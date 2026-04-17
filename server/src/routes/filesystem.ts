import Router from '@koa/router'
import { readdir, readFile, stat, writeFile, mkdir, copyFile } from 'fs/promises'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { promisify } from 'util'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

// --- Auth / Credential Pool ---

interface CredentialPoolEntry {
  id: string
  label: string
  base_url: string
  access_token: string
  last_status?: string | null
}

interface AuthJson {
  credential_pool?: Record<string, CredentialPoolEntry[]>
  providers?: Record<string, any>
}

const authPath = resolve(homedir(), '.hermes', 'auth.json')
const execFileAsync = promisify(execFile)

interface AuthStreamEvent {
  id: string
  timestamp: string
  type: 'switch' | 'snapshot' | 'error' | 'info'
  message: string
  provider?: string
  payload?: Record<string, any>
}

const authEventStream: AuthStreamEvent[] = []

type OAuthFlowStatus = 'pending' | 'authorized' | 'failed' | 'cancelled'

interface OAuthFlowSession {
  id: string
  provider: string
  label: string
  status: OAuthFlowStatus
  created_at: string
  updated_at: string
  verification_url?: string | null
  user_code?: string | null
  logs: string[]
  error?: string | null
  process?: ChildProcessWithoutNullStreams
}

const oauthFlowSessions = new Map<string, OAuthFlowSession>()
const OAUTH_MAX_LOGS = 200

function trimLogs(logs: string[]): string[] {
  if (logs.length <= OAUTH_MAX_LOGS) return logs
  return logs.slice(logs.length - OAUTH_MAX_LOGS)
}

function extractVerificationUrl(line: string): string | null {
  const match = line.match(/https?:\/\/\S+/)
  return match?.[0] || null
}

function extractUserCode(line: string): string | null {
  const match = line.match(/\b[A-Z0-9]{3,}(?:-[A-Z0-9]{2,})+\b|\b[A-Z0-9]{6,}\b/)
  return match?.[0] || null
}

function toIsoTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    // auth.json often stores unix seconds (float)
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms).toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const asNum = Number(trimmed)
    if (Number.isFinite(asNum) && trimmed.match(/^\d+(\.\d+)?$/)) {
      const ms = asNum < 1e12 ? asNum * 1000 : asNum
      return new Date(ms).toISOString()
    }

    const dt = new Date(trimmed)
    if (!Number.isNaN(dt.getTime())) return dt.toISOString()
  }

  return null
}

function decodeJwtExpiresAt(token: unknown): string | null {
  if (typeof token !== 'string' || token.split('.').length !== 3) return null
  try {
    const payloadPart = token.split('.')[1]
    const padded = payloadPart + '='.repeat((4 - (payloadPart.length % 4)) % 4)
    const payloadJson = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    const payload = JSON.parse(payloadJson) as { exp?: number }
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null
    return new Date(payload.exp * 1000).toISOString()
  } catch {
    return null
  }
}

function inferExpiresAt(entry: any): string | null {
  return (
    toIsoTime(entry?.expires_at)
    || decodeJwtExpiresAt(entry?.access_token)
    || null
  )
}

function sortCredentialsByPriority(entries: any[]): any[] {
  return [...entries].sort((a, b) => {
    const pa = Number(a?.priority)
    const pb = Number(b?.priority)
    const wa = Number.isFinite(pa) ? pa : Number.MAX_SAFE_INTEGER
    const wb = Number.isFinite(pb) ? pb : Number.MAX_SAFE_INTEGER
    return wa - wb
  })
}

function appendAuthEvent(event: Omit<AuthStreamEvent, 'id' | 'timestamp'>): void {
  authEventStream.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...event,
  })
  if (authEventStream.length > 200) {
    authEventStream.splice(200)
  }
}

async function loadAuthJson(): Promise<AuthJson | null> {
  try {
    const raw = await readFile(authPath, 'utf-8')
    return JSON.parse(raw) as AuthJson
  } catch {
    return null
  }
}

async function fetchProviderModels(baseUrl: string, apiKey: string): Promise<{ models: string[]; reason?: string }> {
  try {
    const url = baseUrl.replace(/\/+$/, '') + '/models'
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[available-models] ${baseUrl} returned ${res.status}`)
      return { models: [], reason: `http_${res.status}` }
    }
    const data = await res.json() as { data?: Array<{ id: string }> }
    if (!Array.isArray(data.data)) {
      console.error(`[available-models] ${baseUrl} returned unexpected format`)
      return { models: [], reason: 'invalid_response' }
    }
    const models = data.data.map(m => m.id).filter(id => !id.startsWith('hermes')).sort()
    if (models.length === 0) {
      return { models: [], reason: 'empty_model_list' }
    }
    return { models }
  } catch (err: any) {
    console.error(`[available-models] ${baseUrl} failed: ${err.message}`)
    return { models: [], reason: `fetch_failed:${err.message || 'unknown'}` }
  }
}

// Known models per provider (fallback when API doesn't list them)
const KNOWN_MODELS: Record<string, string[]> = {
  nous: [
    'xiaomi/mimo-v2-pro',
    'deepseek-ai/DeepSeek-R1',
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen3-235B-A22B',
    'Qwen/Qwen3-30B-A3B',
    'google/gemma-3-27b-it',
    'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4.6',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/o3-mini',
    'google/gemini-2.5-pro',
    'deepseek/deepseek-r1',
    'deepseek/deepseek-v3',
    'Qwen/Qwen3-235B-A22B',
    'mistralai/Mistral-Large-Instruct-2411',
    'amazon/Nova-Pro-v1:0',
    'ai21/jamba-large-1.7',
    'aion-labs/aion-1.0',
    'aion-labs/aion-2.0',
  ],
  openrouter: [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4.6',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/o3-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-r1',
    'deepseek/deepseek-v3',
    'meta-llama/llama-4-maverick',
    'qwen/qwen-2.5-72b-instruct',
  ],
  'openai-codex': [
    'gpt-5.3-codex',
    'gpt-5.4-codex',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250701',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
}

const PROVIDER_ALIAS: Record<string, string> = {
  openai: 'openai-codex',
}

function normalizeProvider(provider?: string): string {
  if (!provider) return ''
  return PROVIDER_ALIAS[provider] || provider
}

function normalizeModelForProvider(provider: string, model: string): string {
  if (provider !== 'openai-codex') return model
  const known = KNOWN_MODELS['openai-codex'] || []
  return known.includes(model) ? model : 'gpt-5.3-codex'
}

export const fsRoutes = new Router()

const hermesDir = resolve(homedir(), '.hermes')

// --- Types ---

interface SkillInfo {
  name: string
  description: string
}

interface SkillCategory {
  name: string
  description: string
  skills: SkillInfo[]
}

// --- Helpers ---

function extractDescription(content: string): string {
  // SKILL.md format: YAML frontmatter between --- delimiters, then markdown body
  // Extract first non-empty, non-frontmatter, non-heading line as description
  const lines = content.split('\n')
  let inFrontmatter = false
  let bodyStarted = false

  for (const line of lines) {
    if (!bodyStarted && line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true
        continue
      } else {
        inFrontmatter = false
        bodyStarted = true
        continue
      }
    }
    if (inFrontmatter) continue
    if (line.trim() === '') continue
    if (line.startsWith('#')) continue
    // Return first meaningful line, truncated
    return line.trim().slice(0, 80)
  }
  return ''
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

async function safeStat(filePath: string): Promise<{ mtime: number } | null> {
  try {
    const s = await stat(filePath)
    return { mtime: Math.round(s.mtimeMs) }
  } catch {
    return null
  }
}

// --- Skills Routes ---

// List all skills grouped by category
fsRoutes.get('/api/skills', async (ctx) => {
  const skillsDir = join(hermesDir, 'skills')

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true })
    const categories: SkillCategory[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue

      const catDir = join(skillsDir, entry.name)
      const catDesc = await safeReadFile(join(catDir, 'DESCRIPTION.md'))
      const catDescription = catDesc ? catDesc.trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 100) : ''

      const skillEntries = await readdir(catDir, { withFileTypes: true })
      const skills: SkillInfo[] = []

      for (const se of skillEntries) {
        if (!se.isDirectory()) continue
        const skillMd = await safeReadFile(join(catDir, se.name, 'SKILL.md'))
        if (skillMd) {
          skills.push({
            name: se.name,
            description: extractDescription(skillMd),
          })
        }
      }

      if (skills.length > 0) {
        categories.push({ name: entry.name, description: catDescription, skills })
      }
    }

    // Sort categories alphabetically
    categories.sort((a, b) => a.name.localeCompare(b.name))
    for (const cat of categories) {
      cat.skills.sort((a, b) => a.name.localeCompare(b.name))
    }

    ctx.body = { categories }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: `Failed to read skills directory: ${err.message}` }
  }
})

// List files in a skill directory (for references/templates/scripts)
// Must be registered before the wildcard route
async function listFilesRecursive(dir: string, prefix: string): Promise<{ path: string; name: string }[]> {
  const result: { path: string; name: string }[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      result.push(...await listFilesRecursive(join(dir, entry.name), relPath))
    } else {
      result.push({ path: relPath, name: entry.name })
    }
  }
  return result
}

fsRoutes.get('/api/skills/:category/:skill/files', async (ctx) => {
  const { category, skill } = ctx.params
  const skillDir = join(hermesDir, 'skills', category, skill)

  try {
    const allFiles = await listFilesRecursive(skillDir, '')
    const files = allFiles.filter(f => f.path !== 'SKILL.md')
    ctx.body = { files }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// Read a specific file under skills/
fsRoutes.get('/api/skills/:path(.+)', async (ctx) => {
  const filePath = ctx.params.path
  const fullPath = resolve(join(hermesDir, 'skills', filePath))

  // Security: ensure path stays within skills directory
  if (!fullPath.startsWith(join(hermesDir, 'skills'))) {
    ctx.status = 403
    ctx.body = { error: 'Access denied' }
    return
  }

  const content = await safeReadFile(fullPath)
  if (content === null) {
    ctx.status = 404
    ctx.body = { error: 'File not found' }
    return
  }

  ctx.body = { content }
})

// --- Memory Routes ---

// Read MEMORY.md and USER.md
fsRoutes.get('/api/memory', async (ctx) => {
  const memoryPath = join(hermesDir, 'memories', 'MEMORY.md')
  const userPath = join(hermesDir, 'memories', 'USER.md')

  const [memory, user, memoryStat, userStat] = await Promise.all([
    safeReadFile(memoryPath),
    safeReadFile(userPath),
    safeStat(memoryPath),
    safeStat(userPath),
  ])

  ctx.body = {
    memory: memory || '',
    user: user || '',
    memory_mtime: memoryStat?.mtime || null,
    user_mtime: userStat?.mtime || null,
  }
})

// Write MEMORY.md or USER.md
fsRoutes.post('/api/memory', async (ctx) => {
  const { section, content } = ctx.request.body as { section: string; content: string }

  if (!section || !content) {
    ctx.status = 400
    ctx.body = { error: 'Missing section or content' }
    return
  }

  if (section !== 'memory' && section !== 'user') {
    ctx.status = 400
    ctx.body = { error: 'Section must be "memory" or "user"' }
    return
  }

  const fileName = section === 'memory' ? 'MEMORY.md' : 'USER.md'
  const filePath = join(hermesDir, 'memories', fileName)

  try {
    await writeFile(filePath, content, 'utf-8')
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// --- Config Model Routes ---

const configPath = resolve(homedir(), '.hermes/config.yaml')

interface ModelInfo {
  id: string
  label: string
}

interface ModelGroup {
  provider: string
  models: ModelInfo[]
}

// Build model list from user's actual config.yaml configuration
// Only shows models the user has explicitly configured, not entire provider catalogs
function buildModelGroups(yaml: string): { default: string; groups: ModelGroup[] } {
  let defaultModel = ''
  let defaultProvider = ''
  const groups: ModelGroup[] = []
  const allModelIds = new Set<string>()

  // 1. Extract current model from `model:` section
  const defaultMatch = yaml.match(/^model:\s*\n\s+default:\s*(.+)/m)
  if (defaultMatch) defaultModel = defaultMatch[1].trim()
  const providerMatch = yaml.match(/^model:\s*\n(?:.*\n)*?\s+provider:\s*(.+)/m)
  if (providerMatch) defaultProvider = providerMatch[1].trim()

  // 2. Extract providers: section (user-defined endpoints)
  const providersSection = yaml.match(/^providers:\s*\n((?:  .+\n(?:    .+\n)*)*)/m)
  if (providersSection) {
    const entries = providersSection[1].match(/^  (\S+):\s*\n((?:    .+\n)*)/gm)
    if (entries) {
      for (const entry of entries) {
        const nameMatch = entry.match(/^  (\S+):/)
        const baseUrlMatch = entry.match(/base_url:\s*(.+)/)
        const name = nameMatch?.[1]?.trim()
        if (name) {
          // Provider entry itself — mark as available but don't add model yet
          // (it's an endpoint the user can switch to, models are fetched at runtime)
        }
      }
    }
  }

  // 3. Extract custom_providers: section
  const customSection = yaml.match(/^custom_providers:\s*\n((?:\s*- .+\n(?:  .+\n)*)*)/m)
  if (customSection) {
    const entryBlocks = customSection[1].match(/\s*- name:\s*(.+)\n((?:  .+\n)*)/g)
    if (entryBlocks) {
      const customModels: ModelInfo[] = []
      for (const block of entryBlocks) {
        const cName = block.match(/name:\s*(.+)/)?.[1]?.trim()
        const cModel = block.match(/model:\s*(.+)/)?.[1]?.trim()
        if (cName && cModel) {
          customModels.push({ id: cModel, label: `${cName}: ${cModel}` })
          allModelIds.add(cModel)
        }
      }
      if (customModels.length > 0) {
        groups.push({ provider: 'Custom', models: customModels })
      }
    }
  }

  // 4. Add current default model (if not already in custom_providers)
  if (defaultModel && !allModelIds.has(defaultModel)) {
    groups.unshift({ provider: 'Current', models: [{ id: defaultModel, label: defaultModel }] })
  }

  return { default: defaultModel, groups }
}

// GET /api/available-models — fetch models from all credential pool endpoints
fsRoutes.get('/api/available-models', async (ctx) => {
  try {
    const auth = await loadAuthJson()
    const pool = auth?.credential_pool || {}

    // Read current default model from config.yaml
    const yaml = await safeReadFile(configPath) || ''
    const defaultMatch = yaml.match(/^model:\s*\n\s+default:\s*(.+)/m)
    const currentDefault = defaultMatch?.[1]?.trim() || ''

    // Collect unique endpoints from credential pool
    const endpoints: Array<{ key: string; label: string; base_url: string; token: string }> = []
    const unavailableGroups: Array<{ provider: string; label: string; base_url: string; models: string[]; reason: string }> = []
    const seenUrls = new Set<string>()
    const seenUnavailable = new Set<string>()

    const pushUnavailable = (provider: string, label: string, baseUrl: string, reason: string) => {
      const key = `${provider}::${baseUrl}::${reason}`
      if (seenUnavailable.has(key)) return
      seenUnavailable.add(key)
      unavailableGroups.push({
        provider,
        label,
        base_url: baseUrl,
        models: KNOWN_MODELS[provider] || [],
        reason,
      })
    }

    for (const [providerKey, entries] of Object.entries(pool)) {
      if (!Array.isArray(entries) || entries.length === 0) continue

      const sortedEntries = sortCredentialsByPriority(entries as any[])
      const nonExhausted = sortedEntries.find(e => e.last_status !== 'exhausted')
      if (!nonExhausted) {
        const exhaustedEntry = sortedEntries[0] as any
        pushUnavailable(providerKey, providerKey.replace(/^custom:/, '') || exhaustedEntry?.label || providerKey, exhaustedEntry?.base_url || '', 'all_credentials_exhausted')
        continue
      }

      const entry = nonExhausted as any
      if (!entry?.base_url) {
        pushUnavailable(providerKey, providerKey.replace(/^custom:/, '') || entry?.label || providerKey, '', 'missing_base_url')
        continue
      }
      // Support both access_token and agent_key
      const token = entry.access_token || entry.agent_key || ''
      if (!token) {
        pushUnavailable(providerKey, providerKey.replace(/^custom:/, '') || entry?.label || providerKey, entry.base_url, 'missing_token')
        continue
      }
      const baseUrl = entry.base_url.replace(/\/+$/, '')
      if (seenUrls.has(baseUrl)) continue
      seenUrls.add(baseUrl)
      endpoints.push({
        key: providerKey,
        label: providerKey.replace(/^custom:/, '') || entry.label || baseUrl,
        base_url: baseUrl,
        token,
      })
    }

    // Also check top-level providers in auth.json
    const authProviders = auth?.providers || {}
    for (const [providerKey, info] of Object.entries(authProviders)) {
      if (endpoints.find(e => e.key === providerKey)) continue
      const providerInfo = info as any
      const baseUrl = providerInfo.inference_base_url || ''
      const token = providerInfo.agent_key || ''
      if (!baseUrl) {
        pushUnavailable(providerKey, providerKey, '', 'missing_base_url')
        continue
      }
      if (!token) {
        pushUnavailable(providerKey, providerKey, baseUrl, 'missing_token')
        continue
      }
      const cleanUrl = baseUrl.replace(/\/+$/, '')
      if (seenUrls.has(cleanUrl)) continue
      seenUrls.add(cleanUrl)
      endpoints.push({
        key: providerKey,
        label: providerKey,
        base_url: cleanUrl,
        token,
      })
    }

    // Fetch all provider models in parallel
    const results = await Promise.allSettled(
      endpoints.map(async ep => {
        const fetched = await fetchProviderModels(ep.base_url, ep.token)
        return { ...ep, fetched }
      }),
    )

    const groups: Array<{ provider: string; label: string; base_url: string; models: string[] }> = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { key, label, base_url, fetched } = result.value
        if (fetched.models.length > 0) {
          groups.push({ provider: key, label, base_url, models: fetched.models })
        } else {
          pushUnavailable(key, label, base_url, fetched.reason || 'empty_model_list')
        }
      } else {
        console.error(`[available-models] Failed: ${result.reason?.message || result.reason}`)
      }
    }

    // Fallback: if no providers returned models, use KNOWN_MODELS
    if (groups.length === 0) {
      for (const [providerKey, models] of Object.entries(KNOWN_MODELS)) {
        if (models.length > 0) {
          groups.push({
            provider: providerKey,
            label: providerKey.charAt(0).toUpperCase() + providerKey.slice(1),
            base_url: '',
            models,
          })
        }
      }
      if (groups.length > 0) {
        ctx.body = { default: currentDefault, groups, unavailable_groups: unavailableGroups }
        return
      }
      // Last resort: fall back to config.yaml parsing
      const fallback = buildModelGroups(yaml)
      ctx.body = { ...fallback, unavailable_groups: unavailableGroups }
      return
    }

    ctx.body = { default: currentDefault, groups, unavailable_groups: unavailableGroups }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/auth/credentials — list credential pool entries for account switching
fsRoutes.get('/api/auth/credentials', async (ctx) => {
  try {
    const auth = await loadAuthJson()
    const pool = auth?.credential_pool || {}

    const providers = Object.entries(pool)
      .filter(([, entries]) => Array.isArray(entries) && entries.length > 0)
      .map(([provider, entries]) => {
        const sortedEntries = sortCredentialsByPriority(entries as any[])
        const normalized = sortedEntries.map((entry: any, idx: number) => ({
          index: idx + 1,
          id: entry.id || '',
          label: entry.label || `account-${idx + 1}`,
          auth_type: entry.auth_type || 'unknown',
          source: entry.source || 'unknown',
          priority: Number(entry.priority ?? idx),
          status: entry.last_status || 'ok',
          meta: {
            last_error_code: entry.last_error_code ?? null,
            last_error_message: entry.last_error_message ?? null,
            last_error_reset_at: toIsoTime(entry.last_error_reset_at),
            last_status_at: toIsoTime(entry.last_status_at),
            expires_at: inferExpiresAt(entry),
            last_refresh: toIsoTime(entry.last_refresh),
            base_url: entry.base_url ?? null,
          },
        }))

        return {
          provider,
          activeIndex: normalized.length > 0 ? 1 : 0,
          entries: normalized,
        }
      })

    appendAuthEvent({
      type: 'snapshot',
      message: `Fetched auth credentials (${providers.length} providers)`,
      payload: {
        providers: providers.map((p: any) => ({ provider: p.provider, entries: p.entries.length })),
      },
    })

    ctx.body = { providers }
  } catch (err: any) {
    appendAuthEvent({
      type: 'error',
      message: 'Failed to load auth credentials',
      payload: { error: err?.message || 'unknown error' },
    })
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/auth/stream — latest auth switch/snapshot metadata events
fsRoutes.get('/api/auth/stream', async (ctx) => {
  const limitRaw = Number(ctx.query.limit || 30)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 30
  ctx.body = { events: authEventStream.slice(0, limit) }
})

// POST /api/auth/switch — switch active credential by index/id/label
fsRoutes.post('/api/auth/switch', async (ctx) => {
  const body = (ctx.request.body || {}) as { provider?: string; target?: string | number }
  const provider = String(body.provider || '').trim()
  const target = body.target

  if (!provider || target === undefined || target === null || String(target).trim() === '') {
    ctx.status = 400
    ctx.body = { error: 'Missing provider or target' }
    return
  }

  try {
    const { stdout, stderr } = await execFileAsync('hermes', ['auth', 'use', provider, String(target)], {
      timeout: 15000,
    })
    const output = (stdout || stderr || '').trim()
    appendAuthEvent({
      type: 'switch',
      provider,
      message: `Switched credential for ${provider} -> ${String(target)}`,
      payload: {
        provider,
        target: String(target),
        output,
      },
    })
    ctx.body = {
      success: true,
      output,
    }
  } catch (err: any) {
    appendAuthEvent({
      type: 'error',
      provider,
      message: `Switch failed for ${provider}`,
      payload: {
        provider,
        target: String(target),
        error: err?.message || 'Switch failed',
        output: (err?.stdout || err?.stderr || '').toString().trim(),
      },
    })
    ctx.status = 500
    ctx.body = {
      success: false,
      error: err?.message || 'Switch failed',
      output: (err?.stdout || err?.stderr || '').toString().trim(),
    }
  }
})

// POST /api/auth/add — add a new credential without leaving current session
fsRoutes.post('/api/auth/add', async (ctx) => {
  const body = (ctx.request.body || {}) as {
    provider?: string
    label?: string
    api_key?: string
    set_active?: boolean
  }

  const provider = String(body.provider || '').trim()
  const apiKey = String(body.api_key || '').trim()
  const requestedLabel = String(body.label || '').trim()

  if (!provider || !apiKey) {
    ctx.status = 400
    ctx.body = { error: 'Missing provider or api_key' }
    return
  }

  const label = requestedLabel || `webui-${provider}-${Date.now()}`

  try {
    const args = ['auth', 'add', provider, '--type', 'api-key', '--label', label, '--api-key', apiKey]
    const { stdout, stderr } = await execFileAsync('hermes', args, { timeout: 30000, maxBuffer: 1024 * 1024 })

    const redact = (text: string) => text.replaceAll(apiKey, '***')
    const addOutput = redact((stdout || stderr || '').toString().trim())

    let switchOutput = ''
    if (body.set_active !== false) {
      const switched = await execFileAsync('hermes', ['auth', 'use', provider, label], { timeout: 15000, maxBuffer: 1024 * 1024 })
      switchOutput = redact(((switched.stdout || switched.stderr || '') as string).trim())
    }

    appendAuthEvent({
      type: 'switch',
      provider,
      message: `Added credential for ${provider}${body.set_active === false ? '' : ' and switched active account'}`,
      payload: {
        provider,
        label,
        set_active: body.set_active !== false,
      },
    })

    ctx.body = {
      success: true,
      label,
      output: [addOutput, switchOutput].filter(Boolean).join('\n').trim(),
    }
  } catch (err: any) {
    const rawOutput = ((err?.stdout || err?.stderr || '') as string).toString()
    const safeOutput = rawOutput.replaceAll(apiKey, '***').trim()

    appendAuthEvent({
      type: 'error',
      provider,
      message: `Add credential failed for ${provider}`,
      payload: {
        provider,
        label,
        error: err?.message || 'Add credential failed',
        output: safeOutput,
      },
    })

    ctx.status = 500
    ctx.body = {
      success: false,
      error: err?.message || 'Add credential failed',
      output: safeOutput,
    }
  }
})

// POST /api/auth/oauth/start — start OAuth device-code flow and return session id/link
fsRoutes.post('/api/auth/oauth/start', async (ctx) => {
  const body = (ctx.request.body || {}) as { provider?: string; label?: string }
  const provider = String(body.provider || '').trim()
  const requestedLabel = String(body.label || '').trim()

  if (!provider || !['openai-codex', 'nous'].includes(provider)) {
    ctx.status = 400
    ctx.body = { error: 'Unsupported provider. Use openai-codex or nous.' }
    return
  }

  const label = requestedLabel || `webui-${provider}-oauth-${Date.now()}`
  const id = randomUUID()
  const nowIso = new Date().toISOString()

  const session: OAuthFlowSession = {
    id,
    provider,
    label,
    status: 'pending',
    created_at: nowIso,
    updated_at: nowIso,
    verification_url: null,
    user_code: null,
    logs: [],
    error: null,
  }

  oauthFlowSessions.set(id, session)

  const python = '/home/xiao2027/.hermes/hermes-agent/venv/bin/python'
  const script = `
import sys
from types import SimpleNamespace
from hermes_cli.auth_commands import auth_add_command, auth_use_command

provider = sys.argv[1]
label = sys.argv[2]

add_args = SimpleNamespace(
    provider=provider,
    auth_type='oauth',
    label=label,
    api_key=None,
    portal_url=None,
    inference_url=None,
    client_id=None,
    scope=None,
    no_browser=True,
    timeout=15.0,
    insecure=False,
    ca_bundle=None,
    min_key_ttl_seconds=300,
)

use_args = SimpleNamespace(provider=provider, target=label)

auth_add_command(add_args)
auth_use_command(use_args)
print('__HERMES_OAUTH_DONE__', flush=True)
`

  const child = spawn(python, ['-u', '-c', script, provider, label], {
    cwd: resolve(homedir(), '.hermes', 'hermes-agent'),
    env: {
      ...process.env,
      ALL_PROXY: process.env.ALL_PROXY || 'socks5://172.22.192.1:21841',
      HTTP_PROXY: process.env.HTTP_PROXY || 'http://172.22.192.1:21841',
      HTTPS_PROXY: process.env.HTTPS_PROXY || 'http://172.22.192.1:21841',
      NO_PROXY: process.env.NO_PROXY || 'localhost,127.0.0.1',
      PATH: `/home/xiao2027/.hermes/hermes-agent/venv/bin:/home/xiao2027/.hermes/hermes-agent:${process.env.PATH || ''}`,
    },
  })

  session.process = child

  const onLine = (raw: string, source: 'stdout' | 'stderr') => {
    const clean = raw.replace(/\u001b\[[0-9;]*m/g, '').trim()
    if (!clean) return

    session.logs = trimLogs([...session.logs, `[${source}] ${clean}`])
    session.updated_at = new Date().toISOString()

    if (!session.verification_url) {
      const url = extractVerificationUrl(clean)
      if (url && (url.includes('codex/device') || url.includes('/device'))) {
        session.verification_url = url
      }
    }

    if (!session.user_code) {
      if (/enter this code|code:/i.test(clean)) {
        const maybeCode = extractUserCode(clean)
        if (maybeCode) session.user_code = maybeCode
      }
    }

    if (!session.user_code && session.logs.length > 1) {
      const maybeCode = extractUserCode(clean)
      if (maybeCode && maybeCode.length >= 6 && maybeCode.length <= 32) {
        session.user_code = maybeCode
      }
    }

    if (clean.includes('__HERMES_OAUTH_DONE__')) {
      session.status = 'authorized'
      session.updated_at = new Date().toISOString()
      appendAuthEvent({
        type: 'switch',
        provider,
        message: `OAuth login succeeded for ${provider} and switched to ${label}`,
        payload: { provider, label, session_id: id },
      })
    }
  }

  child.stdout.on('data', (buf) => {
    String(buf)
      .split(/\r?\n/)
      .forEach((line) => onLine(line, 'stdout'))
  })

  child.stderr.on('data', (buf) => {
    String(buf)
      .split(/\r?\n/)
      .forEach((line) => onLine(line, 'stderr'))
  })

  child.on('error', (err) => {
    session.status = 'failed'
    session.error = err.message
    session.updated_at = new Date().toISOString()
    appendAuthEvent({
      type: 'error',
      provider,
      message: `OAuth process crashed for ${provider}`,
      payload: { provider, label, session_id: id, error: err.message },
    })
  })

  child.on('exit', (code) => {
    session.process = undefined
    if (session.status === 'cancelled') return

    if (code === 0 && session.status !== 'authorized') {
      session.status = 'authorized'
      appendAuthEvent({
        type: 'switch',
        provider,
        message: `OAuth login completed for ${provider}`,
        payload: { provider, label, session_id: id },
      })
      return
    }

    if (code !== 0 && session.status !== 'authorized') {
      session.status = 'failed'
      session.error = session.error || `OAuth process exited with code ${code}`
      appendAuthEvent({
        type: 'error',
        provider,
        message: `OAuth login failed for ${provider}`,
        payload: {
          provider,
          label,
          session_id: id,
          exit_code: code,
          error: session.error,
        },
      })
    }

    session.updated_at = new Date().toISOString()
  })

  ctx.body = {
    success: true,
    session: {
      id: session.id,
      provider: session.provider,
      label: session.label,
      status: session.status,
      verification_url: session.verification_url,
      user_code: session.user_code,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
  }
})

// GET /api/auth/oauth/:id — poll OAuth flow status
fsRoutes.get('/api/auth/oauth/:id', async (ctx) => {
  const id = String(ctx.params.id || '').trim()
  const session = oauthFlowSessions.get(id)
  if (!session) {
    ctx.status = 404
    ctx.body = { error: 'OAuth session not found' }
    return
  }

  const limitRaw = Number(ctx.query.limit || 120)
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.floor(limitRaw))) : 120

  ctx.body = {
    session: {
      id: session.id,
      provider: session.provider,
      label: session.label,
      status: session.status,
      verification_url: session.verification_url,
      user_code: session.user_code,
      created_at: session.created_at,
      updated_at: session.updated_at,
      error: session.error || null,
      logs: session.logs.slice(-limit),
    },
  }
})

// POST /api/auth/oauth/:id/cancel — cancel running OAuth flow
fsRoutes.post('/api/auth/oauth/:id/cancel', async (ctx) => {
  const id = String(ctx.params.id || '').trim()
  const session = oauthFlowSessions.get(id)
  if (!session) {
    ctx.status = 404
    ctx.body = { error: 'OAuth session not found' }
    return
  }

  if (session.process && !session.process.killed) {
    session.process.kill('SIGTERM')
  }

  session.status = 'cancelled'
  session.updated_at = new Date().toISOString()

  appendAuthEvent({
    type: 'info',
    provider: session.provider,
    message: `OAuth flow cancelled for ${session.provider}`,
    payload: { session_id: session.id, provider: session.provider, label: session.label },
  })

  ctx.body = { success: true }
})

// GET /api/config/models
fsRoutes.get('/api/config/models', async (ctx) => {
  try {
    const yaml = await safeReadFile(configPath)
    ctx.body = yaml ? buildModelGroups(yaml) : { default: '', groups: [] }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// PUT /api/config/model
fsRoutes.put('/api/config/model', async (ctx) => {
  const { default: defaultModel, provider: reqProvider } = ctx.request.body as {
    default: string
    provider?: string
  }

  if (!defaultModel) {
    ctx.status = 400
    ctx.body = { error: 'Missing default model' }
    return
  }

  try {
    await copyFile(configPath, configPath + '.bak')
    let yaml = await safeReadFile(configPath) || ''

    // Rebuild the model: block
    const modelBlockMatch = yaml.match(/^(model:\s*\n(?:  .+\n)*)/m)
    if (modelBlockMatch) {
      const lines = [`model:`, `  default: ${defaultModel}`]

      if (reqProvider) {
        // Provider from credential pool key (e.g. "zai" or "custom:subrouter.ai")
        // Hermes resolves base_url/api_key from auth.json automatically
        lines.push(`  provider: ${reqProvider}`)
      }

      yaml = yaml.replace(modelBlockMatch[1], lines.join('\n') + '\n')
    }

    await writeFile(configPath, yaml, 'utf-8')
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/config/providers
fsRoutes.post('/api/config/providers', async (ctx) => {
  const { name, base_url, api_key, model } = ctx.request.body as {
    name: string
    base_url: string
    api_key: string
    model: string
  }

  if (!name || !base_url || !model) {
    ctx.status = 400
    ctx.body = { error: 'Missing name, base_url, or model' }
    return
  }

  try {
    await copyFile(configPath, configPath + '.bak')
    let yaml = await safeReadFile(configPath) || ''

    const newEntry = `- name: ${name}\n  base_url: ${base_url}\n  api_key: ${api_key || ''}\n  model: ${model}\n`

    if (/^custom_providers:/m.test(yaml)) {
      yaml = yaml.replace(/^(custom_providers:)/m, `$1\n${newEntry}`)
    } else {
      yaml = yaml.trimEnd() + `\n\ncustom_providers:\n${newEntry}\n`
    }

    await writeFile(configPath, yaml, 'utf-8')
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// DELETE /api/config/providers/:name
fsRoutes.delete('/api/config/providers/:name', async (ctx) => {
  const name = ctx.params.name

  try {
    await copyFile(configPath, configPath + '.bak')
    let yaml = await safeReadFile(configPath) || ''

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const blockRegex = new RegExp(`  - name:\\s*${escaped}\\s*\\n(?:    .+\\n)*`, 'g')
    yaml = yaml.replace(blockRegex, '')

    await writeFile(configPath, yaml, 'utf-8')
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})
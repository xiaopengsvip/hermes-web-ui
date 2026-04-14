import Router from '@koa/router'
import { chmod, readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { config } from '../config'

export const configCenterRoutes = new Router()

export interface ConfigCenterState {
  profile: {
    relayBaseUrl: string
    relayHealthPath: string
    workerEnabled: boolean
    workerRoute: string
  }
  platforms: {
    githubOwner: string
    githubRepo: string
    vercelProjectId: string
    cloudflareZoneId: string
  }
  secrets: {
    githubToken: string
    vercelToken: string
    cloudflareToken: string
    relayApiKey: string
    hermesApiKey: string
  }
  audit: {
    enabled: boolean
    dailyHour: number
    autoFix: boolean
  }
  updatedAt: number
}

const configPath = resolve(config.dataDir, 'config-center.json')

const defaults: ConfigCenterState = {
  profile: {
    relayBaseUrl: '',
    relayHealthPath: '/health',
    workerEnabled: true,
    workerRoute: '/relay',
  },
  platforms: {
    githubOwner: 'xiaopengsvip',
    githubRepo: 'hermes-web-ui',
    vercelProjectId: '',
    cloudflareZoneId: '',
  },
  secrets: {
    githubToken: '',
    vercelToken: '',
    cloudflareToken: '',
    relayApiKey: '',
    hermesApiKey: '',
  },
  audit: {
    enabled: true,
    dailyHour: 3,
    autoFix: true,
  },
  updatedAt: 0,
}

function maskSecret(secret: string) {
  if (!secret) return ''
  if (secret.length <= 8) return '*'.repeat(secret.length)
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`
}

function mergeState(base: ConfigCenterState, patch: Partial<ConfigCenterState>): ConfigCenterState {
  const next = {
    ...base,
    ...patch,
    profile: { ...base.profile, ...(patch.profile || {}) },
    platforms: { ...base.platforms, ...(patch.platforms || {}) },
    audit: { ...base.audit, ...(patch.audit || {}) },
    secrets: { ...base.secrets },
    updatedAt: Date.now(),
  }

  if (patch.secrets) {
    for (const key of Object.keys(base.secrets) as Array<keyof ConfigCenterState['secrets']>) {
      const value = patch.secrets[key]
      if (typeof value === 'string') {
        if (value === '__CLEAR__') next.secrets[key] = ''
        else if (value !== '') next.secrets[key] = value
      }
    }
  }

  return next
}

async function loadRawConfig(): Promise<ConfigCenterState> {
  try {
    const raw = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw || '{}')
    return mergeState(defaults, parsed)
  } catch {
    return { ...defaults }
  }
}

async function saveRawConfig(state: ConfigCenterState) {
  await writeFile(configPath, JSON.stringify(state, null, 2), 'utf-8')
  try {
    await chmod(configPath, 0o600)
  } catch {
    // ignore chmod failures on unsupported fs
  }
}

export async function loadConfigCenterState() {
  return loadRawConfig()
}

function toPublicState(state: ConfigCenterState) {
  return {
    ...state,
    secrets: {
      githubToken: maskSecret(state.secrets.githubToken),
      vercelToken: maskSecret(state.secrets.vercelToken),
      cloudflareToken: maskSecret(state.secrets.cloudflareToken),
      relayApiKey: maskSecret(state.secrets.relayApiKey),
      hermesApiKey: maskSecret(state.secrets.hermesApiKey),
    },
    secretsConfigured: {
      githubToken: !!state.secrets.githubToken,
      vercelToken: !!state.secrets.vercelToken,
      cloudflareToken: !!state.secrets.cloudflareToken,
      relayApiKey: !!state.secrets.relayApiKey,
      hermesApiKey: !!state.secrets.hermesApiKey,
    },
  }
}

configCenterRoutes.get('/api/config-center', async (ctx) => {
  const raw = await loadRawConfig()
  ctx.body = toPublicState(raw)
})

configCenterRoutes.post('/api/config-center', async (ctx) => {
  const body = (ctx.request.body || {}) as Partial<ConfigCenterState>
  const current = await loadRawConfig()
  const next = mergeState(current, body)
  await saveRawConfig(next)
  ctx.body = {
    ok: true,
    config: toPublicState(next),
  }
})

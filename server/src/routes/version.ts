import Router from '@koa/router'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { config } from '../config'

const execFileAsync = promisify(execFile)

export const versionRoutes = new Router()

interface FeatureItem {
  name: string
  description: string
  category: string
  endpoints?: string[]
}

// Collect all info in parallel
async function gatherVersionInfo() {
  const rootDir = resolve(__dirname, '..', '..', '..')

  // Read package.json
  let pkg: any = {}
  try {
    const raw = await readFile(resolve(rootDir, 'package.json'), 'utf-8')
    pkg = JSON.parse(raw)
  } catch { /* ignore */ }

  // Hermes version
  let hermesVersion = 'not installed'
  try {
    const { stdout } = await execFileAsync('hermes', ['--version'], { timeout: 5000 })
    hermesVersion = stdout.trim().replace('Hermes Agent ', '') || 'unknown'
  } catch { /* ignore */ }

  // Gateway status
  let gatewayStatus = 'unknown'
  try {
    const { stdout } = await execFileAsync('hermes', ['gateway', 'status'], { timeout: 8000 })
    gatewayStatus = stdout.trim().includes('running') ? 'running' : 'stopped'
  } catch { gatewayStatus = 'error' }

  // Node.js version
  const nodeVersion = process.version
  const platform = process.platform
  const arch = process.arch

  // Uptime
  const uptimeSeconds = Math.round(process.uptime())

  // Upstream health
  let upstreamStatus = 'unknown'
  let upstreamVersion = ''
  try {
    const res = await fetch(`${config.upstream}/health`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json() as any
      upstreamStatus = 'running'
      upstreamVersion = data.version || ''
    } else {
      upstreamStatus = 'error'
    }
  } catch {
    upstreamStatus = 'stopped'
  }

  // Feature list
  const features: FeatureItem[] = [
    {
      name: 'Chat',
      description: 'Interactive conversation with AI agent, session management, streaming responses',
      category: 'Core',
      endpoints: ['POST /v1/chat/completions', 'GET /api/sessions', 'DELETE /api/sessions/:id'],
    },
    {
      name: 'Jobs / Cron',
      description: 'Scheduled task management with cron expressions, pause/resume/delete',
      category: 'Core',
      endpoints: ['GET /api/jobs', 'POST /api/jobs', 'PUT /api/jobs/:id', 'DELETE /api/jobs/:id'],
    },
    {
      name: 'Materials',
      description: 'File upload, download, preview, drag-and-drop management',
      category: 'Core',
      endpoints: ['POST /upload', 'GET /api/materials'],
    },
    {
      name: 'Skills',
      description: 'Browse and manage agent skills with SKILL.md editor',
      category: 'Core',
      endpoints: ['GET /api/skills', 'GET /api/skills/:name'],
    },
    {
      name: 'Memory',
      description: 'Agent persistent memory — notes and user profile across sessions',
      category: 'Core',
      endpoints: ['GET /api/memory', 'PUT /api/memory'],
    },
    {
      name: 'Audit Logs',
      description: 'Operation audit trail with action filtering and statistics',
      category: 'Monitoring',
      endpoints: ['GET /api/audit'],
    },
    {
      name: 'Reports',
      description: 'Daily/weekly/monthly activity reports and metrics',
      category: 'Monitoring',
      endpoints: ['GET /api/reports'],
    },
    {
      name: 'Logs',
      description: 'System and agent log viewer with level filtering',
      category: 'Monitoring',
      endpoints: ['GET /api/logs'],
    },
    {
      name: 'Services',
      description: 'Service status monitoring, gateway control (start/restart/stop), active sessions',
      category: 'System',
      endpoints: ['GET /api/system/status', 'POST /api/system/wake', 'POST /api/system/gateway/restart', 'POST /api/system/gateway/stop', 'GET /api/system/processes', 'GET /api/system/sessions/active'],
    },
    {
      name: 'GitHub',
      description: 'Repository management, file browsing, commit history',
      category: 'Integration',
      endpoints: ['GET /api/github/repos', 'GET /api/github/repos/:owner/:repo/contents'],
    },
    {
      name: 'Vercel',
      description: 'Project deployment, domain management, deploy history',
      category: 'Integration',
      endpoints: ['GET /api/vercel/projects', 'POST /api/vercel/deployments'],
    },
    {
      name: 'Webhook',
      description: 'Incoming webhook handler for external integrations',
      category: 'Integration',
      endpoints: ['POST /webhook'],
    },
    {
      name: 'File System',
      description: 'Server-side file browsing and management',
      category: 'System',
      endpoints: ['GET /api/fs/ls', 'GET /api/fs/cat'],
    },
    {
      name: 'Theme System',
      description: '6 built-in themes: Liquid Glass, Pure Ink, Ocean Blue, Forest Green, Sunset Orange, Midnight Purple',
      category: 'UI',
    },
    {
      name: 'i18n',
      description: 'Internationalization — Chinese (zh-CN) and English (en-US)',
      category: 'UI',
    },
    {
      name: 'Liquid Glass Design',
      description: 'Glass morphism with backdrop-filter blur, gradient accents, responsive layout',
      category: 'UI',
    },
    {
      name: 'Model Selector',
      description: 'Switch between AI models from credential pool, provider-aware routing',
      category: 'Core',
      endpoints: ['GET /api/available-models', 'PUT /api/config/model'],
    },
    {
      name: 'Settings',
      description: 'API configuration, model management, stream toggle, session persistence',
      category: 'Core',
      endpoints: ['GET /api/config', 'PUT /api/config'],
    },
  ]

  // Backend routes
  const backendRoutes = [
    { method: 'GET', path: '/health', desc: 'Health check with version' },
    { method: 'GET', path: '/api/system/status', desc: 'Comprehensive system status' },
    { method: 'POST', path: '/api/system/wake', desc: 'Start gateway' },
    { method: 'POST', path: '/api/system/gateway/restart', desc: 'Restart gateway' },
    { method: 'POST', path: '/api/system/gateway/stop', desc: 'Stop gateway' },
    { method: 'GET', path: '/api/system/processes', desc: 'List hermes processes' },
    { method: 'GET', path: '/api/system/sessions/active', desc: 'Active sessions' },
    { method: 'GET', path: '/api/version', desc: 'Version and feature info' },
  ]

  // Dependencies
  const dependencies = Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
    name,
    version: (version as string).replace(/^[\^~]/, ''),
  }))
  const devDependencies = Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
    name,
    version: (version as string).replace(/^[\^~]/, ''),
  }))

  // Group features by category
  const categories: Record<string, FeatureItem[]> = {}
  for (const f of features) {
    if (!categories[f.category]) categories[f.category] = []
    categories[f.category].push(f)
  }

  return {
    web_ui: {
      name: pkg.name || 'hermes-web-ui',
      version: pkg.version || '0.0.0',
      description: pkg.description || '',
      license: pkg.license || 'MIT',
      repository: pkg.repository?.url || '',
    },
    hermes: {
      version: hermesVersion,
      gateway_status: gatewayStatus,
    },
    upstream: {
      url: config.upstream,
      status: upstreamStatus,
      version: upstreamVersion,
    },
    runtime: {
      node: nodeVersion,
      platform,
      arch,
      pid: process.pid,
      uptime_seconds: uptimeSeconds,
      uptime_human: formatUptime(uptimeSeconds),
    },
    server: {
      port: config.port,
      cors_origins: config.corsOrigins,
      upload_dir: config.uploadDir,
    },
    features: {
      total: features.length,
      categories,
      list: features,
    },
    backend_routes: backendRoutes,
    dependencies,
    dev_dependencies: devDependencies,
    timestamp: new Date().toISOString(),
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}h ${m}m ${s}s`
}

// GET /api/version
versionRoutes.get('/api/version', async (ctx) => {
  try {
    ctx.body = await gatherVersionInfo()
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

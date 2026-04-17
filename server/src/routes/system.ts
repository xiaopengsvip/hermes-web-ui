import Router from '@koa/router'
import { execFile, exec, spawn } from 'child_process'
import { promisify } from 'util'
import { readFile, readdir, writeFile, appendFile } from 'fs/promises'
import { resolve, join } from 'path'
import { homedir } from 'os'
import { config } from '../config'

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)

export const systemRoutes = new Router()

interface ServiceStatus {
  name: string
  status: 'running' | 'stopped' | 'error' | 'unknown'
  pid?: number
  uptime?: string
  details?: string
  type: 'hermes' | 'gateway' | 'web-ui' | 'agent' | 'dashboard' | 'other'
}

interface DashboardStatusInfo {
  running: boolean
  port: number
  host: string
  url: string
  status: 'running' | 'stopped'
  pid?: number
  details?: string
}

interface SystemInfo {
  services: ServiceStatus[]
  hermes_version: string
  gateway_status: string
  active_sessions: number
  active_children: number
  uptime: number
  timestamp: number
  dashboard: DashboardStatusInfo
}

interface CloudflareTunnelState {
  running: boolean
  pid?: number
  target_url: string
  public_url?: string
  status: 'running' | 'stopped' | 'error'
  updated_at: string
  started_at?: string
  error?: string
}

const tunnelStatePath = resolve(config.dataDir, 'cloudflare-tunnel-state.json')
const tunnelLogPath = resolve(config.dataDir, 'cloudflare-tunnel.log')
const DEFAULT_TUNNEL_TARGET = `http://127.0.0.1:${config.port}`
let tunnelProcess: ReturnType<typeof spawn> | null = null

function createDefaultTunnelState(): CloudflareTunnelState {
  return {
    running: false,
    status: 'stopped',
    target_url: DEFAULT_TUNNEL_TARGET,
    updated_at: new Date().toISOString(),
  }
}

async function loadTunnelState(): Promise<CloudflareTunnelState> {
  try {
    const raw = await readFile(tunnelStatePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<CloudflareTunnelState>
    return {
      ...createDefaultTunnelState(),
      ...parsed,
    }
  } catch {
    return createDefaultTunnelState()
  }
}

async function saveTunnelState(next: CloudflareTunnelState): Promise<void> {
  await writeFile(tunnelStatePath, JSON.stringify(next, null, 2), 'utf-8')
}

function isPidRunning(pid?: number): boolean {
  if (!pid || !Number.isFinite(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function ensureCloudflaredAvailable(): Promise<void> {
  await execFileAsync('cloudflared', ['--version'], { timeout: 5000 })
}

function extractTunnelUrl(line: string): string | null {
  const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
  return match?.[0] || null
}

async function appendTunnelLog(line: string): Promise<void> {
  if (!line.trim()) return
  const text = `[${new Date().toISOString()}] ${line}\n`
  await appendFile(tunnelLogPath, text, 'utf-8').catch(() => undefined)
}

async function getTunnelStatus(): Promise<CloudflareTunnelState> {
  const current = await loadTunnelState()
  const runningByPid = isPidRunning(current.pid)
  if (!runningByPid && current.running) {
    const next = {
      ...current,
      running: false,
      status: 'stopped' as const,
      pid: undefined,
      updated_at: new Date().toISOString(),
    }
    await saveTunnelState(next)
    return next
  }

  return {
    ...current,
    running: runningByPid,
    status: runningByPid ? 'running' : current.status,
  }
}

async function stopCloudflareTunnelInternal(): Promise<CloudflareTunnelState> {
  const current = await loadTunnelState()

  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM')
  }

  if (isPidRunning(current.pid)) {
    try {
      process.kill(current.pid!, 'SIGTERM')
    } catch {
      // ignore
    }
  }

  const next: CloudflareTunnelState = {
    ...current,
    running: false,
    status: 'stopped',
    pid: undefined,
    updated_at: new Date().toISOString(),
  }

  tunnelProcess = null
  await saveTunnelState(next)
  await appendTunnelLog('cloudflared tunnel stopped')
  return next
}

async function startCloudflareTunnel(targetUrl: string): Promise<CloudflareTunnelState> {
  const current = await getTunnelStatus()
  if (current.running && current.pid) return current

  await ensureCloudflaredAvailable()

  const child = spawn('cloudflared', ['tunnel', '--url', targetUrl], {
    env: process.env,
    cwd: homedir(),
  })

  const next: CloudflareTunnelState = {
    ...current,
    running: true,
    status: 'running',
    pid: child.pid,
    target_url: targetUrl,
    updated_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    error: undefined,
  }

  tunnelProcess = child
  await saveTunnelState(next)
  await appendTunnelLog(`cloudflared tunnel starting -> ${targetUrl}`)

  const onLine = async (raw: string, source: 'stdout' | 'stderr') => {
    const line = raw.trim()
    if (!line) return
    await appendTunnelLog(`[${source}] ${line}`)
    const url = extractTunnelUrl(line)
    if (url) {
      const latest = await loadTunnelState()
      const updated: CloudflareTunnelState = {
        ...latest,
        running: true,
        status: 'running',
        pid: child.pid,
        target_url: targetUrl,
        public_url: url,
        updated_at: new Date().toISOString(),
      }
      await saveTunnelState(updated)
    }
  }

  child.stdout.on('data', (buf) => {
    String(buf).split(/\r?\n/).forEach((line) => { void onLine(line, 'stdout') })
  })
  child.stderr.on('data', (buf) => {
    String(buf).split(/\r?\n/).forEach((line) => { void onLine(line, 'stderr') })
  })

  child.on('exit', async (code, signal) => {
    const latest = await loadTunnelState()
    const updated: CloudflareTunnelState = {
      ...latest,
      running: false,
      status: code === 0 ? 'stopped' : 'error',
      pid: undefined,
      updated_at: new Date().toISOString(),
      error: code === 0 ? undefined : `cloudflared exited (code=${code}, signal=${signal || 'none'})`,
    }
    tunnelProcess = null
    await saveTunnelState(updated)
    await appendTunnelLog(updated.error || 'cloudflared tunnel exited normally')
  })

  const startWaitMs = 7000
  const startAt = Date.now()
  while (Date.now() - startAt < startWaitMs) {
    const latest = await loadTunnelState()
    if (latest.public_url) return latest
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return loadTunnelState()
}

async function checkProcess(pattern: string): Promise<{ running: boolean; pid?: number }> {
  try {
    const { stdout } = await execAsync(`pgrep -f "${pattern}" | head -1`, { timeout: 5000 })
    const pid = parseInt(stdout.trim())
    return { running: !isNaN(pid), pid: isNaN(pid) ? undefined : pid }
  } catch {
    return { running: false }
  }
}

async function getProcessUptime(pid: number): Promise<string> {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o etime= 2>/dev/null`, { timeout: 5000 })
    return stdout.trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

async function getHermesVersion(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('hermes', ['--version'], { timeout: 5000 })
    return stdout.trim().replace('Hermes Agent ', '') || 'unknown'
  } catch {
    return 'not installed'
  }
}

async function getGatewayStatus(): Promise<{ status: string; details: string }> {
  try {
    const { stdout } = await execFileAsync('hermes', ['gateway', 'status'], { timeout: 10000 })
    const output = stdout.trim()
    if (output.includes('running') || output.includes('active')) {
      return { status: 'running', details: output }
    }
    return { status: 'stopped', details: output }
  } catch (err: any) {
    return { status: 'error', details: err.message }
  }
}

async function getHermesChildren(): Promise<Array<{ pid: number; command: string; elapsed: string }>> {
  try {
    // Find child processes of hermes gateway/agent
    const { stdout } = await execAsync(
      `ps aux | grep -E "hermes|run_agent|delegate" | grep -v grep | head -20`,
      { timeout: 5000 }
    )
    const children: Array<{ pid: number; command: string; elapsed: string }> = []
    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 11) {
        children.push({
          pid: parseInt(parts[1]),
          elapsed: parts[9],
          command: parts.slice(10).join(' ').slice(0, 100),
        })
      }
    }
    return children
  } catch {
    return []
  }
}

async function getActiveSessions(): Promise<number> {
  try {
    const { stdout } = await execFileAsync('hermes', ['sessions', 'export', '-', '--active'], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000,
    })
    return stdout.trim().split('\n').filter(Boolean).length
  } catch {
    return 0
  }
}

async function getDashboardStatus(): Promise<DashboardStatusInfo> {
  const host = '127.0.0.1'
  const port = 9119
  const url = `http://${host}:${port}`

  let running = false
  let pid: number | undefined

  try {
    const proc = await checkProcess('hermes dashboard')
    if (proc.running) {
      running = true
      pid = proc.pid
    }
  } catch {
    // ignore
  }

  if (!running) {
    try {
      const res = await fetch(`${url}/`, {
        signal: AbortSignal.timeout(1500),
      })
      running = res.ok
    } catch {
      running = false
    }
  }

  return {
    running,
    port,
    host,
    url,
    status: running ? 'running' : 'stopped',
    pid,
    details: running ? `${host}:${port}` : 'not running',
  }
}

async function startDashboardIfNeeded(): Promise<DashboardStatusInfo> {
  const current = await getDashboardStatus()
  if (current.running) return current

  await new Promise<void>((resolve, reject) => {
    const child = spawn('hermes', ['dashboard', '--host', '127.0.0.1', '--port', '9119', '--no-open'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    })

    child.once('error', reject)
    child.unref()
    resolve()
  })

  await new Promise((resolve) => setTimeout(resolve, 1500))
  return getDashboardStatus()
}

// GET /api/system/status — comprehensive system status
systemRoutes.get('/api/system/status', async (ctx) => {
  try {
    const [version, gateway, children, sessions, dashboard] = await Promise.all([
      getHermesVersion(),
      getGatewayStatus(),
      getHermesChildren(),
      getActiveSessions(),
      getDashboardStatus(),
    ])

    // Check web-ui itself
    const webUiProc = await checkProcess('hermes-web-ui')

    // Check Hermes API server (upstream)
    let apiServerStatus: 'running' | 'stopped' | 'error' = 'stopped'
    try {
      const res = await fetch(`${config.upstream}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      apiServerStatus = res.ok ? 'running' : 'error'
    } catch {
      apiServerStatus = 'stopped'
    }

    const services: ServiceStatus[] = [
      {
        name: 'Hermes Agent',
        status: gateway.status === 'running' ? 'running' : 'stopped',
        type: 'agent',
        details: `v${version}`,
      },
      {
        name: 'Gateway',
        status: gateway.status as any,
        type: 'gateway',
        details: gateway.details,
      },
      {
        name: 'API Server',
        status: apiServerStatus,
        type: 'hermes',
        details: config.upstream,
      },
      {
        name: 'Hermes Dashboard',
        status: dashboard.status,
        pid: dashboard.pid,
        type: 'dashboard',
        details: dashboard.url,
      },
      {
        name: 'Web UI (BFF)',
        status: 'running', // We're responding, so it's running
        pid: process.pid,
        type: 'web-ui',
        details: `port ${config.port}`,
      },
    ]

    // Add child processes
    for (const child of children) {
      services.push({
        name: `Process ${child.pid}`,
        status: 'running',
        pid: child.pid,
        type: 'other',
        uptime: child.elapsed,
        details: child.command,
      })
    }

    ctx.body = {
      services,
      hermes_version: version,
      gateway_status: gateway.status,
      active_sessions: sessions,
      active_children: children.length,
      uptime: Math.round(process.uptime()),
      timestamp: Date.now(),
      dashboard,
    } as SystemInfo
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/system/wake — wake up / start hermes
systemRoutes.post('/api/system/wake', async (ctx) => {
  try {
    const body = ctx.request.body as any || {}
    const action = body.action || 'gateway' // 'gateway' | 'all'

    if (action === 'gateway' || action === 'all') {
      try {
        await execFileAsync('hermes', ['gateway', 'start'], { timeout: 30000 })
        ctx.body = { success: true, message: 'Gateway started', action }
      } catch (err: any) {
        ctx.status = 500
        ctx.body = { success: false, error: err.message, action }
      }
    } else {
      ctx.status = 400
      ctx.body = { error: `Unknown action: ${action}` }
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/system/dashboard/status — check Hermes dashboard(9119) status
systemRoutes.get('/api/system/dashboard/status', async (ctx) => {
  try {
    const dashboard = await getDashboardStatus()
    ctx.body = dashboard
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/system/dashboard/start — start Hermes dashboard(9119)
systemRoutes.post('/api/system/dashboard/start', async (ctx) => {
  try {
    const dashboard = await startDashboardIfNeeded()
    ctx.body = {
      success: dashboard.running,
      status: dashboard,
      message: dashboard.running ? 'Dashboard is running' : 'Dashboard failed to start',
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { success: false, error: err.message }
  }
})

// POST /api/system/gateway/restart — restart gateway
systemRoutes.post('/api/system/gateway/restart', async (ctx) => {
  try {
    const { stdout, stderr } = await execFileAsync('hermes', ['gateway', 'restart'], {
      timeout: 30000,
    })
    ctx.body = { success: true, output: stdout || stderr }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { success: false, error: err.message }
  }
})

// POST /api/system/gateway/stop — stop gateway
systemRoutes.post('/api/system/gateway/stop', async (ctx) => {
  try {
    const { stdout, stderr } = await execFileAsync('hermes', ['gateway', 'stop'], {
      timeout: 15000,
    })
    ctx.body = { success: true, output: stdout || stderr }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { success: false, error: err.message }
  }
})

// GET /api/system/processes — list hermes-related processes
systemRoutes.get('/api/system/processes', async (ctx) => {
  try {
    const children = await getHermesChildren()
    ctx.body = { processes: children }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/system/shutdown — graceful shutdown of web UI server
systemRoutes.post('/api/system/shutdown', async (ctx) => {
  ctx.body = { success: true, message: 'Shutting down...' }
  // Send response first, then exit
  setTimeout(() => {
    console.log('  ✗ Web UI server shutting down...')
    process.exit(0)
  }, 500)
})

// POST /api/system/restart — restart web UI server
systemRoutes.post('/api/system/restart', async (ctx) => {
  ctx.body = { success: true, message: 'Restarting...' }
  setTimeout(() => {
    console.log('  ↻ Web UI server restarting...')
    process.exit(42) // special exit code for restart
  }, 500)
})

// GET /api/system/cloudflare-tunnel/status — cloudflared tunnel status
systemRoutes.get('/api/system/cloudflare-tunnel/status', async (ctx) => {
  try {
    const tunnel = await getTunnelStatus()
    ctx.body = tunnel
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/system/cloudflare-tunnel/start — start cloudflared quick tunnel
systemRoutes.post('/api/system/cloudflare-tunnel/start', async (ctx) => {
  try {
    const body = (ctx.request.body || {}) as { target_url?: string }
    const target = String(body.target_url || DEFAULT_TUNNEL_TARGET).trim()
    const tunnel = await startCloudflareTunnel(target)
    ctx.body = { success: true, tunnel }
  } catch (err: any) {
    const raw = err?.message || 'Failed to start cloudflared tunnel'
    const message = /ENOENT|not found/i.test(raw)
      ? 'cloudflared not found. Install it first: sudo curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && sudo chmod +x /usr/local/bin/cloudflared'
      : raw
    ctx.status = 500
    ctx.body = { success: false, error: message }
  }
})

// POST /api/system/cloudflare-tunnel/stop — stop cloudflared quick tunnel
systemRoutes.post('/api/system/cloudflare-tunnel/stop', async (ctx) => {
  try {
    const tunnel = await stopCloudflareTunnelInternal()
    ctx.body = { success: true, tunnel }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { success: false, error: err.message }
  }
})

// GET /api/system/sessions/active — active sessions with details
systemRoutes.get('/api/system/sessions/active', async (ctx) => {
  try {
    const { stdout } = await execFileAsync('hermes', ['sessions', 'export', '-'], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    })
    const lines = stdout.trim().split('\n').filter(Boolean)
    const sessions = []
    for (const line of lines) {
      try {
        const s = JSON.parse(line)
        // Only include sessions without end_reason (still active)
        if (!s.end_reason) {
          sessions.push({
            id: s.id,
            source: s.source,
            model: s.model,
            message_count: s.message_count,
            started_at: s.started_at,
            tool_call_count: s.tool_call_count,
          })
        }
      } catch { /* skip */ }
    }
    sessions.sort((a, b) => b.started_at - a.started_at)
    ctx.body = { sessions }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

import Router from '@koa/router'
import { execFile, exec } from 'child_process'
import { promisify } from 'util'
import { readFile, readdir } from 'fs/promises'
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
  type: 'hermes' | 'gateway' | 'web-ui' | 'agent' | 'other'
}

interface SystemInfo {
  services: ServiceStatus[]
  hermes_version: string
  gateway_status: string
  active_sessions: number
  active_children: number
  uptime: number
  timestamp: number
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

// GET /api/system/status — comprehensive system status
systemRoutes.get('/api/system/status', async (ctx) => {
  try {
    const [version, gateway, children, sessions] = await Promise.all([
      getHermesVersion(),
      getGatewayStatus(),
      getHermesChildren(),
      getActiveSessions(),
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

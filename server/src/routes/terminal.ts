import Router from '@koa/router'
import { exec } from 'child_process'
import { promisify } from 'util'
import { resolve } from 'path'

const execAsync = promisify(exec)

export const terminalRoutes = new Router()

// POST /api/terminal/execute — 执行终端命令
terminalRoutes.post('/api/terminal/execute', async (ctx) => {
  try {
    const { command, cwd, env, timeout } = ctx.request.body as {
      command: string
      cwd?: string
      env?: Record<string, string>
      timeout?: number
    }

    if (!command || typeof command !== 'string') {
      ctx.status = 400
      ctx.body = { error: 'Command is required' }
      return
    }

    // 安全检查 - 禁止危险命令
    const blockedPatterns = [
      /rm\s+-rf\s+\//,  // rm -rf /
      /mkfs/,            // 格式化
      /dd\s+if=/,        // dd 命令
      /:\(\)\{/,         // fork bomb
      /chmod\s+777/,     // 危险权限
      />\s*\/dev\/sd/,   // 写入磁盘设备
    ]

    for (const pattern of blockedPatterns) {
      if (pattern.test(command)) {
        ctx.status = 403
        ctx.body = { error: 'Command blocked for safety', output: `Blocked: ${command}` }
        return
      }
    }

    const startTime = Date.now()
    const execTimeout = Math.min(timeout || 30000, 60000) // 最多60秒
    const workingDir = cwd || '/home/xiao2027'

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: resolve(workingDir),
        env: { ...process.env, ...env },
        timeout: execTimeout,
        maxBuffer: 1024 * 1024, // 1MB
      })

      const output = (stdout || '') + (stderr ? `\n${stderr}` : '')
      const duration = Date.now() - startTime

      // 获取新工作目录（如果是 cd 命令）
      let newCwd: string | undefined
      if (command.trim().startsWith('cd ')) {
        try {
          const { stdout: pwd } = await execAsync('pwd', { cwd: resolve(workingDir) })
          newCwd = pwd.trim()
        } catch {
          // ignore
        }
      }

      ctx.body = {
        output: output.trim(),
        exit_code: 0,
        duration,
        new_cwd: newCwd,
      }
    } catch (err: any) {
      const duration = Date.now() - startTime
      const output = (err.stdout || '') + (err.stderr || err.message || '')

      ctx.body = {
        output: output.trim(),
        exit_code: err.code || 1,
        duration,
      }
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/terminal/info — 获取终端信息
terminalRoutes.get('/api/terminal/info', async (ctx) => {
  try {
    const { stdout: hostname } = await execAsync('hostname').catch(() => ({ stdout: 'unknown' }))
    const { stdout: whoami } = await execAsync('whoami').catch(() => ({ stdout: 'unknown' }))
    const { stdout: pwd } = await execAsync('pwd').catch(() => ({ stdout: '/home/xiao2027' }))
    const { stdout: uname } = await execAsync('uname -a').catch(() => ({ stdout: 'unknown' }))

    ctx.body = {
      hostname: hostname.trim(),
      user: whoami.trim(),
      cwd: pwd.trim(),
      os: uname.trim(),
      shell: process.env.SHELL || '/bin/bash',
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

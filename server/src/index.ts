import Koa from 'koa'
import cors from '@koa/cors'
import bodyParser from '@koa/bodyparser'
import serve from 'koa-static'
import send from 'koa-send'
import { resolve } from 'path'
import { mkdir } from 'fs/promises'
import { config } from './config'
import { proxyRoutes } from './routes/proxy'
import { uploadRoutes } from './routes/upload'
import { materialsRoutes } from './routes/materials'
import { sessionRoutes } from './routes/sessions'
import { webhookRoutes } from './routes/webhook'
import { logRoutes } from './routes/logs'
import { fsRoutes } from './routes/filesystem'
import { githubRoutes } from './routes/github'
import { vercelRoutes } from './routes/vercel'
import { cloudflareRoutes } from './routes/cloudflare'
import { terminalRoutes } from './routes/terminal'
import { systemRoutes } from './routes/system'
import { versionRoutes } from './routes/version'
import { modelRoutes } from './routes/models'
import { projectCenterRoutes } from './routes/project-center'
import { configCenterRoutes } from './routes/config-center'
import { securityCenterRoutes, initSecurityCenterScheduler } from './routes/security-center'
import * as hermesCli from './services/hermes-cli'
const { restartGateway } = hermesCli

let serverInstance: ReturnType<Koa['listen']> | null = null
let isShuttingDown = false

export async function bootstrap() {
  await mkdir(config.uploadDir, { recursive: true })
  await mkdir(config.dataDir, { recursive: true })
  await ensureApiServerConfig()
  await initSecurityCenterScheduler()

  const app = new Koa()

  app.use(cors({ origin: config.corsOrigins }))
  app.use(bodyParser())

  app.use(webhookRoutes.routes())
  app.use(logRoutes.routes())
  app.use(uploadRoutes.routes())
  app.use(materialsRoutes.routes())
  app.use(sessionRoutes.routes())
  app.use(fsRoutes.routes())
  app.use(githubRoutes.routes())
  app.use(vercelRoutes.routes())
  app.use(cloudflareRoutes.routes())
  app.use(terminalRoutes.routes())
  app.use(modelRoutes.routes())
  app.use(systemRoutes.routes())
  app.use(versionRoutes.routes())
  app.use(projectCenterRoutes.routes())
  app.use(configCenterRoutes.routes())
  app.use(securityCenterRoutes.routes())

  // Health endpoint with version
  app.use(async (ctx, next) => {
    if (ctx.path === '/health') {
      const raw = await hermesCli.getVersion()
      const version = raw.split('\n')[0].replace('Hermes Agent ', '') || ''
      ctx.body = { status: 'ok', platform: 'hermes-agent', version }
      return
    }
    await next()
  })

  app.use(proxyRoutes.routes())

  // SPA fallback
  const distDir = resolve(__dirname, '..')
  app.use(serve(distDir))
  app.use(async (ctx) => {
    if (!ctx.path.startsWith('/api') && !ctx.path.startsWith('/v1') && ctx.path !== '/health' && ctx.path !== '/upload' && ctx.path !== '/webhook') {
      await send(ctx, 'index.html', { root: distDir })
    }
  })

  serverInstance = app.listen(config.port, '0.0.0.0', () => {
    console.log(`  ➜  Hermes BFF Server: http://localhost:${config.port}`)
    console.log(`  ➜  Upstream: ${config.upstream}`)
  })

  bindShutdownSignals()
}

function bindShutdownSignals() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    try {
      console.log(`\n[${signal}] shutting down hermes-web-ui ...`)
      if (serverInstance) {
        await new Promise<void>((resolve) => {
          serverInstance?.close(() => resolve())
        })
        serverInstance = null
        console.log('  ✓ HTTP server closed')
      }
    } catch (err: any) {
      console.error('  ✗ shutdown error:', err?.message || err)
    }

    process.exit(0)
  }

  process.once('SIGUSR2', () => {
    shutdown('SIGUSR2')
  })
  process.on('SIGINT', () => {
    shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    shutdown('SIGTERM')
  })
  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err)
    shutdown('uncaughtException')
  })
  process.on('unhandledRejection', (err) => {
    console.error('unhandledRejection:', err)
    shutdown('unhandledRejection')
  })
}

async function ensureApiServerConfig() {
  const { homedir } = await import('os')
  const { readFileSync, writeFileSync, existsSync } = await import('fs')
  const configPath = resolve(homedir(), '.hermes/config.yaml')

  try {
    if (!existsSync(configPath)) {
      console.log('  ✗ config.yaml not found, skipping')
      return
    }

    const content = readFileSync(configPath, 'utf-8')

    // Case 1: api_server section exists, check if enabled is true
    if (/api_server:/.test(content)) {
      // Check specifically under api_server: look for a direct child `enabled: false`
      // Match api_server block and find enabled at the correct indent level
      const blockMatch = content.match(/api_server:\n((?:[ \t]+.*\n)*?)(?=\S|$)/)
      if (blockMatch) {
        const block = blockMatch[1]
        if (/^([ \t]*)enabled:\s*true/m.test(block)) {
          console.log('  ✓ api_server.enabled is true')
          return
        }
        if (/^([ \t]*)enabled:\s*false/m.test(block)) {
          // Backup before modifying
          const { copyFileSync } = await import('fs')
          copyFileSync(configPath, configPath + '.bak')
          const updated = content.replace(
            /(api_server:\n(?:[ \t]*.*\n)*?[ \t]*)enabled:\s*false/,
            '$1enabled: true'
          )
          writeFileSync(configPath, updated, 'utf-8')
          console.log('  ✓ api_server.enabled changed to true (backup saved to config.yaml.bak)')
          await restartGateway()
          return
        }
      }
      // api_server exists but no enabled key — don't touch, assume default
      console.log('  ✓ api_server section exists')
      return
    }

    // Case 2: api_server section exists and enabled is true (or missing but default true)
    if (/api_server:/.test(content)) {
      console.log('  ✓ api_server section exists')
      return
    }

    // Case 3: platforms section exists but no api_server — append api_server block
    if (/platforms:/.test(content)) {
      const { copyFileSync } = await import('fs')
      copyFileSync(configPath, configPath + '.bak')
      const append = `\n  api_server:\n    enabled: true\n    host: "127.0.0.1"\n    port: 8642\n    key: ""\n    cors_origins: "*"\n`
      const updated = content.replace(/(platforms:)/, '$1' + append)
      writeFileSync(configPath, updated, 'utf-8')
      console.log('  ✓ api_server block appended to platforms (backup saved to config.yaml.bak)')
      await restartGateway()
      return
    }

    // Case 4: No platforms section at all — append at end of file
    const { copyFileSync } = await import('fs')
    copyFileSync(configPath, configPath + '.bak')
    const append = `\nplatforms:\n  api_server:\n    enabled: true\n    host: "127.0.0.1"\n    port: 8642\n    key: ""\n    cors_origins: "*"\n`
    writeFileSync(configPath, content + append, 'utf-8')
    console.log('  ✓ platforms.api_server block appended (backup saved to config.yaml.bak)')
    await restartGateway()
  } catch (err: any) {
    console.error('  ✗ Failed to update config:', err.message)
  }
}

bootstrap()

import type { Context, Next } from 'koa'
import { timingSafeEqual } from 'crypto'

const SENSITIVE_PREFIXES = [
  '/api/system',
  '/api/terminal',
  '/api/auth',
  '/api/config',
  '/api/config-center',
  '/api/security-center',
  '/api/project-center',
  '/api/github',
  '/api/vercel',
  '/api/cloudflare',
  '/api/memory',
]

function isSensitivePath(path: string): boolean {
  return SENSITIVE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function normalizeIp(input: string): string {
  if (!input) return ''
  if (input.startsWith('::ffff:')) return input.replace('::ffff:', '')
  return input
}

function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost'
}

function isLocalRequest(ctx: Context): boolean {
  // Do NOT trust x-forwarded-for directly; it is client-controlled unless a trusted proxy is enforced.
  const candidates = [
    ctx.request.ip,
    ctx.ip,
    ctx.req.socket?.remoteAddress || '',
  ]
    .map(normalizeIp)
    .filter(Boolean)

  return candidates.some((ip) => isLoopbackIp(ip))
}

function isAllowedBrowserOrigin(origin: string): boolean {
  if (!origin) return true
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin.trim())
}

function getAccessToken(): string {
  return (
    process.env.WEB_UI_ACCESS_TOKEN
    || process.env.HERMES_WEB_UI_ACCESS_TOKEN
    || process.env.HERMES_WEB_UI_TOKEN
    || ''
  ).trim()
}

function readBearerToken(ctx: Context): string {
  const auth = String(ctx.request.headers.authorization || '')
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }
  const headerToken = String(ctx.request.headers['x-webui-token'] || '').trim()
  return headerToken
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export async function enforceAccessControl(ctx: Context, next: Next) {
  if (!isSensitivePath(ctx.path)) {
    await next()
    return
  }

  const requestOrigin = String(ctx.request.headers.origin || '')
  if (!isAllowedBrowserOrigin(requestOrigin)) {
    ctx.status = 403
    ctx.body = { error: 'Forbidden origin for sensitive API' }
    return
  }

  if (isLocalRequest(ctx)) {
    await next()
    return
  }

  const configuredToken = getAccessToken()
  const requestToken = readBearerToken(ctx)

  if (!configuredToken) {
    ctx.status = 403
    ctx.body = {
      error: 'Remote access to sensitive APIs is disabled. Set WEB_UI_ACCESS_TOKEN to enable authenticated remote access.',
    }
    return
  }

  if (!requestToken || !safeEqual(requestToken, configuredToken)) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized: invalid access token' }
    return
  }

  await next()
}

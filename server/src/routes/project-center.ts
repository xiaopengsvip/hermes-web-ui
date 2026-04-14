import Router from '@koa/router'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { config } from '../config'
import * as github from '../services/github'
import * as vercel from '../services/vercel'
import * as cloudflare from '../services/cloudflare'

export const projectCenterRoutes = new Router()

interface RelayConfig {
  enabled: boolean
  baseUrl: string
  apiKey: string
  chatPath: string
  terminalPath: string
  healthPath: string
  localHealthUrl: string
}

const relayConfigPath = resolve(config.dataDir, 'project-center-relay.json')

const relayDefaults: RelayConfig = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  chatPath: '/api/project-center/relay/chat',
  terminalPath: '/api/project-center/relay/command',
  healthPath: '/health',
  localHealthUrl: `http://127.0.0.1:${config.port}/health`,
}

function toError(ctx: any, err: any) {
  const msg = err?.message || String(err)
  ctx.status = msg.includes('No ') ? 401 : 500
  ctx.body = { error: msg }
}

function sanitizeBaseUrl(input: string) {
  return String(input || '').trim().replace(/\/$/, '')
}

function joinUrl(baseUrl: string, path: string) {
  const base = sanitizeBaseUrl(baseUrl)
  const p = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`
  return `${base}${p}`
}

async function loadRelayConfig(): Promise<RelayConfig> {
  try {
    const raw = await readFile(relayConfigPath, 'utf-8')
    const parsed = JSON.parse(raw || '{}')
    return {
      ...relayDefaults,
      ...parsed,
      baseUrl: sanitizeBaseUrl(parsed?.baseUrl || ''),
    }
  } catch {
    return { ...relayDefaults }
  }
}

async function saveRelayConfig(nextConfig: Partial<RelayConfig>) {
  const current = await loadRelayConfig()
  const merged: RelayConfig = {
    ...current,
    ...nextConfig,
    baseUrl: sanitizeBaseUrl(nextConfig.baseUrl ?? current.baseUrl),
  }
  await writeFile(relayConfigPath, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

async function probeUrl(url: string): Promise<{ ok: boolean; status: number; latencyMs: number; preview?: string; error?: string }> {
  const start = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 8000)
  try {
    const res = await fetch(url, { method: 'GET', signal: ac.signal })
    const text = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
      preview: text.slice(0, 200),
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      error: err?.message || 'network error',
    }
  } finally {
    clearTimeout(timer)
  }
}

async function relayPost(url: string, payload: Record<string, any>, apiKey?: string) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 15000)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
    }
  } finally {
    clearTimeout(timer)
  }
}

projectCenterRoutes.get('/api/project-center/servers/defaults', async (ctx) => {
  ctx.body = {
    servers: [
      { id: 'local-bff', name: 'Hermes Web UI BFF', baseUrl: `http://127.0.0.1:${config.port}` },
      { id: 'local-api', name: 'Hermes API Server', baseUrl: config.upstream },
      { id: 'allapple-backend', name: 'Allapple Backend', baseUrl: 'http://43.167.213.143:8641' },
    ],
  }
})

projectCenterRoutes.post('/api/project-center/server-test', async (ctx) => {
  const body = (ctx.request.body || {}) as any
  const baseUrl = sanitizeBaseUrl(body.baseUrl || '')
  const path = String(body.path || '/health')
  if (!baseUrl) {
    ctx.status = 400
    ctx.body = { error: 'baseUrl is required' }
    return
  }

  ctx.body = await probeUrl(joinUrl(baseUrl, path))
})

projectCenterRoutes.get('/api/project-center/relay/config', async (ctx) => {
  const relay = await loadRelayConfig()
  ctx.body = relay
})

projectCenterRoutes.post('/api/project-center/relay/config', async (ctx) => {
  const body = (ctx.request.body || {}) as Partial<RelayConfig>
  const relay = await saveRelayConfig(body)
  ctx.body = { ok: true, relay }
})

projectCenterRoutes.post('/api/project-center/relay/test', async (ctx) => {
  const body = (ctx.request.body || {}) as Partial<RelayConfig>
  const relay = {
    ...(await loadRelayConfig()),
    ...body,
  }

  if (!relay.baseUrl) {
    ctx.status = 400
    ctx.body = { error: 'relay.baseUrl is required' }
    return
  }

  const healthUrl = joinUrl(relay.baseUrl, relay.healthPath || '/health')
  const result = await probeUrl(healthUrl)
  ctx.body = {
    ...result,
    url: healthUrl,
  }
})

projectCenterRoutes.post('/api/project-center/relay/chat', async (ctx) => {
  const relay = await loadRelayConfig()
  const body = (ctx.request.body || {}) as any
  const prompt = String(body.prompt || '').trim()

  if (!relay.baseUrl) {
    ctx.status = 400
    ctx.body = { error: 'relay.baseUrl is required' }
    return
  }
  if (!prompt) {
    ctx.status = 400
    ctx.body = { error: 'prompt is required' }
    return
  }

  const chatUrl = joinUrl(relay.baseUrl, relay.chatPath || '/api/project-center/relay/chat')
  const result = await relayPost(chatUrl, { prompt }, relay.apiKey)
  ctx.body = {
    ok: result.ok,
    status: result.status,
    url: chatUrl,
    result: result.data,
  }
})

projectCenterRoutes.post('/api/project-center/relay/command', async (ctx) => {
  const relay = await loadRelayConfig()
  const body = (ctx.request.body || {}) as any
  const command = String(body.command || '').trim()

  if (!relay.baseUrl) {
    ctx.status = 400
    ctx.body = { error: 'relay.baseUrl is required' }
    return
  }
  if (!command) {
    ctx.status = 400
    ctx.body = { error: 'command is required' }
    return
  }

  const terminalUrl = joinUrl(relay.baseUrl, relay.terminalPath || '/api/project-center/relay/command')
  const result = await relayPost(terminalUrl, { command }, relay.apiKey)
  ctx.body = {
    ok: result.ok,
    status: result.status,
    url: terminalUrl,
    result: result.data,
  }
})

projectCenterRoutes.get('/api/project-center/relay/stream', async (ctx) => {
  const relay = await loadRelayConfig()
  ctx.set('Content-Type', 'text/event-stream')
  ctx.set('Cache-Control', 'no-cache')
  ctx.set('Connection', 'keep-alive')
  ctx.status = 200

  const res = ctx.res
  res.write(':ok\n\n')

  const push = async () => {
    const latest = await loadRelayConfig()
    const local = await probeUrl(latest.localHealthUrl || `http://127.0.0.1:${config.port}/health`)
    const remote = latest.baseUrl
      ? await probeUrl(joinUrl(latest.baseUrl, latest.healthPath || '/health'))
      : { ok: false, status: 0, latencyMs: 0, error: 'relay baseUrl not configured' }

    const data = {
      time: Date.now(),
      relayEnabled: latest.enabled,
      local,
      remote,
    }
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  await push()
  const timer = setInterval(push, 3000)

  const cleanup = () => {
    clearInterval(timer)
    res.end()
  }

  ctx.req.on('close', cleanup)
  ctx.req.on('end', cleanup)
  ctx.respond = false
})

projectCenterRoutes.get('/api/project-center/overview', async (ctx) => {
  try {
    const owner = String(ctx.query.owner || '')
    const repo = String(ctx.query.repo || '')
    const projectId = String(ctx.query.projectId || '')
    const zoneId = String(ctx.query.zoneId || '')

    const tasks: Promise<any>[] = []
    const key: string[] = []

    if (owner && repo) {
      tasks.push(github.listPullRequests(owner, repo, 'open', 20))
      key.push('pulls')
      tasks.push(github.listIssues(owner, repo, 'open', 20))
      key.push('issues')
    }

    if (projectId) {
      tasks.push(vercel.listDeployments({ projectId, limit: 20 }))
      key.push('deployments')
    }

    if (zoneId) {
      tasks.push(cloudflare.getZone(zoneId))
      key.push('zone')
      tasks.push(cloudflare.listDnsRecords(zoneId))
      key.push('dns')
    }

    const values = await Promise.all(tasks)
    const data: Record<string, any> = {}
    key.forEach((k, idx) => { data[k] = values[idx] })

    const clusters: Array<{ reason: string; count: number; severity: 'high' | 'medium' | 'low' }> = []

    const deployments = (data.deployments || []) as Array<any>
    const failedDeployments = deployments.filter((d) => !['READY', 'ready'].includes(String(d.state || '')))
    if (failedDeployments.length) {
      clusters.push({ reason: 'vercel_deploy_failed_or_pending', count: failedDeployments.length, severity: failedDeployments.length > 3 ? 'high' : 'medium' })
    }

    const issues = (data.issues || []) as Array<any>
    const bugIssues = issues.filter((i) => (i.labels || []).some((l: any) => String(l.name || '').toLowerCase().includes('bug')))
    if (bugIssues.length) {
      clusters.push({ reason: 'github_bug_issues_open', count: bugIssues.length, severity: bugIssues.length > 5 ? 'high' : 'medium' })
    }

    const dns = (data.dns || []) as Array<any>
    const hasRootRecord = dns.some((r) => ['A', 'CNAME'].includes(String(r.type || '')))
    if (zoneId && !hasRootRecord) {
      clusters.push({ reason: 'cloudflare_root_record_missing', count: 1, severity: 'high' })
    }

    ctx.body = {
      metrics: {
        openPulls: (data.pulls || []).length,
        openIssues: issues.length,
        deployments: deployments.length,
        failedDeployments: failedDeployments.length,
        dnsRecords: dns.length,
        zoneStatus: data.zone?.status || 'unknown',
      },
      clusters,
      source: {
        pulls: data.pulls || [],
        issues,
        deployments,
        zone: data.zone || null,
        dns,
      },
    }
  } catch (err: any) {
    toError(ctx, err)
  }
})

projectCenterRoutes.post('/api/project-center/actions', async (ctx) => {
  try {
    const body = (ctx.request.body || {}) as any
    const type = String(body.type || '')

    if (type === 'redeploy') {
      if (!body.projectId) {
        ctx.status = 400
        ctx.body = { error: 'projectId is required' }
        return
      }
      const result = await vercel.redeploy(String(body.projectId))
      ctx.body = {
        ok: true,
        action: 'redeploy',
        result,
        chatPrompt: `请继续跟进部署状态，直到项目 ${body.projectId} 部署成功，并汇报最终可访问地址。`,
      }
      return
    }

    if (type === 'dns_fix') {
      const { zoneId, name, content, recordType, proxied } = body
      if (!zoneId || !name || !content) {
        ctx.status = 400
        ctx.body = { error: 'zoneId/name/content are required' }
        return
      }
      const result = await cloudflare.createDnsRecord(String(zoneId), {
        type: String(recordType || 'A'),
        name: String(name),
        content: String(content),
        proxied: proxied !== false,
      })
      ctx.body = {
        ok: true,
        action: 'dns_fix',
        result,
        chatPrompt: `请验证域名 ${name} 的 DNS 生效与证书状态，并给出最终可访问性结果。`,
      }
      return
    }

    if (type === 'create_fix_issue') {
      const { owner, repo, title, issueBody, labels } = body
      if (!owner || !repo || !title) {
        ctx.status = 400
        ctx.body = { error: 'owner/repo/title are required' }
        return
      }
      const result = await github.createIssue(String(owner), String(repo), {
        title: String(title),
        body: issueBody ? String(issueBody) : undefined,
        labels: Array.isArray(labels) ? labels.map((x) => String(x)) : undefined,
      })
      ctx.body = {
        ok: true,
        action: 'create_fix_issue',
        result,
        chatPrompt: `请基于 issue #${result.number} 生成修复计划并执行代码修复，最后提交 PR。`,
      }
      return
    }

    if (type === 'create_fix_pr') {
      const { owner, repo, title, head, base, prBody, draft } = body
      if (!owner || !repo || !title || !head || !base) {
        ctx.status = 400
        ctx.body = { error: 'owner/repo/title/head/base are required' }
        return
      }
      const result = await github.createPullRequest(String(owner), String(repo), {
        title: String(title),
        head: String(head),
        base: String(base),
        body: prBody ? String(prBody) : undefined,
        draft: !!draft,
      })
      ctx.body = {
        ok: true,
        action: 'create_fix_pr',
        result,
        chatPrompt: `请继续跟进 PR #${result.number} 的 CI 状态并修复失败项，直到可合并。`,
      }
      return
    }

    ctx.status = 400
    ctx.body = { error: 'Unsupported action type' }
  } catch (err: any) {
    toError(ctx, err)
  }
})

import Router from '@koa/router'
import { stat } from 'fs/promises'
import { resolve } from 'path'
import { config } from '../config'
import { loadConfigCenterState } from './config-center'
import * as github from '../services/github'
import * as vercel from '../services/vercel'
import * as cloudflare from '../services/cloudflare'

export const securityCenterRoutes = new Router()

type Severity = 'low' | 'medium' | 'high'

interface SecurityFinding {
  id: string
  severity: Severity
  title: string
  detail: string
  recommendation: string
}

interface SecurityReport {
  generatedAt: number
  score: number
  findings: SecurityFinding[]
  summary: {
    high: number
    medium: number
    low: number
  }
}

interface SecuritySettings {
  enabled: boolean
  dailyHour: number
  lastRunAt: number
}

const statePath = resolve(config.dataDir, 'security-center.json')

let schedulerStarted = false
let schedulerTimer: NodeJS.Timeout | null = null
let latestReport: SecurityReport | null = null
let settings: SecuritySettings = {
  enabled: true,
  dailyHour: 3,
  lastRunAt: 0,
}

async function loadState() {
  try {
    const text = await import('fs/promises').then((fs) => fs.readFile(statePath, 'utf-8'))
    const parsed = JSON.parse(text || '{}')
    if (parsed.settings) settings = { ...settings, ...parsed.settings }
    if (parsed.latestReport) latestReport = parsed.latestReport
  } catch {
    // ignore
  }
}

async function saveState() {
  await import('fs/promises').then((fs) => fs.writeFile(statePath, JSON.stringify({ settings, latestReport }, null, 2), 'utf-8'))
}

function severityWeight(severity: Severity) {
  if (severity === 'high') return 18
  if (severity === 'medium') return 8
  return 3
}

async function runAudit(): Promise<SecurityReport> {
  const cfg = await loadConfigCenterState()
  const findings: SecurityFinding[] = []

  if (cfg.profile.relayBaseUrl && !cfg.profile.relayBaseUrl.startsWith('https://')) {
    findings.push({
      id: 'relay-http',
      severity: 'high',
      title: '中转地址未使用 HTTPS',
      detail: `当前 relayBaseUrl=${cfg.profile.relayBaseUrl}`,
      recommendation: '将中转域名切换到 HTTPS，并在 Cloudflare/Vercel 上强制 HTTPS。',
    })
  }

  if (cfg.audit.enabled && !cfg.secrets.relayApiKey) {
    findings.push({
      id: 'relay-api-key-empty',
      severity: 'high',
      title: '中转 API Key 为空',
      detail: '远程中转已启用审计，但 relayApiKey 未配置。',
      recommendation: '在配置中心填写 relayApiKey，并为远端接口开启 Bearer 校验。',
    })
  }

  const tokenChecks = [
    { key: 'githubToken', label: 'GitHub' },
    { key: 'vercelToken', label: 'Vercel' },
    { key: 'cloudflareToken', label: 'Cloudflare' },
  ] as const

  for (const check of tokenChecks) {
    if (!cfg.secrets[check.key]) {
      findings.push({
        id: `token-missing-${check.key}`,
        severity: 'medium',
        title: `${check.label} 密钥未配置`,
        detail: `${check.label} token 为空，平台审计能力受限。`,
        recommendation: `在配置中心补充 ${check.label} token，并限制最小权限。`,
      })
    }
  }

  try {
    const st = await stat(resolve(config.dataDir, 'config-center.json'))
    const perm = st.mode & 0o777
    if (perm !== 0o600) {
      findings.push({
        id: 'config-perm-unsafe',
        severity: 'high',
        title: '配置文件权限过宽',
        detail: `config-center.json 权限为 ${perm.toString(8)}`,
        recommendation: '限制为 600，仅服务用户可读写。',
      })
    }
  } catch {
    findings.push({
      id: 'config-file-missing',
      severity: 'low',
      title: '配置中心文件尚未初始化',
      detail: '未检测到 config-center.json。',
      recommendation: '先在配置中心保存一次，初始化审计基线。',
    })
  }

  if (cfg.platforms.githubOwner && cfg.platforms.githubRepo) {
    try {
      const prs = await github.listPullRequests(cfg.platforms.githubOwner, cfg.platforms.githubRepo, 'open', 20)
      const stale = prs.filter((pr) => Date.now() - new Date(pr.updated_at).getTime() > 7 * 24 * 3600 * 1000)
      if (stale.length >= 5) {
        findings.push({
          id: 'github-stale-prs',
          severity: 'medium',
          title: '存在较多超过 7 天未更新 PR',
          detail: `仓库 ${cfg.platforms.githubOwner}/${cfg.platforms.githubRepo} 有 ${stale.length} 个陈旧 PR。`,
          recommendation: '清理陈旧分支，避免长期暴露未合并变更。',
        })
      }
    } catch (err: any) {
      findings.push({
        id: 'github-audit-failed',
        severity: 'medium',
        title: 'GitHub 审计请求失败',
        detail: err?.message || 'unknown error',
        recommendation: '检查 GitHub token 与网络连通性。',
      })
    }
  }

  if (cfg.platforms.vercelProjectId) {
    try {
      const deployments = await vercel.listDeployments({ projectId: cfg.platforms.vercelProjectId, limit: 20 })
      const failed = deployments.filter((d) => !['READY', 'ready'].includes(String(d.state || '')))
      if (failed.length >= 4) {
        findings.push({
          id: 'vercel-failed-deployments',
          severity: 'high',
          title: 'Vercel 部署失败/待定偏高',
          detail: `${cfg.platforms.vercelProjectId} 最近 20 次部署中有 ${failed.length} 次非 READY。`,
          recommendation: '排查构建日志和环境变量，修复后再触发自动部署。',
        })
      }
    } catch (err: any) {
      findings.push({
        id: 'vercel-audit-failed',
        severity: 'medium',
        title: 'Vercel 审计请求失败',
        detail: err?.message || 'unknown error',
        recommendation: '检查 Vercel token、项目 ID 与 API 配额。',
      })
    }
  }

  if (cfg.platforms.cloudflareZoneId) {
    try {
      const zone = await cloudflare.getZone(cfg.platforms.cloudflareZoneId)
      if (String(zone.status || '').toLowerCase() !== 'active') {
        findings.push({
          id: 'cloudflare-zone-not-active',
          severity: 'high',
          title: 'Cloudflare Zone 非 active',
          detail: `Zone ${zone.name} 状态=${zone.status}`,
          recommendation: '检查 NS 绑定与账号权限，恢复 active 状态。',
        })
      }
      const workers = await cloudflare.listWorkers()
      if (cfg.profile.workerEnabled && workers.length === 0) {
        findings.push({
          id: 'worker-missing',
          severity: 'low',
          title: '建议部署 Cloudflare Worker 作为公网中转层',
          detail: '当前未检测到可用 Worker 脚本。',
          recommendation: '创建 Worker：校验 Bearer 后转发至内网 BFF，实现域名统一入口。',
        })
      }
    } catch (err: any) {
      findings.push({
        id: 'cloudflare-audit-failed',
        severity: 'medium',
        title: 'Cloudflare 审计请求失败',
        detail: err?.message || 'unknown error',
        recommendation: '检查 Cloudflare token、Zone ID 与网络。',
      })
    }
  }

  const penalty = findings.reduce((sum, f) => sum + severityWeight(f.severity), 0)
  const score = Math.max(0, 100 - penalty)
  const report: SecurityReport = {
    generatedAt: Date.now(),
    score,
    findings,
    summary: {
      high: findings.filter((x) => x.severity === 'high').length,
      medium: findings.filter((x) => x.severity === 'medium').length,
      low: findings.filter((x) => x.severity === 'low').length,
    },
  }

  latestReport = report
  settings.lastRunAt = report.generatedAt
  await saveState()
  return report
}

function scheduleNextDailyRun() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer)
    schedulerTimer = null
  }
  if (!settings.enabled) return

  const now = new Date()
  const next = new Date(now)
  next.setHours(settings.dailyHour, 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)

  const ms = next.getTime() - now.getTime()
  schedulerTimer = setTimeout(async () => {
    try {
      await runAudit()
    } finally {
      scheduleNextDailyRun()
    }
  }, ms)
}

export async function initSecurityCenterScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true
  await loadState()
  if (!latestReport) {
    await runAudit().catch(() => undefined)
  }
  scheduleNextDailyRun()
}

securityCenterRoutes.get('/api/security-center/latest', async (ctx) => {
  if (!latestReport) {
    latestReport = await runAudit()
  }
  ctx.body = {
    report: latestReport,
    settings,
  }
})

securityCenterRoutes.post('/api/security-center/run', async (ctx) => {
  const report = await runAudit()
  ctx.body = { ok: true, report, settings }
})

securityCenterRoutes.post('/api/security-center/settings', async (ctx) => {
  const body = (ctx.request.body || {}) as Partial<SecuritySettings>
  settings = {
    ...settings,
    ...body,
    dailyHour: Math.max(0, Math.min(23, Number(body.dailyHour ?? settings.dailyHour))),
  }
  await saveState()
  scheduleNextDailyRun()
  ctx.body = { ok: true, settings }
})

import Router from '@koa/router'
import { chmod, readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { config } from '../config'
import * as hermesCli from '../services/hermes-cli'

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
    sshPassword: string
    serverRootPassword: string
  }
  sessionDesign: {
    defaultSessionPrompt: string
    uiDesignPrompt: string
    contentPolicy: string
  }
  serverConnection: {
    serverHost: string
    serverPort: number
    bffPort: number
    apiPort: number
    relayPort: number
    sshUser: string
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
    sshPassword: '',
    serverRootPassword: '',
  },
  sessionDesign: {
    defaultSessionPrompt: '你是 Hermes 项目调度助手，优先中文，直接执行。',
    uiDesignPrompt: '现代炫酷、玻璃拟态、信息密度高、强调实时反馈。',
    contentPolicy: '禁止在聊天中明文回显密钥；仅在配置中心维护。',
  },
  serverConnection: {
    serverHost: '43.167.213.143',
    serverPort: 22,
    bffPort: config.port,
    apiPort: Number(String(config.upstream).split(':').pop() || 8642),
    relayPort: 443,
    sshUser: 'root',
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
    sessionDesign: { ...base.sessionDesign, ...(patch.sessionDesign || {}) },
    serverConnection: { ...base.serverConnection, ...(patch.serverConnection || {}) },
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
      sshPassword: maskSecret(state.secrets.sshPassword),
      serverRootPassword: maskSecret(state.secrets.serverRootPassword),
    },
    secretsConfigured: {
      githubToken: !!state.secrets.githubToken,
      vercelToken: !!state.secrets.vercelToken,
      cloudflareToken: !!state.secrets.cloudflareToken,
      relayApiKey: !!state.secrets.relayApiKey,
      hermesApiKey: !!state.secrets.hermesApiKey,
      sshPassword: !!state.secrets.sshPassword,
      serverRootPassword: !!state.secrets.serverRootPassword,
    },
  }
}

configCenterRoutes.get('/api/config-center', async (ctx) => {
  const raw = await loadRawConfig()
  ctx.body = toPublicState(raw)
})

configCenterRoutes.get('/api/config-center/overview', async (ctx) => {
  const raw = await loadRawConfig()
  let sessions: any[] = []
  try {
    sessions = await hermesCli.listSessions(undefined, 50)
  } catch {
    sessions = []
  }

  const totalMessages = sessions.reduce((sum, s) => sum + Number(s.message_count || 0), 0)
  const totalToolCalls = sessions.reduce((sum, s) => sum + Number(s.tool_call_count || 0), 0)

  ctx.body = {
    config: toPublicState(raw),
    sessionSummary: {
      totalSessions: sessions.length,
      totalMessages,
      totalToolCalls,
      latestSessions: sessions.slice(0, 5).map((s) => ({
        id: s.id,
        title: s.title || 'Untitled',
        model: s.model,
        startedAt: s.started_at,
        messageCount: s.message_count,
      })),
    },
    ports: {
      bffPort: raw.serverConnection.bffPort || config.port,
      apiPort: raw.serverConnection.apiPort || Number(String(config.upstream).split(':').pop() || 8642),
      relayPort: raw.serverConnection.relayPort || 443,
      sshPort: raw.serverConnection.serverPort || 22,
    },
  }
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

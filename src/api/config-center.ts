import { request } from './client'

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
  secretsConfigured?: Record<string, boolean>
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

export interface ConfigCenterOverview {
  config: ConfigCenterState
  sessionSummary: {
    totalSessions: number
    totalMessages: number
    totalToolCalls: number
    latestSessions: Array<{ id: string; title: string; model: string; startedAt: number; messageCount: number }>
  }
  ports: {
    bffPort: number
    apiPort: number
    relayPort: number
    sshPort: number
  }
}

export async function fetchConfigCenter(): Promise<ConfigCenterState> {
  return request<ConfigCenterState>('/api/config-center')
}

export async function fetchConfigCenterOverview(): Promise<ConfigCenterOverview> {
  return request<ConfigCenterOverview>('/api/config-center/overview')
}

export async function saveConfigCenter(payload: Partial<ConfigCenterState>): Promise<{ ok: boolean; config: ConfigCenterState }> {
  return request<{ ok: boolean; config: ConfigCenterState }>('/api/config-center', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

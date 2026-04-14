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
  }
  secretsConfigured?: Record<string, boolean>
  audit: {
    enabled: boolean
    dailyHour: number
    autoFix: boolean
  }
  updatedAt: number
}

export async function fetchConfigCenter(): Promise<ConfigCenterState> {
  return request<ConfigCenterState>('/api/config-center')
}

export async function saveConfigCenter(payload: Partial<ConfigCenterState>): Promise<{ ok: boolean; config: ConfigCenterState }> {
  return request<{ ok: boolean; config: ConfigCenterState }>('/api/config-center', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

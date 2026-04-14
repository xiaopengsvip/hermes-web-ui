import { request } from './client'

export interface ProjectCenterServer {
  id: string
  name: string
  baseUrl: string
}

export interface ServerTestResult {
  ok: boolean
  status: number
  latencyMs: number
  preview?: string
  error?: string
}

export interface AuditCluster {
  reason: string
  count: number
  severity: 'high' | 'medium' | 'low'
}

export interface ProjectCenterOverview {
  metrics: {
    openPulls: number
    openIssues: number
    deployments: number
    failedDeployments: number
    dnsRecords: number
    zoneStatus: string
  }
  clusters: AuditCluster[]
  source: {
    pulls: any[]
    issues: any[]
    deployments: any[]
    zone: any
    dns: any[]
  }
}

export interface RelayConfig {
  enabled: boolean
  baseUrl: string
  apiKey: string
  chatPath: string
  terminalPath: string
  healthPath: string
  localHealthUrl: string
}

export interface RelayStreamSnapshot {
  time: number
  relayEnabled: boolean
  local: ServerTestResult
  remote: ServerTestResult
}

export async function fetchProjectCenterDefaultServers(): Promise<{ servers: ProjectCenterServer[] }> {
  return request<{ servers: ProjectCenterServer[] }>('/api/project-center/servers/defaults')
}

export async function testProjectCenterServer(baseUrl: string, path = '/health'): Promise<ServerTestResult> {
  return request<ServerTestResult>('/api/project-center/server-test', {
    method: 'POST',
    body: JSON.stringify({ baseUrl, path }),
  })
}

export async function fetchRelayConfig(): Promise<RelayConfig> {
  return request<RelayConfig>('/api/project-center/relay/config')
}

export async function saveRelayConfig(payload: Partial<RelayConfig>): Promise<{ ok: boolean; relay: RelayConfig }> {
  return request<{ ok: boolean; relay: RelayConfig }>('/api/project-center/relay/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function testRelayConfig(payload: Partial<RelayConfig> = {}): Promise<ServerTestResult & { url: string }> {
  return request<ServerTestResult & { url: string }>('/api/project-center/relay/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function relaySendChat(prompt: string): Promise<any> {
  return request('/api/project-center/relay/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  })
}

export async function relaySendCommand(command: string): Promise<any> {
  return request('/api/project-center/relay/command', {
    method: 'POST',
    body: JSON.stringify({ command }),
  })
}

export async function fetchProjectCenterOverview(params: {
  owner: string
  repo: string
  projectId: string
  zoneId: string
}): Promise<ProjectCenterOverview> {
  const query = new URLSearchParams()
  if (params.owner) query.set('owner', params.owner)
  if (params.repo) query.set('repo', params.repo)
  if (params.projectId) query.set('projectId', params.projectId)
  if (params.zoneId) query.set('zoneId', params.zoneId)
  const qs = query.toString()
  return request<ProjectCenterOverview>(`/api/project-center/overview${qs ? '?' + qs : ''}`)
}

export async function runProjectCenterAction(payload: Record<string, any>): Promise<any> {
  return request('/api/project-center/actions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

import { request } from './client'

export interface HealthResponse {
  status: string
  version?: string
}

export interface Model {
  id: string
  object: string
  owned_by: string
}

export interface ModelsResponse {
  object: string
  data: Model[]
}

// Config-based model types
export interface ModelInfo {
  id: string
  label: string
}

export interface ModelGroup {
  provider: string
  models: ModelInfo[]
}

export interface ConfigModelsResponse {
  default: string
  groups: ModelGroup[]
}

export interface AvailableModelGroup {
  provider: string   // credential pool key (e.g. "zai", "custom:subrouter.ai")
  label: string      // display name (e.g. "zai", "subrouter.ai")
  base_url: string
  models: string[]
}

export interface UnavailableModelGroup {
  provider: string
  label: string
  base_url: string
  models: string[]
  reason: string
}

export interface AvailableModelsResponse {
  default: string
  groups: AvailableModelGroup[]
  unavailable_groups?: UnavailableModelGroup[]
}

export interface CustomProvider {
  name: string
  base_url: string
  api_key: string
  model: string
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

export async function fetchModels(): Promise<ModelsResponse> {
  return request<ModelsResponse>('/v1/models')
}

export async function fetchConfigModels(): Promise<ConfigModelsResponse> {
  return request<ConfigModelsResponse>('/api/config/models')
}

export async function fetchAvailableModels(): Promise<AvailableModelsResponse> {
  return request<AvailableModelsResponse>('/api/available-models')
}

export async function updateDefaultModel(data: {
  default: string
  provider?: string
  base_url?: string
  api_key?: string
}): Promise<void> {
  await request('/api/config/model', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function addCustomProvider(data: CustomProvider): Promise<void> {
  await request('/api/config/providers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function removeCustomProvider(name: string): Promise<void> {
  await request(`/api/config/providers/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

// --- System Status ---

export interface ServiceStatus {
  name: string
  status: 'running' | 'stopped' | 'error' | 'unknown'
  pid?: number
  uptime?: string
  details?: string
  type: 'hermes' | 'gateway' | 'web-ui' | 'agent' | 'dashboard' | 'other'
}

export interface DashboardStatus {
  running: boolean
  status: 'running' | 'stopped'
  host: string
  port: number
  url: string
  pid?: number
  details?: string
}

export interface SystemStatus {
  services: ServiceStatus[]
  hermes_version: string
  gateway_status: string
  active_sessions: number
  active_children: number
  uptime: number
  timestamp: number
  dashboard?: DashboardStatus
}

export interface ActiveSession {
  id: string
  source: string
  model: string
  message_count: number
  started_at: number
  tool_call_count: number
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>('/api/system/status')
}

export async function wakeHermes(action = 'gateway'): Promise<{ success: boolean; message?: string; error?: string }> {
  return request('/api/system/wake', {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

export async function restartGateway(): Promise<{ success: boolean; output?: string; error?: string }> {
  return request('/api/system/gateway/restart', { method: 'POST' })
}

export async function stopGateway(): Promise<{ success: boolean; output?: string; error?: string }> {
  return request('/api/system/gateway/stop', { method: 'POST' })
}

export async function fetchActiveSessions(): Promise<{ sessions: ActiveSession[] }> {
  return request('/api/system/sessions/active')
}

export async function fetchSystemProcesses(): Promise<{ processes: Array<{ pid: number; command: string; elapsed: string }> }> {
  return request('/api/system/processes')
}

export async function fetchDashboardStatus(): Promise<DashboardStatus> {
  return request('/api/system/dashboard/status')
}

export async function startDashboard(): Promise<{ success: boolean; status?: DashboardStatus; message?: string; error?: string }> {
  return request('/api/system/dashboard/start', { method: 'POST' })
}

export interface CloudflareTunnelStatus {
  running: boolean
  pid?: number
  target_url: string
  public_url?: string
  status: 'running' | 'stopped' | 'error'
  updated_at: string
  started_at?: string
  error?: string
}

export async function fetchCloudflareTunnelStatus(): Promise<CloudflareTunnelStatus> {
  return request('/api/system/cloudflare-tunnel/status')
}

export async function startCloudflareTunnel(target_url: string): Promise<{ success: boolean; tunnel?: CloudflareTunnelStatus; error?: string }> {
  return request('/api/system/cloudflare-tunnel/start', {
    method: 'POST',
    body: JSON.stringify({ target_url }),
  })
}

export async function stopCloudflareTunnel(): Promise<{ success: boolean; tunnel?: CloudflareTunnelStatus; error?: string }> {
  return request('/api/system/cloudflare-tunnel/stop', {
    method: 'POST',
  })
}

export async function shutdownWebUI(): Promise<{ success: boolean; message?: string }> {
  return request('/api/system/shutdown', { method: 'POST' })
}

export async function restartWebUI(): Promise<{ success: boolean; message?: string }> {
  return request('/api/system/restart', { method: 'POST' })
}

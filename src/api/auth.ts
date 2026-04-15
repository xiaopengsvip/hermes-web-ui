import { request } from './client'

export interface AuthCredentialEntry {
  index: number
  id: string
  label: string
  auth_type: string
  source: string
  priority: number
  status: string
  meta?: Record<string, any>
}

export interface AuthProviderCredentials {
  provider: string
  activeIndex: number
  entries: AuthCredentialEntry[]
}

export interface AuthCredentialsResponse {
  providers: AuthProviderCredentials[]
}

export interface AuthStreamEvent {
  id: string
  timestamp: string
  type: 'switch' | 'snapshot' | 'error' | 'info'
  message: string
  provider?: string
  payload?: Record<string, any>
}

export interface AuthStreamResponse {
  events: AuthStreamEvent[]
}

export async function fetchAuthCredentials(): Promise<AuthCredentialsResponse> {
  return request('/api/auth/credentials')
}

export async function fetchAuthStream(): Promise<AuthStreamResponse> {
  return request('/api/auth/stream')
}

export async function switchAuthCredential(provider: string, target: string | number): Promise<{ success: boolean; output?: string; error?: string }> {
  return request('/api/auth/switch', {
    method: 'POST',
    body: JSON.stringify({ provider, target }),
  })
}

export interface AddAuthCredentialPayload {
  provider: string
  api_key: string
  label?: string
  set_active?: boolean
}

export interface OAuthFlowSession {
  id: string
  provider: string
  label: string
  status: 'pending' | 'authorized' | 'failed' | 'cancelled'
  verification_url?: string | null
  user_code?: string | null
  created_at: string
  updated_at: string
  error?: string | null
  logs?: string[]
}

export async function addAuthCredential(payload: AddAuthCredentialPayload): Promise<{ success: boolean; output?: string; error?: string; label?: string }> {
  return request('/api/auth/add', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function startOAuthFlow(provider: string, label?: string): Promise<{ success: boolean; session: OAuthFlowSession }> {
  return request('/api/auth/oauth/start', {
    method: 'POST',
    body: JSON.stringify({ provider, label }),
  })
}

export async function getOAuthFlow(sessionId: string): Promise<{ session: OAuthFlowSession }> {
  return request(`/api/auth/oauth/${encodeURIComponent(sessionId)}`)
}

export async function cancelOAuthFlow(sessionId: string): Promise<{ success: boolean }> {
  return request(`/api/auth/oauth/${encodeURIComponent(sessionId)}/cancel`, {
    method: 'POST',
  })
}

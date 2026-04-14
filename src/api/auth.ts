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

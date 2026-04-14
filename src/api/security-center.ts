import { request } from './client'

export type SecuritySeverity = 'low' | 'medium' | 'high'

export interface SecurityFinding {
  id: string
  severity: SecuritySeverity
  title: string
  detail: string
  recommendation: string
}

export interface SecurityReport {
  generatedAt: number
  score: number
  findings: SecurityFinding[]
  summary: {
    high: number
    medium: number
    low: number
  }
}

export interface SecuritySettings {
  enabled: boolean
  dailyHour: number
  lastRunAt: number
}

export async function fetchSecurityLatest(): Promise<{ report: SecurityReport; settings: SecuritySettings }> {
  return request('/api/security-center/latest')
}

export async function runSecurityAudit(): Promise<{ ok: boolean; report: SecurityReport; settings: SecuritySettings }> {
  return request('/api/security-center/run', { method: 'POST', body: '{}' })
}

export async function saveSecuritySettings(payload: Partial<SecuritySettings>): Promise<{ ok: boolean; settings: SecuritySettings }> {
  return request('/api/security-center/settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

import { request } from './client'

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  updatedAt: number
  createdAt: number
  link?: {
    type: string
    repo: string
    org: string
  }
}

export interface VercelDeployment {
  uid: string
  name: string
  url: string
  state: string
  type: string
  createdAt: number
  ready?: number
  target: string | null
  source: string
  meta?: {
    githubCommitMessage?: string
    githubCommitRef?: string
    githubCommitSha?: string
  }
}

export interface VercelDomain {
  name: string
  verified: boolean
  createdAt: number
}

export async function fetchVercelProjects(limit = 20): Promise<{ projects: VercelProject[] }> {
  return request<{ projects: VercelProject[] }>(`/api/vercel/projects?limit=${limit}`)
}

export async function fetchVercelDeployments(params?: { projectId?: string; limit?: number }): Promise<{ deployments: VercelDeployment[] }> {
  const query = new URLSearchParams()
  if (params?.projectId) query.set('projectId', params.projectId)
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<{ deployments: VercelDeployment[] }>(`/api/vercel/deployments${qs ? '?' + qs : ''}`)
}

export async function fetchVercelDomains(projectId: string): Promise<{ domains: VercelDomain[] }> {
  return request<{ domains: VercelDomain[] }>(`/api/vercel/projects/${projectId}/domains`)
}

export async function redeployVercelProject(projectId: string): Promise<any> {
  return request('/api/vercel/deployments', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  })
}

export async function deleteVercelProject(projectId: string): Promise<void> {
  await request(`/api/vercel/projects/${projectId}`, { method: 'DELETE' })
}

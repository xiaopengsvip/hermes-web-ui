import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { homedir } from 'os'

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  updatedAt: number
  createdAt: number
  targets?: Record<string, any>
  latestDeployments?: VercelDeployment[]
  link?: {
    type: string
    repo: string
    org: string
    repoId: number
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

/**
 * Get Vercel token from environment or auth.json
 */
async function getToken(): Promise<string | null> {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN

  // Try ~/.local/share/com.vercel.cli/auth.json
  try {
    const authPath = resolve(homedir(), '.local', 'share', 'com.vercel.cli', 'auth.json')
    const raw = await readFile(authPath, 'utf-8')
    const auth = JSON.parse(raw)
    if (auth.token) return auth.token
  } catch { /* not found */ }

  // Try ~/.vercel/auth.json
  try {
    const authPath = resolve(homedir(), '.vercel', 'auth.json')
    const raw = await readFile(authPath, 'utf-8')
    const auth = JSON.parse(raw)
    if (auth.token) return auth.token
  } catch { /* not found */ }

  // Try hermes auth.json
  try {
    const authPath = resolve(homedir(), '.hermes', 'auth.json')
    const raw = await readFile(authPath, 'utf-8')
    const auth = JSON.parse(raw)
    if (auth.vercel_token) return auth.vercel_token
    const pool = auth.credential_pool || {}
    for (const [key, entries] of Object.entries(pool)) {
      if (key.toLowerCase().includes('vercel') && Array.isArray(entries)) {
        for (const entry of entries as any[]) {
          if (entry.access_token) return entry.access_token
        }
      }
    }
  } catch { /* not found */ }

  return null
}

async function vercelApi(path: string, options: { method?: string; body?: any } = {}): Promise<any> {
  const token = await getToken()
  if (!token) throw new Error('No Vercel token found.')

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const url = `https://api.vercel.com${path}`
  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  }

  if (options.body) {
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)

  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vercel API ${res.status}: ${text}`)
  }
  return res.json()
}

function seemsProjectId(value: string): boolean {
  const normalized = String(value || '').trim()
  // Vercel project IDs are typically 20+ alphanumeric chars and do not contain dots.
  return /^[A-Za-z0-9_-]{16,}$/.test(normalized) && !normalized.includes('.')
}

async function resolveProjectId(projectIdOrName?: string): Promise<string | undefined> {
  const raw = String(projectIdOrName || '').trim()
  if (!raw) return undefined

  if (seemsProjectId(raw)) {
    return raw
  }

  try {
    const project = await getProject(raw)
    if (project?.id) return project.id
  } catch (err: any) {
    const msg = String(err?.message || '')
    // For project names under different scopes, direct GET may return 404.
    // Fallback to list+match so UI can keep using human-friendly names.
    if (!msg.includes('Vercel API 404')) {
      throw err
    }
  }

  const projects = await listProjects(100)
  const matched = projects.find((project) => project.id === raw || project.name === raw)
  if (matched?.id) return matched.id

  throw new Error(`Vercel API 404: {"error":{"code":"not_found","message":"Project not found."}}`)
}

/**
 * List projects
 */
export async function listProjects(limit = 20): Promise<VercelProject[]> {
  const data = await vercelApi(`/v9/projects?limit=${limit}`)
  return data.projects || []
}

/**
 * Get a single project
 */
export async function getProject(projectIdOrName: string): Promise<VercelProject> {
  return vercelApi(`/v9/projects/${encodeURIComponent(projectIdOrName)}`)
}

/**
 * List deployments for a project or all
 */
export async function listDeployments(options: { projectId?: string; limit?: number } = {}): Promise<VercelDeployment[]> {
  const params = new URLSearchParams({
    limit: String(options.limit || 20),
  })
  const resolvedProjectId = await resolveProjectId(options.projectId)
  if (resolvedProjectId) params.set('projectId', resolvedProjectId)
  const data = await vercelApi(`/v6/deployments?${params}`)
  return data.deployments || []
}

/**
 * Get deployment details
 */
export async function getDeployment(deploymentId: string): Promise<VercelDeployment> {
  return vercelApi(`/v13/deployments/${deploymentId}`)
}

/**
 * Trigger a new deployment (redeploy)
 */
export async function redeploy(projectIdOrName: string): Promise<any> {
  const projectId = await resolveProjectId(projectIdOrName)
  if (!projectId) throw new Error('projectId is required')
  return vercelApi(`/v13/deployments`, {
    method: 'POST',
    body: { projectId, name: projectId },
  })
}

/**
 * List domains for a project
 */
export async function listDomains(projectIdOrName: string): Promise<VercelDomain[]> {
  const projectId = await resolveProjectId(projectIdOrName)
  if (!projectId) throw new Error('projectId is required')
  const data = await vercelApi(`/v9/projects/${projectId}/domains`)
  return data.domains || []
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  await vercelApi(`/v9/projects/${projectId}`, { method: 'DELETE' })
}

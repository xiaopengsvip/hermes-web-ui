import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { homedir } from 'os'

const execFileAsync = promisify(execFile)

export interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  private: boolean
  default_branch: string
  html_url: string
  clone_url: string
  ssh_url: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  language: string | null
  updated_at: string
  pushed_at: string
  topics: string[]
  fork: boolean
  archived: boolean
}

export interface GitHubBranch {
  name: string
  commit: { sha: string; url: string }
  protected: boolean
}

export interface GitHubCommit {
  sha: string
  message: string
  author: { name: string; email: string; date: string }
  url: string
}

/**
 * Get GitHub token from environment or ~/.hermes/auth.json
 */
async function getToken(): Promise<string | null> {
  // 1. Environment variable
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN

  // 2. Try ~/.hermes/auth.json for github token
  try {
    const authPath = resolve(homedir(), '.hermes', 'auth.json')
    const raw = await readFile(authPath, 'utf-8')
    const auth = JSON.parse(raw)
    if (auth.github_token) return auth.github_token
    // Check credential pool for github entries
    const pool = auth.credential_pool || {}
    for (const [key, entries] of Object.entries(pool)) {
      if (key.toLowerCase().includes('github') && Array.isArray(entries)) {
        for (const entry of entries as any[]) {
          if (entry.access_token) return entry.access_token
        }
      }
    }
  } catch { /* no auth file */ }

  // 3. Try gh CLI
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { timeout: 5000 })
    return stdout.trim()
  } catch { /* gh not available */ }

  return null
}

async function ghApi(path: string, options: { method?: string; body?: any } = {}): Promise<any> {
  const token = await getToken()
  if (!token) throw new Error('No GitHub token found. Set GITHUB_TOKEN or run "gh auth login".')

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const url = `https://api.github.com${path}`
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
    throw new Error(`GitHub API ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * List repositories for the authenticated user
 */
export async function listRepos(options: { sort?: string; per_page?: number; page?: number } = {}): Promise<GitHubRepo[]> {
  const params = new URLSearchParams({
    sort: options.sort || 'updated',
    per_page: String(options.per_page || 30),
    page: String(options.page || 1),
    affiliation: 'owner',
  })
  return ghApi(`/user/repos?${params}`)
}

/**
 * Get a single repository
 */
export async function getRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return ghApi(`/repos/${owner}/${repo}`)
}

/**
 * List branches for a repository
 */
export async function listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  return ghApi(`/repos/${owner}/${repo}/branches?per_page=50`)
}

/**
 * Get recent commits for a repository
 */
export async function listCommits(owner: string, repo: string, per_page = 10): Promise<GitHubCommit[]> {
  const data = await ghApi(`/repos/${owner}/${repo}/commits?per_page=${per_page}`)
  return data.map((c: any) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0].slice(0, 80),
    author: {
      name: c.commit.author.name,
      email: c.commit.author.email,
      date: c.commit.author.date,
    },
    url: c.html_url,
  }))
}

/**
 * Create a new repository
 */
export async function createRepo(data: {
  name: string
  description?: string
  private?: boolean
  auto_init?: boolean
}): Promise<GitHubRepo> {
  return ghApi('/user/repos', { method: 'POST', body: data })
}

/**
 * Delete a repository
 */
export async function deleteRepo(owner: string, repo: string): Promise<void> {
  await ghApi(`/repos/${owner}/${repo}`, { method: 'DELETE' })
}

/**
 * Get authenticated user info
 */
export async function getAuthenticatedUser(): Promise<{ login: string; name: string; avatar_url: string }> {
  return ghApi('/user')
}

import { request } from './client'

export interface GitHubUser {
  login: string
  name: string
  avatar_url: string
}

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

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  state: string
  html_url: string
  created_at: string
  updated_at: string
  draft?: boolean
  user?: { login: string }
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  state: string
  html_url: string
  created_at: string
  updated_at: string
  labels?: Array<{ name: string }>
  user?: { login: string }
}

export async function fetchGitHubUser(): Promise<GitHubUser> {
  return request<GitHubUser>('/api/github/user')
}

export async function fetchGitHubRepos(params?: { sort?: string; per_page?: number; page?: number }): Promise<{ repos: GitHubRepo[] }> {
  const query = new URLSearchParams()
  if (params?.sort) query.set('sort', params.sort)
  if (params?.per_page) query.set('per_page', String(params.per_page))
  if (params?.page) query.set('page', String(params.page))
  const qs = query.toString()
  return request<{ repos: GitHubRepo[] }>(`/api/github/repos${qs ? '?' + qs : ''}`)
}

export async function fetchGitHubBranches(owner: string, repo: string): Promise<{ branches: GitHubBranch[] }> {
  return request<{ branches: GitHubBranch[] }>(`/api/github/repos/${owner}/${repo}/branches`)
}

export async function fetchGitHubCommits(owner: string, repo: string, per_page = 10): Promise<{ commits: GitHubCommit[] }> {
  return request<{ commits: GitHubCommit[] }>(`/api/github/repos/${owner}/${repo}/commits?per_page=${per_page}`)
}

export async function fetchGitHubPulls(owner: string, repo: string, state = 'open', per_page = 20): Promise<{ pulls: GitHubPullRequest[] }> {
  return request<{ pulls: GitHubPullRequest[] }>(`/api/github/repos/${owner}/${repo}/pulls?state=${encodeURIComponent(state)}&per_page=${per_page}`)
}

export async function fetchGitHubIssues(owner: string, repo: string, state = 'open', per_page = 20): Promise<{ issues: GitHubIssue[] }> {
  return request<{ issues: GitHubIssue[] }>(`/api/github/repos/${owner}/${repo}/issues?state=${encodeURIComponent(state)}&per_page=${per_page}`)
}

export async function createGitHubIssue(owner: string, repo: string, data: { title: string; body?: string; labels?: string[] }): Promise<GitHubIssue> {
  return request<GitHubIssue>(`/api/github/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createGitHubPull(owner: string, repo: string, data: { title: string; head: string; base: string; body?: string; draft?: boolean }): Promise<GitHubPullRequest> {
  return request<GitHubPullRequest>(`/api/github/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createGitHubRepo(data: { name: string; description?: string; private?: boolean; auto_init?: boolean }): Promise<GitHubRepo> {
  return request<GitHubRepo>('/api/github/repos', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteGitHubRepo(owner: string, repo: string): Promise<void> {
  await request(`/api/github/repos/${owner}/${repo}`, { method: 'DELETE' })
}

export async function checkGitHubToken(): Promise<{ configured: boolean }> {
  return request<{ configured: boolean }>('/api/github/token-status')
}

export async function saveGitHubToken(token: string): Promise<{ success: boolean; error?: string }> {
  return request('/api/github/token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

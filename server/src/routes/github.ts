import Router from '@koa/router'
import { readFile, writeFile, copyFile } from 'fs/promises'
import { resolve } from 'path'
import { homedir } from 'os'
import * as github from '../services/github'

export const githubRoutes = new Router()

function githubErrorStatus(message: string): number {
  if (!message) return 500
  if (message.includes('No GitHub token')) return 401
  if (message.includes('Bad credentials')) return 401
  if (message.includes('GitHub API 401')) return 401
  if (message.includes('GitHub API 403')) return 403
  if (message.includes('GitHub API 404')) return 404
  return 500
}

// GET /api/github/token-status — check if token is available
githubRoutes.get('/api/github/token-status', async (ctx) => {
  const token = await github.getToken()
  ctx.body = { configured: !!token }
})

// POST /api/github/token — save GitHub token to auth.json
githubRoutes.post('/api/github/token', async (ctx) => {
  try {
    const body = ctx.request.body as any
    const token = (body?.token || '').trim()
    if (!token) {
      ctx.status = 400
      ctx.body = { error: 'Token is required' }
      return
    }

    const authPath = resolve(homedir(), '.hermes', 'auth.json')
    let auth: any = {}
    try {
      const raw = await readFile(authPath, 'utf-8')
      auth = JSON.parse(raw)
    } catch { /* no auth file yet */ }

    // Backup before modifying
    try { await copyFile(authPath, authPath + '.bak') } catch { /* ignore */ }

    auth.github_token = token
    await writeFile(authPath, JSON.stringify(auth, null, 2), 'utf-8')
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/github/user — authenticated user info
githubRoutes.get('/api/github/user', async (ctx) => {
  try {
    const user = await github.getAuthenticatedUser()
    ctx.body = user
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/github/repos — list repos
githubRoutes.get('/api/github/repos', async (ctx) => {
  try {
    const sort = (ctx.query.sort as string) || 'updated'
    const per_page = parseInt(ctx.query.per_page as string) || 30
    const page = parseInt(ctx.query.page as string) || 1
    const repos = await github.listRepos({ sort, per_page, page })
    ctx.body = { repos }
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/github/repos/:owner/:repo — single repo
githubRoutes.get('/api/github/repos/:owner/:repo', async (ctx) => {
  try {
    const repo = await github.getRepo(ctx.params.owner, ctx.params.repo)
    ctx.body = repo
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/github/repos/:owner/:repo/branches — list branches
githubRoutes.get('/api/github/repos/:owner/:repo/branches', async (ctx) => {
  try {
    const branches = await github.listBranches(ctx.params.owner, ctx.params.repo)
    ctx.body = { branches }
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/github/repos/:owner/:repo/commits — list commits
githubRoutes.get('/api/github/repos/:owner/:repo/commits', async (ctx) => {
  try {
    const per_page = parseInt(ctx.query.per_page as string) || 10
    const commits = await github.listCommits(ctx.params.owner, ctx.params.repo, per_page)
    ctx.body = { commits }
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

// POST /api/github/repos — create repo
githubRoutes.post('/api/github/repos', async (ctx) => {
  try {
    const body = ctx.request.body as any
    const repo = await github.createRepo({
      name: body.name,
      description: body.description,
      private: body.private ?? false,
      auto_init: body.auto_init ?? true,
    })
    ctx.body = repo
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

// DELETE /api/github/repos/:owner/:repo — delete repo
githubRoutes.delete('/api/github/repos/:owner/:repo', async (ctx) => {
  try {
    await github.deleteRepo(ctx.params.owner, ctx.params.repo)
    ctx.body = { ok: true }
  } catch (err: any) {
    ctx.status = githubErrorStatus(err.message)
    ctx.body = { error: err.message }
  }
})

import Router from '@koa/router'
import * as github from '../services/github'

export const githubRoutes = new Router()

// GET /api/github/user — authenticated user info
githubRoutes.get('/api/github/user', async (ctx) => {
  try {
    const user = await github.getAuthenticatedUser()
    ctx.body = user
  } catch (err: any) {
    ctx.status = err.message?.includes('No GitHub token') ? 401 : 500
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
    ctx.status = err.message?.includes('No GitHub token') ? 401 : 500
    ctx.body = { error: err.message }
  }
})

// GET /api/github/repos/:owner/:repo — single repo
githubRoutes.get('/api/github/repos/:owner/:repo', async (ctx) => {
  try {
    const repo = await github.getRepo(ctx.params.owner, ctx.params.repo)
    ctx.body = repo
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/github/repos/:owner/:repo/branches — list branches
githubRoutes.get('/api/github/repos/:owner/:repo/branches', async (ctx) => {
  try {
    const branches = await github.listBranches(ctx.params.owner, ctx.params.repo)
    ctx.body = { branches }
  } catch (err: any) {
    ctx.status = 500
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
    ctx.status = 500
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
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// DELETE /api/github/repos/:owner/:repo — delete repo
githubRoutes.delete('/api/github/repos/:owner/:repo', async (ctx) => {
  try {
    await github.deleteRepo(ctx.params.owner, ctx.params.repo)
    ctx.body = { ok: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

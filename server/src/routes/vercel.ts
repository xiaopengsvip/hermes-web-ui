import Router from '@koa/router'
import * as vercel from '../services/vercel'

export const vercelRoutes = new Router()

function resolveErrorStatus(message?: string): number {
  const msg = String(message || '')
  if (msg.includes('No Vercel token')) return 401
  if (msg.includes('Vercel API 404') || msg.includes('"code":"not_found"') || msg.includes('"code": "not_found"')) return 404
  if (msg.includes('Vercel API 400')) return 400
  return 500
}

// GET /api/vercel/projects — list projects
vercelRoutes.get('/api/vercel/projects', async (ctx) => {
  try {
    const limit = parseInt(ctx.query.limit as string) || 20
    const projects = await vercel.listProjects(limit)
    ctx.body = { projects }
  } catch (err: any) {
    ctx.status = resolveErrorStatus(err?.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/vercel/projects/:id — single project
vercelRoutes.get('/api/vercel/projects/:id', async (ctx) => {
  try {
    const project = await vercel.getProject(ctx.params.id)
    ctx.body = project
  } catch (err: any) {
    ctx.status = resolveErrorStatus(err?.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/vercel/deployments — list deployments
vercelRoutes.get('/api/vercel/deployments', async (ctx) => {
  try {
    const projectId = (ctx.query.projectId as string) || undefined
    const limit = parseInt(ctx.query.limit as string) || 20
    const deployments = await vercel.listDeployments({ projectId, limit })
    ctx.body = { deployments }
  } catch (err: any) {
    ctx.status = resolveErrorStatus(err?.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/vercel/deployments/:id — deployment details
vercelRoutes.get('/api/vercel/deployments/:id', async (ctx) => {
  try {
    const deployment = await vercel.getDeployment(ctx.params.id)
    ctx.body = deployment
  } catch (err: any) {
    ctx.status = resolveErrorStatus(err?.message)
    ctx.body = { error: err.message }
  }
})

// POST /api/vercel/deployments — redeploy
vercelRoutes.post('/api/vercel/deployments', async (ctx) => {
  try {
    const { projectId } = ctx.request.body as any
    if (!projectId) {
      ctx.status = 400
      ctx.body = { error: 'Missing projectId' }
      return
    }
    const result = await vercel.redeploy(projectId)
    ctx.body = result
  } catch (err: any) {
    ctx.status = resolveErrorStatus(err?.message)
    ctx.body = { error: err.message }
  }
})

// GET /api/vercel/projects/:id/domains — list domains
vercelRoutes.get('/api/vercel/projects/:id/domains', async (ctx) => {
  try {
    const domains = await vercel.listDomains(ctx.params.id)
    ctx.body = { domains }
  } catch (err: any) {
    ctx.status = resolveErrorStatus(err?.message)
    ctx.body = { error: err.message }
  }
})

// DELETE /api/vercel/projects/:id — delete project
vercelRoutes.delete('/api/vercel/projects/:id', async (ctx) => {
  try {
    await vercel.deleteProject(ctx.params.id)
    ctx.body = { ok: true }
  } catch (err: any) {
    ctx.status = resolveErrorStatus(err?.message)
    ctx.body = { error: err.message }
  }
})

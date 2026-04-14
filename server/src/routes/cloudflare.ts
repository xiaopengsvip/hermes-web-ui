import Router from '@koa/router'
import * as cloudflare from '../services/cloudflare'

export const cloudflareRoutes = new Router()

// GET /api/cloudflare/zones — list zones
cloudflareRoutes.get('/api/cloudflare/zones', async (ctx) => {
  try {
    const zones = await cloudflare.listZones()
    ctx.body = { zones }
  } catch (err: any) {
    ctx.status = err.message?.includes('No Cloudflare') ? 401 : 500
    ctx.body = { error: err.message }
  }
})

// GET /api/cloudflare/zones/:id — single zone
cloudflareRoutes.get('/api/cloudflare/zones/:id', async (ctx) => {
  try {
    const zone = await cloudflare.getZone(ctx.params.id)
    ctx.body = zone
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/cloudflare/zones/:id/dns — DNS records
cloudflareRoutes.get('/api/cloudflare/zones/:id/dns', async (ctx) => {
  try {
    const records = await cloudflare.listDnsRecords(ctx.params.id)
    ctx.body = { records }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/cloudflare/zones/:id/dns — create DNS record
cloudflareRoutes.post('/api/cloudflare/zones/:id/dns', async (ctx) => {
  try {
    const record = await cloudflare.createDnsRecord(ctx.params.id, ctx.request.body as any)
    ctx.body = record
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// DELETE /api/cloudflare/zones/:zoneId/dns/:recordId — delete DNS record
cloudflareRoutes.delete('/api/cloudflare/zones/:zoneId/dns/:recordId', async (ctx) => {
  try {
    await cloudflare.deleteDnsRecord(ctx.params.zoneId, ctx.params.recordId)
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/cloudflare/workers — list workers
cloudflareRoutes.get('/api/cloudflare/workers', async (ctx) => {
  try {
    const workers = await cloudflare.listWorkers()
    ctx.body = { workers }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/cloudflare/accounts — list accounts
cloudflareRoutes.get('/api/cloudflare/accounts', async (ctx) => {
  try {
    const accounts = await cloudflare.listAccounts()
    ctx.body = { accounts }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/cloudflare/zones/:id/purge-cache — purge cache
cloudflareRoutes.post('/api/cloudflare/zones/:id/purge-cache', async (ctx) => {
  try {
    const body = ctx.request.body as any
    const result = await cloudflare.purgeCache(ctx.params.id, body?.files)
    ctx.body = result
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

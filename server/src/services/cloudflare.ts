import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { homedir } from 'os'

export interface CloudflareZone {
  id: string
  name: string
  status: string
  paused: boolean
  type: string
  development_mode: number
  name_servers: string[]
  original_name_servers: string[]
  created_on: string
  modified_on: string
  plan: {
    id: string
    name: string
    price: number
    currency: string
  }
}

export interface CloudflareDnsRecord {
  id: string
  zone_id: string
  zone_name: string
  name: string
  type: string
  content: string
  proxied: boolean
  ttl: number
  created_on: string
  modified_on: string
}

export interface CloudflareWorker {
  id: string
  name: string
  created_on: string
  modified_on: string
  size: number
}

export interface CloudflareAccount {
  id: string
  name: string
  type: string
}

/** Get Cloudflare API token */
async function getToken(): Promise<string | null> {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN
  if (process.env.CF_API_TOKEN) return process.env.CF_API_TOKEN

  // Try ~/.hermes/auth.json
  try {
    const authPath = resolve(homedir(), '.hermes', 'auth.json')
    const raw = await readFile(authPath, 'utf-8')
    const auth = JSON.parse(raw)
    if (auth.cloudflare_token) return auth.cloudflare_token
    const pool = auth.credential_pool || {}
    for (const [key, entries] of Object.entries(pool)) {
      if (key.toLowerCase().includes('cloudflare') && Array.isArray(entries)) {
        for (const entry of entries as any[]) {
          if (entry.access_token || entry.api_token) return entry.access_token || entry.api_token
        }
      }
    }
  } catch { /* not found */ }

  return null
}

async function cfApi(path: string, options: { method?: string; body?: any } = {}): Promise<any> {
  const token = await getToken()
  if (!token) throw new Error('No Cloudflare API token found.')

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const url = `https://api.cloudflare.com/client/v4${path}`
  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  }

  if (options.body) {
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)
  const data = await res.json()

  if (!res.ok || !data.success) {
    const errors = data.errors?.map((e: any) => e.message).join(', ') || res.statusText
    throw new Error(`Cloudflare API ${res.status}: ${errors}`)
  }

  return data.result
}

/** List all zones (domains) */
export async function listZones(): Promise<CloudflareZone[]> {
  return cfApi('/zones?per_page=50') || []
}

/** Get zone details */
export async function getZone(zoneId: string): Promise<CloudflareZone> {
  return cfApi(`/zones/${zoneId}`)
}

/** List DNS records for a zone */
export async function listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
  return cfApi(`/zones/${zoneId}/dns_records?per_page=100`) || []
}

/** Create DNS record */
export async function createDnsRecord(zoneId: string, record: { type: string; name: string; content: string; proxied?: boolean; ttl?: number }): Promise<CloudflareDnsRecord> {
  return cfApi(`/zones/${zoneId}/dns_records`, { method: 'POST', body: record })
}

/** Delete DNS record */
export async function deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
  await cfApi(`/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE' })
}

/** List workers across all accounts */
export async function listWorkers(): Promise<CloudflareWorker[]> {
  const accounts = await listAccounts()
  const all: CloudflareWorker[] = []

  for (const account of accounts) {
    try {
      const scripts = await cfApi(`/accounts/${account.id}/workers/scripts`)
      if (Array.isArray(scripts)) {
        for (const w of scripts) {
          all.push({
            id: w.id || w.script || `${account.id}:${w.name || 'worker'}`,
            name: w.name || w.id || w.script || 'worker',
            created_on: w.created_on || '',
            modified_on: w.modified_on || '',
            size: Number(w.size || 0),
          })
        }
      }
    } catch {
      // Skip accounts where Workers API isn't enabled/authorized
    }
  }

  return all
}

/** List accounts */
export async function listAccounts(): Promise<CloudflareAccount[]> {
  return cfApi('/accounts') || []
}

/** Get zone analytics */
export async function getZoneAnalytics(zoneId: string): Promise<any> {
  return cfApi(`/zones/${zoneId}/analytics/dashboard`)
}

/** Purge zone cache */
export async function purgeCache(zoneId: string, files?: string[]): Promise<any> {
  const body = files ? { files } : { purge_everything: true }
  return cfApi(`/zones/${zoneId}/purge_cache`, { method: 'POST', body })
}

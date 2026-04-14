import { request } from './client'

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

export async function fetchCloudflareZones(): Promise<CloudflareZone[]> {
  try {
    const data = await request('/api/cloudflare/zones')
    return (data as any).zones || []
  } catch {
    return []
  }
}

export async function fetchCloudflareZone(zoneId: string): Promise<CloudflareZone | null> {
  try {
    return await request(`/api/cloudflare/zones/${zoneId}`) as CloudflareZone
  } catch {
    return null
  }
}

export async function fetchDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
  try {
    const data = await request(`/api/cloudflare/zones/${zoneId}/dns`)
    return (data as any).records || []
  } catch {
    return []
  }
}

export async function createDnsRecord(zoneId: string, record: { type: string; name: string; content: string; proxied?: boolean; ttl?: number }): Promise<CloudflareDnsRecord | null> {
  try {
    return await request(`/api/cloudflare/zones/${zoneId}/dns`, { method: 'POST', body: JSON.stringify(record) }) as CloudflareDnsRecord
  } catch {
    return null
  }
}

export async function deleteDnsRecord(zoneId: string, recordId: string): Promise<boolean> {
  try {
    await request(`/api/cloudflare/zones/${zoneId}/dns/${recordId}`, { method: 'DELETE' })
    return true
  } catch {
    return false
  }
}

export async function fetchCloudflareWorkers(): Promise<CloudflareWorker[]> {
  try {
    const data = await request('/api/cloudflare/workers')
    return (data as any).workers || []
  } catch {
    return []
  }
}

export async function fetchCloudflareAccounts(): Promise<CloudflareAccount[]> {
  try {
    const data = await request('/api/cloudflare/accounts')
    return (data as any).accounts || []
  } catch {
    return []
  }
}

export async function purgeCache(zoneId: string, files?: string[]): Promise<boolean> {
  try {
    await request(`/api/cloudflare/zones/${zoneId}/purge-cache`, { method: 'POST', body: JSON.stringify({ files }) })
    return true
  } catch {
    return false
  }
}

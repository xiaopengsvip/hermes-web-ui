import { request } from '../client'

export type TunnelName = 'frontend' | 'backend'

export interface TunnelStatus {
  name: TunnelName
  target_url: string
  running: boolean
  pid?: number
  public_url?: string
  error?: string
  started_at?: string
  updated_at: string
}

export async function fetchTunnels(): Promise<Record<TunnelName, TunnelStatus>> {
  const res = await request<{ tunnels: Record<TunnelName, TunnelStatus> }>('/api/hermes/tunnels')
  return res.tunnels
}

export async function startTunnel(name: TunnelName, target_url?: string): Promise<TunnelStatus> {
  const res = await request<{ success: boolean; tunnel: TunnelStatus }>(`/api/hermes/tunnels/${name}/start`, {
    method: 'POST',
    body: JSON.stringify(target_url ? { target_url } : {}),
  })
  return res.tunnel
}

export async function stopTunnel(name: TunnelName): Promise<TunnelStatus> {
  const res = await request<{ success: boolean; tunnel: TunnelStatus }>(`/api/hermes/tunnels/${name}/stop`, {
    method: 'POST',
  })
  return res.tunnel
}

export async function restartTunnel(name: TunnelName, target_url?: string): Promise<TunnelStatus> {
  const res = await request<{ success: boolean; tunnel: TunnelStatus }>(`/api/hermes/tunnels/${name}/restart`, {
    method: 'POST',
    body: JSON.stringify(target_url ? { target_url } : {}),
  })
  return res.tunnel
}

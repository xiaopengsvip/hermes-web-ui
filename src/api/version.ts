import { request } from './client'

export interface VersionFeature {
  name: string
  description: string
  category: string
  endpoints?: string[]
}

export interface BackendRoute {
  method: string
  path: string
  desc: string
}

export interface DepItem {
  name: string
  version: string
}

export interface VersionInfo {
  web_ui: {
    name: string
    version: string
    description: string
    license: string
    repository: string
  }
  hermes: {
    version: string
    gateway_status: string
  }
  upstream: {
    url: string
    status: string
    version: string
  }
  runtime: {
    node: string
    platform: string
    arch: string
    pid: number
    uptime_seconds: number
    uptime_human: string
  }
  server: {
    port: number
    cors_origins: string
    upload_dir: string
  }
  features: {
    total: number
    categories: Record<string, VersionFeature[]>
    list: VersionFeature[]
  }
  backend_routes: BackendRoute[]
  dependencies: DepItem[]
  dev_dependencies: DepItem[]
  timestamp: string
}

export async function fetchVersionInfo(): Promise<VersionInfo> {
  return request<VersionInfo>('/api/version')
}

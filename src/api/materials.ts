import { request } from './client'

export type MaterialType = 'image' | 'document' | 'video' | 'audio' | 'code' | 'other'
export type MaterialSource = 'upload' | 'chat'
export type PreviewKind = 'image' | 'video' | 'audio' | 'text' | 'binary'

export interface MaterialSessionRef {
  id: string
  title: string
  updatedAt?: number
}

export interface MaterialCategory {
  name: string
  count: number
}

export interface Material {
  id: string
  name: string
  type: MaterialType
  size: number
  uploadedAt: number
  lastModified: number
  url: string
  tags: string[]
  description?: string
  usedIn: string[]
  source: MaterialSource
  category: string
  chatSessionId?: string
  chatMessageId?: string
  chatSessions: MaterialSessionRef[]
  previewKind: PreviewKind
}

export interface MaterialsResponse {
  materials: Material[]
  categories: MaterialCategory[]
  chatSessions: MaterialSessionRef[]
}

export async function fetchMaterials(): Promise<MaterialsResponse> {
  return request<MaterialsResponse>('/api/materials')
}

export async function deleteMaterial(id: string): Promise<void> {
  await request(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function fetchMaterialText(id: string, limit = 20000): Promise<{ text: string; truncated: boolean }> {
  return request<{ text: string; truncated: boolean }>(`/api/materials/${encodeURIComponent(id)}/text?limit=${limit}`)
}

export async function uploadMaterial(file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/upload', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Upload failed: ${res.status}`)
  }
}

import Router from '@koa/router'
import { config } from '../config'
import { promises as fsp, createReadStream } from 'fs'
import { resolve, extname, basename } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const materialsRoutes = new Router()

type MaterialType = 'image' | 'document' | 'video' | 'audio' | 'code' | 'other'
type PreviewKind = 'image' | 'video' | 'audio' | 'text' | 'binary'
type MaterialSource = 'upload' | 'chat'

interface MaterialSessionRef {
  id: string
  title: string
  updatedAt?: number
}

interface MaterialItem {
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
  filePath: string
  ext: string
  mime: string
  previewKind: PreviewKind
}

const MATERIAL_EXT: Record<string, MaterialType> = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image', '.svg': 'image', '.bmp': 'image',
  '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.ppt': 'document', '.pptx': 'document', '.xls': 'document', '.xlsx': 'document', '.txt': 'document', '.md': 'document', '.csv': 'document',
  '.mp4': 'video', '.avi': 'video', '.mov': 'video', '.wmv': 'video', '.flv': 'video', '.webm': 'video', '.mkv': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.flac': 'audio', '.m4a': 'audio', '.aac': 'audio',
  '.js': 'code', '.ts': 'code', '.py': 'code', '.java': 'code', '.cpp': 'code', '.c': 'code', '.h': 'code', '.json': 'code', '.xml': 'code', '.html': 'code', '.css': 'code', '.yaml': 'code', '.yml': 'code', '.sh': 'code'
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.js': 'text/javascript; charset=utf-8', '.ts': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.yaml': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8', '.sh': 'text/plain; charset=utf-8'
}

const TEXT_EXT = new Set(['.txt', '.md', '.csv', '.json', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.xml', '.html', '.css', '.yaml', '.yml', '.sh'])

function materialTypeByExt(ext: string): MaterialType {
  return MATERIAL_EXT[ext.toLowerCase()] || 'other'
}

function previewKindByExt(ext: string): PreviewKind {
  const t = materialTypeByExt(ext)
  if (t === 'image') return 'image'
  if (t === 'video') return 'video'
  if (t === 'audio') return 'audio'
  if (TEXT_EXT.has(ext.toLowerCase())) return 'text'
  return 'binary'
}

function mimeByExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] || 'application/octet-stream'
}

function buildId(source: MaterialSource, fullPath: string, sessionId?: string, messageId?: string): string {
  const raw = `${source}|${fullPath}|${sessionId || ''}|${messageId || ''}`
  return Buffer.from(raw).toString('base64url')
}

async function safeStat(path: string) {
  try {
    return await fsp.stat(path)
  } catch {
    return null
  }
}

async function listDirFiles(dirPath: string): Promise<string[]> {
  try {
    const st = await fsp.stat(dirPath)
    if (!st.isDirectory()) return []
    const names = await fsp.readdir(dirPath)
    return names.map((n) => resolve(dirPath, n))
  } catch {
    return []
  }
}

function collectMediaPathsFromObject(obj: any, paths: Set<string>) {
  if (obj == null) return
  if (typeof obj === 'string') {
    const mediaMatch = obj.match(/MEDIA:([^\s]+)/g)
    if (mediaMatch) {
      for (const m of mediaMatch) {
        const p = m.slice('MEDIA:'.length).trim()
        if (p.startsWith('/')) paths.add(p)
      }
    }
    return
  }
  if (Array.isArray(obj)) {
    for (const it of obj) collectMediaPathsFromObject(it, paths)
    return
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) collectMediaPathsFromObject(v, paths)
  }
}

async function collectChatSessionData(): Promise<{
  mediaRefs: Array<{ path: string; sessionId?: string; messageId?: string }>
  sessionsById: Map<string, MaterialSessionRef>
}> {
  const mediaRefs: Array<{ path: string; sessionId?: string; messageId?: string }> = []
  const sessionsById = new Map<string, MaterialSessionRef>()

  try {
    const { stdout } = await execFileAsync('hermes', ['sessions', 'export', '-'], {
      maxBuffer: 80 * 1024 * 1024,
      timeout: 30000,
    })
    const lines = stdout.trim().split('\n').filter(Boolean)

    for (const line of lines) {
      try {
        const sess = JSON.parse(line)
        const sessionId = String(sess?.id || '')
        if (!sessionId) continue

        const title = String(sess?.title || sess?.name || `session-${sessionId.slice(0, 8)}`)
        const updatedAtRaw = sess?.updated_at || sess?.updatedAt || sess?.last_updated || sess?.created_at || sess?.createdAt
        const updatedAt = typeof updatedAtRaw === 'number' ? updatedAtRaw : undefined
        sessionsById.set(sessionId, { id: sessionId, title, updatedAt })

        const messages = Array.isArray(sess?.messages) ? sess.messages : []
        for (const msg of messages) {
          const paths = new Set<string>()
          collectMediaPathsFromObject(msg, paths)
          for (const p of paths) {
            mediaRefs.push({ path: p, sessionId, messageId: msg?.id || undefined })
          }
        }
      } catch {
        // ignore malformed lines
      }
    }
  } catch {
    // ignore if hermes export unavailable
  }

  return { mediaRefs, sessionsById }
}

async function buildMaterialIndex(): Promise<{ materials: MaterialItem[]; categories: Array<{ name: string; count: number }>; chatSessions: MaterialSessionRef[] }> {
  const home = homedir()
  const uploadFiles = await listDirFiles(config.uploadDir)
  const artifactDirs = [
    resolve(home, '.hermes', 'audio_cache'),
    resolve(home, 'voice-memos'),
    resolve(home, '.hermes', 'sessions'),
  ]

  const artifactFilesNested = await Promise.all(artifactDirs.map((d) => listDirFiles(d)))
  const artifactFiles = artifactFilesNested.flat()
  const { mediaRefs: chatMediaRefs, sessionsById } = await collectChatSessionData()

  const byPath = new Map<string, MaterialItem>()

  const inferSessionRefsFromPath = (fullPath: string): MaterialSessionRef[] => {
    const base = basename(fullPath)
    const refs: MaterialSessionRef[] = []
    for (const s of sessionsById.values()) {
      if (base.includes(s.id)) refs.push(s)
    }
    return refs
  }

  const addFile = async (fullPath: string, source: MaterialSource, sessionId?: string, messageId?: string) => {
    const exists = byPath.get(fullPath)
    if (exists) {
      if (sessionId && sessionsById.has(sessionId) && !exists.chatSessions.find((s) => s.id === sessionId)) {
        exists.chatSessions.push(sessionsById.get(sessionId) as MaterialSessionRef)
      }
      return
    }

    const st = await safeStat(fullPath)
    if (!st || !st.isFile()) return

    const ext = extname(fullPath).toLowerCase()
    const type = materialTypeByExt(ext)

    // keep only useful material-like files
    const allow = type !== 'other' || ['.pdf', '.zip', '.tar', '.gz', '.json', '.log', '.txt'].includes(ext)
    if (!allow) return

    const previewKind = previewKindByExt(ext)
    const category = `${source}-${previewKind}`
    const directSessionRefs = sessionId && sessionsById.has(sessionId) ? [sessionsById.get(sessionId) as MaterialSessionRef] : []
    const inferredSessionRefs = source === 'chat' ? inferSessionRefsFromPath(fullPath) : []
    const chatSessions = [...directSessionRefs]
    for (const s of inferredSessionRefs) {
      if (!chatSessions.find((x) => x.id === s.id)) chatSessions.push(s)
    }

    const item: MaterialItem = {
      id: buildId(source, fullPath, sessionId, messageId),
      name: basename(fullPath),
      type,
      size: st.size,
      uploadedAt: st.mtimeMs,
      lastModified: st.mtimeMs,
      url: `/api/materials/${encodeURIComponent(buildId(source, fullPath, sessionId, messageId))}/content`,
      tags: [source === 'chat' ? 'chat-output' : 'upload', ext.replace('.', ''), category].filter(Boolean),
      description: source === 'chat' ? 'Chat generated artifact' : 'Uploaded file',
      usedIn: source === 'chat' ? ['chat'] : ['upload'],
      source,
      category,
      chatSessionId: sessionId,
      chatMessageId: messageId,
      chatSessions,
      filePath: fullPath,
      ext,
      mime: mimeByExt(ext),
      previewKind,
    }

    byPath.set(fullPath, item)
  }

  // uploads
  for (const p of uploadFiles) await addFile(p, 'upload')

  // known artifact dirs (chat-related generated files)
  for (const p of artifactFiles) await addFile(p, 'chat')

  // direct MEDIA refs from sessions
  for (const ref of chatMediaRefs) await addFile(ref.path, 'chat', ref.sessionId, ref.messageId)

  const materials = [...byPath.values()].sort((a, b) => b.uploadedAt - a.uploadedAt)

  const catCount = new Map<string, number>()
  for (const m of materials) catCount.set(m.category, (catCount.get(m.category) || 0) + 1)
  const categories = [...catCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  const chatSessions = [...sessionsById.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

  return { materials, categories, chatSessions }
}

materialsRoutes.get('/api/materials', async (ctx) => {
  const { materials, categories, chatSessions } = await buildMaterialIndex()

  const type = String(ctx.query.type || '')
  const source = String(ctx.query.source || '')
  const category = String(ctx.query.category || '')
  const sessionId = String(ctx.query.sessionId || '')

  const filtered = materials.filter((m) => {
    if (type && m.type !== type) return false
    if (source && m.source !== source) return false
    if (category && m.category !== category) return false
    if (sessionId && !m.chatSessions.some((s) => s.id === sessionId)) return false
    return true
  })

  ctx.body = { materials: filtered, categories, chatSessions }
})

materialsRoutes.get('/api/materials/:id/content', async (ctx) => {
  const { materials } = await buildMaterialIndex()
  const id = String(ctx.params.id || '')
  const item = materials.find((m) => m.id === id)
  if (!item) {
    ctx.status = 404
    ctx.body = { error: 'Material not found' }
    return
  }

  ctx.set('Content-Type', item.mime)
  ctx.set('Content-Disposition', `inline; filename="${encodeURIComponent(item.name)}"`)
  ctx.body = createReadStream(item.filePath)
})

materialsRoutes.get('/api/materials/:id/text', async (ctx) => {
  const { materials } = await buildMaterialIndex()
  const id = String(ctx.params.id || '')
  const item = materials.find((m) => m.id === id)
  if (!item) {
    ctx.status = 404
    ctx.body = { error: 'Material not found' }
    return
  }
  if (!TEXT_EXT.has(item.ext)) {
    ctx.status = 400
    ctx.body = { error: 'Text preview not supported for this file type' }
    return
  }

  const limit = Math.max(1000, Math.min(parseInt(String(ctx.query.limit || '20000'), 10) || 20000, 100000))
  try {
    const buf = await fsp.readFile(item.filePath)
    const text = buf.toString('utf-8').slice(0, limit)
    ctx.body = { text, truncated: text.length >= limit }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err?.message || 'Failed to read text preview' }
  }
})

materialsRoutes.delete('/api/materials/:id', async (ctx) => {
  const { materials } = await buildMaterialIndex()
  const id = String(ctx.params.id || '')
  const item = materials.find((m) => m.id === id)
  if (!item) {
    ctx.status = 404
    ctx.body = { error: 'Material not found' }
    return
  }

  try {
    await fsp.unlink(item.filePath)
    ctx.body = { ok: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err?.message || 'Failed to delete material' }
  }
})

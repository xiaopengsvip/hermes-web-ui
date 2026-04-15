import { defineStore } from 'pinia'
import { ref } from 'vue'
import { startRun, streamRunEvents, type ChatMessage, type RunEvent } from '@/api/chat'
import { fetchSessions, fetchSession, deleteSession as deleteSessionApi, type SessionSummary, type HermesMessage } from '@/api/sessions'
import { useAppStore } from './app'
import { useTerminalStore } from './terminal'

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  file?: File
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolName?: string
  toolPreview?: string
  toolStatus?: 'running' | 'done' | 'error'
  isStreaming?: boolean
  attachments?: Attachment[]
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  model?: string
  provider?: string
  messageCount?: number
}

export interface StreamEventItem {
  id: string
  event: string
  label: string
  timestamp: number
  detail?: Record<string, any>
  level?: 'info' | 'success' | 'error'
}

const EVENT_LABELS: Record<string, string> = {
  'run.queued': '任务已入队',
  'run.started': '任务开始',
  'message.delta': '模型增量输出',
  'tool.started': '工具开始执行',
  'tool.completed': '工具执行完成',
  'run.completed': '任务完成',
  'run.failed': '任务失败',
  'run.done': '流结束',
  'run.error': '流错误',
  'run.stopped': '手动停止',
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function uploadFiles(attachments: Attachment[]): Promise<{ name: string; path: string }[]> {
  if (attachments.length === 0) return []
  const formData = new FormData()
  for (const att of attachments) {
    if (att.file) formData.append('file', att.file, att.name)
  }
  const res = await fetch('/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json() as { files: { name: string; path: string }[] }
  return data.files
}

function mapHermesMessages(msgs: HermesMessage[]): Message[] {
  // Build a lookup of tool_call_id -> tool name from assistant messages with tool_calls
  const toolNameMap = new Map<string, string>()
  for (const msg of msgs) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.function?.name && tc.id) {
          toolNameMap.set(tc.id, tc.function.name)
        }
      }
    }
  }

  const result: Message[] = []
  for (const msg of msgs) {
    // Skip assistant messages that only contain tool_calls (no meaningful content)
    if (msg.role === 'assistant' && msg.tool_calls?.length && !msg.content?.trim()) {
      // Emit a tool.started message for each tool call
      for (const tc of msg.tool_calls) {
        result.push({
          id: String(msg.id) + '_' + tc.id,
          role: 'tool',
          content: '',
          timestamp: Math.round(msg.timestamp * 1000),
          toolName: tc.function?.name || 'Tool',
          toolStatus: 'done',
        })
      }
      continue
    }

    // Tool result messages
    if (msg.role === 'tool') {
      const toolName = msg.tool_name || toolNameMap.get(msg.tool_call_id || '') || 'Tool'
      const raw = msg.content || ''
      // Extract a short preview from the content
      let preview = ''
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          preview = parsed.url || parsed.title || parsed.preview || parsed.summary || ''
        } catch {
          preview = raw.slice(0, 80)
        }
      }
      result.push({
        id: String(msg.id),
        role: 'tool',
        content: raw,
        timestamp: Math.round(msg.timestamp * 1000),
        toolName,
        toolPreview: preview.slice(0, 100) || undefined,
        toolStatus: 'done',
      })
      continue
    }

    // Normal user/assistant messages
    result.push({
      id: String(msg.id),
      role: msg.role,
      content: msg.content || '',
      timestamp: Math.round(msg.timestamp * 1000),
    })
  }
  return result
}

function mapHermesSession(s: SessionSummary): Session {
  return {
    id: s.id,
    title: s.title || 'New Chat',
    messages: [],
    createdAt: Math.round(s.started_at * 1000),
    updatedAt: Math.round((s.ended_at || s.started_at) * 1000),
    model: s.model,
    provider: (s as any).billing_provider || '',
    messageCount: s.message_count,
  }
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<Session[]>([])
  const activeSessionId = ref<string | null>(null)
  const isStreaming = ref(false)
  const abortController = ref<AbortController | null>(null)
  const isLoadingSessions = ref(false)
  const isLoadingMessages = ref(false)
  const streamEvents = ref<StreamEventItem[]>([])
  const lastDeltaEventTs = ref(0)


  const activeSession = ref<Session | null>(null)
  const messages = ref<Message[]>([])

  function pushStreamEvent(event: string, detail?: Record<string, any>, level: StreamEventItem['level'] = 'info') {
    if (event === 'message.delta') {
      const now = Date.now()
      if (now - lastDeltaEventTs.value < 700) return
      lastDeltaEventTs.value = now
    }

    streamEvents.value.unshift({
      id: uid(),
      event,
      label: EVENT_LABELS[event] || event,
      timestamp: Date.now(),
      detail,
      level,
    })

    if (streamEvents.value.length > 300) {
      streamEvents.value = streamEvents.value.slice(0, 300)
    }
  }

  function clearStreamEvents() {
    streamEvents.value = []
    lastDeltaEventTs.value = 0
  }

  async function loadSessions() {
    isLoadingSessions.value = true
    try {
      const list = await fetchSessions('api_server')
      sessions.value = list.map(mapHermesSession)
      // Backfill titles from first user message for sessions with null title
      const nullTitleSessions = sessions.value.filter(s => s.title === 'New Chat')
      if (nullTitleSessions.length > 0) {
        await Promise.allSettled(
          nullTitleSessions.map(async (s) => {
            const detail = await fetchSession(s.id)
            if (detail?.messages) {
              const firstUser = detail.messages.find(m => m.role === 'user')
              if (firstUser) {
                const t = firstUser.content.slice(0, 40)
                s.title = t + (firstUser.content.length > 40 ? '...' : '')
              }
            }
          })
        )
      }
      // Auto-select the most recent session
      if (!activeSessionId.value && sessions.value.length > 0) {
        await switchSession(sessions.value[0].id)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      isLoadingSessions.value = false
    }
  }

  function createSession(): Session {
    const session: Session = {
      id: uid(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sessions.value.unshift(session)
    return session
  }

  async function switchSession(sessionId: string) {
    clearStreamEvents()
    activeSessionId.value = sessionId
    activeSession.value = sessions.value.find(s => s.id === sessionId) || null

    // If session has no messages loaded, fetch from API
    if (activeSession.value && activeSession.value.messages.length === 0) {
      isLoadingMessages.value = true
      try {
        const detail = await fetchSession(sessionId)
        if (detail && detail.messages) {
          const mapped = mapHermesMessages(detail.messages)
          activeSession.value.messages = mapped
          // Update title: use Hermes title, or fallback to first user message
          if (detail.title) {
            activeSession.value.title = detail.title
          } else {
            const firstUser = mapped.find(m => m.role === 'user')
            if (firstUser) {
              const t = firstUser.content.slice(0, 40)
              activeSession.value.title = t + (firstUser.content.length > 40 ? '...' : '')
            }
          }
        }
      } catch (err) {
        console.error('Failed to load session messages:', err)
      } finally {
        isLoadingMessages.value = false
      }
    }

    messages.value = activeSession.value ? [...activeSession.value.messages] : []
  }

  function newChat() {
    if (isStreaming.value) return
    const session = createSession()
    // Inherit current global model
    const appStore = useAppStore()
    session.model = appStore.selectedModel || undefined
    switchSession(session.id)
  }

  async function switchSessionModel(modelId: string, provider?: string) {
    if (!activeSession.value) return
    activeSession.value.model = modelId
    activeSession.value.provider = provider || ''
    // If provider changed, update global config too (Hermes requires it)
    if (provider) {
      const { useAppStore } = await import('./app')
      await useAppStore().switchModel(modelId, provider)
    }
  }

  async function deleteSession(sessionId: string) {
    await deleteSessionApi(sessionId)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    if (activeSessionId.value === sessionId) {
      if (sessions.value.length > 0) {
        await switchSession(sessions.value[0].id)
      } else {
        const session = createSession()
        switchSession(session.id)
      }
    }
  }

  function syncActiveMessages() {
    if (activeSession.value) {
      activeSession.value.messages = [...messages.value]
      activeSession.value.updatedAt = Date.now()
    }
  }

  function addMessage(msg: Message) {
    messages.value.push(msg)
    syncActiveMessages()
  }

  function updateMessage(id: string, update: Partial<Message>) {
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx !== -1) {
      messages.value[idx] = { ...messages.value[idx], ...update }
      syncActiveMessages()
    }
  }

  function updateSessionTitle(sessionId?: string, newTitle?: string) {
    if (sessionId && newTitle) {
      // Explicit rename
      const session = sessions.value.find(s => s.id === sessionId)
      if (session) {
        session.title = newTitle
        session.updatedAt = Date.now()
        if (activeSession.value?.id === sessionId) {
          activeSession.value.title = newTitle
        }
      }
      return
    }
    if (!activeSession.value) return
    if (activeSession.value.title === 'New Chat') {
      const firstUser = messages.value.find(m => m.role === 'user')
      if (firstUser) {
        const title = firstUser.attachments?.length
          ? firstUser.attachments.map(a => a.name).join(', ')
          : firstUser.content
        activeSession.value.title = title.slice(0, 40) + (title.length > 40 ? '...' : '')
      }
    }
    activeSession.value.updatedAt = Date.now()
  }

  function isLikelyTerminalCommand(input: string): boolean {
    const text = input.trim()
    if (!text) return false

    if (text.startsWith('$ ')) return true

    const cmdPrefix = /^(ls|pwd|cd|cat|echo|grep|find|git|npm|pnpm|yarn|python|python3|node|curl|wget|chmod|chown|mv|cp|rm|mkdir|touch|ps|top|htop|df|du|whoami|uname|systemctl|pm2|vercel)\b/
    return cmdPrefix.test(text)
  }

  async function sendHybridInput(content: string, attachments?: Attachment[]) {
    const pure = content.trim()

    if (attachments && attachments.length > 0) {
      await sendMessage(content, attachments)
      return
    }

    if (!isLikelyTerminalCommand(pure)) {
      await sendMessage(content, attachments)
      return
    }

    if (!activeSession.value) {
      const session = createSession()
      switchSession(session.id)
    }

    const terminalStore = useTerminalStore()
    if (!terminalStore.activeSession) {
      terminalStore.createSession()
    }

    const cmd = pure.startsWith('$ ') ? pure.slice(2).trim() : pure

    addMessage({
      id: uid(),
      role: 'user',
      content: pure,
      timestamp: Date.now(),
    })
    updateSessionTitle()

    isStreaming.value = true
    clearStreamEvents()
    pushStreamEvent('run.queued', { mode: 'terminal', command: cmd })
    pushStreamEvent('run.started', { mode: 'terminal', command: cmd })

    const toolMessageId = uid()
    addMessage({
      id: toolMessageId,
      role: 'tool',
      content: '',
      timestamp: Date.now(),
      toolName: 'terminal.execute',
      toolPreview: cmd,
      toolStatus: 'running',
    })
    pushStreamEvent('tool.started', {
      mode: 'terminal',
      toolName: 'terminal.execute',
      toolMessageId,
      command: cmd,
    })

    try {
      const result = await terminalStore.executeCommand(cmd)
      terminalStore.saveSessions()

      const preview = result.output?.trim()
        ? result.output.trim().split('\n').slice(0, 2).join(' · ').slice(0, 120)
        : `exit code ${result.exitCode ?? 0}`

      updateMessage(toolMessageId, {
        toolStatus: result.exitCode === 0 ? 'done' : 'error',
        toolPreview: preview,
        content: result.output || '(no output)',
      })

      pushStreamEvent('tool.completed', {
        mode: 'terminal',
        toolName: 'terminal.execute',
        toolMessageId,
        command: cmd,
        exitCode: result.exitCode,
        duration: result.duration,
      }, result.exitCode === 0 ? 'success' : 'error')

      if (result.exitCode === 0) {
        pushStreamEvent('run.completed', { mode: 'terminal', command: cmd }, 'success')
      } else {
        pushStreamEvent('run.failed', { mode: 'terminal', command: cmd, exitCode: result.exitCode }, 'error')
      }
    } catch (err: any) {
      updateMessage(toolMessageId, {
        toolStatus: 'error',
        toolPreview: err?.message || 'terminal execute failed',
        content: `Error: ${err?.message || 'terminal execute failed'}`,
      })
      pushStreamEvent('run.failed', { mode: 'terminal', command: cmd, error: err?.message }, 'error')
    } finally {
      isStreaming.value = false
      pushStreamEvent('run.done', { mode: 'terminal', command: cmd }, 'success')
      updateSessionTitle()
    }
  }

  async function sendMessage(content: string, attachments?: Attachment[]) {
    if ((!content.trim() && !(attachments && attachments.length > 0)) || isStreaming.value) return

    if (!activeSession.value) {
      const session = createSession()
      switchSession(session.id)
    }

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    }
    addMessage(userMsg)
    updateSessionTitle()

    isStreaming.value = true
    clearStreamEvents()
    pushStreamEvent('run.queued', {
      hasContent: Boolean(content.trim()),
      attachmentCount: attachments?.length || 0,
      sessionId: activeSession.value?.id,
    })

    try {
      // Build conversation history from past messages
      const history: ChatMessage[] = messages.value
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
        .map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))

      // Upload attachments and build input with file paths
      let inputText = content.trim()
      if (attachments && attachments.length > 0) {
        const uploaded = await uploadFiles(attachments)
        const pathParts = uploaded.map(f => `[File: ${f.name}](${f.path})`)
        inputText = inputText ? inputText + '\n\n' + pathParts.join('\n') : pathParts.join('\n')
      }

      const appStore = useAppStore()
      // Use session-level model if set, otherwise fall back to global
      const sessionModel = activeSession.value?.model || appStore.selectedModel
      const run = await startRun({
        input: inputText,
        conversation_history: history,
        session_id: activeSession.value?.id,
        model: sessionModel || undefined,
      })

      const runId = (run as any).run_id || (run as any).id
      if (!runId) {
        addMessage({
          id: uid(),
          role: 'system',
          content: `Error: startRun returned no run ID. Response: ${JSON.stringify(run)}`,
          timestamp: Date.now(),
        })
        isStreaming.value = false
        return
      }

      pushStreamEvent('run.started', { runId })

      // Listen to SSE events
      abortController.value = streamRunEvents(
        runId,
        // onEvent
        (evt: RunEvent) => {
          switch (evt.event) {
            case 'run.started': {
              pushStreamEvent('run.started', { runId })
              break
            }

            case 'message.delta': {
              const last = messages.value[messages.value.length - 1]
              if (last?.role === 'assistant' && last.isStreaming) {
                last.content += evt.delta || ''
              } else {
                addMessage({
                  id: uid(),
                  role: 'assistant',
                  content: evt.delta || '',
                  timestamp: Date.now(),
                  isStreaming: true,
                })
              }
              pushStreamEvent('message.delta', {
                runId,
                chars: (evt.delta || '').length,
              })
              break
            }

            case 'tool.started': {
              const last = messages.value[messages.value.length - 1]
              if (last?.isStreaming) {
                updateMessage(last.id, { isStreaming: false })
              }

              const toolName = evt.tool || evt.name || 'Tool'
              const toolMessageId = uid()

              addMessage({
                id: toolMessageId,
                role: 'tool',
                content: '',
                timestamp: Date.now(),
                toolName,
                toolPreview: evt.preview,
                toolStatus: 'running',
              })

              pushStreamEvent('tool.started', {
                runId,
                toolName,
                toolMessageId,
                preview: evt.preview,
              })
              break
            }

            case 'tool.completed': {
              const evtAny = evt as Record<string, any>
              const toolName = evt.tool || evt.name
              const toolMsgs = messages.value
                .filter(m => m.role === 'tool' && m.toolStatus === 'running')
                .filter(m => (toolName ? m.toolName === toolName : true))

              const fallback = messages.value.filter(m => m.role === 'tool' && m.toolStatus === 'running')
              const target = toolMsgs[toolMsgs.length - 1] || fallback[fallback.length - 1]

              const rawOutput = evtAny.output ?? evtAny.result ?? evtAny.content
              const outputText = typeof rawOutput === 'string'
                ? rawOutput
                : rawOutput != null
                  ? JSON.stringify(rawOutput, null, 2)
                  : ''

              if (target) {
                updateMessage(target.id, {
                  toolStatus: 'done',
                  toolPreview: evt.preview || target.toolPreview,
                  content: outputText || target.content || '',
                })
              }

              pushStreamEvent('tool.completed', {
                runId,
                toolName: toolName || target?.toolName,
                toolMessageId: target?.id,
                preview: evt.preview,
              }, 'success')
              break
            }

            case 'run.completed': {
              const lastMsg = messages.value[messages.value.length - 1]
              if (lastMsg?.isStreaming) {
                updateMessage(lastMsg.id, { isStreaming: false })
              }
              isStreaming.value = false
              abortController.value = null
              updateSessionTitle()
              pushStreamEvent('run.completed', { runId }, 'success')
              break
            }

            case 'run.failed': {
              const lastErr = messages.value[messages.value.length - 1]
              if (lastErr?.isStreaming) {
                updateMessage(lastErr.id, {
                  isStreaming: false,
                  content: evt.error ? `Error: ${evt.error}` : 'Run failed',
                  role: 'system',
                })
              } else {
                addMessage({
                  id: uid(),
                  role: 'system',
                  content: evt.error ? `Error: ${evt.error}` : 'Run failed',
                  timestamp: Date.now(),
                })
              }
              messages.value.forEach((m, i) => {
                if (m.role === 'tool' && m.toolStatus === 'running') {
                  messages.value[i] = { ...m, toolStatus: 'error' }
                }
              })
              isStreaming.value = false
              abortController.value = null
              pushStreamEvent('run.failed', { runId, error: evt.error }, 'error')
              break
            }

            default:
              pushStreamEvent(evt.event, evt as Record<string, any>, evt.event.includes('failed') ? 'error' : 'info')
          }
        },
        // onDone
        () => {
          const last = messages.value[messages.value.length - 1]
          if (last?.isStreaming) {
            updateMessage(last.id, { isStreaming: false })
          }
          isStreaming.value = false
          abortController.value = null
          updateSessionTitle()
          pushStreamEvent('run.done', { runId }, 'success')
        },
        // onError
        (err) => {
          const last = messages.value[messages.value.length - 1]
          if (last?.isStreaming) {
            updateMessage(last.id, {
              isStreaming: false,
              content: `Error: ${err.message}`,
              role: 'system',
            })
          } else {
            addMessage({
              id: uid(),
              role: 'system',
              content: `Error: ${err.message}`,
              timestamp: Date.now(),
            })
          }
          isStreaming.value = false
          abortController.value = null
          pushStreamEvent('run.error', { runId, error: err.message }, 'error')
        },
      )
    } catch (err: any) {
      addMessage({
        id: uid(),
        role: 'system',
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
      })
      isStreaming.value = false
      abortController.value = null
      pushStreamEvent('run.error', { error: err.message }, 'error')
    }
  }

  function clearCurrentSessionMessages() {
    if (!activeSession.value || isStreaming.value) return
    messages.value = []
    activeSession.value.messages = []
    activeSession.value.updatedAt = Date.now()
  }

  async function resendMessage(messageId: string) {
    const target = messages.value.find(m => m.id === messageId && m.role === 'user')
    if (!target || isStreaming.value) return
    const text = target.content || ''
    await sendMessage(text)
  }

  async function regenerateLastResponse() {
    if (isStreaming.value) return
    const userIndexes = messages.value
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.role === 'user')
      .map(({ i }) => i)

    if (userIndexes.length === 0) return

    const lastUserIndex = userIndexes[userIndexes.length - 1]
    const lastUser = messages.value[lastUserIndex]
    if (!lastUser) return

    messages.value = messages.value.slice(0, lastUserIndex + 1)
    syncActiveMessages()

    await sendMessage(lastUser.content)
  }

  function stopStreaming() {
    abortController.value?.abort()
    isStreaming.value = false
    pushStreamEvent('run.stopped', {
      sessionId: activeSession.value?.id,
    })
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.isStreaming) {
      updateMessage(lastMsg.id, { isStreaming: false })
    }
    abortController.value = null
  }

  // Load sessions on init
  loadSessions()

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    isStreaming,
    isLoadingSessions,
    isLoadingMessages,
    streamEvents,
    clearStreamEvents,
    newChat,
    switchSession,
    switchSessionModel,
    deleteSession,
    sendMessage,
    sendHybridInput,
    resendMessage,
    regenerateLastResponse,
    clearCurrentSessionMessages,
    stopStreaming,
    loadSessions,
    updateSessionTitle,
  }
})

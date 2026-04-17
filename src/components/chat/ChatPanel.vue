<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NModal, NPopconfirm, NTooltip, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import { useChatStore } from '@/stores/chat'
import { useTerminalStore } from '@/stores/terminal'
import { renameSession } from '@/api/sessions'
import { listJobs, type Job } from '@/api/jobs'
import {
  appendJobRuntimeNotification,
  clearJobRuntimeNotifications,
  getJobRuntimeNotifications,
  jobRuntimeNotificationEventName,
  type JobRuntimeNotification,
} from '@/utils/jobNotifications'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()

const chatStore = useChatStore()
const terminalStore = useTerminalStore()

const SESSION_PINNED_MEMORY_KEY = 'chat:pinned-sessions'
const SESSION_SELECTED_MEMORY_KEY = 'chat:selected-session'
const SESSION_LIST_SCROLL_MEMORY_KEY = 'chat:session-list-scroll-top'

const showSessions = ref(true)
const sessionSearch = ref('')
const sessionTypeFilter = ref<'all' | 'chat' | 'terminal'>('all')
const pinnedSessionKeys = ref<Set<string>>(new Set(JSON.parse(localStorage.getItem(SESSION_PINNED_MEMORY_KEY) || '[]')))

const terminalInput = ref('')
const terminalOutputRef = ref<HTMLDivElement | null>(null)
const sessionListRef = ref<HTMLDivElement | null>(null)
const terminalHistory = ref<string[]>([])
const terminalHistoryIndex = ref(-1)
const showWorkspaceData = ref(false)
const showMaterialModal = ref(false)
const showImagePreviewModal = ref(false)
const previewImageIndex = ref(0)
const quickRenameInput = ref('')
const summaryExpanded = ref(false)
const SUMMARY_COLLAPSED_LINES = 2
const runtimeJobNotifications = ref<JobRuntimeNotification[]>([])
const runtimeNoticeHandler = ref<((event: Event) => void) | null>(null)
const runtimeJobsSnapshot = ref<Record<string, string>>({})
const runtimeJobsTimer = ref<number | null>(null)

const showRenameModal = ref(false)
const renameTarget = ref<{ id: string; title: string; type: 'chat' | 'terminal' } | null>(null)
const renameInput = ref('')

interface UnifiedSession {
  id: string
  title: string
  updatedAt: number
  createdAt: number
  type: 'chat' | 'terminal'
  messageCount?: number
  commandCount?: number
  model?: string
}

type SessionGroupKey = 'today' | 'yesterday' | 'earlier'

interface SessionGroup {
  key: SessionGroupKey
  label: string
  sessions: UnifiedSession[]
}

interface SessionMaterialItem {
  id: string
  name: string
  url?: string
  kind: 'image' | 'file'
  source: 'attachment' | 'content'
  size?: number
  mime?: string
  messageId: string
  timestamp: number
}

function formatMaterialSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function inferMaterialKind(name: string, mime?: string): 'image' | 'file' {
  if (mime && mime.startsWith('image/')) return 'image'
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(name) ? 'image' : 'file'
}

const isTerminalMode = computed(() => route.query.panel === 'terminal')

const allSessions = computed<UnifiedSession[]>(() => {
  const chatSessions: UnifiedSession[] = chatStore.sessions.map(s => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
    type: 'chat',
    messageCount: s.messages.length || s.messageCount,
    model: s.model,
  }))

  const terminalSessions: UnifiedSession[] = terminalStore.sessions.map(s => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
    type: 'terminal',
    commandCount: s.commands.length,
  }))

  return [...chatSessions, ...terminalSessions].sort((a, b) => {
    const aPinned = pinnedSessionKeys.value.has(`${a.type}:${a.id}`)
    const bPinned = pinnedSessionKeys.value.has(`${b.type}:${b.id}`)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
})

const filteredSessions = computed(() => {
  const keyword = sessionSearch.value.trim().toLowerCase()

  const byType = allSessions.value.filter((session) => {
    if (sessionTypeFilter.value === 'all') return true
    return session.type === sessionTypeFilter.value
  })

  if (!keyword) return byType
  return byType.filter((session) =>
    session.title.toLowerCase().includes(keyword) || session.id.toLowerCase().includes(keyword),
  )
})

function getStartOfDayMs(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function resolveSessionGroupKey(ts: number): SessionGroupKey {
  const todayStart = getStartOfDayMs(Date.now())
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000

  if (ts >= todayStart) return 'today'
  if (ts >= yesterdayStart) return 'yesterday'
  return 'earlier'
}

function sessionGroupLabel(key: SessionGroupKey): string {
  if (key === 'today') return t('chat.workspace.groupToday')
  if (key === 'yesterday') return t('chat.workspace.groupYesterday')
  return t('chat.workspace.groupEarlier')
}

const groupedSessions = computed<SessionGroup[]>(() => {
  const groups: Record<SessionGroupKey, UnifiedSession[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  }

  for (const session of filteredSessions.value) {
    groups[resolveSessionGroupKey(session.updatedAt)].push(session)
  }

  const orderedKeys: SessionGroupKey[] = ['today', 'yesterday', 'earlier']
  return orderedKeys
    .map((key) => ({
      key,
      label: sessionGroupLabel(key),
      sessions: groups[key],
    }))
    .filter((group) => group.sessions.length > 0)
})

const chatSessionCount = computed(() => allSessions.value.filter(s => s.type === 'chat').length)
const terminalSessionCount = computed(() => allSessions.value.filter(s => s.type === 'terminal').length)
const displayedSessionCount = computed(() => filteredSessions.value.length)
const latestRuntimeNotifications = computed(() => runtimeJobNotifications.value.slice(0, 6))
const runtimeNoticeBadge = computed(() => runtimeJobNotifications.value.length)

const sessionGroupAnchorRefs = ref<Record<SessionGroupKey, HTMLElement | null>>({
  today: null,
  yesterday: null,
  earlier: null,
})

const activeSessionLabel = computed(() => {
  if (isTerminalMode.value) return terminalStore.activeSession?.title || t('chat.workspace.terminalSession')
  return chatStore.activeSession?.title || t('chat.newChat')
})

const activeSessionIdText = computed(() => {
  if (isTerminalMode.value) return terminalStore.activeSession?.id || '--'
  return chatStore.activeSession?.id || '--'
})

const activeSessionMeta = computed(() => {
  if (isTerminalMode.value) {
    return terminalStore.activeSession?.workingDir || '/home'
  }
  return chatStore.activeSession?.id || '--'
})

const activeSessionMetaLabel = computed(() => (isTerminalMode.value ? t('chat.workspace.workingDirectory') : t('chat.workspace.sessionId')))
const activeSessionMetaText = computed(() => `${activeSessionMetaLabel.value}: ${activeSessionMeta.value}`)

const currentChatMessages = computed(() => chatStore.activeSession?.messages || [])
const currentSessionMessageCount = computed(() => {
  if (isTerminalMode.value) return 0
  return currentChatMessages.value.length || chatStore.activeSession?.messageCount || 0
})
const currentSessionToolCount = computed<number | null>(() => {
  if (isTerminalMode.value) return null
  if (currentChatMessages.value.length === 0 && currentSessionMessageCount.value > 0) return null
  return currentChatMessages.value.filter(msg => msg.role === 'tool').length
})
const currentSessionUserTurnCount = computed<number | null>(() => {
  if (isTerminalMode.value) return null
  if (currentChatMessages.value.length === 0 && currentSessionMessageCount.value > 0) return null
  return currentChatMessages.value.filter(msg => msg.role === 'user').length
})
const currentSessionTerminalCommandCount = computed(() => terminalStore.activeSession?.commands.length || 0)

const currentSessionMaterials = computed<SessionMaterialItem[]>(() => {
  const messages = currentChatMessages.value
  if (!messages.length) return []

  const map = new Map<string, SessionMaterialItem>()

  for (const msg of messages) {
    for (const att of msg.attachments || []) {
      const key = `att:${att.id}:${att.url || att.name}`
      if (map.has(key)) continue
      map.set(key, {
        id: key,
        name: att.name,
        url: att.url,
        kind: inferMaterialKind(att.name, att.type),
        source: 'attachment',
        size: att.size,
        mime: att.type,
        messageId: msg.id,
        timestamp: msg.timestamp,
      })
    }

    if (!msg.content) continue
    const fileRegex = /\[File:\s*([^\]]+)\]\(([^)]+)\)/g
    let match: RegExpExecArray | null
    while ((match = fileRegex.exec(msg.content)) !== null) {
      const name = (match[1] || '').trim()
      const url = (match[2] || '').trim()
      if (!name && !url) continue
      const key = `ct:${msg.id}:${name}:${url}`
      if (map.has(key)) continue
      map.set(key, {
        id: key,
        name: name || url.split('/').pop() || 'unknown',
        url,
        kind: inferMaterialKind(name || url),
        source: 'content',
        messageId: msg.id,
        timestamp: msg.timestamp,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp)
})

const currentSessionImageMaterials = computed(() => currentSessionMaterials.value.filter(item => item.kind === 'image'))
const currentSessionOtherMaterials = computed(() => currentSessionMaterials.value.filter(item => item.kind === 'file'))
const hasCurrentSessionMaterials = computed(() => currentSessionMaterials.value.length > 0)
const previewImageItems = computed(() => currentSessionImageMaterials.value.filter(item => Boolean(item.url)))
const previewImageItem = computed(() => previewImageItems.value[previewImageIndex.value] || null)

const currentSessionSummary = computed(() => {
  if (isTerminalMode.value) {
    const total = currentSessionTerminalCommandCount.value
    const lastCommand = terminalStore.activeSession?.commands?.[terminalStore.activeSession.commands.length - 1]?.command || t('chat.workspace.none')
    return [
      t('chat.workspace.summary.terminalTotal', { total }),
      total > 0 ? t('chat.workspace.summary.terminalLastCommand', { command: lastCommand }) : t('chat.workspace.summary.terminalNoCommand'),
      t('chat.workspace.summary.renameAdvice'),
    ].join('\n')
  }

  const turns = currentSessionUserTurnCount.value
  const tools = currentSessionToolCount.value
  const materials = currentSessionMaterials.value.length
  const imageCount = currentSessionImageMaterials.value.length
  const fileCount = currentSessionOtherMaterials.value.length
  const hasMessageSummaryOnly = currentChatMessages.value.length === 0 && currentSessionMessageCount.value > 0
  const lastAssistant = [...currentChatMessages.value].reverse().find(msg => msg.role === 'assistant' && msg.content.trim())
  const assistantText = (lastAssistant?.content || '').trim()
  const lastUser = [...currentChatMessages.value].reverse().find(msg => msg.role === 'user' && msg.content.trim())
  const userText = (lastUser?.content || '').trim()
  const userTopic = userText
    ? userText.slice(0, 90)
    : (hasMessageSummaryOnly ? t('chat.workspace.summary.partialStats') : t('chat.workspace.summary.noUserTopic'))
  const assistantDigest = assistantText
    ? assistantText.slice(0, 260)
    : (hasMessageSummaryOnly ? t('chat.workspace.summary.partialStats') : t('chat.workspace.summary.noAssistantDigest'))

  return [
    t('chat.workspace.summary.stats', {
      turns: turns ?? t('chat.workspace.summary.pendingCount'),
      tools: tools ?? t('chat.workspace.summary.pendingCount'),
      materials,
      imageCount,
      fileCount,
    }),
    t('chat.workspace.summary.currentTopic', { topic: `${userTopic}${userText.length > 90 ? '…' : ''}` }),
    t('chat.workspace.summary.replyDigest', { digest: `${assistantDigest}${assistantText.length > 260 ? '…' : ''}` }),
  ].join('\n')
})

const currentSessionSummaryLines = computed(() => currentSessionSummary.value.split('\n').filter(Boolean))
const summaryCanExpand = computed(() => currentSessionSummaryLines.value.length > SUMMARY_COLLAPSED_LINES)
const visibleSummaryLines = computed(() => {
  if (summaryExpanded.value) return currentSessionSummaryLines.value
  return currentSessionSummaryLines.value.slice(0, SUMMARY_COLLAPSED_LINES)
})

const suggestedSessionNames = computed(() => {
  const base = (currentChatMessages.value.find(msg => msg.role === 'user' && msg.content.trim())?.content || activeSessionLabel.value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18)

  const day = new Date().toLocaleDateString(locale.value, { month: '2-digit', day: '2-digit' }).replace('/', '-').replace('/', '-')

  if (isTerminalMode.value) {
    return [
      t('chat.workspace.renameSuggestion.terminalTask', { day }),
      t('chat.workspace.renameSuggestion.terminalOps', { base: base || t('chat.workspace.renameSuggestion.defaultCommand') }),
      t('chat.workspace.renameSuggestion.terminalTroubleshoot', { id: activeSessionIdText.value.slice(0, 8) }),
    ]
  }

  const hasImages = currentSessionImageMaterials.value.length > 0
  return [
    t('chat.workspace.renameSuggestion.chatSummary', { base: base || t('chat.workspace.renameSuggestion.defaultSession') }),
    t('chat.workspace.renameSuggestion.chatMaterials', { base: base || t('chat.workspace.renameSuggestion.defaultSession') }),
    t('chat.workspace.renameSuggestion.chatByType', { type: hasImages ? t('chat.workspace.renameSuggestion.imageMaterials') : t('chat.workspace.renameSuggestion.dialogue'), day }),
  ]
})

function openImagePreviewByItem(item: SessionMaterialItem) {
  if (!item.url || item.kind !== 'image') return
  const index = previewImageItems.value.findIndex(img => img.id === item.id)
  previewImageIndex.value = index >= 0 ? index : 0
  showImagePreviewModal.value = true
}

function previewPrevImage() {
  if (!previewImageItems.value.length) return
  previewImageIndex.value = (previewImageIndex.value - 1 + previewImageItems.value.length) % previewImageItems.value.length
}

function previewNextImage() {
  if (!previewImageItems.value.length) return
  previewImageIndex.value = (previewImageIndex.value + 1) % previewImageItems.value.length
}

function setContentMode(mode: 'chat' | 'terminal') {
  const query = { ...route.query }
  if (mode === 'terminal') {
    query.panel = 'terminal'
  } else {
    delete query.panel
  }
  router.replace({ name: 'chat', query })
}

function setSessionTypeFilter(mode: 'all' | 'chat' | 'terminal') {
  sessionTypeFilter.value = mode
  if (mode === 'chat' || mode === 'terminal') {
    setContentMode(mode)
  }
}

async function ensureActiveChatMessagesLoaded() {
  if (isTerminalMode.value) return
  const active = chatStore.activeSession
  if (!active) return
  if (chatStore.isLoadingMessages) return

  const hasMessagesLoaded = (active.messages?.length || 0) > 0
  const hasSummaryCount = (active.messageCount || 0) > 0
  if (!hasMessagesLoaded && hasSummaryCount) {
    await chatStore.switchSession(active.id)
  }
}

function toggleWorkspaceData() {
  showWorkspaceData.value = !showWorkspaceData.value
  if (showWorkspaceData.value) {
    void ensureActiveChatMessagesLoaded()
  }
}

function toggleSummaryExpanded() {
  if (!summaryCanExpand.value) return
  summaryExpanded.value = !summaryExpanded.value
}

function isPinned(session: UnifiedSession): boolean {
  return pinnedSessionKeys.value.has(`${session.type}:${session.id}`)
}

function togglePin(session: UnifiedSession) {
  const key = `${session.type}:${session.id}`
  if (pinnedSessionKeys.value.has(key)) {
    pinnedSessionKeys.value.delete(key)
  } else {
    pinnedSessionKeys.value.add(key)
  }
  localStorage.setItem(SESSION_PINNED_MEMORY_KEY, JSON.stringify(Array.from(pinnedSessionKeys.value)))
}

function isSessionActive(session: UnifiedSession): boolean {
  if (session.type === 'chat') return session.id === chatStore.activeSessionId
  return session.id === terminalStore.activeSessionId
}

function handleSessionClick(session: UnifiedSession) {
  localStorage.setItem(SESSION_SELECTED_MEMORY_KEY, `${session.type}:${session.id}`)
  if (session.type === 'chat') {
    chatStore.switchSession(session.id)
    setContentMode('chat')
    return
  }

  terminalStore.switchSession(session.id)
  setContentMode('terminal')
}

function handleSessionCardKeydown(event: KeyboardEvent, session: UnifiedSession) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  handleSessionClick(session)
}

function handleSessionListScroll() {
  if (!sessionListRef.value) return
  localStorage.setItem(SESSION_LIST_SCROLL_MEMORY_KEY, String(sessionListRef.value.scrollTop))
}

function setSessionGroupAnchorRef(key: SessionGroupKey, el: Element | { $el?: Element } | null) {
  const resolved = el && typeof el === 'object' && '$el' in el ? (el.$el ?? null) : el
  sessionGroupAnchorRefs.value[key] = (resolved as HTMLElement | null)
}

function jumpToSessionGroup(key: SessionGroupKey) {
  const anchor = sessionGroupAnchorRefs.value[key]
  if (!anchor) return
  anchor.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleNewSession() {
  if (isTerminalMode.value) {
    terminalStore.createSession()
    terminalStore.saveSessions()
    return
  }

  chatStore.newChat()
}

function openRenameModal(session: UnifiedSession) {
  renameTarget.value = { id: session.id, title: session.title, type: session.type }
  renameInput.value = session.title
  showRenameModal.value = true
}

async function handleRenameConfirm() {
  if (!renameTarget.value || !renameInput.value.trim()) return

  const title = renameInput.value.trim()
  if (renameTarget.value.type === 'chat') {
    const ok = await renameSession(renameTarget.value.id, title)
    if (ok) {
      chatStore.updateSessionTitle(renameTarget.value.id, title)
      message.success(t('common.success'))
    } else {
      message.error(t('common.error'))
    }
  } else {
    terminalStore.updateSessionTitle(renameTarget.value.id, title)
    terminalStore.saveSessions()
    message.success(t('common.success'))
  }

  showRenameModal.value = false
  renameTarget.value = null
}

async function applySessionName(title: string) {
  const nextTitle = title.trim()
  if (!nextTitle) return

  if (isTerminalMode.value) {
    const activeId = terminalStore.activeSession?.id
    if (!activeId) return
    terminalStore.updateSessionTitle(activeId, nextTitle)
    terminalStore.saveSessions()
    quickRenameInput.value = nextTitle
    message.success(t('chat.workspace.messages.terminalRenamed'))
    return
  }

  const activeId = chatStore.activeSession?.id
  if (!activeId) return

  const ok = await renameSession(activeId, nextTitle)
  if (!ok) {
    message.error(t('chat.workspace.messages.renameFailed'))
    return
  }
  chatStore.updateSessionTitle(activeId, nextTitle)
  quickRenameInput.value = nextTitle
  message.success(t('chat.workspace.messages.sessionRenamed'))
}

async function handleQuickRename() {
  await applySessionName(quickRenameInput.value)
}

async function applySuggestedSessionName(title: string) {
  await applySessionName(title)
}

function handleDeleteSession(id: string, type: 'chat' | 'terminal') {
  if (type === 'chat') {
    chatStore.deleteSession(id)
  } else {
    terminalStore.deleteSession(id)
    terminalStore.saveSessions()
  }
  message.success(t('chat.sessionDeleted'))
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function runtimeNoticeTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function runtimeNoticeLabel(item: JobRuntimeNotification) {
  if (item.status === 'ok') {
    return t('chat.workspace.runtime.success', { name: item.name, target: item.target })
  }
  if (item.status === 'error') {
    return t('chat.workspace.runtime.failed', { name: item.name, error: item.error || t('chat.workspace.unknownError') })
  }
  return t('chat.workspace.runtime.updated', { name: item.name, error: item.error || 'unknown' })
}

function clearRuntimeNotices() {
  runtimeJobNotifications.value = []
  clearJobRuntimeNotifications()
  message.success(t('chat.workspace.messages.runtimeCleared'))
}

function runtimeJobKey(job: Job) {
  return job.job_id || job.id
}

function runtimeJobSnapshotValue(job: Job) {
  return `${job.last_run_at || ''}|${job.last_status || ''}|${job.last_delivery_error || ''}`
}

function runtimeJobDeliverHint(job: Job) {
  if (job.deliver === 'origin' && job.origin) {
    return `${job.origin.platform}:${job.origin.chat_name || job.origin.chat_id}`
  }
  if (job.deliver === 'origin' && !job.origin) {
    return t('chat.workspace.runtime.originMissing')
  }
  if (job.deliver === 'local') {
    return t('chat.workspace.runtime.localStorage')
  }
  return job.deliver
}

async function pollRuntimeJobNotifications(emitNotice = true) {
  try {
    const jobs = await listJobs()
    const nextSnapshot: Record<string, string> = {}

    for (const job of jobs) {
      const key = runtimeJobKey(job)
      const nextSig = runtimeJobSnapshotValue(job)
      const prevSig = runtimeJobsSnapshot.value[key]
      nextSnapshot[key] = nextSig

      if (!emitNotice || !job.last_run_at || !prevSig || prevSig === nextSig) {
        continue
      }

      if (job.last_status === 'ok' && !job.last_delivery_error) {
        appendJobRuntimeNotification({
          key,
          jobId: key,
          name: job.name,
          status: 'ok',
          target: runtimeJobDeliverHint(job),
          runAt: job.last_run_at,
        })
        continue
      }

      if (job.last_delivery_error) {
        appendJobRuntimeNotification({
          key,
          jobId: key,
          name: job.name,
          status: 'error',
          target: runtimeJobDeliverHint(job),
          error: job.last_delivery_error,
          runAt: job.last_run_at,
        })
        continue
      }

      appendJobRuntimeNotification({
        key,
        jobId: key,
        name: job.name,
        status: 'state',
        target: runtimeJobDeliverHint(job),
        error: job.last_status || 'unknown',
        runAt: job.last_run_at,
      })
    }

    runtimeJobsSnapshot.value = nextSnapshot
  } catch {
    // ignore polling error to avoid interrupting chat interaction
  }
}

async function executeTerminalCommand() {
  const cmd = terminalInput.value.trim()
  if (!cmd) return

  terminalInput.value = ''
  terminalHistory.value.unshift(cmd)
  terminalHistoryIndex.value = -1

  await terminalStore.executeCommand(cmd)
  terminalStore.saveSessions()
  await nextTick()
  if (terminalOutputRef.value) {
    terminalOutputRef.value.scrollTop = terminalOutputRef.value.scrollHeight
  }
}

function handleTerminalKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    executeTerminalCommand()
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (terminalHistoryIndex.value < terminalHistory.value.length - 1) {
      terminalHistoryIndex.value += 1
      terminalInput.value = terminalHistory.value[terminalHistoryIndex.value]
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (terminalHistoryIndex.value > 0) {
      terminalHistoryIndex.value -= 1
      terminalInput.value = terminalHistory.value[terminalHistoryIndex.value]
    } else {
      terminalHistoryIndex.value = -1
      terminalInput.value = ''
    }
  }
}

watch(() => terminalStore.activeSession?.commands.length, async () => {
  await nextTick()
  if (terminalOutputRef.value) {
    terminalOutputRef.value.scrollTop = terminalOutputRef.value.scrollHeight
  }
})

watch(previewImageItems, (items) => {
  if (!items.length) {
    showImagePreviewModal.value = false
    previewImageIndex.value = 0
    return
  }

  if (previewImageIndex.value > items.length - 1) {
    previewImageIndex.value = items.length - 1
  }
})

watch(
  () => [isTerminalMode.value, chatStore.activeSession?.id, terminalStore.activeSession?.id, activeSessionLabel.value],
  () => {
    quickRenameInput.value = activeSessionLabel.value
    summaryExpanded.value = false
    if (showWorkspaceData.value && !isTerminalMode.value) {
      void ensureActiveChatMessagesLoaded()
    }
  },
  { immediate: true },
)

onMounted(async () => {
  if (!chatStore.sessions.length) {
    await chatStore.loadSessions()
  }

  if (!terminalStore.sessions.length) {
    terminalStore.createSession()
    terminalStore.saveSessions()
  }

  runtimeJobNotifications.value = getJobRuntimeNotifications()
  await pollRuntimeJobNotifications(false)
  runtimeNoticeHandler.value = (event: Event) => {
    const customEvent = event as CustomEvent<JobRuntimeNotification>
    if (!customEvent.detail) return
    runtimeJobNotifications.value = [customEvent.detail, ...runtimeJobNotifications.value].slice(0, 80)

    if (customEvent.detail.status === 'ok') {
      message.success(t('chat.workspace.messages.jobNotified', { name: customEvent.detail.name }))
      return
    }

    if (customEvent.detail.status === 'error') {
      message.warning(t('chat.workspace.messages.jobNotifyFailed', { name: customEvent.detail.name }))
      return
    }

    message.info(t('chat.workspace.messages.jobNotifyUpdated', { name: customEvent.detail.name }))
  }
  window.addEventListener(jobRuntimeNotificationEventName(), runtimeNoticeHandler.value)
  runtimeJobsTimer.value = window.setInterval(() => {
    pollRuntimeJobNotifications(true)
  }, 15000)

  const selected = localStorage.getItem(SESSION_SELECTED_MEMORY_KEY)
  if (selected) {
    const [type, id] = selected.split(':')
    const target = allSessions.value.find(s => s.type === type && s.id === id)
    if (target) {
      handleSessionClick(target)
    }
  }

  await nextTick()
  const savedScroll = Number(localStorage.getItem(SESSION_LIST_SCROLL_MEMORY_KEY) || '0')
  if (sessionListRef.value && Number.isFinite(savedScroll) && savedScroll > 0) {
    sessionListRef.value.scrollTop = savedScroll
  }
})

onBeforeUnmount(() => {
  if (runtimeJobsTimer.value) {
    window.clearInterval(runtimeJobsTimer.value)
    runtimeJobsTimer.value = null
  }
  if (!runtimeNoticeHandler.value) return
  window.removeEventListener(jobRuntimeNotificationEventName(), runtimeNoticeHandler.value)
  runtimeNoticeHandler.value = null
})
</script>

<template>
  <div class="chat-panel-v2" :class="{ 'sessions-collapsed': !showSessions }">
    <aside class="session-side" :class="{ collapsed: !showSessions }">
      <header class="session-brand">
        <div class="brand-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 5V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              class="session-collapse-btn"
              size="tiny"
              quaternary
              circle
              :aria-label="showSessions ? t('chat.workspace.collapseSessions') : t('chat.workspace.expandSessions')"
              :title="showSessions ? t('chat.workspace.collapseSessions') : t('chat.workspace.expandSessions')"
              @click="showSessions = !showSessions"
            >
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <polyline v-if="showSessions" points="15 18 9 12 15 6" />
                  <polyline v-else points="9 18 15 12 9 6" />
                </svg>
              </template>
            </NButton>
          </template>
          {{ showSessions ? t('chat.workspace.collapseSessions') : t('chat.workspace.expandSessions') }}
        </NTooltip>
      </header>

      <div v-if="showSessions" class="session-tools">
        <div class="session-control-shell">
          <div class="session-control-row">
            <div class="session-mode-switch" role="tablist" :aria-label="t('chat.workspace.sessionModeFilter')">
              <button
                class="mode-chip"
                :class="{ active: sessionTypeFilter === 'all' }"
                role="tab"
                :aria-selected="sessionTypeFilter === 'all'"
                @click="setSessionTypeFilter('all')"
              >
                <span class="mode-chip-label">{{ t('chat.all') }}</span>
                <span class="mode-chip-count">{{ allSessions.length }}</span>
              </button>
              <button
                class="mode-chip"
                :class="{ active: sessionTypeFilter === 'chat' }"
                role="tab"
                :aria-selected="sessionTypeFilter === 'chat'"
                @click="setSessionTypeFilter('chat')"
              >
                <span class="mode-chip-label">{{ t('chat.chatOnly') }}</span>
                <span class="mode-chip-count">{{ chatSessionCount }}</span>
              </button>
              <button
                class="mode-chip"
                :class="{ active: sessionTypeFilter === 'terminal' }"
                role="tab"
                :aria-selected="sessionTypeFilter === 'terminal'"
                @click="setSessionTypeFilter('terminal')"
              >
                <span class="mode-chip-label">{{ t('chat.terminalOnly') }}</span>
                <span class="mode-chip-count">{{ terminalSessionCount }}</span>
              </button>
            </div>
            <span class="session-control-total">{{ t('chat.workspace.currentCount', { count: displayedSessionCount }) }}</span>
          </div>

          <NInput
            v-model:value="sessionSearch"
            class="session-search-input"
            size="medium"
            clearable
            :placeholder="t('chat.workspace.searchByTitleOrId')"
          >
            <template #prefix>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16.65" y2="16.65" />
              </svg>
            </template>
            <template #suffix>
              <span class="session-search-count">{{ displayedSessionCount }}</span>
            </template>
          </NInput>

          <div v-if="displayedSessionCount > 0" class="session-group-nav" role="tablist" :aria-label="t('chat.workspace.sessionDateGroups')">
            <button
              v-for="group in groupedSessions"
              :key="`group-nav-${group.key}`"
              class="session-group-nav-btn"
              type="button"
              @click="jumpToSessionGroup(group.key)"
            >
              <span>{{ group.label }}</span>
              <strong>{{ group.sessions.length }}</strong>
            </button>
          </div>
        </div>
      </div>

      <div v-if="showSessions" ref="sessionListRef" class="session-list" @scroll="handleSessionListScroll">
        <div v-if="filteredSessions.length === 0" class="session-empty">{{ t('chat.noSessions') }}</div>
        <section
          v-for="group in groupedSessions"
          :key="`group-${group.key}`"
          class="session-group"
          :ref="(el) => setSessionGroupAnchorRef(group.key, el)"
        >
          <header class="session-group-head">
            <span class="session-group-title">{{ group.label }}</span>
            <span class="session-group-count">{{ group.sessions.length }}</span>
          </header>

          <article
            v-for="s in group.sessions"
            :key="`${s.type}:${s.id}`"
            class="session-card"
            :class="{ active: isSessionActive(s), terminal: s.type === 'terminal' }"
            role="button"
            tabindex="0"
            :aria-label="t('chat.workspace.openSessionAria', { title: s.title })"
            @click="handleSessionClick(s)"
            @keydown="handleSessionCardKeydown($event, s)"
          >
            <div class="session-level-title-row">
              <h4 class="session-title" :title="s.title">{{ s.title }}</h4>
              <span class="session-tag" :class="s.type">{{ s.type === 'terminal' ? 'TERMINAL' : 'CHAT' }}</span>
            </div>

            <p class="session-id-line" :title="s.id">
              <span class="session-id-label">ID</span>
              <span class="session-id-value">{{ s.id }}</span>
            </p>

            <div class="session-meta-row">
              <span class="session-time">{{ formatTime(s.updatedAt) }}</span>
              <span class="session-stat-count">
                <template v-if="s.type === 'terminal'">{{ t('chat.workspace.commandCountLabel', { count: s.commandCount || 0 }) }}</template>
                <template v-else>{{ t('chat.workspace.messageCountLabel', { count: s.messageCount || 0 }) }}</template>
              </span>
            </div>

            <div class="session-actions">
              <button :class="{ on: isPinned(s) }" @click.stop="togglePin(s)">{{ t('chat.workspace.pin') }}</button>
              <button @click.stop="openRenameModal(s)">{{ t('chat.workspace.rename') }}</button>
              <NPopconfirm @positive-click="handleDeleteSession(s.id, s.type)">
                <template #trigger>
                  <button class="danger" @click.stop>{{ t('common.delete') }}</button>
                </template>
                {{ t('chat.deleteSessionConfirm') }}
              </NPopconfirm>
            </div>
          </article>
        </section>
      </div>
    </aside>

    <section class="content-shell">
      <header class="content-header">
        <div class="content-header-shell">
          <div class="content-header-inner">
            <div class="content-meta">
              <div class="content-session-main">
                <strong class="content-session-title" :title="activeSessionLabel">{{ activeSessionLabel }}</strong>
                <span class="content-mode-pill" :class="{ terminal: isTerminalMode }">{{ isTerminalMode ? t('chat.terminalOnly') : t('chat.chatOnly') }}</span>
              </div>
              <div class="content-meta-main">
                <span class="content-meta-id" :title="activeSessionMetaText">{{ activeSessionMetaText }}</span>
              </div>
            </div>

            <div class="content-actions">
              <NTooltip trigger="hover">
                <template #trigger>
                  <button
                    class="workspace-data-toggle"
                    type="button"
                    :class="{ active: showWorkspaceData }"
                    :aria-expanded="showWorkspaceData"
                    :aria-label="t('chat.workspace.viewSessionData')"
                    :title="t('chat.workspace.viewSessionData')"
                    @click="toggleWorkspaceData"
                  >
                    ◎
                  </button>
                </template>
                {{ showWorkspaceData ? t('chat.workspace.hideSessionData') : t('chat.workspace.viewSessionData') }}
              </NTooltip>
              <NButton size="small" type="primary" @click="handleNewSession">{{ isTerminalMode ? t('chat.workspace.newTerminal') : t('chat.newChat') }}</NButton>
            </div>
          </div>

          <div v-if="showWorkspaceData" class="workspace-data-panel">
            <div class="workspace-scope-row">
              <span class="workspace-scope-label">{{ t('chat.workspace.scopeCurrentSession') }}</span>
              <code class="workspace-scope-id" :title="activeSessionIdText">{{ activeSessionIdText }}</code>
            </div>

            <div class="workspace-data-stats">
              <div class="workspace-data-item">
                <span class="workspace-data-label">{{ t('chat.workspace.sessionId') }}</span>
                <strong class="workspace-data-value mono">{{ activeSessionIdText }}</strong>
              </div>
              <div class="workspace-data-item">
                <span class="workspace-data-label">{{ isTerminalMode ? t('chat.workspace.terminalCommands') : t('chat.workspace.chatMessages') }}</span>
                <strong class="workspace-data-value">{{ isTerminalMode ? currentSessionTerminalCommandCount : currentSessionMessageCount }}</strong>
              </div>
              <div class="workspace-data-item" v-if="!isTerminalMode">
                <span class="workspace-data-label">{{ t('chat.workspace.toolCalls') }}</span>
                <strong class="workspace-data-value">{{ currentSessionToolCount }}</strong>
              </div>
              <div class="workspace-data-item" v-if="!isTerminalMode">
                <span class="workspace-data-label">{{ t('chat.workspace.materialsTotal') }}</span>
                <strong class="workspace-data-value">{{ currentSessionMaterials.length }}</strong>
              </div>
            </div>

            <div class="workspace-job-notices">
              <div class="workspace-section-head">
                <strong>{{ t('chat.workspace.runtimeNotificationsTitle') }}</strong>
                <div class="job-notice-head-right">
                  <span class="job-notice-count">{{ runtimeNoticeBadge }}</span>
                  <NButton text size="tiny" :disabled="runtimeNoticeBadge === 0" @click="clearRuntimeNotices">{{ t('chat.workspace.clear') }}</NButton>
                </div>
              </div>
              <div v-if="latestRuntimeNotifications.length" class="job-notice-list">
                <div v-for="item in latestRuntimeNotifications" :key="item.id" class="job-notice-item" :class="item.status">
                  <p class="job-notice-text" :title="runtimeNoticeLabel(item)">{{ runtimeNoticeLabel(item) }}</p>
                  <small class="job-notice-meta">{{ runtimeNoticeTime(item.createdAt) }} · {{ item.target }}</small>
                </div>
              </div>
              <div v-else class="workspace-empty-tip">{{ t('chat.workspace.runtimeNotificationsEmpty') }}</div>
            </div>

            <div v-if="!isTerminalMode" class="workspace-materials">
              <div class="workspace-section-head">
                <strong>{{ t('chat.workspace.materialsCurrentSession') }}</strong>
                <NButton text size="tiny" @click="showMaterialModal = true" :disabled="!hasCurrentSessionMaterials">{{ t('chat.workspace.viewAll') }}</NButton>
              </div>
              <div class="material-summary-row">
                <span class="material-chip image">{{ t('chat.workspace.imagesCount', { count: currentSessionImageMaterials.length }) }}</span>
                <span class="material-chip file">{{ t('chat.workspace.filesCount', { count: currentSessionOtherMaterials.length }) }}</span>
              </div>
              <div v-if="hasCurrentSessionMaterials" class="material-preview-list">
                <button
                  v-for="item in currentSessionMaterials.slice(0, 8)"
                  :key="item.id"
                  class="material-item"
                  :class="{ 'is-image': item.kind === 'image' && !!item.url }"
                  type="button"
                  @click="openImagePreviewByItem(item)"
                >
                  <template v-if="item.kind === 'image' && item.url">
                    <span class="material-thumb-wrap">
                      <img class="material-thumb" :src="item.url" :alt="item.name" loading="lazy" />
                    </span>
                  </template>
                  <span v-else class="material-kind" :class="item.kind">{{ item.kind === 'image' ? 'IMG' : 'FILE' }}</span>
                  <span class="material-name" :title="item.name">{{ item.name }}</span>
                  <span class="material-size">{{ formatMaterialSize(item.size) }}</span>
                  <span v-if="item.kind === 'image' && item.url" class="material-action">{{ t('chat.workspace.view') }}</span>
                </button>
              </div>
              <div v-else class="workspace-empty-tip">{{ t('chat.workspace.noMaterials') }}</div>
            </div>

            <div class="workspace-summary-box">
              <div class="workspace-section-head summary-head">
                <strong>{{ t('chat.workspace.sessionSummary') }}</strong>
                <div class="summary-actions">
                  <span class="summary-scroll-tip">{{ summaryExpanded ? t('chat.workspace.summary.scrollTipExpanded') : t('chat.workspace.summary.scrollTipCollapsed') }}</span>
                  <button
                    v-if="summaryCanExpand"
                    type="button"
                    class="summary-toggle-btn"
                    :aria-expanded="summaryExpanded"
                    @click="toggleSummaryExpanded"
                  >
                    {{ summaryExpanded ? t('chat.workspace.collapse') : t('chat.workspace.expand') }}
                  </button>
                </div>
              </div>
              <div class="summary-scroll" :class="{ expanded: summaryExpanded }" role="region" :aria-label="t('chat.workspace.summaryRegionAria')">
                <p v-for="(line, idx) in visibleSummaryLines" :key="`summary-${idx}`">{{ line }}</p>
              </div>
            </div>

            <div class="workspace-rename-box">
              <div class="workspace-section-head">
                <strong>{{ t('chat.workspace.suggestedRename') }}</strong>
              </div>
              <div class="rename-inline">
                <NInput
                  v-model:value="quickRenameInput"
                  size="small"
                  :placeholder="t('chat.workspace.renamePlaceholder')"
                  @keyup.enter="handleQuickRename"
                />
                <NButton size="small" type="primary" ghost @click="handleQuickRename">{{ t('chat.workspace.apply') }}</NButton>
              </div>
              <div class="suggestion-list">
                <button
                  v-for="name in suggestedSessionNames"
                  :key="name"
                  class="suggestion-chip"
                  type="button"
                  @click="applySuggestedSessionName(name)"
                >
                  {{ name }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div class="content-body">
        <div class="content-body-inner">
        <template v-if="isTerminalMode">
          <div class="terminal-shell">
            <div ref="terminalOutputRef" class="terminal-output">
              <div
                v-for="cmd in terminalStore.activeSession?.commands || []"
                :key="cmd.id"
                class="terminal-item"
                :class="cmd.status"
              >
                <div class="terminal-item-head">
                  <span class="terminal-dot"></span>
                  <span class="terminal-title">RUN: {{ cmd.command }}</span>
                  <span class="terminal-duration">{{ cmd.duration }}ms</span>
                </div>
                <div class="terminal-command">$ {{ cmd.command }}</div>
                <pre class="terminal-result">{{ cmd.output || '(no output)' }}</pre>
                <div class="terminal-meta">
                  <span :class="['status', cmd.status === 'error' ? 'error' : cmd.exitCode === 0 ? 'ok' : 'run']">
                    {{ cmd.status === 'running' ? t('chat.workspace.status.running') : cmd.exitCode === 0 ? t('chat.workspace.status.done') : t('chat.workspace.status.failed') }}
                  </span>
                  <span>exit code {{ cmd.exitCode ?? '-' }}</span>
                </div>
              </div>
              <div v-if="(terminalStore.activeSession?.commands.length || 0) === 0" class="terminal-empty">
                {{ t('chat.workspace.terminalOutputHint') }}
              </div>
            </div>
            <div class="terminal-input-row">
              <NInput
                v-model:value="terminalInput"
                type="textarea"
                :rows="2"
                :placeholder="t('chat.workspace.terminalInputPlaceholder')"
                @keydown="handleTerminalKeydown"
              />
              <NButton :loading="terminalStore.isLoading" @click="executeTerminalCommand">{{ t('chat.workspace.execute') }}</NButton>
            </div>
          </div>
        </template>

        <template v-else>
          <MessageList />
          <ChatInput />
        </template>
        </div>
      </div>
    </section>

    <NModal v-model:show="showMaterialModal" preset="card" :title="t('chat.workspace.materialsCurrentSession')" style="width: min(860px, 95vw)">
      <div class="material-modal-body">
        <div v-if="!hasCurrentSessionMaterials" class="workspace-empty-tip">{{ t('chat.workspace.noMaterials') }}</div>
        <div v-else class="material-modal-list">
          <div v-for="item in currentSessionMaterials" :key="item.id" class="material-modal-item" :class="{ image: item.kind === 'image' && !!item.url }">
            <div v-if="item.kind === 'image' && item.url" class="material-modal-preview" @click="openImagePreviewByItem(item)">
              <img :src="item.url" :alt="item.name" loading="lazy" />
              <button type="button" class="material-preview-zoom">{{ t('chat.workspace.zoomView') }}</button>
            </div>
            <span v-else class="material-kind" :class="item.kind">{{ item.kind === 'image' ? 'IMG' : 'FILE' }}</span>
            <div class="material-modal-main">
              <strong :title="item.name">{{ item.name }}</strong>
              <small>
                {{ t('chat.workspace.sourceLabel') }}{{ item.source === 'attachment' ? t('chat.workspace.sourceAttachment') : t('chat.workspace.sourceContent') }}
                <template v-if="item.url"> · {{ item.url }}</template>
              </small>
            </div>
            <span class="material-size">{{ formatMaterialSize(item.size) }}</span>
          </div>
        </div>
      </div>
    </NModal>

    <NModal v-model:show="showImagePreviewModal" preset="card" :title="t('chat.workspace.imagePreview')" style="width: min(1080px, 96vw)">
      <div class="image-preview-modal-body">
        <div v-if="!previewImageItem" class="workspace-empty-tip">{{ t('chat.workspace.noPreviewImages') }}</div>
        <template v-else>
          <div class="image-preview-meta">
            <strong :title="previewImageItem.name">{{ previewImageItem.name }}</strong>
            <small>{{ t('chat.workspace.previewIndicator', { index: previewImageIndex + 1, total: previewImageItems.length, sessionId: activeSessionIdText }) }}</small>
          </div>
          <div class="image-preview-stage">
            <button type="button" class="image-preview-nav" @click="previewPrevImage" :disabled="previewImageItems.length <= 1">‹</button>
            <img class="image-preview-main" :src="previewImageItem.url" :alt="previewImageItem.name" />
            <button type="button" class="image-preview-nav" @click="previewNextImage" :disabled="previewImageItems.length <= 1">›</button>
          </div>
        </template>
      </div>
    </NModal>

    <NModal
      v-model:show="showRenameModal"
      preset="dialog"
      :title="t('chat.renameSession')"
      :positive-text="t('common.confirm')"
      :negative-text="t('common.cancel')"
      @positive-click="handleRenameConfirm"
    >
      <NInput v-model:value="renameInput" :placeholder="t('chat.renamePlaceholder')" @keyup.enter="handleRenameConfirm" />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-panel-v2 {
  --session-side-width: 248px;
  --cp-accent-rgb: var(--theme-primary-rgb, 102, 126, 234);
  --cp-accent: rgba(var(--cp-accent-rgb), 0.92);
  --cp-accent-soft: rgba(var(--cp-accent-rgb), 0.16);
  --cp-accent-soft-2: rgba(var(--cp-accent-rgb), 0.24);
  --cp-accent-outline: rgba(var(--cp-accent-rgb), 0.44);
  --cp-surface: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 78%, transparent);
  --cp-surface-strong: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 92%, rgba(0, 0, 0, 0.1));
  --cp-border: color-mix(in srgb, var(--theme-border, rgba(255, 255, 255, 0.15)) 86%, transparent);
  --cp-text-main: var(--theme-text, #e8f2ff);
  --cp-text-subtle: var(--theme-text-secondary, #b6c7dd);
  --cp-text-muted: var(--theme-text-muted, #8da2ba);

  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--session-side-width) minmax(0, 1fr);
  position: relative;
  transition: grid-template-columns 0.26s cubic-bezier(0.22, 1, 0.36, 1);
  background:
    radial-gradient(circle at 18% 20%, rgba(var(--cp-accent-rgb), 0.12), transparent 46%),
    radial-gradient(circle at 82% 78%, rgba(var(--cp-accent-rgb), 0.08), transparent 48%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-background-secondary, #12121a) 86%, transparent),
      color-mix(in srgb, var(--theme-background, #0a0a0f) 95%, transparent)
    );

  &.sessions-collapsed {
    --session-side-width: 72px;
  }
}

.session-side {
  border-right: 1px solid var(--cp-border);
  background: color-mix(in srgb, var(--cp-surface-strong) 92%, transparent);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  transition: border-color 0.22s ease, background-color 0.22s ease;

  &.collapsed {
    border-right-color: var(--cp-accent-soft-2);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-background-secondary, #12121a) 84%, transparent),
      color-mix(in srgb, var(--theme-background, #0a0a0f) 92%, transparent)
    );

    .session-tools,
    .session-list {
      display: none;
    }
  }
}

.session-brand {
  flex-shrink: 0;
  padding: 12px 10px;
  display: grid;
  grid-template-columns: 34px auto;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--cp-border);
  transition: padding 0.22s ease;
}

.session-side.collapsed .session-brand {
  grid-template-columns: 1fr;
  justify-items: center;
  gap: 8px;
  padding: 12px 8px 10px;
}

.brand-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--cp-text-main);
  border: 1px solid var(--cp-accent-outline);
  background: linear-gradient(145deg, rgba(var(--cp-accent-rgb), 0.24), rgba(var(--cp-accent-rgb), 0.14));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text, #fff) 24%, transparent),
    0 8px 20px color-mix(in srgb, rgba(var(--cp-accent-rgb), 0.34) 70%, rgba(0, 0, 0, 0.24));

  svg {
    width: 16px;
    height: 16px;
    stroke-width: 1.75;
  }
}

.session-side.collapsed .brand-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.session-collapse-btn {
  color: var(--cp-text-subtle);
  border: 1px solid var(--cp-border);
  background: color-mix(in srgb, var(--cp-surface) 76%, transparent);
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;

  &:hover {
    color: var(--cp-text-main);
    border-color: var(--cp-accent-outline);
    background: var(--cp-accent-soft);
    transform: translateX(-1px);
  }

  :deep(svg) {
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.session-side.collapsed .session-collapse-btn {
  transform: rotate(180deg);

  &:hover {
    transform: rotate(180deg);
  }
}

.session-tools {
  flex-shrink: 0;
  padding: 9px;
  border-bottom: 1px solid var(--cp-border);
}

.session-control-shell {
  border: 1px solid var(--cp-border);
  border-radius: 12px;
  padding: 8px;
  background:
    linear-gradient(
      140deg,
      color-mix(in srgb, rgba(var(--cp-accent-rgb), 0.16) 72%, transparent),
      color-mix(in srgb, rgba(var(--cp-accent-rgb), 0.08) 62%, transparent)
    ),
    color-mix(in srgb, var(--cp-surface) 88%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text, #fff) 10%, transparent),
    0 8px 20px rgba(5, 11, 17, 0.18);
  display: grid;
  gap: 8px;
}

.session-control-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.session-mode-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  border-radius: 10px;
  border: 1px solid var(--cp-border);
  padding: 3px;
  background: color-mix(in srgb, var(--cp-surface-strong) 88%, transparent);
}

.mode-chip {
  border: none;
  background: transparent;
  color: var(--cp-text-subtle);
  border-radius: 8px;
  text-align: center;
  padding: 6px 8px;
  min-height: 32px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.16s ease;

  &:hover {
    color: var(--cp-text-main);
    background: var(--cp-accent-soft);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(var(--cp-accent-rgb), 0.24);
  }

  &.active {
    color: var(--cp-accent);
    background: linear-gradient(120deg, rgba(var(--cp-accent-rgb), 0.24), rgba(var(--cp-accent-rgb), 0.12));
    box-shadow: inset 0 0 0 1px rgba(var(--cp-accent-rgb), 0.24);
  }
}

.mode-chip-label {
  font-size: 11px;
  font-weight: 700;
}

.mode-chip-count {
  min-width: 18px;
  padding: 0 6px;
  height: 18px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 18px;
  color: var(--cp-text-subtle);
  background: rgba(var(--cp-accent-rgb), 0.16);
  border: 1px solid rgba(var(--cp-accent-rgb), 0.28);
  font-variant-numeric: tabular-nums;
}

.mode-chip.active .mode-chip-count {
  color: var(--cp-text-main);
  border-color: rgba(var(--cp-accent-rgb), 0.44);
  background: rgba(var(--cp-accent-rgb), 0.24);
}

.session-control-total {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.32px;
  color: var(--cp-text-subtle);
  border-radius: 999px;
  border: 1px solid rgba(var(--cp-accent-rgb), 0.28);
  background: rgba(var(--cp-accent-rgb), 0.12);
  padding: 4px 8px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.session-search-count {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid rgba(var(--cp-accent-rgb), 0.42);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--cp-text-main);
  background: rgba(var(--cp-accent-rgb), 0.16);
}

.session-group-nav {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.session-group-nav-btn {
  border: 1px solid rgba(var(--cp-accent-rgb), 0.32);
  background: color-mix(in srgb, var(--cp-surface) 88%, transparent);
  color: var(--cp-text-subtle);
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.16s ease;

  strong {
    font-size: 10px;
    min-width: 16px;
    text-align: center;
    color: var(--cp-text-main);
    background: rgba(var(--cp-accent-rgb), 0.18);
    border-radius: 999px;
    padding: 0 4px;
  }

  &:hover {
    border-color: rgba(var(--cp-accent-rgb), 0.56);
    color: var(--cp-text-main);
    background: rgba(var(--cp-accent-rgb), 0.16);
  }
}

:deep(.session-search-input .n-input) {
  border-radius: 10px;
  border-color: var(--cp-border);
  background: color-mix(in srgb, var(--cp-surface) 82%, transparent);
  min-height: 38px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

:deep(.session-search-input .n-input:hover) {
  border-color: rgba(var(--cp-accent-rgb), 0.42);
  background: color-mix(in srgb, var(--cp-surface) 94%, transparent);
}

:deep(.session-search-input .n-input.n-input--focus) {
  border-color: rgba(var(--cp-accent-rgb), 0.76);
  background: color-mix(in srgb, var(--cp-surface) 96%, transparent);
  box-shadow: 0 0 0 2px rgba(var(--cp-accent-rgb), 0.18);
}

:deep(.session-search-input .n-input__placeholder) {
  color: color-mix(in srgb, var(--cp-text-muted) 86%, transparent);
}


.session-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 9px 9px 16px;
  display: flex;
  flex-direction: column;
  gap: 7px;

  scrollbar-width: thin;
  scrollbar-color: rgba(var(--cp-accent-rgb), 0.42) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(var(--cp-accent-rgb), 0.32);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--cp-accent-rgb), 0.52);
    background-clip: content-box;
  }
}

.session-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.session-group-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--cp-border) 82%, transparent);
  background: color-mix(in srgb, var(--cp-surface-strong) 94%, transparent);
  backdrop-filter: blur(8px);
}

.session-group-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--cp-text-subtle);
  letter-spacing: 0.2px;
}

.session-group-count {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 18px;
  text-align: center;
  color: var(--cp-text-main);
  background: rgba(var(--cp-accent-rgb), 0.18);
  border: 1px solid rgba(var(--cp-accent-rgb), 0.3);
}

.session-card {
  border: 1px solid var(--cp-border);
  border-radius: 12px;
  padding: 9px;
  background: color-mix(in srgb, var(--cp-surface-strong) 88%, transparent);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(var(--cp-accent-rgb), 0.5);
    box-shadow: 0 14px 22px rgba(4, 10, 14, 0.26);
  }

  &:focus-visible {
    outline: none;
    border-color: rgba(var(--cp-accent-rgb), 0.9);
    box-shadow: 0 0 0 2px rgba(var(--cp-accent-rgb), 0.22);
  }

  &.active {
    border-color: rgba(var(--cp-accent-rgb), 0.9);
    background: linear-gradient(
      145deg,
      rgba(var(--cp-accent-rgb), 0.2),
      color-mix(in srgb, var(--cp-surface-strong) 88%, transparent)
    );
    box-shadow: inset 0 0 0 1px rgba(var(--cp-accent-rgb), 0.3);
  }

  &.terminal.active {
    border-color: rgba(var(--cp-accent-rgb), 0.72);
    background: linear-gradient(
      145deg,
      rgba(var(--cp-accent-rgb), 0.16),
      color-mix(in srgb, var(--cp-surface-strong) 90%, transparent)
    );
  }
}

.session-level-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
}

.session-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 700;
  color: var(--cp-text-main);
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.session-id-line {
  margin: 5px 0 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px;
  align-items: center;
}

.session-id-label {
  font-size: 10px;
  font-weight: 700;
  color: color-mix(in srgb, var(--cp-text-subtle) 92%, transparent);
  letter-spacing: 0.35px;
}

.session-id-value {
  min-width: 0;
  font-size: 11px;
  color: color-mix(in srgb, var(--cp-text-subtle) 98%, transparent);
  font-family: $font-code;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta-row {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.session-stat-count {
  font-size: 11px;
  color: rgba($text-muted, 0.95);
}

.session-tag {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid rgba(var(--cp-accent-rgb), 0.5);
  color: var(--cp-accent);
  background: rgba(var(--cp-accent-rgb), 0.15);

  &.terminal {
    border-color: rgba(var(--cp-accent-rgb), 0.4);
    color: var(--cp-text-main);
    background: rgba(var(--cp-accent-rgb), 0.12);
  }
}

.session-time {
  color: $text-muted;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.1px;
}

.session-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  opacity: 0;
  transform: translateY(2px);
  pointer-events: none;
  transition: opacity 0.16s ease, transform 0.16s ease;

  button {
    border: 1px solid var(--cp-border);
    background: color-mix(in srgb, var(--cp-surface) 82%, transparent);
    color: var(--cp-text-subtle);
    border-radius: 999px;
    font-size: 11px;
    min-height: 28px;
    padding: 4px 10px;
    cursor: pointer;

    &.danger { color: var(--theme-error, #ff9aa5); }

    &:hover {
      border-color: rgba(var(--cp-accent-rgb), 0.38);
      color: var(--cp-text-main);
    }

    &.on {
      color: var(--cp-accent);
      border-color: rgba(var(--cp-accent-rgb), 0.56);
      background: rgba(var(--cp-accent-rgb), 0.15);
    }
  }
}

.session-card:hover .session-actions,
.session-card:focus-within .session-actions,
.session-card.active .session-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.session-empty {
  text-align: center;
  color: $text-muted;
  font-size: 12px;
  padding: 24px 0;
}

.content-shell {
  --content-max-width: 100%;
  --content-padding-x: 14px;

  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  margin-top: 12px;
  padding: 0 var(--content-padding-x);
}

.content-header-shell {
  width: var(--content-max-width);
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, rgba(var(--cp-accent-rgb), 0.16) 76%, transparent),
      color-mix(in srgb, rgba(var(--cp-accent-rgb), 0.08) 58%, transparent)
    ),
    color-mix(in srgb, var(--cp-surface-strong) 86%, transparent);
  backdrop-filter: blur(16px);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text, #fff) 10%, transparent),
    0 16px 28px rgba(5, 10, 16, 0.18);
}

.content-header-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.content-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.content-meta-main {
  min-width: 0;
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: center;
}

.workspace-data-toggle {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid var(--cp-accent-outline);
  background: rgba(var(--cp-accent-rgb), 0.12);
  color: var(--cp-text-main);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(var(--cp-accent-rgb), 0.74);
    background: rgba(var(--cp-accent-rgb), 0.2);
    box-shadow: 0 0 0 2px rgba(var(--cp-accent-rgb), 0.2);
  }

  &:focus-visible {
    outline: none;
    border-color: rgba(var(--cp-accent-rgb), 0.88);
    box-shadow: 0 0 0 2px rgba(var(--cp-accent-rgb), 0.26);
  }

  &.active {
    color: var(--cp-text-main);
    border-color: rgba(var(--cp-accent-rgb), 0.84);
    background: rgba(var(--cp-accent-rgb), 0.26);
  }
}

.content-session-main {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.content-session-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  word-break: break-word;
  font-size: 16px;
  line-height: 1.34;
  font-weight: 800;
  color: var(--cp-text-main);
  letter-spacing: 0.08px;
}

.content-mode-pill {
  font-size: 10px;
  color: var(--cp-accent);
  border: 1px solid rgba(var(--cp-accent-rgb), 0.5);
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(var(--cp-accent-rgb), 0.14);

  &.terminal {
    color: var(--cp-text-main);
    border-color: rgba(var(--cp-accent-rgb), 0.48);
    background: rgba(var(--cp-accent-rgb), 0.15);
  }
}

.content-meta-id {
  max-width: 100%;
  font-size: 11px;
  color: var(--cp-text-subtle);
  border: 1px solid rgba(var(--cp-accent-rgb), 0.38);
  border-radius: 999px;
  padding: 4px 10px;
  background: rgba(var(--cp-accent-rgb), 0.12);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.content-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.workspace-data-panel {
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border);
  display: grid;
  gap: 10px;
}

.workspace-scope-row {
  border: 1px dashed rgba(var(--cp-accent-rgb), 0.3);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(var(--cp-accent-rgb), 0.12);
}

.workspace-scope-label {
  font-size: 11px;
  color: var(--cp-text-subtle);
}

.workspace-scope-id {
  min-width: 0;
  max-width: 72%;
  border-radius: 999px;
  padding: 3px 10px;
  border: 1px solid rgba(var(--cp-accent-rgb), 0.34);
  background: rgba(var(--cp-accent-rgb), 0.16);
  color: var(--cp-text-main);
  font-size: 11px;
  font-family: $font-code;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-data-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.workspace-data-item {
  border: 1px solid rgba(var(--cp-accent-rgb), 0.24);
  border-radius: 10px;
  padding: 8px 9px;
  background: rgba(var(--cp-accent-rgb), 0.12);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-data-label {
  font-size: 10px;
  color: var(--cp-text-subtle);
  letter-spacing: 0.3px;
}

.workspace-data-value {
  font-size: 13px;
  color: var(--cp-text-main);
  font-variant-numeric: tabular-nums;

  &.mono {
    font-family: $font-code;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.workspace-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  strong {
    font-size: 12px;
    color: var(--cp-text-main);
    letter-spacing: 0.12px;
  }
}

.workspace-materials,
.workspace-summary-box,
.workspace-rename-box,
.workspace-job-notices {
  border: 1px solid rgba(var(--cp-accent-rgb), 0.18);
  border-radius: 10px;
  background: color-mix(in srgb, var(--cp-surface) 84%, transparent);
  padding: 9px;
  display: grid;
  gap: 8px;
}

.job-notice-head-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.job-notice-count {
  min-width: 22px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid rgba(127, 210, 255, 0.42);
  background: rgba(96, 186, 250, 0.16);
  color: #9deaff;
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.job-notice-list {
  display: grid;
  gap: 6px;
}

.job-notice-item {
  border: 1px solid rgba(121, 193, 255, 0.22);
  border-radius: 8px;
  background: rgba(8, 16, 24, 0.62);
  padding: 7px 8px;
  display: grid;
  gap: 3px;

  &.ok {
    border-color: rgba(95, 220, 172, 0.35);
    background: rgba(37, 95, 78, 0.22);
  }

  &.error {
    border-color: rgba(255, 142, 168, 0.35);
    background: rgba(108, 52, 64, 0.24);
  }

  &.state {
    border-color: rgba(143, 189, 255, 0.32);
    background: rgba(47, 74, 112, 0.24);
  }
}

.job-notice-text {
  margin: 0;
  color: #dff2ff;
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.job-notice-meta {
  color: rgba(180, 214, 244, 0.76);
  font-size: 11px;
}

.material-summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.material-chip {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  border: 1px solid rgba(130, 192, 255, 0.3);
  color: #bcdcff;
  background: rgba(115, 178, 247, 0.14);

  &.image {
    border-color: rgba(106, 236, 255, 0.4);
    color: #8cefff;
    background: rgba(106, 236, 255, 0.14);
  }

  &.file {
    border-color: rgba(167, 160, 255, 0.4);
    color: #d8d3ff;
    background: rgba(167, 160, 255, 0.16);
  }
}

.material-preview-list {
  display: grid;
  gap: 6px;
}

.material-item {
  border: 1px solid rgba(120, 191, 255, 0.2);
  background: rgba(12, 20, 28, 0.46);
  border-radius: 8px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 4px 8px;
  text-align: left;
  cursor: default;
}

.material-item.is-image {
  cursor: zoom-in;

  &:hover {
    border-color: rgba(106, 236, 255, 0.48);
    background: rgba(18, 35, 50, 0.62);
  }
}

.material-thumb-wrap {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(106, 236, 255, 0.34);
  background: rgba(13, 23, 32, 0.8);
}

.material-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.material-kind {
  min-width: 36px;
  text-align: center;
  border-radius: 999px;
  border: 1px solid rgba(148, 197, 255, 0.42);
  color: #afe6ff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 0;

  &.file {
    color: #d7d5ff;
    border-color: rgba(185, 170, 255, 0.44);
  }
}

.material-name {
  min-width: 0;
  font-size: 12px;
  color: rgba(214, 233, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-size {
  font-size: 10px;
  color: rgba(176, 206, 238, 0.82);
  font-variant-numeric: tabular-nums;
}

.material-action {
  font-size: 10px;
  border: 1px solid rgba(113, 221, 255, 0.45);
  color: #93f1ff;
  border-radius: 999px;
  padding: 1px 7px;
  background: rgba(73, 174, 219, 0.16);
}

.workspace-empty-tip {
  font-size: 12px;
  color: rgba(176, 205, 236, 0.78);
}

.summary-head {
  align-items: flex-start;
}

.summary-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.summary-scroll-tip {
  font-size: 10px;
  color: color-mix(in srgb, var(--cp-text-subtle) 86%, transparent);
  border: 1px solid rgba(var(--cp-accent-rgb), 0.24);
  border-radius: 999px;
  padding: 1px 8px;
  background: rgba(var(--cp-accent-rgb), 0.12);
}

.summary-toggle-btn {
  border: 1px solid rgba(var(--cp-accent-rgb), 0.44);
  border-radius: 999px;
  background: rgba(var(--cp-accent-rgb), 0.16);
  color: var(--cp-text-main);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 9px;
  line-height: 1.5;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;

  &:hover {
    border-color: rgba(var(--cp-accent-rgb), 0.62);
    background: rgba(var(--cp-accent-rgb), 0.24);
    color: var(--cp-text-main);
  }
}

.summary-scroll {
  max-height: 108px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  display: grid;
  gap: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(129, 187, 255, 0.46) transparent;

  &.expanded {
    max-height: 184px;
  }

  &::-webkit-scrollbar {
    width: 7px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(129, 187, 255, 0.36);
    border-radius: 999px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(129, 187, 255, 0.56);
  }

  p {
    margin: 0;
    font-size: 12px;
    color: rgba(210, 230, 252, 0.9);
    line-height: 1.62;
    word-break: break-word;
    white-space: pre-wrap;
  }
}

.rename-inline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.suggestion-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggestion-chip {
  border: 1px solid rgba(var(--cp-accent-rgb), 0.28);
  background: rgba(var(--cp-accent-rgb), 0.14);
  color: var(--cp-text-main);
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease;

  &:hover {
    border-color: rgba(var(--cp-accent-rgb), 0.56);
    background: rgba(var(--cp-accent-rgb), 0.2);
  }
}

.material-modal-body {
  display: grid;
  gap: 8px;
}

.material-modal-list {
  display: grid;
  gap: 8px;
  max-height: 62vh;
  overflow: auto;
}

.material-modal-item {
  border: 1px solid rgba(128, 199, 255, 0.2);
  border-radius: 9px;
  background: rgba(20, 32, 44, 0.6);
  padding: 8px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.material-modal-item.image {
  grid-template-columns: 126px minmax(0, 1fr) auto;
}

.material-modal-preview {
  position: relative;
  width: 126px;
  height: 84px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(104, 217, 255, 0.42);
  background: rgba(9, 17, 24, 0.86);
  cursor: zoom-in;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.material-preview-zoom {
  position: absolute;
  right: 6px;
  bottom: 6px;
  border: 1px solid rgba(127, 228, 255, 0.52);
  background: rgba(8, 24, 34, 0.76);
  color: #abf5ff;
  border-radius: 999px;
  font-size: 10px;
  padding: 2px 8px;
  pointer-events: none;
}

.material-modal-main {
  min-width: 0;
  display: grid;
  gap: 2px;

  strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #e4f3ff;
  }

  small {
    font-size: 11px;
    color: rgba(176, 207, 239, 0.8);
    word-break: break-all;
  }
}

.content-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px var(--content-padding-x) 18px;
  overflow: hidden;
}

.image-preview-modal-body {
  display: grid;
  gap: 10px;
}

.image-preview-meta {
  display: grid;
  gap: 2px;

  strong {
    min-width: 0;
    font-size: 13px;
    color: #e4f4ff;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  small {
    font-size: 11px;
    color: rgba(183, 211, 240, 0.84);
  }
}

.image-preview-stage {
  border: 1px solid rgba(129, 202, 255, 0.24);
  border-radius: 12px;
  background: rgba(8, 16, 24, 0.88);
  min-height: min(72vh, 760px);
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 8px;
  padding: 10px;
}

.image-preview-main {
  width: 100%;
  max-height: min(68vh, 720px);
  object-fit: contain;
  border-radius: 8px;
  background: rgba(7, 14, 22, 0.86);
}

.image-preview-nav {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(121, 208, 255, 0.46);
  background: rgba(68, 146, 212, 0.2);
  color: #c7ecff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.content-body-inner {
  flex: 1;
  min-height: 0;
  width: var(--content-max-width);
  margin: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(13, 18, 24, 0.6);
  backdrop-filter: blur(16px);
}

.terminal-output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.terminal-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px;
  background: rgba(5, 10, 14, 0.62);
  box-shadow: 0 0 18px rgba(#6dddff, 0.08);

  &.error {
    border-color: rgba(#ff6b78, 0.7);
    background: rgba(#ff6b78, 0.08);
  }
}

.terminal-item-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;

  .terminal-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #7cf2ff;
    box-shadow: 0 0 12px rgba(#7cf2ff, 0.8);
  }

  .terminal-title {
    font-size: 11px;
    color: #aeeeff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .terminal-duration {
    font-size: 10px;
    color: $text-muted;
  }
}

.terminal-command {
  font-family: $font-code;
  font-size: 12px;
  color: #7ad9ff;
  margin-bottom: 8px;
}

.terminal-result {
  margin: 0;
  font-family: $font-code;
  font-size: 12px;
  color: $text-primary;
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal-meta {
  margin-top: 8px;
  font-size: 11px;
  color: $text-muted;
  display: flex;
  gap: 8px;
  align-items: center;

  .status {
    border-radius: 999px;
    padding: 2px 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);

    &.ok {
      color: #8fffc6;
      border-color: rgba(#8fffc6, 0.45);
      background: rgba(#8fffc6, 0.12);
    }

    &.error {
      color: #ffb1b8;
      border-color: rgba(#ffb1b8, 0.45);
      background: rgba(#ffb1b8, 0.12);
    }

    &.run {
      color: #bde6ff;
      border-color: rgba(#bde6ff, 0.45);
      background: rgba(#bde6ff, 0.12);
    }
  }
}

.terminal-empty {
  text-align: center;
  color: $text-muted;
  font-size: 12px;
  padding: 56px 0;
}

.terminal-input-row {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 10px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  background: rgba(13, 18, 24, 0.75);
}

@media (max-width: 1500px) {
  .chat-panel-v2 {
    --session-side-width: 236px;
  }

  .chat-panel-v2.sessions-collapsed {
    --session-side-width: 70px;
  }
}

@media (max-width: 1200px) {
  .chat-panel-v2 {
    --session-side-width: 220px;
  }

  .chat-panel-v2.sessions-collapsed {
    --session-side-width: 68px;
  }

  .session-control-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .session-control-total {
    justify-self: start;
  }

  .workspace-data-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace-scope-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .workspace-scope-id {
    max-width: 100%;
  }

  .rename-inline {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary-scroll {
    max-height: 102px;

    &.expanded {
      max-height: 168px;
    }
  }
}

@media (max-width: 860px) {
  .chat-panel-v2 {
    grid-template-columns: minmax(0, 1fr);
  }

  .session-side {
    display: none;
  }

  .content-header-shell {
    padding: 9px 10px;
  }

  .workspace-data-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .material-modal-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .material-modal-item.image {
    grid-template-columns: minmax(0, 1fr);
  }

  .material-modal-preview {
    width: 100%;
    height: 160px;
  }

  .image-preview-stage {
    grid-template-columns: 30px minmax(0, 1fr) 30px;
    min-height: min(66vh, 540px);
    padding: 8px;
  }

  .session-mode-switch {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .content-session-main {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .content-meta-id {
    max-width: 100%;
  }

  .content-header,
  .content-body {
    padding-left: 12px;
    padding-right: 12px;
  }

  .summary-scroll {
    max-height: 94px;

    &.expanded {
      max-height: 152px;
    }
  }
}
</style>

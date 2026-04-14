<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, NTooltip, NPopconfirm, NInput, NModal, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import { useChatStore } from '@/stores/chat'
import { useTerminalStore } from '@/stores/terminal'
import { useAppStore } from '@/stores/app'
import { renameSession } from '@/api/sessions'
import { useRouter } from 'vue-router'

const { t, locale } = useI18n()
const chatStore = useChatStore()
const terminalStore = useTerminalStore()
const appStore = useAppStore()
const message = useMessage()
const router = useRouter()

const SESSION_PANEL_MEMORY_KEY = 'chat:preferred-panel'

const showSessions = ref(true)
const expandedGroups = ref<Set<string>>(new Set(['today'])) // 默认展开今天
const sessionSearch = ref('')
const sessionTypeFilter = ref<'none' | 'all' | 'chat' | 'terminal'>('none')
const preferredPanel = ref<'chat' | 'terminal'>(
  localStorage.getItem(SESSION_PANEL_MEMORY_KEY) === 'terminal' ? 'terminal' : 'chat',
)

// 合并所有会话（聊天+终端）
interface UnifiedSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  type: 'chat' | 'terminal'
  messageCount?: number
  commandCount?: number
  model?: string
}

const allSessions = computed<UnifiedSession[]>(() => {
  const chatSessions: UnifiedSession[] = chatStore.sessions.map(s => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    type: 'chat' as const,
    messageCount: s.messages.length || s.messageCount,
    model: s.model,
  }))

  const terminalSessions: UnifiedSession[] = terminalStore.sessions.map(s => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    type: 'terminal' as const,
    commandCount: s.commands.length,
  }))

  return [...chatSessions, ...terminalSessions].sort((a, b) => b.updatedAt - a.updatedAt)
})

const chatSessionCount = computed(() => allSessions.value.filter(s => s.type === 'chat').length)
const terminalSessionCount = computed(() => allSessions.value.filter(s => s.type === 'terminal').length)

const filteredSessions = computed(() => {
  const keyword = sessionSearch.value.trim().toLowerCase()
  return allSessions.value.filter((session) => {
    if (sessionTypeFilter.value === 'none') {
      return false
    }
    if (sessionTypeFilter.value !== 'all' && session.type !== sessionTypeFilter.value) {
      return false
    }
    if (!keyword) return true
    return session.title.toLowerCase().includes(keyword) || session.id.toLowerCase().includes(keyword)
  })
})

// 按日期分组
const groupedSessions = computed(() => {
  const groups: Record<string, UnifiedSession[]> = {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const weekAgo = today - 7 * 86400000

  for (const session of filteredSessions.value) {
    const sessionDate = new Date(session.createdAt)
    const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()).getTime()

    let groupKey: string
    if (sessionDay >= today) {
      groupKey = 'today'
    } else if (sessionDay >= yesterday) {
      groupKey = 'yesterday'
    } else if (sessionDay >= weekAgo) {
      groupKey = 'thisWeek'
    } else {
      groupKey = sessionDate.toLocaleDateString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric' })
    }

    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(session)
  }

  return groups
})

function toggleGroup(groupKey: string) {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
  } else {
    expandedGroups.value.add(groupKey)
  }
}

function isGroupExpanded(groupKey: string): boolean {
  return expandedGroups.value.has(groupKey)
}

function getGroupLabel(groupKey: string): string {
  switch (groupKey) {
    case 'today': return t('chat.groupToday')
    case 'yesterday': return t('chat.groupYesterday')
    case 'thisWeek': return t('chat.groupThisWeek')
    default: return groupKey
  }
}

function switchToChatView() {
  const nextQuery = { ...router.currentRoute.value.query }
  delete nextQuery.panel
  router.replace({ name: 'chat', query: nextQuery })
}

function switchToTerminalView() {
  router.replace({ name: 'chat', query: { ...router.currentRoute.value.query, panel: 'terminal' } })
}

function rememberPreferredPanel(panel: 'chat' | 'terminal') {
  preferredPanel.value = panel
  localStorage.setItem(SESSION_PANEL_MEMORY_KEY, panel)
}

function handleUnifiedFilter(target: 'none' | 'all' | 'chat' | 'terminal') {
  sessionTypeFilter.value = target

  if (target === 'none') {
    return
  }

  if (target === 'all') {
    if (preferredPanel.value === 'terminal') {
      switchToTerminalView()
    } else {
      switchToChatView()
    }
    return
  }

  if (target === 'terminal') {
    rememberPreferredPanel('terminal')
    switchToTerminalView()
  } else {
    rememberPreferredPanel('chat')
    switchToChatView()
  }
}

function handleSessionClick(session: UnifiedSession) {
  if (session.type === 'chat') {
    rememberPreferredPanel('chat')
    chatStore.switchSession(session.id)
    router.push({ name: 'chat' })
  } else {
    rememberPreferredPanel('terminal')
    terminalStore.switchSession(session.id)
    router.push({ name: 'chat', query: { panel: 'terminal' } })
  }
}

function isSessionActive(session: UnifiedSession): boolean {
  if (session.type === 'chat') {
    return session.id === chatStore.activeSessionId
  }
  return session.id === terminalStore.activeSessionId
}

const activeSessionLabel = computed(() =>
  chatStore.activeSession?.title || t('chat.newChat'),
)

const sessionModelLabel = computed(() =>
  chatStore.activeSession?.model || appStore.selectedModel || '',
)

const activeMessageCount = computed(() => chatStore.messages.filter(m => m.role === 'user' || m.role === 'assistant').length)
const activeToolCount = computed(() => chatStore.messages.filter(m => m.role === 'tool').length)

const lastResponseLatencyMs = computed(() => {
  const msgs = chatStore.messages
  const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant) return 0

  const assistantIndex = msgs.findIndex(m => m.id === lastAssistant.id)
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      return Math.max(0, lastAssistant.timestamp - msgs[i].timestamp)
    }
  }
  return 0
})

const lastLatencyLabel = computed(() => {
  const ms = lastResponseLatencyMs.value
  if (!ms) return '--'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
})

const activeUpdatedAtLabel = computed(() => {
  if (!chatStore.activeSession?.updatedAt) return '--'
  return formatTime(chatStore.activeSession.updatedAt)
})

const canRegenerate = computed(() => !chatStore.isStreaming && chatStore.messages.some(m => m.role === 'user'))

async function handleRegenerate() {
  await chatStore.regenerateLastResponse()
}

function handleNewChat() {
  chatStore.newChat()
}

function copySessionId() {
  if (chatStore.activeSessionId) {
    navigator.clipboard.writeText(chatStore.activeSessionId)
    message.success(t('common.copied'))
  }
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
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Session context menu
const showRenameModal = ref(false)
const renameTarget = ref<{ id: string; title: string } | null>(null)
const renameInput = ref('')

async function handleRenameConfirm() {
  if (!renameTarget.value || !renameInput.value.trim()) return
  const ok = await renameSession(renameTarget.value.id, renameInput.value.trim())
  if (ok) {
    chatStore.updateSessionTitle(renameTarget.value.id, renameInput.value.trim())
    message.success(t('common.success'))
  } else {
    message.error(t('common.error'))
  }
  showRenameModal.value = false
  renameTarget.value = null
}
</script>

<template>
  <div class="chat-panel">
    <!-- Session List -->
    <aside class="session-list" :class="{ collapsed: !showSessions }">
      <div class="session-list-header">
        <div class="session-title-wrap">
          <span v-if="showSessions" class="session-list-title">{{ t('chat.sessions') }}</span>
          <span class="session-total-pill">{{ t('chat.totalSessions') }} {{ allSessions.length }}</span>
        </div>
        <NButton quaternary size="tiny" @click="handleNewChat" circle>
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </template>
        </NButton>
      </div>

      <div v-if="showSessions" class="session-tools">
        <NInput
          v-model:value="sessionSearch"
          size="small"
          clearable
          :placeholder="t('chat.searchSessions')"
        />

        <div class="session-control-row">
          <button class="type-filter-btn" :class="{ active: sessionTypeFilter === 'all' }" @click="handleUnifiedFilter('all')">
            {{ t('chat.all') }}
            <small>{{ allSessions.length }}</small>
          </button>
          <button class="type-filter-btn" :class="{ active: sessionTypeFilter === 'chat' }" @click="handleUnifiedFilter('chat')">
            {{ t('chat.chatOnly') }}
            <small>{{ chatSessionCount }}</small>
          </button>
          <button class="type-filter-btn" :class="{ active: sessionTypeFilter === 'terminal' }" @click="handleUnifiedFilter('terminal')">
            {{ t('chat.terminalOnly') }}
            <small>{{ terminalSessionCount }}</small>
          </button>
        </div>
      </div>

      <div v-if="showSessions" class="session-items">
        <div v-if="chatStore.isLoadingSessions && allSessions.length === 0" class="session-loading">{{ t('chat.loadingSessions') }}</div>
        <div v-else-if="filteredSessions.length === 0" class="session-empty">
          {{ sessionTypeFilter === 'none' ? t('chat.clickFilterToShow') : t('chat.noSessions') }}
        </div>

        <!-- 按日期分组 -->
        <div v-for="(sessions, groupKey) in groupedSessions" :key="groupKey" class="session-group">
          <div class="group-header" @click="toggleGroup(groupKey)">
            <span class="group-arrow" :class="{ expanded: isGroupExpanded(groupKey) }">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
            <span class="group-label">{{ getGroupLabel(groupKey) }}</span>
            <span class="group-count">{{ sessions.length }}</span>
          </div>

          <div v-show="isGroupExpanded(groupKey)" class="group-sessions">
            <div
              v-for="s in sessions"
              :key="s.id"
              class="session-item"
              :class="{ active: isSessionActive(s), 'session-terminal': s.type === 'terminal' }"
              @click="handleSessionClick(s)"
            >
              <div class="session-type-icon">
                <svg v-if="s.type === 'terminal'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="session-item-content">
                <span class="session-item-title">{{ s.title }}</span>
                <span class="session-item-meta">
                  <span class="session-item-kind" :class="{ terminal: s.type === 'terminal' }">
                    {{ s.type === 'terminal' ? t('chat.terminalOnly') : t('chat.chatOnly') }}
                  </span>
                  <span v-if="s.type === 'terminal'" class="session-item-count">{{ s.commandCount }} {{ t('chat.commandsCount') }}</span>
                  <template v-else>
                    <span v-if="s.messageCount" class="session-item-count">{{ s.messageCount }} {{ t('chat.messagesCount') }}</span>
                    <span v-if="s.model" class="session-item-model">{{ s.model }}</span>
                  </template>
                  <span class="session-item-time">{{ formatTime(s.updatedAt) }}</span>
                </span>
              </div>
              <NPopconfirm
                @positive-click="handleDeleteSession(s.id, s.type)"
              >
                <template #trigger>
                  <button class="session-item-delete" @click.stop>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </template>
                {{ t('chat.deleteSessionConfirm') }}
              </NPopconfirm>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Chat Area -->
    <div class="chat-main">
      <header class="chat-header">
        <div class="header-left">
          <NButton quaternary size="small" @click="showSessions = !showSessions" circle>
            <template #icon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </template>
          </NButton>
          <span class="header-session-title">{{ activeSessionLabel }}</span>
        </div>
        <div class="header-center">
          <span v-if="sessionModelLabel" class="model-badge">{{ sessionModelLabel }}</span>
          <span class="header-meta-chip">{{ activeMessageCount }} {{ t('chat.messagesCount') }}</span>
          <span class="header-meta-chip">{{ activeToolCount }} {{ t('chat.toolCalls') }}</span>
          <span class="header-meta-chip muted">{{ t('chat.lastLatency') }} {{ lastLatencyLabel }}</span>
          <span class="header-meta-chip muted">{{ t('chat.lastUpdated') }} {{ activeUpdatedAtLabel }}</span>
        </div>
        <div class="header-actions">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton quaternary size="small" @click="copySessionId" circle>
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </template>
              </NButton>
            </template>
            {{ t('chat.copySessionId') }}
          </NTooltip>
          <NButton size="small" :disabled="!canRegenerate" @click="handleRegenerate">
            {{ t('chat.regenerate') }}
          </NButton>
          <NButton size="small" @click="handleNewChat">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </template>
            {{ t('chat.newChat') }}
          </NButton>
        </div>
      </header>

      <MessageList />
      <ChatInput />
    </div>

    <!-- Rename Session Modal -->
    <NModal
      v-model:show="showRenameModal"
      preset="dialog"
      :title="t('chat.renameSession')"
      :positive-text="t('common.confirm')"
      :negative-text="t('common.cancel')"
      @positive-click="handleRenameConfirm"
    >
        <NInput
          v-model:value="renameInput"
          :placeholder="t('chat.renamePlaceholder')"
          @keyup.enter="handleRenameConfirm"
        />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-panel {
  display: flex;
  height: 100%;
}

.session-list {
  width: 280px;
  border-right: 1px solid rgba($border-color, 0.8);
  background: linear-gradient(180deg, rgba($bg-secondary, 0.72) 0%, rgba($bg-primary, 0.94) 100%);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width $transition-normal, opacity $transition-normal;
  overflow: hidden;

  &.collapsed {
    width: 0;
    border-right: none;
    opacity: 0;
    pointer-events: none;
  }
}

.session-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  flex-shrink: 0;
}

.session-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.session-total-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  font-size: 10px;
  color: $text-muted;
  border: 1px solid rgba($accent-primary, 0.22);
  background: rgba($accent-primary, 0.08);
  border-radius: 999px;
  padding: 2px 8px;
}

.session-tools {
  padding: 0 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-control-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: thin;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    height: 4px;
  }
}

.type-filter-btn {
  border: 1px solid rgba($border-color, 0.75);
  background: rgba($bg-secondary, 0.65);
  color: $text-muted;
  font-size: 11px;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  transition: all $transition-fast;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;

  small {
    min-width: 16px;
    text-align: center;
    font-size: 10px;
    line-height: 15px;
    border-radius: 999px;
    padding: 0 5px;
    color: $text-muted;
    border: 1px solid rgba($border-color, 0.6);
    background: rgba($bg-primary, 0.5);
  }

  &:hover {
    border-color: rgba($accent-primary, 0.5);
    color: $text-primary;
  }

  &.active {
    border-color: rgba($accent-primary, 0.72);
    background: rgba($accent-primary, 0.14);
    color: $accent-primary;
    font-weight: 600;

    small {
      color: $accent-primary;
      border-color: rgba($accent-primary, 0.45);
      background: rgba($accent-primary, 0.12);
    }
  }
}

.session-list-title {
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 14px;
}

// Session Groups
.session-group {
  margin-bottom: 8px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  user-select: none;
  border-radius: $radius-sm;
  transition: background $transition-fast;

  &:hover {
    background: rgba($accent-primary, 0.04);
  }
}

.group-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: $text-muted;
  transition: transform $transition-fast;

  &.expanded {
    transform: rotate(90deg);
  }
}

.group-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
}

.group-count {
  font-size: 10px;
  color: $text-muted;
  background: $bg-secondary;
  padding: 1px 6px;
  border-radius: 8px;
}

.group-sessions {
  margin-left: 7px;
  border-left: 2px solid rgba($border-color, 0.72);
  padding-left: 6px;
}

.session-type-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;

  .session-terminal & {
    color: $accent-primary;
  }
}

.session-item-count {
  font-size: 10px;
  color: $text-muted;
}

.session-loading,
.session-empty {
  padding: 16px 10px;
  font-size: 12px;
  color: $text-muted;
  text-align: center;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 10px;
  border: 1px solid transparent;
  background: rgba($bg-secondary, 0.42);
  border-radius: $radius-sm;
  cursor: pointer;
  text-align: left;
  color: $text-secondary;
  transition: all $transition-fast;
  margin-bottom: 5px;
  position: relative;

  &:hover {
    background: rgba($accent-primary, 0.1);
    color: $text-primary;
    border-color: rgba($accent-primary, 0.38);
    transform: translateX(2px);

    .session-item-menu,
    .session-item-delete {
      opacity: 1;
    }
  }

  &.active {
    background: linear-gradient(120deg, rgba($accent-primary, 0.18), rgba($accent-primary, 0.08));
    color: $text-primary;
    font-weight: 500;
    border-color: rgba($accent-primary, 0.54);

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 6px;
      bottom: 6px;
      width: 3px;
      background: $accent-primary;
      border-radius: 0 2px 2px 0;
    }

    .session-item-title {
      color: $accent-primary;
    }

    .session-item-model {
      background: rgba($accent-primary, 0.15);
      color: $accent-primary;
    }
  }
}

.session-item-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.session-item-title {
  display: block;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item-time {
  font-size: 11px;
  color: $text-muted;
}

.session-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.session-item-kind {
  font-size: 10px;
  line-height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid rgba($accent-primary, 0.32);
  background: rgba($accent-primary, 0.08);
  color: $accent-primary;
  flex-shrink: 0;

  &.terminal {
    border-color: rgba($info, 0.38);
    background: rgba($info, 0.12);
    color: $info;
  }
}

.session-item-model {
  font-size: 10px;
  color: $accent-primary;
  background: rgba($accent-primary, 0.08);
  padding: 0 5px;
  border-radius: 3px;
  line-height: 16px;
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item-menu {
  flex-shrink: 0;
  opacity: 0;
  padding: 2px;
  border: none;
  background: none;
  color: $text-muted;
  cursor: pointer;
  border-radius: 3px;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
    background: rgba($text-primary, 0.1);
  }
}

.session-item-delete {
  flex-shrink: 0;
  opacity: 0;
  padding: 2px;
  border: none;
  background: none;
  color: $text-muted;
  cursor: pointer;
  border-radius: 3px;
  transition: all $transition-fast;

  &:hover {
    color: $error;
    background: rgba($error, 0.1);
  }
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba($border-color, 0.9);
  background: linear-gradient(180deg, rgba($bg-primary, 0.92), rgba($bg-primary, 0.82));
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.header-center {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.header-session-title {
  font-size: 14px;
  font-weight: 500;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-badge {
  font-size: 11px;
  color: $text-muted;
  background: rgba($accent-primary, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid $border-color;
  flex-shrink: 0;
}

.header-meta-chip {
  font-size: 10px;
  border-radius: 999px;
  border: 1px solid rgba($accent-primary, 0.28);
  background: rgba($accent-primary, 0.08);
  color: $text-secondary;
  padding: 2px 8px;
  white-space: nowrap;

  &.muted {
    border-color: rgba($border-color, 0.7);
    background: rgba($bg-secondary, 0.6);
    color: $text-muted;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .session-list {
    width: 240px;
  }

  .header-meta-chip.muted {
    display: none;
  }
}

@media (max-width: 768px) {
  .session-list {
    width: 220px;
  }

  .chat-header {
    padding: 10px 12px;
    gap: 8px;
  }

  .header-center {
    display: none;
  }
}
</style>

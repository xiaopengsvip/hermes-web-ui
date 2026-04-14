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

const { t } = useI18n()
const chatStore = useChatStore()
const terminalStore = useTerminalStore()
const appStore = useAppStore()
const message = useMessage()
const router = useRouter()

const showSessions = ref(true)
const expandedGroups = ref<Set<string>>(new Set(['today'])) // 默认展开今天

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

// 按日期分组
const groupedSessions = computed(() => {
  const groups: Record<string, UnifiedSession[]> = {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const weekAgo = today - 7 * 86400000

  for (const session of allSessions.value) {
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
      groupKey = sessionDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
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
    case 'today': return '今天'
    case 'yesterday': return '昨天'
    case 'thisWeek': return '本周'
    default: return groupKey
  }
}

function handleSessionClick(session: UnifiedSession) {
  if (session.type === 'chat') {
    chatStore.switchSession(session.id)
  } else {
    terminalStore.switchSession(session.id)
    router.push({ name: 'terminal' })
  }
}

function isSessionActive(session: UnifiedSession): boolean {
  if (session.type === 'chat') {
    return session.id === chatStore.activeSessionId
  }
  return session.id === terminalStore.activeSessionId
}

const activeSessionLabel = computed(() =>
  chatStore.activeSession?.id || 'New Chat',
)

const sessionModelLabel = computed(() =>
  chatStore.activeSession?.model || appStore.selectedModel || '',
)

function handleNewChat() {
  chatStore.newChat()
}

function copySessionId() {
  if (chatStore.activeSessionId) {
    navigator.clipboard.writeText(chatStore.activeSessionId)
    message.success('Copied')
  }
}

function handleDeleteSession(id: string, type: 'chat' | 'terminal') {
  if (type === 'chat') {
    chatStore.deleteSession(id)
  } else {
    terminalStore.deleteSession(id)
    terminalStore.saveSessions()
  }
  message.success('Session deleted')
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
    message.success('Session renamed')
  } else {
    message.error('Failed to rename')
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
        <span v-if="showSessions" class="session-list-title">{{ t('chat.sessions') }}</span>
        <NButton quaternary size="tiny" @click="handleNewChat" circle>
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </template>
        </NButton>
      </div>
      <div v-if="showSessions" class="session-items">
        <div v-if="chatStore.isLoadingSessions && allSessions.length === 0" class="session-loading">{{ t('chat.loadingSessions') }}</div>
        <div v-else-if="allSessions.length === 0" class="session-empty">{{ t('chat.noSessions') }}</div>

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
                  <span v-if="s.type === 'terminal'" class="session-item-count">{{ s.commandCount }} 命令</span>
                  <span v-else-if="s.model" class="session-item-model">{{ s.model }}</span>
                  <span v-else-if="s.messageCount" class="session-item-count">{{ s.messageCount }} 条消息</span>
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
                {{ s.type === 'terminal' ? '删除此终端会话?' : t('chat.deleteSessionConfirm') }}
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
            Copy Session ID
          </NTooltip>
          <NButton size="small" @click="handleNewChat">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </template>
            New Chat
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
      title="Rename Session"
      positive-text="Confirm"
      negative-text="Cancel"
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
  width: 220px;
  border-right: 1px solid $border-color;
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
  padding: 0 6px 12px;
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
  margin-left: 8px;
  border-left: 2px solid $border-color;
  padding-left: 4px;
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
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: none;
  border-radius: $radius-sm;
  cursor: pointer;
  text-align: left;
  color: $text-secondary;
  transition: all $transition-fast;
  margin-bottom: 2px;
  position: relative;

  &:hover {
    background: rgba($accent-primary, 0.06);
    color: $text-primary;

    .session-item-menu,
    .session-item-delete {
      opacity: 1;
    }
  }

  &.active {
    background: rgba($accent-primary, 0.12);
    color: $text-primary;
    font-weight: 500;
    border-left: 3px solid $accent-primary;
    padding-left: 7px;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 4px;
      bottom: 4px;
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
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;
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
  max-width: 240px;
  min-width: 140px;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>

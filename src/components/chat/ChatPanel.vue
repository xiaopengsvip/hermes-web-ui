<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NModal, NPopconfirm, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import ChatDataFlow from './ChatDataFlow.vue'
import { useChatStore } from '@/stores/chat'
import { useTerminalStore } from '@/stores/terminal'
import { useAppStore } from '@/stores/app'
import { renameSession } from '@/api/sessions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()

const chatStore = useChatStore()
const terminalStore = useTerminalStore()
const appStore = useAppStore()

const SESSION_PINNED_MEMORY_KEY = 'chat:pinned-sessions'
const SESSION_SELECTED_MEMORY_KEY = 'chat:selected-session'

const showSessions = ref(true)
const sessionSearch = ref('')
const pinnedSessionKeys = ref<Set<string>>(new Set(JSON.parse(localStorage.getItem(SESSION_PINNED_MEMORY_KEY) || '[]')))

const terminalInput = ref('')
const terminalOutputRef = ref<HTMLDivElement | null>(null)
const terminalHistory = ref<string[]>([])
const terminalHistoryIndex = ref(-1)

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
  if (!keyword) return allSessions.value
  return allSessions.value.filter((session) =>
    session.title.toLowerCase().includes(keyword) || session.id.toLowerCase().includes(keyword),
  )
})

const chatSessionCount = computed(() => allSessions.value.filter(s => s.type === 'chat').length)
const terminalSessionCount = computed(() => allSessions.value.filter(s => s.type === 'terminal').length)

const activeSessionLabel = computed(() => {
  if (isTerminalMode.value) return terminalStore.activeSession?.title || 'Terminal Session'
  return chatStore.activeSession?.title || t('chat.newChat')
})

const activeStats = computed(() => {
  if (isTerminalMode.value) {
    return {
      primary: `${terminalStore.activeSession?.commands.length || 0} 条命令`,
      secondary: terminalStore.activeSession?.workingDir || '/home',
      model: 'Terminal',
    }
  }

  const msgCount = chatStore.messages.filter(m => m.role === 'user' || m.role === 'assistant').length
  const toolCount = chatStore.messages.filter(m => m.role === 'tool').length
  return {
    primary: `${msgCount} 条消息 · ${toolCount} 个工具调用`,
    secondary: chatStore.activeSession?.id || '--',
    model: chatStore.activeSession?.model || appStore.selectedModel || '--',
  }
})

function setContentMode(mode: 'chat' | 'terminal') {
  const query = { ...route.query }
  if (mode === 'terminal') {
    query.panel = 'terminal'
  } else {
    delete query.panel
  }
  router.replace({ name: 'chat', query })
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

onMounted(async () => {
  if (!chatStore.sessions.length) {
    await chatStore.loadSessions()
  }

  if (!terminalStore.sessions.length) {
    terminalStore.createSession()
    terminalStore.saveSessions()
  }

  const selected = localStorage.getItem(SESSION_SELECTED_MEMORY_KEY)
  if (!selected) return

  const [type, id] = selected.split(':')
  const target = allSessions.value.find(s => s.type === type && s.id === id)
  if (target) {
    handleSessionClick(target)
  }
})
</script>

<template>
  <div class="chat-panel-v2">
    <aside class="session-side" :class="{ collapsed: !showSessions }">
      <header class="session-header">
        <div>
          <h3>会话中心</h3>
          <p>默认显示全部：聊天 + 终端</p>
        </div>
        <NButton size="tiny" quaternary circle @click="showSessions = !showSessions">
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <polyline v-if="showSessions" points="15 18 9 12 15 6" />
              <polyline v-else points="9 18 15 12 9 6" />
            </svg>
          </template>
        </NButton>
      </header>

      <div v-if="showSessions" class="session-tools">
        <NInput v-model:value="sessionSearch" size="small" clearable :placeholder="t('chat.searchSessions')" />
        <div class="session-summary">
          <span>全部 {{ allSessions.length }}</span>
          <span>聊天 {{ chatSessionCount }}</span>
          <span>终端 {{ terminalSessionCount }}</span>
        </div>
      </div>

      <div v-if="showSessions" class="session-list">
        <div v-if="filteredSessions.length === 0" class="session-empty">{{ t('chat.noSessions') }}</div>
        <article
          v-for="s in filteredSessions"
          :key="`${s.type}:${s.id}`"
          class="session-card"
          :class="{ active: isSessionActive(s), terminal: s.type === 'terminal' }"
          @click="handleSessionClick(s)"
        >
          <div class="session-card-top">
            <span class="session-tag" :class="s.type">{{ s.type === 'terminal' ? 'TERMINAL' : 'CHAT' }}</span>
            <span class="session-time">{{ formatTime(s.updatedAt) }}</span>
          </div>

          <h4>{{ s.title }}</h4>
          <p>
            <template v-if="s.type === 'terminal'">{{ s.commandCount || 0 }} 条命令</template>
            <template v-else>{{ s.messageCount || 0 }} 条消息</template>
          </p>

          <div class="session-actions">
            <button :class="{ on: isPinned(s) }" @click.stop="togglePin(s)">置顶</button>
            <button @click.stop="openRenameModal(s)">重命名</button>
            <NPopconfirm @positive-click="handleDeleteSession(s.id, s.type)">
              <template #trigger>
                <button class="danger" @click.stop>删除</button>
              </template>
              {{ t('chat.deleteSessionConfirm') }}
            </NPopconfirm>
          </div>
        </article>
      </div>
    </aside>

    <section class="content-shell">
      <header class="content-header">
        <div class="mode-switch">
          <button :class="{ active: !isTerminalMode }" @click="setContentMode('chat')">聊天</button>
          <button :class="{ active: isTerminalMode }" @click="setContentMode('terminal')">终端</button>
        </div>

        <div class="content-meta">
          <strong>{{ activeSessionLabel }}</strong>
          <span>{{ activeStats.primary }}</span>
          <span class="muted">{{ activeStats.model }}</span>
        </div>

        <div class="content-actions">
          <NButton size="small" quaternary @click="chatStore.clearStreamEvents">清空流</NButton>
          <NButton size="small" @click="handleNewSession">{{ isTerminalMode ? '新建终端' : t('chat.newChat') }}</NButton>
        </div>
      </header>

      <div class="content-body">
        <template v-if="isTerminalMode">
          <div class="terminal-shell">
            <div ref="terminalOutputRef" class="terminal-output">
              <div
                v-for="cmd in terminalStore.activeSession?.commands || []"
                :key="cmd.id"
                class="terminal-item"
                :class="cmd.status"
              >
                <div class="terminal-command">$ {{ cmd.command }}</div>
                <pre class="terminal-result">{{ cmd.output || '(no output)' }}</pre>
                <div class="terminal-meta">{{ cmd.duration }}ms · code {{ cmd.exitCode ?? '-' }}</div>
              </div>
              <div v-if="(terminalStore.activeSession?.commands.length || 0) === 0" class="terminal-empty">
                这里显示终端会话输出，左侧会话列表保持不变。
              </div>
            </div>
            <div class="terminal-input-row">
              <NInput
                v-model:value="terminalInput"
                type="textarea"
                :rows="2"
                placeholder="输入命令，Enter 执行，Shift+Enter 换行"
                @keydown="handleTerminalKeydown"
              />
              <NButton :loading="terminalStore.isLoading" @click="executeTerminalCommand">执行</NButton>
            </div>
          </div>
        </template>

        <template v-else>
          <MessageList />
          <ChatInput />
        </template>
      </div>
    </section>

    <ChatDataFlow :events="chatStore.streamEvents" :is-streaming="chatStore.isStreaming" @clear="chatStore.clearStreamEvents" />

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
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 320px;
  background: radial-gradient(circle at 0% 0%, rgba($accent-primary, 0.08), transparent 42%);
}

.session-side {
  border-right: 1px solid rgba($border-color, 0.65);
  background: linear-gradient(180deg, rgba($bg-secondary, 0.78), rgba($bg-primary, 0.96));
  display: flex;
  flex-direction: column;
  min-width: 0;

  &.collapsed {
    width: 56px;
    min-width: 56px;

    .session-tools,
    .session-list,
    .session-header h3,
    .session-header p {
      display: none;
    }
  }
}

.session-header {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid rgba($border-color, 0.5);

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
  }

  p {
    margin: 4px 0 0;
    font-size: 11px;
    color: $text-muted;
  }
}

.session-tools {
  padding: 10px;
  border-bottom: 1px solid rgba($border-color, 0.45);
}

.session-summary {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  span {
    font-size: 11px;
    color: $text-secondary;
    border: 1px solid rgba($border-color, 0.6);
    border-radius: 999px;
    padding: 2px 8px;
    background: rgba($bg-primary, 0.5);
  }
}

.session-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.session-card {
  border: 1px solid rgba($border-color, 0.65);
  border-radius: 14px;
  padding: 12px;
  background: linear-gradient(160deg, rgba($bg-primary, 0.95), rgba($bg-secondary, 0.55));
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba($accent-primary, 0.55);
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.2);
  }

  &.active {
    border-color: rgba($accent-primary, 0.95);
    background: linear-gradient(145deg, rgba($accent-primary, 0.26), rgba($bg-secondary, 0.68));
    box-shadow:
      inset 0 0 0 1px rgba($accent-primary, 0.35),
      0 16px 28px rgba($accent-primary, 0.2);
  }

  &.terminal.active {
    border-color: rgba(#4cc9f0, 0.95);
    background: linear-gradient(145deg, rgba(#4cc9f0, 0.2), rgba($bg-secondary, 0.68));
  }

  h4 {
    margin: 8px 0 4px;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-word;
  }

  p {
    margin: 0;
    color: $text-muted;
    font-size: 11px;
  }
}

.session-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-tag {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  border: 1px solid rgba($accent-primary, 0.5);
  color: $accent-primary;
  background: rgba($accent-primary, 0.12);

  &.terminal {
    border-color: rgba(#4cc9f0, 0.6);
    color: #7ad9ff;
    background: rgba(#4cc9f0, 0.14);
  }
}

.session-time {
  color: $text-muted;
  font-size: 10px;
}

.session-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;

  button {
    border: 1px solid rgba($border-color, 0.7);
    background: rgba($bg-secondary, 0.45);
    color: $text-secondary;
    border-radius: 999px;
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;

    &.danger { color: #ff909e; }
    &.on {
      color: $accent-primary;
      border-color: rgba($accent-primary, 0.6);
      background: rgba($accent-primary, 0.12);
    }
  }
}

.session-empty {
  text-align: center;
  color: $text-muted;
  font-size: 12px;
  padding: 24px 0;
}

.content-shell {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.content-header {
  padding: 12px;
  border-bottom: 1px solid rgba($border-color, 0.55);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  background: linear-gradient(180deg, rgba($bg-secondary, 0.45), rgba($bg-primary, 0.18));
}

.mode-switch {
  display: inline-flex;
  border: 1px solid rgba($border-color, 0.6);
  border-radius: 999px;
  padding: 3px;
  background: rgba($bg-primary, 0.58);

  button {
    border: none;
    background: transparent;
    color: $text-secondary;
    border-radius: 999px;
    padding: 6px 12px;
    cursor: pointer;

    &.active {
      color: #fff;
      background: linear-gradient(135deg, rgba($accent-primary, 0.92), rgba(#6f86ff, 0.92));
      box-shadow: 0 6px 14px rgba($accent-primary, 0.35);
    }
  }
}

.content-meta {
  min-width: 0;
  display: flex;
  gap: 8px;
  align-items: center;

  strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  span {
    font-size: 11px;
    color: $text-secondary;
    border: 1px solid rgba($border-color, 0.5);
    border-radius: 999px;
    padding: 2px 8px;
    background: rgba($bg-secondary, 0.42);

    &.muted {
      color: $text-muted;
    }
  }
}

.content-actions {
  display: flex;
  gap: 8px;
}

.content-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.terminal-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.terminal-output {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: radial-gradient(circle at 10% 0%, rgba(#4cc9f0, 0.08), transparent 28%);
}

.terminal-item {
  border: 1px solid rgba($border-color, 0.65);
  border-radius: 12px;
  padding: 10px;
  background: rgba($bg-primary, 0.6);

  &.error {
    border-color: rgba(#ff6b78, 0.65);
    background: rgba(#ff6b78, 0.08);
  }
}

.terminal-command {
  font-family: $font-code;
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
}

.terminal-empty {
  text-align: center;
  color: $text-muted;
  font-size: 12px;
  padding: 48px 0;
}

.terminal-input-row {
  border-top: 1px solid rgba($border-color, 0.5);
  padding: 10px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

@media (max-width: 1500px) {
  .chat-panel-v2 {
    grid-template-columns: 280px minmax(0, 1fr) 280px;
  }
}

@media (max-width: 1200px) {
  .chat-panel-v2 {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .chat-panel-v2 :deep(.flow-rail) {
    display: none;
  }
}
</style>

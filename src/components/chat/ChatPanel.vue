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

const streamPulse = computed(() => {
  const now = Date.now()
  const recent = chatStore.streamEvents.filter(e => now - e.timestamp <= 10_000)
  const kbps = Math.min(9.9, recent.length * 0.18)
  return `${kbps.toFixed(1)} MB/s`
})

const runtimeBadge = computed(() => {
  if (isTerminalMode.value) return 'Terminal Hybrid'
  return chatStore.activeSession?.model || appStore.selectedModel || 'Hermes Hybrid'
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
      <header class="session-brand">
        <div class="brand-icon">⌘</div>
        <div v-if="showSessions" class="brand-copy">
          <h3>工作站控制台</h3>
          <p>系统就绪</p>
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

      <div v-if="showSessions" class="workspace-nav">
        <button class="workspace-nav-btn">
          <span>主页</span>
        </button>
        <button class="workspace-nav-btn" :class="{ active: isTerminalMode }" @click="setContentMode('terminal')">
          <span>终端</span>
        </button>
        <button class="workspace-nav-btn" :class="{ active: !isTerminalMode }" @click="setContentMode('chat')">
          <span>聊天</span>
        </button>
      </div>

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
      <header class="content-topbar">
        <div class="topbar-left">
          <strong>AI 混合工作站</strong>
          <NInput v-model:value="sessionSearch" size="small" clearable placeholder="搜索会话/ID..." class="top-search" />
        </div>
        <div class="topbar-right">
          <span class="meta-chip">{{ activeStats.primary }}</span>
          <span class="meta-chip muted">{{ runtimeBadge }}</span>
        </div>
      </header>

      <header class="content-header">
        <div class="mode-switch">
          <button :class="{ active: !isTerminalMode }" @click="setContentMode('chat')">聊天</button>
          <button :class="{ active: isTerminalMode }" @click="setContentMode('terminal')">终端</button>
        </div>

        <div class="content-meta">
          <strong>{{ activeSessionLabel }}</strong>
          <span>{{ activeStats.secondary }}</span>
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
                <div class="terminal-item-head">
                  <span class="terminal-dot"></span>
                  <span class="terminal-title">RUN: {{ cmd.command }}</span>
                  <span class="terminal-duration">{{ cmd.duration }}ms</span>
                </div>
                <div class="terminal-command">$ {{ cmd.command }}</div>
                <pre class="terminal-result">{{ cmd.output || '(no output)' }}</pre>
                <div class="terminal-meta">
                  <span :class="['status', cmd.status === 'error' ? 'error' : cmd.exitCode === 0 ? 'ok' : 'run']">
                    {{ cmd.status === 'running' ? '进行中' : cmd.exitCode === 0 ? '完成' : '失败' }}
                  </span>
                  <span>exit code {{ cmd.exitCode ?? '-' }}</span>
                </div>
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

    <div class="floating-status">
      <p>Network Traffic</p>
      <strong>{{ streamPulse }}</strong>
      <div class="bars">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    </div>

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
  position: relative;
  background:
    radial-gradient(circle at 18% 20%, rgba(#6dddff, 0.11), transparent 46%),
    radial-gradient(circle at 82% 78%, rgba(#edb1ff, 0.1), transparent 48%),
    linear-gradient(180deg, rgba($bg-primary, 0.96), rgba($bg-primary, 1));
}

.session-side {
  border-right: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(8, 14, 18, 0.66);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  min-width: 0;

  &.collapsed {
    width: 58px;
    min-width: 58px;

    .workspace-nav,
    .session-tools,
    .session-list,
    .brand-copy {
      display: none;
    }
  }
}

.session-brand {
  padding: 14px 12px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.brand-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #06222a;
  font-weight: 800;
  background: linear-gradient(145deg, #6dddff, #edb1ff);
}

.brand-copy {
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 800;
  }

  p {
    margin: 2px 0 0;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(#6dddff, 0.95);
  }
}

.workspace-nav {
  padding: 10px 10px 2px;
  display: grid;
  gap: 6px;
}

.workspace-nav-btn {
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: $text-muted;
  border-radius: 10px;
  text-align: left;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;

  &.active,
  &:hover {
    color: #8be9ff;
    background: rgba(#19d3ff, 0.14);
    border-color: rgba(#19d3ff, 0.4);
  }
}

.session-tools {
  padding: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.session-summary {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  span {
    font-size: 10px;
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
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  padding: 12px;
  background: rgba(18, 25, 32, 0.55);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(#6dddff, 0.5);
    box-shadow: 0 14px 22px rgba(4, 10, 14, 0.32);
  }

  &.active {
    border-color: rgba(#6dddff, 0.9);
    background: linear-gradient(145deg, rgba(#6dddff, 0.2), rgba(18, 25, 32, 0.55));
    box-shadow: inset 0 0 0 1px rgba(#6dddff, 0.3);
  }

  &.terminal.active {
    border-color: rgba(#8bc5ff, 0.9);
    background: linear-gradient(145deg, rgba(#8bc5ff, 0.2), rgba(18, 25, 32, 0.55));
  }

  h4 {
    margin: 8px 0 4px;
    font-size: 13px;
    line-height: 1.35;
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
  border: 1px solid rgba(#6dddff, 0.5);
  color: #7ee7ff;
  background: rgba(#6dddff, 0.15);

  &.terminal {
    border-color: rgba(#b0b4ff, 0.6);
    color: #d8d7ff;
    background: rgba(#b0b4ff, 0.15);
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
    border: 1px solid rgba($border-color, 0.65);
    background: rgba($bg-secondary, 0.45);
    color: $text-secondary;
    border-radius: 999px;
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;

    &.danger { color: #ff9aa5; }

    &.on {
      color: #7ee7ff;
      border-color: rgba(#6dddff, 0.56);
      background: rgba(#6dddff, 0.15);
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

.content-topbar {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: rgba(8, 14, 18, 0.48);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  strong {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.2px;
    background: linear-gradient(120deg, #77ecff, #e4b1ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.top-search {
  width: 260px;
}

.topbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meta-chip {
  font-size: 11px;
  color: $text-secondary;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 3px 9px;
  background: rgba(255, 255, 255, 0.04);

  &.muted {
    color: $text-muted;
  }
}

.content-header {
  margin: 12px 14px 0;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  background: rgba(19, 26, 33, 0.56);
  backdrop-filter: blur(16px);
}

.mode-switch {
  display: inline-flex;
  border: 1px solid rgba(255, 255, 255, 0.13);
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
      color: #021d2b;
      font-weight: 700;
      background: linear-gradient(130deg, #6dddff, #edb1ff);
      box-shadow: 0 6px 14px rgba(#6dddff, 0.3);
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
  padding: 10px 14px 14px;
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

.floating-status {
  position: fixed;
  right: 18px;
  bottom: 96px;
  z-index: 12;
  border: 1px solid rgba(#6dddff, 0.25);
  background: rgba(11, 18, 24, 0.72);
  backdrop-filter: blur(14px);
  border-radius: 16px;
  padding: 10px 12px;
  min-width: 138px;

  p {
    margin: 0;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: $text-muted;
  }

  strong {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: #7ee7ff;
    font-family: $font-code;
  }

  .bars {
    margin-top: 8px;
    display: flex;
    gap: 3px;
    align-items: flex-end;
    height: 18px;

    span {
      display: block;
      width: 3px;
      border-radius: 99px 99px 0 0;
      background: linear-gradient(180deg, #6dddff, #dcb3ff);
      animation: pulse-bars 1.2s infinite ease-in-out;
    }

    span:nth-child(1) { height: 8px; }
    span:nth-child(2) { height: 14px; animation-delay: 0.1s; }
    span:nth-child(3) { height: 11px; animation-delay: 0.2s; }
    span:nth-child(4) { height: 17px; animation-delay: 0.3s; }
    span:nth-child(5) { height: 9px; animation-delay: 0.4s; }
  }
}

@keyframes pulse-bars {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

@media (max-width: 1500px) {
  .chat-panel-v2 {
    grid-template-columns: 280px minmax(0, 1fr) 280px;
  }

  .top-search {
    width: 220px;
  }
}

@media (max-width: 1200px) {
  .chat-panel-v2 {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .chat-panel-v2 :deep(.flow-rail),
  .floating-status {
    display: none;
  }
}

@media (max-width: 860px) {
  .chat-panel-v2 {
    grid-template-columns: minmax(0, 1fr);
  }

  .session-side {
    display: none;
  }

  .content-topbar {
    padding: 10px;
  }

  .topbar-left {
    flex-direction: column;
    align-items: flex-start;

    strong {
      font-size: 16px;
    }
  }
}
</style>

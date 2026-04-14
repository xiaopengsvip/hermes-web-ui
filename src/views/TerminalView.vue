<script setup lang="ts">
import { ref, nextTick, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NPopconfirm, NDropdown, NModal, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useTerminalStore, type TerminalCommand } from '@/stores/terminal'
import { useChatStore } from '@/stores/chat'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const terminalStore = useTerminalStore()
const chatStore = useChatStore()
const message = useMessage()

const SESSION_PANEL_MEMORY_KEY = 'chat:preferred-panel'

const terminalVisible = computed(() => route.query.panel === 'terminal')
const chatSessionCount = computed(() => chatStore.sessions.length)
const terminalSessionCount = computed(() => terminalStore.sessions.length)
const preferredPanel = ref<'chat' | 'terminal'>(
  localStorage.getItem(SESSION_PANEL_MEMORY_KEY) === 'terminal' ? 'terminal' : 'chat',
)

const commandInput = ref('')
const inputRef = ref<InstanceType<typeof NInput> | null>(null)
const outputRef = ref<HTMLDivElement | null>(null)
const showSessionList = ref(true)
const commandHistory = ref<string[]>([])
const historyIndex = ref(-1)

// Rename modal
const showRenameModal = ref(false)
const renameTarget = ref('')
const renameInput = ref('')

const sessionMenuOptions = [
  { label: t('terminal.renameSession'), key: 'rename' },
  { label: t('terminal.clearHistory'), key: 'clear' },
]

function scrollToBottom() {
  nextTick(() => {
    if (outputRef.value) {
      outputRef.value.scrollTop = outputRef.value.scrollHeight
    }
  })
}

async function executeCommand() {
  const cmd = commandInput.value.trim()
  if (!cmd) return

  commandInput.value = ''
  commandHistory.value.unshift(cmd)
  historyIndex.value = -1

  await terminalStore.executeCommand(cmd)
  terminalStore.saveSessions()
  scrollToBottom()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    executeCommand()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++
      commandInput.value = commandHistory.value[historyIndex.value]
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (historyIndex.value > 0) {
      historyIndex.value--
      commandInput.value = commandHistory.value[historyIndex.value]
    } else {
      historyIndex.value = -1
      commandInput.value = ''
    }
  }
}

function switchToChatView() {
  const nextQuery = { ...route.query }
  delete nextQuery.panel
  router.replace({ name: 'chat', query: nextQuery })
}

function switchToTerminalView() {
  router.replace({ name: 'chat', query: { ...route.query, panel: 'terminal' } })
}

function rememberPreferredPanel(panel: 'chat' | 'terminal') {
  preferredPanel.value = panel
  localStorage.setItem(SESSION_PANEL_MEMORY_KEY, panel)
}

function handleUnifiedMode(target: 'all' | 'chat' | 'terminal') {
  if (target === 'all') {
    if (preferredPanel.value === 'chat') {
      switchToChatView()
    } else {
      switchToTerminalView()
    }
    return
  }

  if (target === 'chat') {
    rememberPreferredPanel('chat')
    switchToChatView()
  } else {
    rememberPreferredPanel('terminal')
    switchToTerminalView()
  }
}

function handleNewSession() {
  terminalStore.createSession()
  terminalStore.saveSessions()
  message.success(t('terminal.messages.newSessionCreated'))
}

function handleSessionMenuSelect(key: string, sessionId: string) {
  if (key === 'rename') {
    const session = terminalStore.sessions.find(s => s.id === sessionId)
    if (session) {
      renameTarget.value = sessionId
      renameInput.value = session.title
      showRenameModal.value = true
    }
  } else if (key === 'clear') {
    terminalStore.clearSession(sessionId)
    terminalStore.saveSessions()
    message.success(t('terminal.messages.historyCleared'))
  }
}

function handleRenameConfirm() {
  if (renameTarget.value && renameInput.value.trim()) {
    terminalStore.updateSessionTitle(renameTarget.value, renameInput.value.trim())
    terminalStore.saveSessions()
    message.success(t('terminal.messages.renamed'))
  }
  showRenameModal.value = false
}

function handleDeleteSession(id: string) {
  terminalStore.deleteSession(id)
  terminalStore.saveSessions()
  message.success(t('terminal.messages.sessionDeleted'))
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return t('terminal.time.milliseconds', { value: ms })
  return t('terminal.time.seconds', { value: (ms / 1000).toFixed(1) })
}

function getStatusColor(cmd: TerminalCommand): string {
  if (cmd.status === 'running') return 'var(--theme-warning, #f0ad4e)'
  if (cmd.exitCode === 0) return 'var(--theme-success, #5cb85c)'
  return 'var(--theme-error, #d9534f)'
}

function copyOutput(cmd: TerminalCommand) {
  navigator.clipboard.writeText(cmd.output)
  message.success(t('terminal.messages.outputCopied'))
}

onMounted(() => {
  chatStore.loadSessions()
  inputRef.value?.focus()
  scrollToBottom()
})

watch(() => terminalStore.activeSession?.commands.length, () => {
  scrollToBottom()
})
</script>

<template>
  <div class="terminal-view">
    <!-- Session List -->
    <aside class="session-sidebar" :class="{ collapsed: !showSessionList }">
      <div class="sidebar-header">
        <span v-if="showSessionList" class="sidebar-title">{{ t('sidebar.terminal') }}</span>
        <NButton quaternary size="tiny" @click="handleNewSession" circle>
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </template>
        </NButton>
      </div>

      <div v-if="showSessionList" class="view-mode-switch">
        <button class="view-mode-btn" @click="handleUnifiedMode('all')">
          <span>{{ t('chat.all') }}</span>
          <small>{{ chatSessionCount + terminalSessionCount }}</small>
        </button>
        <button class="view-mode-btn" @click="handleUnifiedMode('chat')">
          <span>{{ t('chat.chatOnly') }}</span>
          <small>{{ chatSessionCount }}</small>
        </button>
        <button class="view-mode-btn" :class="{ active: terminalVisible }" @click="handleUnifiedMode('terminal')">
          <span>{{ t('chat.terminalOnly') }}</span>
          <small>{{ terminalSessionCount }}</small>
        </button>
      </div>

      <div v-if="showSessionList" class="session-list">
        <!-- 按日期分组 -->
        <div v-for="(sessions, groupKey) in terminalStore.groupedSessions" :key="groupKey" class="date-group">
          <div class="date-header">
            <span class="date-label">
              {{ groupKey === 'today' ? t('chat.groupToday') : groupKey === 'yesterday' ? t('chat.groupYesterday') : groupKey === 'thisWeek' ? t('chat.groupThisWeek') : groupKey }}
            </span>
            <span class="date-count">{{ sessions.length }}</span>
          </div>
          <button
            v-for="session in sessions"
            :key="session.id"
            class="session-item"
            :class="{ active: session.id === terminalStore.activeSessionId }"
            @click="terminalStore.switchSession(session.id)"
          >
            <div class="session-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </div>
            <div class="session-info">
              <span class="session-title">{{ session.title }}</span>
              <span class="session-meta">
                <span class="cmd-count">{{ session.commands.length }} {{ t('terminal.commands') }}</span>
                <span class="session-time">{{ formatTime(session.updatedAt) }}</span>
              </span>
            </div>
            <NDropdown
              :options="sessionMenuOptions"
              trigger="click"
              @select="(key: string) => handleSessionMenuSelect(key, session.id)"
            >
              <button class="session-menu" @click.stop>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
            </NDropdown>
            <NPopconfirm @positive-click="handleDeleteSession(session.id)">
              <template #trigger>
                <button class="session-delete" @click.stop>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </template>
              {{ t('terminal.confirmDeleteSession') }}
            </NPopconfirm>
          </button>
        </div>

        <div v-if="terminalStore.sessions.length === 0" class="empty-sessions">
          {{ t('terminal.noSessions') }}
        </div>
      </div>
    </aside>

    <!-- Terminal Area -->
    <div class="terminal-main">
      <header class="terminal-header">
        <div class="header-left">
          <NButton quaternary size="small" @click="showSessionList = !showSessionList" circle>
            <template #icon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </template>
          </NButton>
          <span class="header-title">{{ terminalStore.activeSession?.title || t('sidebar.terminal') }}</span>
          <span class="header-cwd">{{ terminalStore.activeSession?.workingDir || '~' }}</span>
        </div>
        <div class="header-actions">
          <NButton size="small" @click="handleNewSession">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </template>
            {{ t('common.create') }}
          </NButton>
        </div>
      </header>

      <!-- Output Area -->
      <div ref="outputRef" class="terminal-output">
        <div v-if="!terminalStore.activeSession || terminalStore.activeSession.commands.length === 0" class="welcome-message">
          <div class="welcome-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <div class="welcome-text">
            <p>{{ t('terminal.welcomeTitle') }}</p>
            <p class="welcome-hint">{{ t('terminal.welcomeHintEnter') }}</p>
            <p class="welcome-hint">{{ t('terminal.welcomeHintHistory') }}</p>
          </div>
        </div>

        <div
          v-for="cmd in terminalStore.activeSession?.commands"
          :key="cmd.id"
          class="command-block"
        >
          <div class="command-line">
            <span class="prompt-symbol">$</span>
            <span class="command-text">{{ cmd.command }}</span>
            <span class="command-status" :style="{ color: getStatusColor(cmd) }">
              {{ cmd.status === 'running' ? '●' : cmd.exitCode === 0 ? '✓' : '✗' }}
            </span>
            <span class="command-duration">{{ formatDuration(cmd.duration) }}</span>
            <button class="copy-btn" @click="copyOutput(cmd)" :title="t('terminal.copyOutput')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9"/>
              </svg>
            </button>
          </div>
          <pre v-if="cmd.output" class="command-output" :class="{ error: cmd.exitCode !== 0 }">{{ cmd.output }}</pre>
        </div>
      </div>

      <!-- Input Area -->
      <div class="terminal-input">
        <span class="input-prompt">
          <span class="prompt-user">{{ t('terminal.promptUser') }}</span>
          <span class="prompt-at">@</span>
          <span class="prompt-host">{{ t('terminal.promptHost') }}</span>
          <span class="prompt-colon">:</span>
          <span class="prompt-path">{{ terminalStore.activeSession?.workingDir?.replace('/home/xiao2027', '~') || '~' }}</span>
          <span class="prompt-dollar">$</span>
        </span>
        <input
          ref="inputRef"
          v-model="commandInput"
          class="command-input"
          :placeholder="t('terminal.placeholder.command')"
          spellcheck="false"
          autocomplete="off"
          @keydown="handleKeydown"
        />
      </div>
    </div>

    <!-- Rename Modal -->
    <NModal
      v-model:show="showRenameModal"
      preset="dialog"
      :title="t('terminal.renameSession')"
      :positive-text="t('common.confirm')"
      :negative-text="t('common.cancel')"
      @positive-click="handleRenameConfirm"
    >
      <NInput
        v-model:value="renameInput"
        :placeholder="t('terminal.placeholder.sessionName')"
        @keyup.enter="handleRenameConfirm"
      />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.terminal-view {
  height: 100%;
  min-height: 0;
  display: flex;
}

// Session Sidebar
.session-sidebar {
  width: 240px;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: $bg-secondary;
  transition: width $transition-normal;

  &.collapsed {
    width: 0;
    border-right: none;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid $border-color;
}

.view-mode-switch {
  padding: 8px 8px 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.view-mode-btn {
  border: 1px solid rgba($border-color, 0.8);
  background: rgba($bg-primary, 0.55);
  color: $text-secondary;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all $transition-fast;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  small {
    min-width: 14px;
    text-align: center;
    font-size: 10px;
    line-height: 14px;
    border-radius: 999px;
    padding: 0 4px;
    color: $text-muted;
    border: 1px solid rgba($border-color, 0.6);
    background: rgba($bg-secondary, 0.5);
  }

  &:hover {
    border-color: rgba($accent-primary, 0.55);
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

.sidebar-title {
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.date-group {
  margin-bottom: 12px;
}

.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  margin-bottom: 4px;
}

.date-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
}

.date-count {
  font-size: 10px;
  color: $text-muted;
  background: $bg-primary;
  padding: 1px 6px;
  border-radius: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
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

  &:hover {
    background: rgba($accent-primary, 0.06);
    color: $text-primary;

    .session-menu, .session-delete {
      opacity: 1;
    }
  }

  &.active {
    background: rgba($accent-primary, 0.12);
    color: $text-primary;
    border-left: 3px solid $accent-primary;
    padding-left: 7px;

    .session-title {
      color: $accent-primary;
    }
  }
}

.session-icon {
  flex-shrink: 0;
  color: $text-muted;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  display: block;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: $text-muted;
  margin-top: 2px;
}

.session-menu, .session-delete {
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

.session-delete:hover {
  color: $error;
  background: rgba($error, 0.1);
}

.empty-sessions {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: $text-muted;
}

// Terminal Main
.terminal-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #1a1a2e;
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
}

.header-cwd {
  font-size: 12px;
  color: #888;
  font-family: $font-code;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-family: $font-code;
  font-size: 13px;
  line-height: 1.6;
}

.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.welcome-icon {
  margin-bottom: 16px;
  color: #4a9eff;
}

.welcome-text {
  text-align: center;

  p {
    margin: 4px 0;
  }

  .welcome-hint {
    font-size: 12px;
    color: #555;
  }
}

.command-block {
  margin-bottom: 16px;
}

.command-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.prompt-symbol {
  color: #4a9eff;
  font-weight: 600;
}

.command-text {
  color: #e0e0e0;
  flex: 1;
}

.command-status {
  font-size: 12px;
}

.command-duration {
  font-size: 11px;
  color: #666;
}

.copy-btn {
  padding: 2px;
  border: none;
  background: none;
  color: #555;
  cursor: pointer;
  border-radius: 3px;
  opacity: 0;
  transition: all $transition-fast;

  .command-block:hover & {
    opacity: 1;
  }

  &:hover {
    color: #4a9eff;
    background: rgba(74, 158, 255, 0.1);
  }
}

.command-output {
  margin: 0;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: $radius-sm;
  color: #b0b0b0;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;

  &.error {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
  }
}

// Input Area
.terminal-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.input-prompt {
  display: flex;
  align-items: center;
  font-family: $font-code;
  font-size: 13px;
  flex-shrink: 0;
}

.prompt-user {
  color: #4a9eff;
  font-weight: 600;
}

.prompt-at {
  color: #888;
}

.prompt-host {
  color: #5cb85c;
}

.prompt-colon {
  color: #888;
}

.prompt-path {
  color: #f0ad4e;
}

.prompt-dollar {
  color: #888;
  margin-left: 4px;
}

.command-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #e0e0e0;
  font-family: $font-code;
  font-size: 13px;
  caret-color: #4a9eff;

  &::placeholder {
    color: #555;
  }
}
</style>

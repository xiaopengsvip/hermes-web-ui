<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { NButton, NInput, NPopconfirm, NDropdown, NModal, useMessage } from 'naive-ui'
import { useTerminalStore, type TerminalCommand } from '@/stores/terminal'

const terminalStore = useTerminalStore()
const message = useMessage()

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
  { label: '重命名', key: 'rename' },
  { label: '清空历史', key: 'clear' },
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

function handleNewSession() {
  terminalStore.createSession()
  terminalStore.saveSessions()
  message.success('新终端会话已创建')
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
    message.success('历史已清空')
  }
}

function handleRenameConfirm() {
  if (renameTarget.value && renameInput.value.trim()) {
    terminalStore.updateSessionTitle(renameTarget.value, renameInput.value.trim())
    terminalStore.saveSessions()
    message.success('已重命名')
  }
  showRenameModal.value = false
}

function handleDeleteSession(id: string) {
  terminalStore.deleteSession(id)
  terminalStore.saveSessions()
  message.success('会话已删除')
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getStatusColor(cmd: TerminalCommand): string {
  if (cmd.status === 'running') return 'var(--theme-warning, #f0ad4e)'
  if (cmd.exitCode === 0) return 'var(--theme-success, #5cb85c)'
  return 'var(--theme-error, #d9534f)'
}

function copyOutput(cmd: TerminalCommand) {
  navigator.clipboard.writeText(cmd.output)
  message.success('已复制输出')
}

onMounted(() => {
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
        <span v-if="showSessionList" class="sidebar-title">终端会话</span>
        <NButton quaternary size="tiny" @click="handleNewSession" circle>
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </template>
        </NButton>
      </div>

      <div v-if="showSessionList" class="session-list">
        <!-- 按日期分组 -->
        <div v-for="(sessions, groupKey) in terminalStore.groupedSessions" :key="groupKey" class="date-group">
          <div class="date-header">
            <span class="date-label">
              {{ groupKey === 'today' ? '今天' : groupKey === 'yesterday' ? '昨天' : groupKey === 'thisWeek' ? '本周' : groupKey }}
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
                <span class="cmd-count">{{ session.commands.length }} 命令</span>
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
              删除此终端会话?
            </NPopconfirm>
          </button>
        </div>

        <div v-if="terminalStore.sessions.length === 0" class="empty-sessions">
          暂无终端会话
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
          <span class="header-title">{{ terminalStore.activeSession?.title || 'Terminal' }}</span>
          <span class="header-cwd">{{ terminalStore.activeSession?.workingDir || '~' }}</span>
        </div>
        <div class="header-actions">
          <NButton size="small" @click="handleNewSession">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </template>
            新建
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
            <p>终端命令会话</p>
            <p class="welcome-hint">输入命令后按 Enter 执行</p>
            <p class="welcome-hint">↑/↓ 浏览历史命令</p>
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
            <button class="copy-btn" @click="copyOutput(cmd)" title="复制输出">
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
          <span class="prompt-user">xiao2027</span>
          <span class="prompt-at">@</span>
          <span class="prompt-host">hermes</span>
          <span class="prompt-colon">:</span>
          <span class="prompt-path">{{ terminalStore.activeSession?.workingDir?.replace('/home/xiao2027', '~') || '~' }}</span>
          <span class="prompt-dollar">$</span>
        </span>
        <input
          ref="inputRef"
          v-model="commandInput"
          class="command-input"
          placeholder="输入命令..."
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
      title="重命名会话"
      positive-text="确认"
      negative-text="取消"
      @positive-click="handleRenameConfirm"
    >
      <NInput
        v-model:value="renameInput"
        placeholder="会话名称"
        @keyup.enter="handleRenameConfirm"
      />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.terminal-view {
  height: 100vh;
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

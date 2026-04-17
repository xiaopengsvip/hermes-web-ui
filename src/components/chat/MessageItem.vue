<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, useMessage } from 'naive-ui'
import { useChatStore } from '@/stores/chat'
import type { Message } from '@/stores/chat'
const MarkdownRenderer = defineAsyncComponent(() => import('./MarkdownRenderer.vue'))

const props = defineProps<{ message: Message }>()

const { t } = useI18n()
const toast = useMessage()
const chatStore = useChatStore()

const showToolDetail = ref(false)
const isToolOutputExpanded = ref(false)

const isSystem = computed(() => props.message.role === 'system')
const isTool = computed(() => props.message.role === 'tool')
const canResend = computed(() => props.message.role === 'user' && !chatStore.isStreaming)

const relatedToolEvents = computed(() => {
  if (!isTool.value) return [] as Array<{ id: string; event: string; label: string; timestamp: number; detail?: Record<string, any>; level?: 'info' | 'success' | 'error' }>

  const name = props.message.toolName
  const minTs = props.message.timestamp - 15000

  const matched = chatStore.streamEvents
    .filter((evt) => {
      if (evt.timestamp < minTs) return false
      const detail = (evt.detail || {}) as Record<string, any>
      const detailName = String(detail.toolName || detail.tool || detail.name || '')
      const byMessage = detail.toolMessageId === props.message.id
      const byName = Boolean(name && detailName && detailName === name)
      return byMessage || (evt.event.startsWith('tool.') && byName)
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 6)

  return matched.reverse()
})

const toolOutputLineCount = computed(() => {
  if (!props.message.content) return 0
  return props.message.content.split('\n').length
})

const shouldClampToolOutput = computed(() => !isToolOutputExpanded.value && toolOutputLineCount.value > 10)


const timeStr = computed(() => {
  const d = new Date(props.message.timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

function isImage(type: string): boolean {
  return type.startsWith('image/')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return t('chat.size.byte', { value: bytes })
  if (bytes < 1024 * 1024) return t('chat.size.kb', { value: (bytes / 1024).toFixed(1) })
  return t('chat.size.mb', { value: (bytes / (1024 * 1024)).toFixed(1) })
}

async function copyMessage() {
  if (!props.message.content) return
  await navigator.clipboard.writeText(props.message.content)
  toast.success(t('common.copied'))
}

async function resendMessage() {
  if (!canResend.value) return
  await chatStore.resendMessage(props.message.id)
}

function toolStateLabel(status?: string) {
  if (status === 'running') return t('chat.tool.running')
  if (status === 'error') return t('chat.tool.failed')
  return t('chat.tool.done')
}

function tSafe(key: string, fallback: string): string {
  const value = t(key)
  return value === key ? fallback : value
}

function roleLabel(role: Message['role']): string {
  if (role === 'user') return tSafe('chat.youLabel', 'You')
  if (role === 'assistant') return tSafe('chat.roleAssistant', 'Assistant')
  if (role === 'system') return tSafe('chat.roleSystem', 'System')
  return tSafe('chat.roleMessage', 'Message')
}
</script>

<template>
  <div class="message-v2" :class="message.role">
    <template v-if="isTool">
      <div class="tool-card" :class="message.toolStatus || 'done'">
        <div class="tool-card-head">
          <div class="tool-left">
            <span class="tool-chip">TOOL</span>
            <strong>{{ message.toolName || t('chat.tool.defaultName') }}</strong>
          </div>
          <span class="tool-status">{{ toolStateLabel(message.toolStatus) }}</span>
        </div>

        <p v-if="message.toolPreview" class="tool-preview">{{ message.toolPreview }}</p>

        <div v-if="relatedToolEvents.length" class="tool-flow-inline">
          <div
            v-for="evt in relatedToolEvents"
            :key="evt.id"
            class="flow-line"
            :class="evt.level || 'info'"
          >
            <span class="flow-dot"></span>
            <span class="flow-label">{{ evt.label }}</span>
            <time>{{ new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</time>
          </div>
        </div>

        <div v-if="message.content" class="tool-output-wrap">
          <div class="tool-output-head">
            <span class="terminal-mark">terminal</span>
            <span class="tool-output-hint">{{ t('chat.tool.output') }}</span>
          </div>
          <pre class="tool-output" :class="[{ error: message.toolStatus === 'error' }, { clamp: shouldClampToolOutput }]">{{ message.content }}</pre>
          <div v-if="toolOutputLineCount > 10" class="tool-output-actions">
            <button @click="isToolOutputExpanded = !isToolOutputExpanded">
              {{ isToolOutputExpanded ? t('chat.tool.collapseOutput') : t('chat.tool.expandOutput', { lines: toolOutputLineCount }) }}
            </button>
          </div>
        </div>

        <div class="tool-actions">
          <button @click="showToolDetail = true">{{ t('chat.tool.viewDetail') }}</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="message-row" :class="message.role">
        <img v-if="message.role === 'assistant'" src="/hermes-avatar.webp" alt="Hermes" class="avatar assistant" loading="lazy" decoding="async" />

        <div class="bubble-wrap" :class="message.role">
          <div class="bubble" :class="{ system: isSystem }">
            <div class="bubble-head">
              <span class="bubble-role" :class="message.role">
                {{ roleLabel(message.role) }}
              </span>
              <span class="bubble-head-time">{{ timeStr }}</span>
            </div>

            <div v-if="message.attachments?.length" class="attachments">
              <div v-for="att in message.attachments" :key="att.id" class="attachment" :class="{ image: isImage(att.type) }">
                <img v-if="isImage(att.type) && att.url" :src="att.url" :alt="att.name" class="attachment-thumb" loading="lazy" decoding="async" />
                <div v-else class="attachment-file">
                  <span>{{ att.name }}</span>
                  <small>{{ formatSize(att.size) }}</small>
                </div>
              </div>
            </div>

            <MarkdownRenderer v-if="message.content" :content="message.content" />

            <div v-if="message.isStreaming && !message.content" class="streaming-dots">
              <span></span><span></span><span></span>
            </div>
            <span v-if="message.isStreaming && message.content" class="streaming-cursor"></span>
          </div>

          <div class="bubble-meta">
            <span class="bubble-meta-time">{{ timeStr }}</span>
            <button v-if="message.content" @click="copyMessage">{{ t('common.copy') }}</button>
            <button v-if="message.role === 'user'" :disabled="!canResend" @click="resendMessage">{{ t('chat.resend') }}</button>
          </div>
        </div>

        <img v-if="message.role === 'user'" src="/everettlogo.jpg" :alt="t('chat.youLabel')" class="avatar user" loading="lazy" decoding="async" />
      </div>
    </template>

    <NModal v-model:show="showToolDetail" preset="card" :title="t('chat.tool.detailTitle')" style="width: min(860px, 95vw)">
      <div class="tool-modal-body">
        <p><strong>{{ t('chat.tool.label') }}</strong>{{ message.toolName || t('chat.tool.defaultName') }}</p>
        <p><strong>{{ t('chat.tool.statusLabel') }}</strong>{{ toolStateLabel(message.toolStatus) }}</p>
        <pre>{{ JSON.stringify(message, null, 2) }}</pre>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.message-v2 {
  --msg-accent-rgb: var(--theme-primary-rgb, 102, 126, 234);
  --msg-border: color-mix(in srgb, var(--theme-border, rgba(255, 255, 255, 0.15)) 84%, transparent);
  --msg-surface: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 86%, transparent);
  display: flex;
  flex-direction: column;

  &.user { align-items: flex-end; }
  &.assistant, &.system, &.tool { align-items: flex-start; }
}

.message-row {
  width: 100%;
  display: flex;
  gap: 10px;
  align-items: flex-start;

  &.user {
    justify-content: flex-end;

    .bubble-wrap {
      align-items: flex-end;
    }
  }

  &.assistant,
  &.system {
    justify-content: flex-start;
  }
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;

  &.assistant {
    border-radius: 8px;
    border: 1px solid rgba($border-color, 0.5);
  }

  &.user {
    border: 1px solid rgba($accent-primary, 0.35);
  }
}

.bubble-wrap {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-width: min(98%, 1380px);
}

.bubble {
  border: 1px solid var(--msg-border);
  border-radius: 18px;
  padding: 12px 14px 13px;
  background:
    linear-gradient(
      162deg,
      color-mix(in srgb, var(--theme-background-secondary, #12121a) 86%, transparent),
      color-mix(in srgb, var(--theme-background, #0a0a0f) 94%, transparent)
    ),
    radial-gradient(circle at 92% 8%, rgba(var(--msg-accent-rgb), 0.12), transparent 42%);
  backdrop-filter: blur(10px);
  font-size: 14px;
  line-height: 1.72;
  word-break: break-word;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(147, 190, 235, 0.08),
    0 12px 26px rgba(5, 11, 18, 0.3);

  :deep(p) {
    margin: 0;
  }
}

.user .bubble {
  background:
    linear-gradient(148deg, rgba(var(--msg-accent-rgb), 0.38), rgba(var(--msg-accent-rgb), 0.26)),
    radial-gradient(circle at 12% 10%, rgba(var(--msg-accent-rgb), 0.22), transparent 46%);
  border-color: rgba(var(--msg-accent-rgb), 0.82);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text, #fff) 20%, transparent),
    inset 0 -1px 0 rgba(var(--msg-accent-rgb), 0.18),
    0 16px 30px rgba(var(--msg-accent-rgb), 0.22);
}

.assistant .bubble {
  background:
    linear-gradient(
      162deg,
      color-mix(in srgb, var(--theme-background-secondary, #12121a) 92%, transparent),
      color-mix(in srgb, var(--theme-background, #0a0a0f) 96%, transparent)
    ),
    radial-gradient(circle at 10% 8%, rgba(var(--msg-accent-rgb), 0.14), transparent 44%);
  border-color: rgba(var(--msg-accent-rgb), 0.34);
}

.system .bubble,
.bubble.system {
  border-left: 3px solid $warning;
  background: rgba($warning, 0.09);
}

.bubble-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.bubble-role {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(140, 199, 255, 0.32);
  background: rgba(86, 152, 218, 0.14);
  color: #cce8ff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.28px;

  &.assistant {
    color: #8cefff;
    border-color: rgba(120, 222, 255, 0.48);
    background: rgba(120, 222, 255, 0.16);
  }

  &.user {
    color: #f2f5ff;
    border-color: rgba(190, 181, 255, 0.5);
    background: rgba(146, 136, 255, 0.2);
  }

  &.system {
    color: #ffe2b8;
    border-color: rgba(255, 193, 116, 0.44);
    background: rgba(255, 186, 96, 0.16);
  }
}

.bubble-head-time {
  font-size: 10px;
  color: rgba(178, 207, 236, 0.82);
  font-variant-numeric: tabular-nums;
}

.bubble-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba($text-muted, 0.95);

  .bubble-meta-time {
    font-variant-numeric: tabular-nums;
    color: rgba(184, 211, 237, 0.84);
  }

  button {
    border: 1px solid rgba($border-color, 0.72);
    background: rgba($bg-secondary, 0.5);
    color: $text-secondary;
    border-radius: 999px;
    padding: 2px 9px;
    cursor: pointer;
    font-size: 11px;
    transition: border-color 0.16s ease, color 0.16s ease, background-color 0.16s ease;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:hover:not(:disabled) {
      border-color: rgba($accent-primary, 0.64);
      color: #9fe8ff;
      background: rgba($accent-primary, 0.12);
    }
  }
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.attachment {
  border: 1px solid rgba($border-color, 0.6);
  border-radius: 10px;
  overflow: hidden;
  background: rgba($bg-primary, 0.5);

  &.image {
    max-width: 220px;
  }
}

.attachment-thumb {
  display: block;
  max-width: 220px;
  max-height: 160px;
  object-fit: contain;
}

.attachment-file {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  small {
    color: $text-muted;
    font-size: 11px;
  }
}

.tool-card {
  width: min(98%, 1420px);
  border: 1px solid rgba($border-color, 0.62);
  border-radius: 14px;
  background: linear-gradient(140deg, rgba($bg-secondary, 0.82), rgba($bg-primary, 0.95));
  padding: 10px 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 10px 24px rgba(5, 11, 18, 0.28);

  &.running {
    border-color: rgba(#ffe082, 0.8);
    box-shadow:
      inset 0 0 0 1px rgba(#ffe082, 0.3),
      0 0 20px rgba(#ffe082, 0.15);
  }

  &.done {
    border-color: rgba(#4ade80, 0.7);
  }

  &.error {
    border-color: rgba(#ff6b78, 0.8);
    background: linear-gradient(140deg, rgba(#ff6b78, 0.12), rgba($bg-primary, 0.95));
  }
}

.tool-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.tool-left {
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    font-size: 13px;
    font-family: $font-code;
  }
}

.tool-chip {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  border: 1px solid rgba($accent-primary, 0.58);
  color: $accent-primary;
  border-radius: 999px;
  padding: 1px 7px;
}

.tool-status {
  font-size: 11px;
  color: $text-muted;
}

.tool-preview {
  margin: 8px 0 0;
  color: $text-secondary;
  font-size: 12px;
}

.tool-flow-inline {
  margin-top: 8px;
  border: 1px solid rgba($border-color, 0.5);
  border-radius: 10px;
  background: rgba($bg-primary, 0.5);
  overflow: hidden;
}

.flow-line {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-top: 1px solid rgba($border-color, 0.35);

  &:first-child {
    border-top: none;
  }

  .flow-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #6ea8ff;
    box-shadow: 0 0 8px rgba(110, 168, 255, 0.6);
  }

  &.success .flow-dot {
    background: #34d399;
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.65);
  }

  &.error .flow-dot {
    background: #ff6b78;
    box-shadow: 0 0 8px rgba(255, 107, 120, 0.65);
  }

  .flow-label {
    font-size: 11px;
    color: $text-secondary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  time {
    font-size: 10px;
    color: $text-muted;
  }
}

.tool-actions {
  margin-top: 8px;

  button {
    border: 1px solid rgba($border-color, 0.7);
    background: rgba($bg-primary, 0.5);
    color: $text-secondary;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
  }
}

.tool-output-wrap {
  margin-top: 10px;
  border: 1px solid rgba($border-color, 0.55);
  border-radius: 10px;
  overflow: hidden;
  background: rgba($bg-primary, 0.6);
}

.tool-output-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid rgba($border-color, 0.4);
  font-size: 10px;

  .terminal-mark {
    color: #7ee7ff;
    font-family: $font-code;
    letter-spacing: 0.4px;
  }

  .tool-output-hint {
    color: $text-muted;
  }
}

.tool-output {
  margin: 0;
  padding: 8px;
  max-height: 220px;
  overflow: auto;
  font-family: $font-code;
  font-size: 11px;
  line-height: 1.45;
  color: #d5f4ff;
  white-space: pre-wrap;
  word-break: break-word;

  &.clamp {
    max-height: 160px;
  }

  &.error {
    color: #ffb3bc;
  }
}

.tool-output-actions {
  border-top: 1px solid rgba($border-color, 0.35);
  padding: 6px 8px;
  display: flex;
  justify-content: flex-end;

  button {
    border: 1px solid rgba($border-color, 0.6);
    background: rgba($bg-secondary, 0.5);
    color: $text-secondary;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;

    &:hover {
      border-color: rgba($accent-primary, 0.55);
      color: $accent-primary;
    }
  }
}

.tool-modal-body pre {
  margin: 10px 0 0;
  max-height: 55vh;
  overflow: auto;
  background: rgba($bg-primary, 0.65);
  border: 1px solid rgba($border-color, 0.45);
  border-radius: 10px;
  padding: 10px;
  font-size: 12px;
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background-color: $text-muted;
  animation: blink 0.8s infinite;
}

.streaming-dots {
  display: flex;
  gap: 4px;

  span {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: $text-muted;
    animation: pulse 1.3s infinite ease-in-out;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
</style>

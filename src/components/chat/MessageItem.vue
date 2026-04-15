<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, useMessage } from 'naive-ui'
import { useChatStore } from '@/stores/chat'
import type { Message } from '@/stores/chat'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{ message: Message }>()

const { t } = useI18n()
const toast = useMessage()
const chatStore = useChatStore()

const showToolDetail = ref(false)

const isSystem = computed(() => props.message.role === 'system')
const isTool = computed(() => props.message.role === 'tool')
const canResend = computed(() => props.message.role === 'user' && !chatStore.isStreaming)

const relatedToolEvents = computed(() => {
  if (!isTool.value) return [] as Array<{ id: string; event: string; label: string; timestamp: number; detail?: Record<string, any>; level?: 'info' | 'success' | 'error' }>

  const name = props.message.toolName
  const minTs = props.message.timestamp - 15000

  return chatStore.streamEvents
    .filter((evt) => {
      if (evt.timestamp < minTs) return false
      const detail = (evt.detail || {}) as Record<string, any>
      const detailName = String(detail.toolName || detail.tool || detail.name || '')
      const byMessage = detail.toolMessageId === props.message.id
      const byName = Boolean(name && detailName && detailName === name)
      return byMessage || (evt.event.startsWith('tool.') && byName)
    })
    .slice(0, 6)
})

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
  if (status === 'running') return '执行中'
  if (status === 'error') return '失败'
  return '完成'
}
</script>

<template>
  <div class="message-v2" :class="message.role">
    <template v-if="isTool">
      <div class="tool-card" :class="message.toolStatus || 'done'">
        <div class="tool-card-head">
          <div class="tool-left">
            <span class="tool-chip">TOOL</span>
            <strong>{{ message.toolName || 'Tool' }}</strong>
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
            <span class="tool-output-hint">输出</span>
          </div>
          <pre class="tool-output" :class="{ error: message.toolStatus === 'error' }">{{ message.content }}</pre>
        </div>

        <div class="tool-actions">
          <button @click="showToolDetail = true">查看详情</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="message-row" :class="message.role">
        <img v-if="message.role === 'assistant'" src="/assets/logo.png" alt="Hermes" class="avatar assistant" />

        <div class="bubble-wrap" :class="message.role">
          <div class="bubble" :class="{ system: isSystem }">
            <div v-if="message.attachments?.length" class="attachments">
              <div v-for="att in message.attachments" :key="att.id" class="attachment" :class="{ image: isImage(att.type) }">
                <img v-if="isImage(att.type) && att.url" :src="att.url" :alt="att.name" class="attachment-thumb" />
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
            <span>{{ timeStr }}</span>
            <button v-if="message.content" @click="copyMessage">{{ t('common.copy') }}</button>
            <button v-if="message.role === 'user'" :disabled="!canResend" @click="resendMessage">{{ t('chat.resend') }}</button>
          </div>
        </div>

        <img v-if="message.role === 'user'" src="/everettlogo.jpg" :alt="t('chat.youLabel')" class="avatar user" />
      </div>
    </template>

    <NModal v-model:show="showToolDetail" preset="card" title="工具调用详情" style="width: min(860px, 95vw)">
      <div class="tool-modal-body">
        <p><strong>工具：</strong>{{ message.toolName || 'Tool' }}</p>
        <p><strong>状态：</strong>{{ toolStateLabel(message.toolStatus) }}</p>
        <pre>{{ JSON.stringify(message, null, 2) }}</pre>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.message-v2 {
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
  gap: 6px;
  max-width: min(78%, 860px);
}

.bubble {
  border: 1px solid rgba($border-color, 0.6);
  border-radius: 18px;
  padding: 12px 14px;
  background: linear-gradient(160deg, rgba($bg-secondary, 0.85), rgba($bg-primary, 0.9));
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;

  :deep(p) {
    margin: 0;
  }
}

.user .bubble {
  background: linear-gradient(150deg, rgba($accent-primary, 0.33), rgba(#8364ff, 0.28));
  border-color: rgba($accent-primary, 0.75);
  box-shadow: 0 12px 24px rgba($accent-primary, 0.2);
}

.assistant .bubble {
  background: linear-gradient(160deg, rgba($bg-secondary, 0.9), rgba($bg-primary, 0.95));
}

.system .bubble,
.bubble.system {
  border-left: 3px solid $warning;
  background: rgba($warning, 0.08);
}

.bubble-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: $text-muted;

  button {
    border: 1px solid rgba($border-color, 0.75);
    background: rgba($bg-secondary, 0.55);
    color: $text-secondary;
    border-radius: 999px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 11px;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:hover:not(:disabled) {
      border-color: rgba($accent-primary, 0.6);
      color: $accent-primary;
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
  width: min(86%, 920px);
  border: 1px solid rgba($border-color, 0.65);
  border-radius: 14px;
  background: linear-gradient(140deg, rgba($bg-secondary, 0.8), rgba($bg-primary, 0.95));
  padding: 10px 12px;

  &.running {
    border-color: rgba(#ffe082, 0.8);
    box-shadow: 0 0 0 1px rgba(#ffe082, 0.3) inset;
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

  &.error {
    color: #ffb3bc;
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

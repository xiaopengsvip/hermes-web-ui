<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import MessageItem from './MessageItem.vue'
import ToolCallGroupCard from './ToolCallGroupCard.vue'
import { useChatStore } from '@/stores/chat'
import type { Message } from '@/stores/chat'

const { t } = useI18n()
const chatStore = useChatStore()
const listRef = ref<HTMLElement>()
const isNearBottom = ref(true)
const BOTTOM_THRESHOLD = 120
const CHAT_SCROLL_MEMORY_PREFIX = 'chat:message-scroll:'
const SCROLL_PERSIST_THROTTLE_MS = 140
let persistScrollTimer: number | null = null

type RenderMessageItem =
  | { type: 'message'; id: string; message: Message }
  | { type: 'tool-group'; id: string; messages: Message[] }

const renderedItems = computed<RenderMessageItem[]>(() => {
  const source = chatStore.messages
  if (!source.length) return []

  const result: RenderMessageItem[] = []

  for (let i = 0; i < source.length; i++) {
    const current = source[i]

    if (current.role !== 'tool') {
      result.push({ type: 'message', id: current.id, message: current })
      continue
    }

    const group: Message[] = [current]
    let cursor = i + 1

    while (cursor < source.length && source[cursor].role === 'tool') {
      group.push(source[cursor])
      cursor += 1
    }

    if (group.length > 1) {
      result.push({
        type: 'tool-group',
        id: `tool-group:${group[0].id}:${group[group.length - 1].id}:${group.length}`,
        messages: group,
      })
    } else {
      result.push({ type: 'message', id: current.id, message: current })
    }

    i = cursor - 1
  }

  return result
})

function getScrollMemoryKey() {
  return `${CHAT_SCROLL_MEMORY_PREFIX}${chatStore.activeSessionId || 'new'}`
}

function persistScrollPosition() {
  if (!listRef.value) return
  try {
    localStorage.setItem(getScrollMemoryKey(), String(listRef.value.scrollTop))
  } catch {
    // ignore quota/storage exceptions
  }
}

function schedulePersistScrollPosition() {
  if (persistScrollTimer) return
  persistScrollTimer = window.setTimeout(() => {
    persistScrollTimer = null
    persistScrollPosition()
  }, SCROLL_PERSIST_THROTTLE_MS)
}

function restoreScrollPosition() {
  if (!listRef.value) return
  const saved = Number(localStorage.getItem(getScrollMemoryKey()) || '0')
  if (Number.isFinite(saved) && saved > 0) {
    listRef.value.scrollTop = saved
    updateNearBottom()
    return
  }
  scrollToBottom(true)
}

function updateNearBottom() {
  if (!listRef.value) return
  const el = listRef.value
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  isNearBottom.value = distance <= BOTTOM_THRESHOLD
}

function scrollToBottom(force = false) {
  nextTick(() => {
    if (!listRef.value) return
    if (!force && !isNearBottom.value) return
    listRef.value.scrollTop = listRef.value.scrollHeight
    updateNearBottom()
  })
}

function handleScroll() {
  updateNearBottom()
  schedulePersistScrollPosition()
}

watch(() => chatStore.messages.length, () => scrollToBottom(false))
watch(() => chatStore.messages[chatStore.messages.length - 1]?.content, () => scrollToBottom(false))
watch(() => chatStore.isStreaming, (v) => { if (v) scrollToBottom(false) })
watch(() => chatStore.activeSessionId, () => {
  nextTick(() => {
    restoreScrollPosition()
  })
})

onMounted(() => {
  nextTick(() => {
    restoreScrollPosition()
  })
})

onBeforeUnmount(() => {
  if (persistScrollTimer) {
    window.clearTimeout(persistScrollTimer)
    persistScrollTimer = null
  }
  persistScrollPosition()
})
</script>

<template>
  <div class="message-list-wrap">
    <div ref="listRef" class="message-list" @scroll="handleScroll">
      <div v-if="chatStore.messages.length === 0" class="empty-state">
        <img src="/hermes-avatar.webp" alt="Hermes" class="empty-logo" loading="lazy" decoding="async" />
        <p>{{ t('chat.startConversation') }}</p>
      </div>
      <template
        v-for="item in renderedItems"
        :key="item.id"
      >
        <MessageItem
          v-if="item.type === 'message'"
          :message="item.message"
        />
        <ToolCallGroupCard
          v-else
          :messages="item.messages"
        />
      </template>
      <div v-if="chatStore.isStreaming" class="streaming-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>

    <button
      v-if="!isNearBottom && chatStore.messages.length > 0"
      class="jump-latest"
      @click="scrollToBottom(true)"
    >
      {{ t('chat.jumpToLatest') }}
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.message-list-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background:
    radial-gradient(circle at 0% 0%, rgba($accent-primary, 0.06) 0%, rgba($accent-primary, 0) 42%),
    radial-gradient(circle at 100% 100%, rgba(#b68cff, 0.06) 0%, rgba(#b68cff, 0) 45%),
    rgba(14, 20, 26, 0.58);
  backdrop-filter: blur(14px);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $text-muted;
  gap: 12px;
  border: 1px dashed rgba($border-color, 0.9);
  border-radius: $radius-md;
  background: rgba($bg-secondary, 0.45);

  .empty-logo {
    width: 52px;
    height: 52px;
    opacity: 0.35;
    filter: drop-shadow(0 0 10px rgba($accent-primary, 0.18));
  }

  p {
    font-size: 14px;
  }
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  color: $text-muted;

  span {
    width: 5px;
    height: 5px;
    background-color: $text-muted;
    border-radius: 50%;
    animation: stream-pulse 1.4s infinite ease-in-out;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

.jump-latest {
  position: absolute;
  right: 20px;
  bottom: 14px;
  z-index: 3;
  border: 1px solid rgba($accent-primary, 0.6);
  background: rgba($bg-primary, 0.85);
  color: $accent-primary;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  backdrop-filter: blur(6px);

  &:hover {
    background: rgba($accent-primary, 0.12);
  }
}

@keyframes stream-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
</style>

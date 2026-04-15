<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NModal } from 'naive-ui'
import type { StreamEventItem } from '@/stores/chat'

const props = defineProps<{
  events: StreamEventItem[]
  isStreaming: boolean
}>()

const emit = defineEmits<{
  clear: []
}>()

const showFullscreen = ref(false)
const selected = ref<StreamEventItem | null>(null)

const latestEvents = computed(() => props.events.slice(0, 80))

function openDetail(event: StreamEventItem) {
  selected.value = event
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function levelClass(level?: string) {
  if (level === 'error') return 'error'
  if (level === 'success') return 'success'
  return 'info'
}

function eventToolName(event: StreamEventItem): string {
  const detail = (event.detail || {}) as Record<string, any>
  return String(detail.toolName || detail.tool || detail.name || '')
}
</script>

<template>
  <aside class="flow-rail">
    <header class="flow-header">
      <div>
        <h4>实时数据流</h4>
        <p>{{ isStreaming ? '运行中 · 持续更新' : '等待新任务' }}</p>
      </div>
      <div class="flow-actions">
        <NButton size="tiny" quaternary @click="emit('clear')">清空</NButton>
        <NButton size="tiny" @click="showFullscreen = true">全屏</NButton>
      </div>
    </header>

    <div class="flow-list">
      <button
        v-for="event in latestEvents"
        :key="event.id"
        class="flow-item"
        :class="levelClass(event.level)"
        @click="openDetail(event)"
      >
        <span class="dot"></span>
        <div class="flow-item-main">
          <strong>{{ event.label }}</strong>
          <small>{{ event.event }}</small>
          <small v-if="eventToolName(event)" class="tool-binding">工具：{{ eventToolName(event) }}</small>
        </div>
        <time>{{ formatTime(event.timestamp) }}</time>
      </button>
      <div v-if="latestEvents.length === 0" class="flow-empty">暂无流数据</div>
    </div>

    <div v-if="selected" class="flow-detail">
      <div class="detail-head">
        <strong>详情</strong>
        <button class="detail-close" @click="selected = null">×</button>
      </div>
      <pre>{{ JSON.stringify(selected.detail || {}, null, 2) }}</pre>
    </div>

    <NModal v-model:show="showFullscreen" preset="card" title="数据流全屏视图" style="width: min(1100px, 96vw)">
      <div class="flow-fullscreen">
        <button
          v-for="event in events"
          :key="event.id"
          class="flow-item"
          :class="levelClass(event.level)"
          @click="openDetail(event)"
        >
          <span class="dot"></span>
          <div class="flow-item-main">
            <strong>{{ event.label }}</strong>
            <small>{{ event.event }}</small>
            <small v-if="eventToolName(event)" class="tool-binding">工具：{{ eventToolName(event) }}</small>
          </div>
          <time>{{ formatTime(event.timestamp) }}</time>
        </button>
      </div>
    </NModal>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.flow-rail {
  width: 320px;
  min-width: 280px;
  max-width: 360px;
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(11, 16, 21, 0.68);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
}

.flow-header {
  padding: 12px;
  border-bottom: 1px solid rgba($border-color, 0.5);
  display: flex;
  justify-content: space-between;
  gap: 8px;

  h4 { margin: 0; font-size: 14px; }
  p { margin: 4px 0 0; font-size: 11px; color: $text-muted; }
}

.flow-actions { display: flex; gap: 6px; }

.flow-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flow-item {
  width: 100%;
  border: 1px solid rgba($border-color, 0.6);
  background: rgba($bg-primary, 0.62);
  border-radius: 12px;
  padding: 10px;
  color: $text-primary;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 8px;
  text-align: left;
  cursor: pointer;

  .dot {
    width: 8px;
    height: 8px;
    margin-top: 5px;
    border-radius: 999px;
    background: #6ea8ff;
    box-shadow: 0 0 12px rgba(110, 168, 255, 0.6);
  }

  &.success .dot { background: #32d296; box-shadow: 0 0 12px rgba(50, 210, 150, 0.6); }
  &.error .dot { background: #ff6b78; box-shadow: 0 0 12px rgba(255, 107, 120, 0.62); }

  &:hover {
    border-color: rgba($accent-primary, 0.62);
    transform: translateY(-1px);
  }

  strong { font-size: 12px; display: block; }
  small { font-size: 10px; color: $text-muted; }
  .tool-binding {
    color: rgba($accent-primary, 0.9);
  }
  time { font-size: 10px; color: $text-muted; align-self: start; }
}

.flow-empty {
  color: $text-muted;
  font-size: 12px;
  text-align: center;
  padding: 24px 0;
}

.flow-detail {
  border-top: 1px solid rgba($border-color, 0.5);
  padding: 10px;
  background: rgba($bg-primary, 0.92);

  .detail-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .detail-close {
    border: none;
    background: transparent;
    color: $text-muted;
    cursor: pointer;
    font-size: 18px;
  }

  pre {
    margin: 0;
    max-height: 180px;
    overflow: auto;
    font-size: 11px;
    color: $text-secondary;
    background: rgba($bg-secondary, 0.65);
    padding: 8px;
    border-radius: 8px;
  }
}

.flow-fullscreen {
  max-height: 72vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>

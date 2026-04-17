<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { NModal } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Message } from '@/stores/chat'

const props = defineProps<{
  messages: Message[]
}>()

const { t } = useI18n()
const sliderRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const activeToolKey = ref<'all' | string>('all')
const showFailedOnly = ref(false)
const expandedMap = ref<Record<string, boolean>>({})
const detailModalVisible = ref(false)
const detailTarget = ref<Message | null>(null)

const totalCount = computed(() => props.messages.length)
const totalFailedCount = computed(() => props.messages.filter((msg) => msg.toolStatus === 'error').length)

type ToolCluster = {
  key: string
  name: string
  count: number
  failedCount: number
}

const toolClusters = computed<ToolCluster[]>(() => {
  const clusterMap = new Map<string, ToolCluster>()
  for (const msg of props.messages) {
    const name = (msg.toolName || t('chat.tool.defaultName')).trim() || t('chat.tool.defaultName')
    const key = `tool:${name}`
    if (!clusterMap.has(key)) {
      clusterMap.set(key, { key, name, count: 0, failedCount: 0 })
    }
    const cluster = clusterMap.get(key)!
    cluster.count += 1
    if (msg.toolStatus === 'error') cluster.failedCount += 1
  }

  return Array.from(clusterMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name)
  })
})

const filteredMessages = computed<Message[]>(() => {
  const byTool = activeToolKey.value === 'all'
    ? props.messages
    : props.messages.filter((msg) => `tool:${(msg.toolName || t('chat.tool.defaultName')).trim() || t('chat.tool.defaultName')}` === activeToolKey.value)

  if (!showFailedOnly.value) return byTool
  return byTool.filter((msg) => msg.toolStatus === 'error')
})

const filteredCount = computed(() => filteredMessages.value.length)
const activeDisplayIndex = computed(() => Math.min(activeIndex.value, Math.max(filteredCount.value - 1, 0)))

watch(
  () => props.messages,
  () => {
    const allKeys = new Set(['all', ...toolClusters.value.map((c) => c.key)])
    if (!allKeys.has(activeToolKey.value)) {
      activeToolKey.value = 'all'
    }
    nextTick(() => {
      syncActiveIndex()
      scrollToIndex(0)
    })
  },
  { deep: true }
)

watch([activeToolKey, showFailedOnly], () => {
  nextTick(() => {
    activeIndex.value = 0
    scrollToIndex(0)
  })
})

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function toolStateLabel(status?: string) {
  if (status === 'running') return t('chat.tool.running')
  if (status === 'error') return t('chat.tool.failed')
  return t('chat.tool.done')
}

function outputLines(message: Message): number {
  if (!message.content) return 0
  return message.content.split('\n').length
}

function isExpanded(id: string): boolean {
  return Boolean(expandedMap.value[id])
}

function toggleExpand(id: string) {
  expandedMap.value[id] = !expandedMap.value[id]
}

function openDetail(message: Message) {
  detailTarget.value = message
  detailModalVisible.value = true
}

function setToolCluster(clusterKey: string) {
  activeToolKey.value = clusterKey
}

function toggleFailedOnly() {
  showFailedOnly.value = !showFailedOnly.value
}

function syncActiveIndex() {
  if (!sliderRef.value) return
  const cards = sliderRef.value.querySelectorAll<HTMLElement>('.tool-slide-card')
  if (!cards.length) {
    activeIndex.value = 0
    return
  }
  if (activeIndex.value >= cards.length) {
    activeIndex.value = cards.length - 1
  }
}

function scrollToIndex(nextIndex: number) {
  if (!sliderRef.value) return
  const cards = sliderRef.value.querySelectorAll<HTMLElement>('.tool-slide-card')
  if (!cards.length) {
    activeIndex.value = 0
    return
  }
  const clamped = Math.max(0, Math.min(nextIndex, cards.length - 1))
  activeIndex.value = clamped
  cards[clamped]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
}

function onTrackScroll() {
  if (!sliderRef.value) return
  const cards = sliderRef.value.querySelectorAll<HTMLElement>('.tool-slide-card')
  if (!cards.length) return

  const left = sliderRef.value.scrollLeft
  let nearest = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  cards.forEach((card, idx) => {
    const distance = Math.abs(card.offsetLeft - left)
    if (distance < nearestDistance) {
      nearest = idx
      nearestDistance = distance
    }
  })

  activeIndex.value = nearest
}
</script>

<template>
  <div class="tool-group-wrap">
    <div class="tool-group-head">
      <div class="tool-group-title">
        <span class="tool-group-chip">TOOLS</span>
        <strong>{{ t('chat.toolGroup.title', { count: totalCount }) }}</strong>
        <small>{{ t('chat.toolGroup.swipeHint') }}</small>
      </div>
      <div class="tool-group-nav">
        <button
          class="nav-btn"
          :disabled="activeDisplayIndex <= 0"
          @click="scrollToIndex(activeDisplayIndex - 1)"
        >
          {{ t('chat.toolGroup.prev') }}
        </button>
        <span class="tool-group-progress">{{ filteredCount ? activeDisplayIndex + 1 : 0 }} / {{ filteredCount }}</span>
        <button
          class="nav-btn"
          :disabled="activeDisplayIndex >= filteredCount - 1 || filteredCount === 0"
          @click="scrollToIndex(activeDisplayIndex + 1)"
        >
          {{ t('chat.toolGroup.next') }}
        </button>
      </div>
    </div>

    <div class="tool-group-filters">
      <span class="filters-label">{{ t('chat.toolGroup.clusterLabel') }}</span>
      <button
        class="cluster-chip"
        :class="{ active: activeToolKey === 'all' }"
        @click="setToolCluster('all')"
      >
        {{ t('chat.toolGroup.all') }}
        <em>{{ totalCount }}</em>
      </button>
      <button
        v-for="cluster in toolClusters"
        :key="cluster.key"
        class="cluster-chip"
        :class="{ active: activeToolKey === cluster.key }"
        @click="setToolCluster(cluster.key)"
      >
        {{ cluster.name }}
        <em>{{ cluster.count }}</em>
      </button>

      <button
        class="failed-filter-btn"
        :class="{ active: showFailedOnly }"
        :disabled="totalFailedCount === 0"
        @click="toggleFailedOnly"
      >
        {{ showFailedOnly ? t('chat.toolGroup.failedOnlyOn') : t('chat.toolGroup.failedOnly') }}
        <em>{{ totalFailedCount }}</em>
      </button>
    </div>

    <div
      v-if="filteredCount > 0"
      ref="sliderRef"
      class="tool-group-slider"
      @scroll="onTrackScroll"
    >
      <article
        v-for="toolMessage in filteredMessages"
        :key="toolMessage.id"
        class="tool-slide-card"
      >
        <header class="tool-slide-head">
          <div class="tool-main">
            <span class="tool-name">{{ toolMessage.toolName || t('chat.tool.defaultName') }}</span>
            <span class="tool-status" :class="toolMessage.toolStatus || 'done'">{{ toolStateLabel(toolMessage.toolStatus) }}</span>
          </div>
          <time>{{ formatClock(toolMessage.timestamp) }}</time>
        </header>

        <p v-if="toolMessage.toolPreview" class="tool-preview">{{ toolMessage.toolPreview }}</p>

        <div v-if="toolMessage.content" class="tool-output-wrap">
          <pre :class="['tool-output', { clamp: !isExpanded(toolMessage.id) && outputLines(toolMessage) > 10 }]">{{ toolMessage.content }}</pre>
          <button
            v-if="outputLines(toolMessage) > 10"
            class="inline-btn"
            @click="toggleExpand(toolMessage.id)"
          >
            {{ isExpanded(toolMessage.id)
              ? t('chat.tool.collapseOutput')
              : t('chat.tool.expandOutput', { lines: outputLines(toolMessage) }) }}
          </button>
        </div>

        <footer class="tool-slide-actions">
          <button class="inline-btn" @click="openDetail(toolMessage)">{{ t('chat.tool.viewDetail') }}</button>
        </footer>
      </article>
    </div>

    <div v-else class="tool-group-empty">
      {{ t('chat.toolGroup.emptyFiltered') }}
    </div>

    <NModal
      v-model:show="detailModalVisible"
      preset="card"
      :title="t('chat.toolGroup.detailTitle')"
      style="width: min(900px, 95vw)"
    >
      <div class="tool-detail-body">
        <p><strong>{{ t('chat.tool.label') }}</strong>{{ detailTarget?.toolName || t('chat.tool.defaultName') }}</p>
        <p><strong>{{ t('chat.tool.statusLabel') }}</strong>{{ toolStateLabel(detailTarget?.toolStatus) }}</p>
        <pre>{{ JSON.stringify(detailTarget, null, 2) }}</pre>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.tool-group-wrap {
  width: min(95%, 1180px);
  border: 1px solid rgba(137, 196, 255, 0.24);
  border-radius: 16px;
  background:
    linear-gradient(155deg, rgba(19, 28, 40, 0.88), rgba(9, 14, 22, 0.92)),
    radial-gradient(circle at 8% 6%, rgba(120, 219, 255, 0.15), transparent 44%);
  box-shadow: 0 12px 28px rgba(4, 11, 18, 0.28);
  overflow: hidden;
}

.tool-group-head {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(148, 202, 255, 0.18);
  background: rgba(11, 21, 33, 0.72);
}

.tool-group-title {
  display: flex;
  align-items: center;
  gap: 10px;

  strong {
    font-size: 13px;
    color: #d5ebff;
  }

  small {
    font-size: 11px;
    color: rgba(198, 227, 255, 0.68);
  }
}

.tool-group-chip {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.32px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(127, 208, 255, 0.55);
  color: #a8eaff;
  background: rgba(86, 156, 234, 0.16);
}

.tool-group-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tool-group-filters {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 202, 255, 0.14);
  background: rgba(8, 17, 28, 0.68);
}

.filters-label {
  font-size: 11px;
  color: rgba(188, 223, 255, 0.82);
  margin-right: 2px;
}

.cluster-chip,
.failed-filter-btn {
  border: 1px solid rgba(147, 206, 255, 0.3);
  background: rgba(15, 30, 45, 0.6);
  color: #cbe8ff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  em {
    font-style: normal;
    border-radius: 999px;
    padding: 0 6px;
    line-height: 18px;
    min-height: 18px;
    background: rgba(116, 187, 255, 0.24);
    color: #dbf1ff;
  }

  &:hover:not(:disabled) {
    border-color: rgba(143, 216, 255, 0.72);
    background: rgba(34, 62, 92, 0.84);
  }

  &.active {
    border-color: rgba(122, 213, 255, 0.88);
    background: rgba(36, 78, 121, 0.84);
    color: #e5f5ff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }
}

.failed-filter-btn {
  margin-left: auto;
}

.nav-btn,
.inline-btn {
  border: 1px solid rgba(147, 206, 255, 0.42);
  background: rgba(15, 30, 45, 0.72);
  color: #cbe8ff;
  border-radius: 9px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: rgba(143, 216, 255, 0.72);
    background: rgba(34, 62, 92, 0.84);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.tool-group-progress {
  min-width: 58px;
  text-align: center;
  font-size: 11px;
  color: rgba(188, 223, 255, 0.82);
}

.tool-group-slider {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 12px;
  scroll-padding-inline: 12px;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(116, 187, 255, 0.4);
  }
}

.tool-slide-card {
  flex: 0 0 min(88%, 640px);
  scroll-snap-align: start;
  border: 1px solid rgba(143, 205, 255, 0.24);
  border-radius: 14px;
  background:
    linear-gradient(162deg, rgba(15, 25, 38, 0.92), rgba(10, 16, 25, 0.94)),
    radial-gradient(circle at 94% 8%, rgba(113, 171, 255, 0.14), transparent 42%);
  padding: 11px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-slide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  time {
    font-size: 11px;
    color: rgba(194, 225, 255, 0.72);
    white-space: nowrap;
  }
}

.tool-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-name {
  font-size: 13px;
  font-weight: 600;
  color: #def0ff;
}

.tool-status {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid rgba(111, 187, 255, 0.42);
  color: #afe0ff;
  background: rgba(80, 147, 220, 0.16);

  &.running {
    border-color: rgba(255, 214, 117, 0.5);
    color: #ffe6ad;
    background: rgba(255, 189, 84, 0.16);
  }

  &.error {
    border-color: rgba(255, 122, 122, 0.56);
    color: #ffb8b8;
    background: rgba(255, 112, 112, 0.16);
  }
}

.tool-preview {
  margin: 0;
  font-size: 12px;
  line-height: 1.56;
  color: rgba(210, 233, 255, 0.9);
}

.tool-output-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-output {
  margin: 0;
  border-radius: 10px;
  border: 1px solid rgba(160, 217, 255, 0.2);
  background: rgba(6, 13, 21, 0.88);
  color: #bee4ff;
  font-size: 12px;
  line-height: 1.52;
  padding: 10px;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;

  &.clamp {
    max-height: 168px;
    mask-image: linear-gradient(to bottom, black 72%, transparent 100%);
  }
}

.tool-slide-actions {
  display: flex;
  justify-content: flex-end;
}

.tool-group-empty {
  margin: 12px;
  border: 1px dashed rgba(153, 208, 255, 0.3);
  border-radius: 12px;
  padding: 14px 12px;
  color: rgba(201, 228, 255, 0.8);
  background: rgba(8, 15, 24, 0.5);
  font-size: 12px;
}

.tool-detail-body {
  display: flex;
  flex-direction: column;
  gap: 8px;

  p {
    margin: 0;
    color: rgba(208, 230, 255, 0.9);

    strong {
      margin-right: 8px;
      color: #fff;
    }
  }

  pre {
    margin: 0;
    border-radius: 10px;
    border: 1px solid rgba(148, 207, 255, 0.2);
    background: rgba(8, 15, 24, 0.92);
    color: #bde5ff;
    font-size: 12px;
    line-height: 1.5;
    padding: 10px;
    max-height: 65vh;
    overflow: auto;
  }
}

@media (max-width: 860px) {
  .tool-group-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .tool-group-nav {
    width: 100%;
    justify-content: space-between;
  }

  .tool-group-filters {
    padding: 10px;
  }

  .failed-filter-btn {
    margin-left: 0;
  }

  .tool-slide-card {
    flex-basis: 94%;
  }
}
</style>

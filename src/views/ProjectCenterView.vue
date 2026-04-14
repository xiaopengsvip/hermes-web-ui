<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard, NTag, NInput, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '@/stores/chat'

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const chatStore = useChatStore()

const commandInput = ref('')
const isDispatching = ref(false)

interface ActivityLog {
  id: string
  role: 'sent' | 'status' | 'error'
  text: string
  time: number
}

const activityLogs = ref<ActivityLog[]>([])

const modules = computed(() => [
  { key: 'chat', title: t('sidebar.chat'), route: 'chat', tone: 'info' as const },
  { key: 'materials', title: t('sidebar.materials'), route: 'materials', tone: 'warning' as const },
  { key: 'github', title: t('sidebar.github'), route: 'github', tone: 'success' as const },
  { key: 'vercel', title: t('sidebar.vercel'), route: 'vercel', tone: 'default' as const },
  { key: 'cloudflare', title: t('sidebar.cloudflare'), route: 'cloudflare', tone: 'error' as const },
  { key: 'insights', title: t('sidebar.insights'), route: 'insights', tone: 'primary' as const },
])

const quickCommands = computed(() => [
  { key: 'site', label: t('projectCenter.quick.websiteDev'), prompt: t('projectCenter.quickPrompt.websiteDev') },
  { key: 'plan', label: t('projectCenter.quick.planDesign'), prompt: t('projectCenter.quickPrompt.planDesign') },
  { key: 'deploy', label: t('projectCenter.quick.deployFix'), prompt: t('projectCenter.quickPrompt.deployFix') },
  { key: 'domain', label: t('projectCenter.quick.domainBinding'), prompt: t('projectCenter.quickPrompt.domainBinding') },
])

const workflows = computed(() => [
  t('projectCenter.workflow.websiteDev'),
  t('projectCenter.workflow.planDesign'),
  t('projectCenter.workflow.autoDeploy'),
  t('projectCenter.workflow.domainOps'),
  t('projectCenter.workflow.autoDebug'),
])

const suggestions = computed(() => [
  t('projectCenter.suggestion.one'),
  t('projectCenter.suggestion.two'),
  t('projectCenter.suggestion.three'),
])

function go(routeName: string) {
  router.push({ name: routeName })
}

function pushLog(role: ActivityLog['role'], text: string) {
  activityLogs.value.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
    time: Date.now(),
  })
  activityLogs.value = activityLogs.value.slice(0, 12)
}

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function runAutoCommand(raw?: string) {
  const command = (raw ?? commandInput.value).trim()
  if (!command || isDispatching.value) return

  isDispatching.value = true
  pushLog('sent', command)

  try {
    if (!chatStore.activeSessionId || chatStore.messages.length > 0) {
      chatStore.newChat()
    }

    await router.push({ name: 'chat' })
    await chatStore.sendMessage(`[Project Center Auto]\n${command}`)

    if (!raw) commandInput.value = ''
    pushLog('status', t('projectCenter.commandCompleted'))
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    pushLog('error', errMsg)
    message.error(t('projectCenter.commandFailed'))
  } finally {
    isDispatching.value = false
  }
}

onMounted(() => {
  chatStore.loadSessions()
})
</script>

<template>
  <div class="project-center-view">
    <header class="project-center-header page-header">
      <div>
        <h2>{{ t('projectCenter.title') }}</h2>
        <p>{{ t('projectCenter.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <NButton type="primary" @click="go('jobs')">{{ t('projectCenter.createSchedule') }}</NButton>
        <NButton secondary @click="go('insights')">{{ t('projectCenter.openAudit') }}</NButton>
      </div>
    </header>

    <div class="project-center-content">
      <NCard class="panel-card" :title="t('projectCenter.commandCenter')">
        <div class="command-center">
          <NInput
            v-model:value="commandInput"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            :placeholder="t('projectCenter.commandPlaceholder')"
          />

          <div class="quick-command-row">
            <button
              v-for="item in quickCommands"
              :key="item.key"
              class="quick-command-chip"
              @click="runAutoCommand(item.prompt)"
            >
              {{ item.label }}
            </button>
          </div>

          <div class="command-actions">
            <NButton type="primary" :loading="isDispatching" @click="runAutoCommand()">
              {{ isDispatching ? t('projectCenter.running') : t('projectCenter.runAuto') }}
            </NButton>
            <NButton secondary @click="go('chat')">{{ t('projectCenter.enterChat') }}</NButton>
          </div>

          <div class="activity-stream">
            <div class="stream-title">{{ t('projectCenter.activityStream') }}</div>
            <div v-if="activityLogs.length === 0" class="stream-empty">
              {{ t('projectCenter.activityEmpty') }}
            </div>
            <div v-else class="stream-list">
              <div v-for="log in activityLogs" :key="log.id" class="stream-item" :class="`role-${log.role}`">
                <span class="stream-time">{{ timeLabel(log.time) }}</span>
                <span class="stream-text">{{ log.text }}</span>
              </div>
            </div>
          </div>
        </div>
      </NCard>

      <NCard class="panel-card" :title="t('projectCenter.dispatchCenter')">
        <div class="module-grid">
          <button
            v-for="item in modules"
            :key="item.key"
            class="module-item"
            @click="go(item.route)"
          >
            <span>{{ item.title }}</span>
            <NTag size="small" :type="item.tone">{{ t('projectCenter.enter') }}</NTag>
          </button>
        </div>
      </NCard>

      <NCard class="panel-card" :title="t('projectCenter.autoPipeline')">
        <div class="workflow-list">
          <div v-for="(wf, idx) in workflows" :key="wf" class="workflow-row">
            <span class="index">{{ idx + 1 }}</span>
            <span class="text">{{ wf }}</span>
          </div>
        </div>
      </NCard>

      <NCard class="panel-card" :title="t('projectCenter.suggestionsTitle')">
        <ul class="suggestion-list">
          <li v-for="s in suggestions" :key="s">{{ s }}</li>
        </ul>
      </NCard>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.project-center-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-center-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  h2 {
    margin: 0;
    font-size: 20px;
  }

  p {
    margin: 4px 0 0;
    color: $text-muted;
    font-size: 13px;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.project-center-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 10px;
}

.panel-card {
  :deep(.n-card-header) {
    border-bottom: 1px solid rgba($border-color, 0.75);
  }
}

.command-center {
  display: grid;
  gap: 10px;
}

.quick-command-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.quick-command-chip {
  border: 1px solid rgba($border-color, 0.8);
  border-radius: 999px;
  background: rgba($bg-secondary, 0.55);
  color: $text-secondary;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
    border-color: rgba($accent-primary, 0.55);
    background: rgba($accent-primary, 0.12);
  }
}

.command-actions {
  display: flex;
  gap: 8px;
}

.activity-stream {
  border: 1px solid rgba($border-color, 0.65);
  border-radius: 10px;
  background: rgba($bg-secondary, 0.3);
  padding: 8px;
}

.stream-title {
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 6px;
}

.stream-empty {
  font-size: 12px;
  color: $text-muted;
}

.stream-list {
  display: grid;
  gap: 6px;
}

.stream-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  border-left: 2px solid transparent;
  padding-left: 8px;

  &.role-sent {
    border-left-color: rgba($accent-primary, 0.7);
  }

  &.role-status {
    border-left-color: rgba($success, 0.7);
  }

  &.role-error {
    border-left-color: rgba($error, 0.8);
  }
}

.stream-time {
  color: $text-muted;
  flex-shrink: 0;
}

.stream-text {
  color: $text-secondary;
  line-height: 1.4;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.module-item {
  border: 1px solid rgba($border-color, 0.75);
  background: rgba($bg-secondary, 0.6);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: $text-primary;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: rgba($accent-primary, 0.55);
    transform: translateY(-1px);
  }
}

.workflow-list {
  display: grid;
  gap: 6px;
}

.workflow-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba($bg-secondary, 0.45);

  .index {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    background: rgba($accent-primary, 0.15);
    color: $accent-primary;
    flex-shrink: 0;
  }

  .text {
    font-size: 13px;
  }
}

.suggestion-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  color: $text-secondary;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .project-center-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }
}
</style>

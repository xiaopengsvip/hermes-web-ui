<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard, NInput, NTag, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '@/stores/chat'
import {
  fetchProjectCenterDefaultServers,
  fetchProjectCenterOverview,
  fetchRelayConfig,
  relaySendChat,
  relaySendCommand,
  runProjectCenterAction,
  saveRelayConfig,
  testProjectCenterServer,
  testRelayConfig,
  type AuditCluster,
  type ProjectCenterOverview,
  type ProjectCenterServer,
  type RelayConfig,
  type RelayStreamSnapshot,
} from '@/api/project-center'

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const chatStore = useChatStore()

const owner = ref('xiaopengsvip')
const repo = ref('allapple.new')
const projectId = ref('allapple-new')
const zoneId = ref('34ba071485d78fb973a3c3bc014b2aaf')

const dnsName = ref('hms.allapple.top')
const dnsContent = ref('cname.vercel-dns.com')

const commandInput = ref('')
const isDispatching = ref(false)
const isLoadingOverview = ref(false)

const overview = ref<ProjectCenterOverview | null>(null)
const servers = ref<ProjectCenterServer[]>([])
const serverStatus = ref<Record<string, { ok: boolean; text: string }>>({})
const addingServerName = ref('')
const addingServerUrl = ref('')

const relayConfig = ref<RelayConfig>({
  enabled: false,
  baseUrl: '',
  apiKey: '',
  chatPath: '/api/project-center/relay/chat',
  terminalPath: '/api/project-center/relay/command',
  healthPath: '/health',
  localHealthUrl: 'http://127.0.0.1:8650/health',
})
const relayPrompt = ref('')
const relayCommand = ref('')
const relayTestStatus = ref('')
const relayRealtime = ref<RelayStreamSnapshot | null>(null)
let relayEventSource: EventSource | null = null

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

const clusters = computed<AuditCluster[]>(() => overview.value?.clusters || [])

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
  activityLogs.value = activityLogs.value.slice(0, 14)
}

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function loadSavedServers(): ProjectCenterServer[] {
  try {
    const raw = localStorage.getItem('project-center:servers')
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveServers() {
  localStorage.setItem('project-center:servers', JSON.stringify(servers.value))
}

async function loadServers() {
  const defaults = await fetchProjectCenterDefaultServers()
  const saved = loadSavedServers()
  const map = new Map<string, ProjectCenterServer>()
  for (const s of defaults.servers) map.set(s.id, s)
  for (const s of saved) map.set(s.id, s)
  servers.value = [...map.values()]
  saveServers()
}

async function testServer(server: ProjectCenterServer) {
  try {
    serverStatus.value[server.id] = { ok: false, text: 'testing...' }
    const r = await testProjectCenterServer(server.baseUrl)
    serverStatus.value[server.id] = {
      ok: r.ok,
      text: r.ok ? `${r.status} · ${r.latencyMs}ms` : `${r.status || 0} · ${r.error || 'failed'}`,
    }
  } catch (err) {
    serverStatus.value[server.id] = { ok: false, text: String(err) }
  }
}

function addServer() {
  const name = addingServerName.value.trim()
  const url = addingServerUrl.value.trim().replace(/\/$/, '')
  if (!name || !url) return
  const id = `custom-${Date.now()}`
  servers.value.unshift({ id, name, baseUrl: url })
  addingServerName.value = ''
  addingServerUrl.value = ''
  saveServers()
}

function removeServer(id: string) {
  servers.value = servers.value.filter((s) => s.id !== id)
  delete serverStatus.value[id]
  saveServers()
}

async function loadOverview() {
  isLoadingOverview.value = true
  try {
    overview.value = await fetchProjectCenterOverview({
      owner: owner.value.trim(),
      repo: repo.value.trim(),
      projectId: projectId.value.trim(),
      zoneId: zoneId.value.trim(),
    })
    pushLog('status', t('projectCenter.overviewLoaded'))
  } catch (err: any) {
    const msg = err?.message || String(err)
    pushLog('error', msg)
    message.error(msg)
  } finally {
    isLoadingOverview.value = false
  }
}

async function dispatchToChat(prompt: string) {
  if (!chatStore.activeSessionId || chatStore.messages.length > 0) {
    chatStore.newChat()
  }
  await router.push({ name: 'chat' })
  await chatStore.sendMessage(prompt)
}

async function runAutoCommand(raw?: string) {
  const command = (raw ?? commandInput.value).trim()
  if (!command || isDispatching.value) return

  isDispatching.value = true
  pushLog('sent', command)

  try {
    await dispatchToChat(`[Project Center Auto]\n${command}`)
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

async function oneClickCreateFixIssue() {
  try {
    const result = await runProjectCenterAction({
      type: 'create_fix_issue',
      owner: owner.value,
      repo: repo.value,
      title: `Auto audit fix: ${new Date().toISOString()}`,
      issueBody: 'Generated by Project Center automated audit. Please track root cause and patch plan.',
      labels: ['bug', 'auto-fix'],
    })
    pushLog('status', `Issue #${result?.result?.number || '?'} created`)
    if (result.chatPrompt) await dispatchToChat(`[Project Center Action]\n${result.chatPrompt}`)
  } catch (err: any) {
    pushLog('error', err?.message || String(err))
  }
}

async function oneClickRedeploy() {
  try {
    const result = await runProjectCenterAction({ type: 'redeploy', projectId: projectId.value })
    pushLog('status', `Redeploy triggered: ${result?.result?.url || result?.result?.uid || 'ok'}`)
    if (result.chatPrompt) await dispatchToChat(`[Project Center Action]\n${result.chatPrompt}`)
  } catch (err: any) {
    pushLog('error', err?.message || String(err))
  }
}

async function oneClickDnsFix() {
  try {
    const result = await runProjectCenterAction({
      type: 'dns_fix',
      zoneId: zoneId.value,
      name: dnsName.value,
      content: dnsContent.value,
      recordType: 'CNAME',
      proxied: true,
    })
    pushLog('status', `DNS fixed: ${result?.result?.name || dnsName.value}`)
    if (result.chatPrompt) await dispatchToChat(`[Project Center Action]\n${result.chatPrompt}`)
  } catch (err: any) {
    pushLog('error', err?.message || String(err))
  }
}

async function loadRelay() {
  relayConfig.value = await fetchRelayConfig()
}

async function saveRelay() {
  try {
    const r = await saveRelayConfig(relayConfig.value)
    relayConfig.value = r.relay
    relayTestStatus.value = t('projectCenter.relaySaved')
    pushLog('status', t('projectCenter.relaySaved'))
  } catch (err: any) {
    const msg = err?.message || String(err)
    relayTestStatus.value = msg
    pushLog('error', msg)
  }
}

async function testRelay() {
  try {
    const r = await testRelayConfig(relayConfig.value)
    relayTestStatus.value = `${r.ok ? 'OK' : 'FAIL'} · ${r.status} · ${r.latencyMs}ms`
    pushLog('status', `${t('projectCenter.relayTest')}: ${relayTestStatus.value}`)
  } catch (err: any) {
    const msg = err?.message || String(err)
    relayTestStatus.value = msg
    pushLog('error', msg)
  }
}

async function sendRelayChat() {
  const prompt = relayPrompt.value.trim()
  if (!prompt) return
  try {
    const result = await relaySendChat(prompt)
    pushLog('status', `${t('projectCenter.relayChatSent')} · ${result?.status || '-'}`)
    relayPrompt.value = ''
  } catch (err: any) {
    pushLog('error', err?.message || String(err))
  }
}

async function sendRelayCommand() {
  const command = relayCommand.value.trim()
  if (!command) return
  try {
    const result = await relaySendCommand(command)
    pushLog('status', `${t('projectCenter.relayCommandSent')} · ${result?.status || '-'}`)
    relayCommand.value = ''
  } catch (err: any) {
    pushLog('error', err?.message || String(err))
  }
}

function startRelayStream() {
  relayEventSource?.close()
  relayEventSource = new EventSource('/api/project-center/relay/stream')
  relayEventSource.onmessage = (event) => {
    try {
      relayRealtime.value = JSON.parse(event.data) as RelayStreamSnapshot
    } catch {
      // ignore parse error
    }
  }
  relayEventSource.onerror = () => {
    relayEventSource?.close()
    relayEventSource = null
  }
}

onMounted(async () => {
  chatStore.loadSessions()
  await loadServers()
  await loadOverview()
  await loadRelay()
  startRelayStream()
})

onUnmounted(() => {
  relayEventSource?.close()
  relayEventSource = null
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

      <NCard class="panel-card" :title="t('projectCenter.realtimeData')">
        <div class="target-row">
          <NInput v-model:value="owner" :placeholder="t('projectCenter.ownerPlaceholder')" />
          <NInput v-model:value="repo" :placeholder="t('projectCenter.repoPlaceholder')" />
          <NInput v-model:value="projectId" :placeholder="t('projectCenter.projectIdPlaceholder')" />
          <NInput v-model:value="zoneId" :placeholder="t('projectCenter.zoneIdPlaceholder')" />
          <NButton :loading="isLoadingOverview" @click="loadOverview">{{ t('common.refresh') }}</NButton>
        </div>

        <div class="metric-grid" v-if="overview">
          <div class="metric-item">
            <span class="k">PR</span>
            <strong>{{ overview.metrics.openPulls }}</strong>
          </div>
          <div class="metric-item">
            <span class="k">Issue</span>
            <strong>{{ overview.metrics.openIssues }}</strong>
          </div>
          <div class="metric-item">
            <span class="k">Deploy Fail</span>
            <strong>{{ overview.metrics.failedDeployments }}</strong>
          </div>
          <div class="metric-item">
            <span class="k">DNS</span>
            <strong>{{ overview.metrics.dnsRecords }}</strong>
          </div>
          <div class="metric-item">
            <span class="k">Zone</span>
            <strong>{{ overview.metrics.zoneStatus }}</strong>
          </div>
        </div>

        <div class="cluster-list">
          <div v-if="clusters.length === 0" class="stream-empty">{{ t('projectCenter.noAuditRisk') }}</div>
          <div v-for="c in clusters" :key="c.reason" class="cluster-item">
            <span>{{ c.reason }}</span>
            <NTag :type="c.severity === 'high' ? 'error' : c.severity === 'medium' ? 'warning' : 'info'">{{ c.count }}</NTag>
          </div>
        </div>

        <div class="action-row">
          <NButton type="warning" secondary @click="oneClickCreateFixIssue">{{ t('projectCenter.oneClickFixIssue') }}</NButton>
          <NButton type="primary" secondary @click="oneClickRedeploy">{{ t('projectCenter.oneClickRedeploy') }}</NButton>
          <NInput v-model:value="dnsName" :placeholder="t('projectCenter.dnsNamePlaceholder')" />
          <NInput v-model:value="dnsContent" :placeholder="t('projectCenter.dnsContentPlaceholder')" />
          <NButton type="success" secondary @click="oneClickDnsFix">{{ t('projectCenter.oneClickDnsFix') }}</NButton>
        </div>
      </NCard>

      <NCard class="panel-card" :title="t('projectCenter.serverHub')">
        <div class="target-row">
          <NInput v-model:value="addingServerName" :placeholder="t('projectCenter.serverNamePlaceholder')" />
          <NInput v-model:value="addingServerUrl" :placeholder="t('projectCenter.serverUrlPlaceholder')" />
          <NButton @click="addServer">{{ t('common.create') }}</NButton>
        </div>
        <div class="server-list">
          <div class="server-item" v-for="s in servers" :key="s.id">
            <div class="server-meta">
              <strong>{{ s.name }}</strong>
              <span>{{ s.baseUrl }}</span>
            </div>
            <div class="server-actions">
              <NTag :type="serverStatus[s.id]?.ok ? 'success' : 'default'">{{ serverStatus[s.id]?.text || '-' }}</NTag>
              <NButton size="small" @click="testServer(s)">{{ t('projectCenter.testServer') }}</NButton>
              <NButton size="small" quaternary @click="removeServer(s.id)">{{ t('common.delete') }}</NButton>
            </div>
          </div>
        </div>
      </NCard>

      <NCard class="panel-card" :title="t('projectCenter.relayHub')">
        <div class="target-row relay-grid-2">
          <NInput v-model:value="relayConfig.baseUrl" :placeholder="t('projectCenter.relayBaseUrlPlaceholder')" />
          <NInput v-model:value="relayConfig.apiKey" type="password" :placeholder="t('projectCenter.relayApiKeyPlaceholder')" />
          <NInput v-model:value="relayConfig.healthPath" :placeholder="t('projectCenter.relayHealthPathPlaceholder')" />
          <NInput v-model:value="relayConfig.chatPath" :placeholder="t('projectCenter.relayChatPathPlaceholder')" />
          <NInput v-model:value="relayConfig.terminalPath" :placeholder="t('projectCenter.relayTerminalPathPlaceholder')" />
          <NInput v-model:value="relayConfig.localHealthUrl" :placeholder="t('projectCenter.relayLocalHealthPlaceholder')" />
        </div>
        <div class="command-actions relay-actions">
          <NButton type="primary" @click="saveRelay">{{ t('projectCenter.relaySaveConfig') }}</NButton>
          <NButton secondary @click="testRelay">{{ t('projectCenter.relayTest') }}</NButton>
          <NTag :type="relayRealtime?.remote?.ok ? 'success' : 'warning'">{{ relayTestStatus || '-' }}</NTag>
        </div>
        <div class="relay-status-grid" v-if="relayRealtime">
          <div class="metric-item">
            <span class="k">{{ t('projectCenter.relayLocal') }}</span>
            <strong>{{ relayRealtime.local.ok ? 'OK' : 'FAIL' }}</strong>
            <span class="k">{{ relayRealtime.local.status }} · {{ relayRealtime.local.latencyMs }}ms</span>
          </div>
          <div class="metric-item">
            <span class="k">{{ t('projectCenter.relayRemote') }}</span>
            <strong>{{ relayRealtime.remote.ok ? 'OK' : 'FAIL' }}</strong>
            <span class="k">{{ relayRealtime.remote.status }} · {{ relayRealtime.remote.latencyMs }}ms</span>
          </div>
        </div>
        <div class="action-row relay-message-row">
          <NInput v-model:value="relayPrompt" :placeholder="t('projectCenter.relayPromptPlaceholder')" />
          <NButton secondary @click="sendRelayChat">{{ t('projectCenter.relaySendChat') }}</NButton>
          <NInput v-model:value="relayCommand" :placeholder="t('projectCenter.relayCommandPlaceholder')" />
          <NButton secondary @click="sendRelayCommand">{{ t('projectCenter.relaySendCommand') }}</NButton>
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

.project-center-view { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.project-center-header { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  h2 { margin: 0; font-size: 20px; }
  p { margin: 4px 0 0; color: $text-muted; font-size: 13px; }
}
.header-actions { display: flex; gap: 8px; }
.project-center-content { flex: 1; min-height: 0; overflow-y: auto; display: grid; gap: 10px; }
.panel-card :deep(.n-card-header) { border-bottom: 1px solid rgba($border-color, 0.75); }
.command-center { display: grid; gap: 10px; }
.quick-command-row { display: flex; gap: 6px; flex-wrap: wrap; }
.quick-command-chip { border: 1px solid rgba($border-color, 0.8); border-radius: 999px; background: rgba($bg-secondary, 0.55); color: $text-secondary; font-size: 12px; padding: 5px 10px; cursor: pointer; transition: all $transition-fast;
  &:hover { color: $text-primary; border-color: rgba($accent-primary, 0.55); background: rgba($accent-primary, 0.12); }
}
.command-actions { display: flex; gap: 8px; }
.activity-stream { border: 1px solid rgba($border-color, 0.65); border-radius: 10px; background: rgba($bg-secondary, 0.3); padding: 8px; }
.stream-title { font-size: 12px; color: $text-muted; margin-bottom: 6px; }
.stream-empty { font-size: 12px; color: $text-muted; }
.stream-list { display: grid; gap: 6px; }
.stream-item { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; border-left: 2px solid transparent; padding-left: 8px;
  &.role-sent { border-left-color: rgba($accent-primary, 0.7); }
  &.role-status { border-left-color: rgba($success, 0.7); }
  &.role-error { border-left-color: rgba($error, 0.8); }
}
.stream-time { color: $text-muted; flex-shrink: 0; }
.stream-text { color: $text-secondary; line-height: 1.4; }
.target-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.metric-item { border: 1px solid rgba($border-color, 0.7); border-radius: 10px; padding: 8px; background: rgba($bg-secondary, 0.45); display: grid; gap: 4px;
  .k { font-size: 11px; color: $text-muted; }
  strong { font-size: 18px; color: $text-primary; }
}
.cluster-list { display: grid; gap: 6px; margin-top: 10px; }
.cluster-item { display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba($border-color, 0.7); border-radius: 8px; padding: 8px; font-size: 12px; }
.action-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 8px; margin-top: 10px; }
.relay-grid-2 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.relay-actions { margin-top: 10px; align-items: center; }
.relay-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.relay-message-row { grid-template-columns: 2fr auto 2fr auto; }
.server-list { display: grid; gap: 8px; margin-top: 10px; }
.server-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid rgba($border-color, 0.7); border-radius: 10px; padding: 8px; }
.server-meta { display: grid; gap: 2px;
  span { color: $text-muted; font-size: 12px; }
}
.server-actions { display: flex; align-items: center; gap: 6px; }
.module-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.module-item { border: 1px solid rgba($border-color, 0.75); background: rgba($bg-secondary, 0.6); border-radius: 10px; padding: 10px; display: flex; align-items: center; justify-content: space-between; color: $text-primary; cursor: pointer; transition: all $transition-fast;
  &:hover { border-color: rgba($accent-primary, 0.55); transform: translateY(-1px); }
}
.workflow-list { display: grid; gap: 6px; }
.workflow-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; background: rgba($bg-secondary, 0.45);
  .index { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; background: rgba($accent-primary, 0.15); color: $accent-primary; flex-shrink: 0; }
  .text { font-size: 13px; }
}
.suggestion-list { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: $text-secondary; font-size: 13px; }
@media (max-width: 1200px) {
  .target-row, .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .action-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .relay-grid-2, .relay-message-row, .relay-status-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .project-center-header { flex-direction: column; align-items: flex-start; }
  .module-grid, .target-row, .metric-grid, .action-row, .relay-grid-2, .relay-message-row, .relay-status-grid { grid-template-columns: 1fr; }
}
</style>

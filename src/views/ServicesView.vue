<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NEmpty, NPopconfirm, useMessage, NCard, NStatistic, NGrid
} from 'naive-ui'
import {
  fetchSystemStatus, wakeHermes, restartGateway, stopGateway,
  fetchActiveSessions, shutdownWebUI, restartWebUI,
  type SystemStatus, type ActiveSession
} from '@/api/system'
import { fetchLogs } from '@/api/logs'

useI18n()
const message = useMessage()

const status = ref<SystemStatus | null>(null)
const activeSessions = ref<ActiveSession[]>([])
const loading = ref(true)
const logsLoading = ref(false)
const serviceLogs = ref<Record<string, string[]>>({
  agent: [],
  gateway: [],
  errors: [],
})
const logTargets = ['agent', 'gateway', 'errors'] as const
const error = ref('')
const actionLoading = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadStatus() {
  try {
    const data = await fetchSystemStatus()
    status.value = data
    error.value = ''
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch status'
  } finally {
    loading.value = false
  }
}

async function loadActiveSessions() {
  try {
    const data = await fetchActiveSessions()
    activeSessions.value = data.sessions
  } catch {
    // ignore
  }
}

async function loadServiceLogs() {
  logsLoading.value = true
  try {
    const results: Array<[string, string[]]> = await Promise.all(
      logTargets.map(async (name): Promise<[string, string[]]> => {
        try {
          const entries = await fetchLogs(name, { lines: 30 })
          const lines = entries.length
            ? entries.map((e) => `[${e.level}] ${e.timestamp} ${e.message}`)
            : ['(no logs)']
          return [name, lines]
        } catch (err: any) {
          return [name, [`(load failed) ${err?.message || 'unknown error'}`]]
        }
      })
    )

    const merged: Record<string, string[]> = { ...serviceLogs.value }
    for (const [name, lines] of results) merged[name] = lines
    serviceLogs.value = merged
  } finally {
    logsLoading.value = false
  }
}

async function handleWake() {
  actionLoading.value = 'wake'
  try {
    const res = await wakeHermes('gateway')
    if (res.success) {
      message.success('Hermes gateway started')
    } else {
      message.error(res.error || 'Wake failed')
    }
    await loadStatus()
  } catch (err: any) {
    message.error(err.message || 'Wake failed')
  } finally {
    actionLoading.value = ''
  }
}

async function handleRestart() {
  actionLoading.value = 'restart'
  try {
    const res = await restartGateway()
    if (res.success) {
      message.success('Gateway restarted')
    } else {
      message.error(res.error || 'Restart failed')
    }
    await loadStatus()
  } catch (err: any) {
    message.error(err.message || 'Restart failed')
  } finally {
    actionLoading.value = ''
  }
}

async function handleStop() {
  actionLoading.value = 'stop'
  try {
    const res = await stopGateway()
    if (res.success) {
      message.success('Gateway stopped')
    } else {
      message.error(res.error || 'Stop failed')
    }
    await loadStatus()
  } catch (err: any) {
    message.error(err.message || 'Stop failed')
  } finally {
    actionLoading.value = ''
  }
}

async function handleWebUIRestart() {
  actionLoading.value = 'webui-restart'
  try {
    await restartWebUI()
    // Server will exit with code 42, wrapper script restarts it
    message.success('Web UI restarting...')
    setTimeout(() => window.location.reload(), 3000)
  } catch {
    // Connection lost is expected during restart
    setTimeout(() => window.location.reload(), 3000)
  } finally {
    actionLoading.value = ''
  }
}

async function handleWebUIShutdown() {
  actionLoading.value = 'webui-shutdown'
  try {
    await shutdownWebUI()
    message.success('Web UI shutting down...')
  } catch {
    // Connection lost is expected
  }
}

function getStatusType(st: string): 'success' | 'warning' | 'error' | 'default' {
  switch (st) {
    case 'running': return 'success'
    case 'stopped': return 'warning'
    case 'error': return 'error'
    default: return 'default'
  }
}

function getServiceIcon(type: string): string {
  switch (type) {
    case 'agent': return '🤖'
    case 'gateway': return '🌐'
    case 'web-ui': return '🖥️'
    case 'hermes': return '⚡'
    default: return '📦'
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatSessionTime(ts: number): string {
  const diff = Date.now() - ts * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function refresh() {
  loading.value = true
  loadStatus()
  loadActiveSessions()
  loadServiceLogs()
}

onMounted(() => {
  loadStatus()
  loadActiveSessions()
  loadServiceLogs()
  pollTimer = setInterval(() => {
    loadStatus()
    loadActiveSessions()
    loadServiceLogs()
  }, 15000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="services-view">
    <header class="page-header">
      <h2>Services</h2>
      <div class="header-actions">
        <NButton size="small" @click="refresh" :loading="loading">Refresh</NButton>
      </div>
    </header>

    <div class="services-body">
      <div v-if="error" class="error-banner">{{ error }}</div>

      <NSpin class="status-spin" :show="loading && !status">
        <div v-if="status" class="content">
        <!-- Stats -->
        <NGrid :cols="4" :x-gap="12" :y-gap="12" class="stats-grid">
          <NGridItem>
            <NCard size="small">
              <NStatistic label="Hermes Version" :value="status.hermes_version || '—'" />
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small">
              <NStatistic label="Active Sessions" :value="status.active_sessions" />
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small">
              <NStatistic label="Child Processes" :value="status.active_children" />
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small">
              <NStatistic label="Uptime" :value="formatUptime(status.uptime)" />
            </NCard>
          </NGridItem>
        </NGrid>

        <!-- Gateway Actions -->
        <section class="section">
          <h3>Gateway Control</h3>
          <div class="action-bar">
            <NButton
              v-if="status.gateway_status !== 'running'"
              type="primary"
              size="small"
              :loading="actionLoading === 'wake'"
              @click="handleWake"
            >
              ▶ Start Gateway
            </NButton>
            <NButton
              v-if="status.gateway_status === 'running'"
              size="small"
              :loading="actionLoading === 'restart'"
              @click="handleRestart"
            >
              ↻ Restart
            </NButton>
            <NPopconfirm
              v-if="status.gateway_status === 'running'"
              @positive-click="handleStop"
            >
              <template #trigger>
                <NButton size="small" type="error" :loading="actionLoading === 'stop'">
                  ■ Stop
                </NButton>
              </template>
              Stop the gateway? Active sessions will be interrupted.
            </NPopconfirm>
            <NTag :type="getStatusType(status.gateway_status)" size="small">
              Gateway: {{ status.gateway_status }}
            </NTag>
          </div>
        </section>

        <!-- Web UI Control -->
        <section class="section">
          <h3>Web UI Control</h3>
          <div class="action-bar">
            <NButton
              size="small"
              :loading="actionLoading === 'webui-restart'"
              @click="handleWebUIRestart"
            >
              ↻ Restart Web UI
            </NButton>
            <NPopconfirm @positive-click="handleWebUIShutdown">
              <template #trigger>
                <NButton size="small" type="error" :loading="actionLoading === 'webui-shutdown'">
                  ■ Stop Web UI
                </NButton>
              </template>
              Stop the Web UI server? You will need to restart it manually.
            </NPopconfirm>
            <NTag type="success" size="small">Web UI: running</NTag>
          </div>
        </section>

        <!-- Services -->
        <section class="section">
          <h3>Services ({{ status.services.length }})</h3>
          <div class="service-list">
            <div v-for="svc in status.services" :key="svc.name" class="service-card">
              <div class="service-icon">{{ getServiceIcon(svc.type) }}</div>
              <div class="service-info">
                <div class="service-name">{{ svc.name }}</div>
                <div class="service-details">{{ svc.details || '—' }}</div>
              </div>
              <div class="service-right">
                <NTag :type="getStatusType(svc.status)" size="small">{{ svc.status }}</NTag>
                <span v-if="svc.pid" class="service-pid">PID {{ svc.pid }}</span>
                <span v-if="svc.uptime" class="service-uptime">{{ svc.uptime }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Service Logs -->
        <section class="section">
          <div class="section-title-row">
            <h3>Service Logs</h3>
            <span class="logs-hint" v-if="logsLoading">Refreshing...</span>
          </div>
          <div class="logs-grid">
            <div v-for="name in logTargets" :key="name" class="log-card">
              <div class="log-card-title">{{ name }}</div>
              <pre class="log-pre">{{ (serviceLogs[name] || []).join('\n') }}</pre>
            </div>
          </div>
        </section>

        <!-- Active Sessions -->
        <section class="section">
          <h3>Active Sessions ({{ activeSessions.length }})</h3>
          <NEmpty v-if="activeSessions.length === 0" description="No active sessions" />
          <div v-else class="session-list">
            <div v-for="sess in activeSessions" :key="sess.id" class="session-item">
              <div class="session-id">{{ sess.id.slice(0, 24) }}{{ sess.id.length > 24 ? '...' : '' }}</div>
              <div class="session-meta">
                <NTag size="tiny">{{ sess.source }}</NTag>
                <span v-if="sess.model" class="session-model">{{ sess.model }}</span>
                <span>{{ sess.message_count }} msgs</span>
                <span>{{ sess.tool_call_count }} tools</span>
                <span>{{ formatSessionTime(sess.started_at) }}</span>
              </div>
            </div>
          </div>
        </section>
        </div>
      </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.services-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.services-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: $text-primary;
  }
}

.error-banner {
  padding: 10px 16px;
  background: rgba($error, 0.1);
  color: $error;
  border-radius: $radius-sm;
  margin-bottom: 12px;
  font-size: 13px;
}

.status-spin {
  flex: 1;
  min-height: 0;
}

.status-spin :deep(.n-spin-body),
.status-spin :deep(.n-spin-content) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 0;
}

.stats-grid {
  flex-shrink: 0;
}

.section h3 {
  font-size: 14px;
  font-weight: 600;
  color: $text-secondary;
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logs-hint {
  font-size: 12px;
  color: $text-muted;
}

.logs-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.log-card {
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  padding: 10px;
  min-height: 180px;
  display: flex;
  flex-direction: column;
}

.log-card-title {
  font-size: 12px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.log-pre {
  margin: 0;
  flex: 1;
  overflow: auto;
  font-family: $font-code;
  font-size: 11px;
  line-height: 1.35;
  color: $text-primary;
  white-space: pre-wrap;
  word-break: break-word;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.service-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
}

.service-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.service-info {
  flex: 1;
  min-width: 0;
}

.service-name {
  font-size: 14px;
  font-weight: 500;
  color: $text-primary;
}

.service-details {
  font-size: 12px;
  color: $text-muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.service-pid {
  font-size: 11px;
  color: $text-muted;
  font-family: $font-code;
}

.service-uptime {
  font-size: 11px;
  color: $text-muted;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: $bg-secondary;
  border-radius: $radius-sm;
}

.session-id {
  font-size: 12px;
  font-family: $font-code;
  color: $accent-primary;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: $text-muted;
}

.session-model {
  font-size: 11px;
  color: $text-secondary;
  background: rgba($accent-primary, 0.1);
  padding: 0 5px;
  border-radius: 3px;
}

@media (max-width: 1200px) {
  .logs-grid {
    grid-template-columns: 1fr;
  }
}
</style>

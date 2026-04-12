<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NEmpty, NPopconfirm, useMessage, NCard, NStatistic, NGrid
} from 'naive-ui'
import {
  fetchSystemStatus, wakeHermes, restartGateway, stopGateway,
  fetchActiveSessions, type SystemStatus, type ActiveSession
} from '@/api/system'

useI18n()
const message = useMessage()

const status = ref<SystemStatus | null>(null)
const activeSessions = ref<ActiveSession[]>([])
const loading = ref(true)
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
}

onMounted(() => {
  loadStatus()
  loadActiveSessions()
  pollTimer = setInterval(() => {
    loadStatus()
    loadActiveSessions()
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

    <div v-if="error" class="error-banner">{{ error }}</div>

    <NSpin :show="loading && !status" style="min-height: 200px">
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

        <!-- Services -->
        <section class="section">
          <h3>Services</h3>
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
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.services-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
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
  margin-bottom: 16px;
  font-size: 13px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  flex: 1;
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
</style>

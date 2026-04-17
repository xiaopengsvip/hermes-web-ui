<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NEmpty, NPopconfirm, useMessage, NCard, NStatistic, NGrid, NInput
} from 'naive-ui'
import {
  fetchSystemStatus, wakeHermes, restartGateway, stopGateway,
  fetchActiveSessions, shutdownWebUI, restartWebUI,
  fetchDashboardStatus, startDashboard,
  fetchCloudflareTunnelStatus, startCloudflareTunnel, stopCloudflareTunnel,
  type SystemStatus, type ActiveSession, type DashboardStatus, type CloudflareTunnelStatus
} from '@/api/system'
import { fetchLogs } from '@/api/logs'

const { t } = useI18n()
const message = useMessage()

const status = ref<SystemStatus | null>(null)
const dashboard = ref<DashboardStatus | null>(null)
const tunnel = ref<CloudflareTunnelStatus | null>(null)
const tunnelTarget = ref('http://127.0.0.1:8650')
const activeSessions = ref<ActiveSession[]>([])
const loading = ref(true)
const logsLoading = ref(false)
const logsCollapsed = ref(false)
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
    dashboard.value = data.dashboard || null

    if (!dashboard.value) {
      try {
        dashboard.value = await fetchDashboardStatus()
      } catch {
        // ignore dashboard fallback failure
      }
    }

    error.value = ''
  } catch (err: any) {
    error.value = err.message || t('services.messages.fetchStatusFailed')
  } finally {
    loading.value = false
  }
}

async function loadTunnelStatus() {
  try {
    const data = await fetchCloudflareTunnelStatus()
    tunnel.value = data
    tunnelTarget.value = data.target_url || tunnelTarget.value
  } catch (err: any) {
    tunnel.value = null
    if (!error.value) {
      error.value = err.message || t('services.messages.fetchStatusFailed')
    }
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
            : [t('services.messages.noLogs')]
          return [name, lines]
        } catch (err: any) {
          return [name, [`${t('services.messages.loadLogsFailed')} ${err?.message || t('services.messages.unknownError')}`]]
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
      message.success(t('services.messages.gatewayStarted'))
    } else {
      message.error(res.error || t('services.messages.wakeFailed'))
    }
    await loadStatus()
  } catch (err: any) {
    message.error(err.message || t('services.messages.wakeFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function handleRestart() {
  actionLoading.value = 'restart'
  try {
    const res = await restartGateway()
    if (res.success) {
      message.success(t('services.messages.gatewayRestarted'))
    } else {
      message.error(res.error || t('services.messages.restartFailed'))
    }
    await loadStatus()
  } catch (err: any) {
    message.error(err.message || t('services.messages.restartFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function handleStop() {
  actionLoading.value = 'stop'
  try {
    const res = await stopGateway()
    if (res.success) {
      message.success(t('services.messages.gatewayStopped'))
    } else {
      message.error(res.error || t('services.messages.stopFailed'))
    }
    await loadStatus()
  } catch (err: any) {
    message.error(err.message || t('services.messages.stopFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function handleWebUIRestart() {
  actionLoading.value = 'webui-restart'
  try {
    await restartWebUI()
    // Server will exit with code 42, wrapper script restarts it
    message.success(t('services.messages.webuiRestarting'))
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
    message.success(t('services.messages.webuiShuttingDown'))
  } catch {
    // Connection lost is expected
  }
}

async function handleDashboardStart() {
  actionLoading.value = 'dashboard-start'
  try {
    const res = await startDashboard()
    if (res.success) {
      message.success(t('services.messages.dashboardStarted'))
    } else {
      message.error(res.error || t('services.messages.dashboardStartFailed'))
    }
    await loadStatus()
  } catch (err: any) {
    message.error(err.message || t('services.messages.dashboardStartFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function handleTunnelStart() {
  actionLoading.value = 'tunnel-start'
  try {
    const res = await startCloudflareTunnel(tunnelTarget.value.trim())
    if (!res.success) {
      message.error(res.error || t('services.messages.tunnelStartFailed'))
      return
    }
    message.success(t('services.messages.tunnelStarted'))
    await loadTunnelStatus()
  } catch (err: any) {
    message.error(err.message || t('services.messages.tunnelStartFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function handleTunnelStop() {
  actionLoading.value = 'tunnel-stop'
  try {
    const res = await stopCloudflareTunnel()
    if (!res.success) {
      message.error(res.error || t('services.messages.tunnelStopFailed'))
      return
    }
    message.success(t('services.messages.tunnelStopped'))
    await loadTunnelStatus()
  } catch (err: any) {
    message.error(err.message || t('services.messages.tunnelStopFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function copyTunnelUrl() {
  if (!tunnel.value?.public_url) return
  try {
    await navigator.clipboard.writeText(tunnel.value.public_url)
    message.success(t('services.messages.tunnelUrlCopied'))
  } catch {
    message.error(t('common.copyFailed'))
  }
}

function handleDashboardOpen() {
  const url = dashboard.value?.url || 'http://127.0.0.1:9119'
  window.open(url, '_blank', 'noopener')
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
    case 'dashboard': return '📊'
    case 'hermes': return '⚡'
    default: return '📦'
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return t('services.time.durationSeconds', { value: seconds })
  if (seconds < 3600) {
    return t('services.time.durationMinutesSeconds', {
      minutes: Math.floor(seconds / 60),
      seconds: seconds % 60,
    })
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return t('services.time.durationHoursMinutes', { hours: h, minutes: m })
}

function formatSessionTime(ts: number): string {
  const diff = Date.now() - ts * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t('services.time.minutesAgo', { value: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('services.time.hoursAgo', { value: hours })
  return t('services.time.daysAgo', { value: Math.floor(hours / 24) })
}

function refresh() {
  loading.value = true
  loadStatus()
  loadActiveSessions()
  loadServiceLogs()
  loadTunnelStatus()
}

onMounted(() => {
  loadStatus()
  loadActiveSessions()
  loadServiceLogs()
  loadTunnelStatus()
  pollTimer = setInterval(() => {
    loadStatus()
    loadActiveSessions()
    loadServiceLogs()
    loadTunnelStatus()
  }, 15000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="services-view">
    <header class="page-header">
      <h2>{{ t('sidebar.services') }}</h2>
      <div class="header-actions">
        <NButton size="small" @click="refresh" :loading="loading">{{ t('common.refresh') }}</NButton>
      </div>
    </header>

    <div class="services-body">
      <div class="services-scroll">
        <div v-if="error" class="error-banner">{{ error }}</div>

        <NSpin class="status-spin" :show="loading && !status">
          <div v-if="status" class="content">
        <!-- Stats -->
        <NGrid :cols="4" :x-gap="12" :y-gap="12" class="stats-grid">
          <NGridItem>
            <NCard size="small">
              <NStatistic :label="t('services.stats.hermesVersion')" :value="status.hermes_version || '—'" />
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small">
              <NStatistic :label="t('services.stats.activeSessions')" :value="status.active_sessions" />
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small">
              <NStatistic :label="t('services.stats.childProcesses')" :value="status.active_children" />
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small">
              <NStatistic :label="t('services.stats.uptime')" :value="formatUptime(status.uptime)" />
            </NCard>
          </NGridItem>
        </NGrid>

        <!-- Legacy Platform Identity -->
        <section class="section">
          <h3>{{ t('services.legacyBrand.title') }}</h3>
          <div class="legacy-brand-card">
            <img src="/hermes-avatar.webp" alt="Hermes" class="legacy-brand-avatar" loading="lazy" decoding="async" />
            <div class="legacy-brand-meta">
              <div class="legacy-brand-name">Hermes</div>
              <div class="legacy-brand-desc">{{ t('services.legacyBrand.description') }}</div>
            </div>
          </div>
        </section>

        <!-- Unified Service Control -->
        <section class="section">
          <div class="section-title-row section-title-row-top">
            <h3>{{ t('services.unifiedControl.title') }}</h3>
            <span class="control-subtitle">{{ t('services.unifiedControl.subtitle') }}</span>
          </div>

          <div class="control-groups">
            <div class="control-group">
              <div class="control-group-title">{{ t('services.gatewayControl') }}</div>
              <div class="action-bar">
                <NButton
                  v-if="status.gateway_status !== 'running'"
                  type="primary"
                  size="small"
                  :loading="actionLoading === 'wake'"
                  @click="handleWake"
                >
                  ▶ {{ t('services.actions.startGateway') }}
                </NButton>
                <NButton
                  v-if="status.gateway_status === 'running'"
                  size="small"
                  :loading="actionLoading === 'restart'"
                  @click="handleRestart"
                >
                  ↻ {{ t('services.actions.restart') }}
                </NButton>
                <NPopconfirm
                  v-if="status.gateway_status === 'running'"
                  @positive-click="handleStop"
                >
                  <template #trigger>
                    <NButton size="small" type="error" :loading="actionLoading === 'stop'">
                      ■ {{ t('services.actions.stop') }}
                    </NButton>
                  </template>
                  {{ t('services.messages.stopGatewayConfirm') }}
                </NPopconfirm>
                <NTag :type="getStatusType(status.gateway_status)" size="small">
                  {{ t('services.gatewayStatus', { status: status.gateway_status }) }}
                </NTag>
              </div>
            </div>

            <div class="control-group">
              <div class="control-group-title">{{ t('services.webuiControl') }}</div>
              <div class="action-bar">
                <NButton
                  size="small"
                  :loading="actionLoading === 'webui-restart'"
                  @click="handleWebUIRestart"
                >
                  ↻ {{ t('services.actions.restartWebui') }}
                </NButton>
                <NPopconfirm @positive-click="handleWebUIShutdown">
                  <template #trigger>
                    <NButton size="small" type="error" :loading="actionLoading === 'webui-shutdown'">
                      ■ {{ t('services.actions.stopWebui') }}
                    </NButton>
                  </template>
                  {{ t('services.messages.stopWebuiConfirm') }}
                </NPopconfirm>
                <NTag type="success" size="small">{{ t('services.webuiRunning') }}</NTag>
              </div>
            </div>

            <div class="control-group">
              <div class="control-group-title">{{ t('services.dashboardControl') }}</div>
              <div class="action-bar">
                <NButton
                  v-if="dashboard?.status !== 'running'"
                  type="primary"
                  size="small"
                  :loading="actionLoading === 'dashboard-start'"
                  @click="handleDashboardStart"
                >
                  ▶ {{ t('services.actions.startDashboard') }}
                </NButton>
                <NButton size="small" @click="handleDashboardOpen">
                  ↗ {{ t('services.actions.openDashboard') }}
                </NButton>
                <NTag :type="getStatusType(dashboard?.status || 'unknown')" size="small">
                  {{ t('services.dashboardStatus', { status: dashboard?.status || 'unknown' }) }}
                </NTag>
                <span v-if="dashboard?.url" class="dashboard-url">{{ dashboard.url }}</span>
              </div>
            </div>

            <div class="control-group control-group-tunnel">
              <div class="control-group-title">{{ t('services.tunnelControl') }}</div>
              <div class="action-bar tunnel-bar">
                <NInput
                  v-model:value="tunnelTarget"
                  size="small"
                  class="tunnel-target-input"
                  :placeholder="t('services.tunnelTargetPlaceholder')"
                />
                <NButton
                  size="small"
                  type="primary"
                  :loading="actionLoading === 'tunnel-start'"
                  @click="handleTunnelStart"
                >
                  ▶ {{ t('services.actions.startTunnel') }}
                </NButton>
                <NPopconfirm @positive-click="handleTunnelStop">
                  <template #trigger>
                    <NButton
                      size="small"
                      type="error"
                      :loading="actionLoading === 'tunnel-stop'"
                    >
                      ■ {{ t('services.actions.stopTunnel') }}
                    </NButton>
                  </template>
                  {{ t('services.messages.stopTunnelConfirm') }}
                </NPopconfirm>
                <NTag :type="getStatusType(tunnel?.status || 'stopped')" size="small">
                  {{ t('services.tunnelStatus', { status: tunnel?.status || 'stopped' }) }}
                </NTag>
              </div>
              <div class="tunnel-url-row" v-if="tunnel?.public_url">
                <code class="tunnel-url">{{ tunnel.public_url }}</code>
                <NButton size="tiny" tertiary @click="copyTunnelUrl">{{ t('common.copy') }}</NButton>
                <NButton size="tiny" tertiary tag="a" :href="tunnel.public_url" target="_blank" rel="noopener">{{ t('services.actions.openTunnel') }}</NButton>
              </div>
              <div class="tunnel-meta" v-if="tunnel?.error">{{ tunnel.error }}</div>
            </div>
          </div>
        </section>

        <!-- Services -->
        <section class="section">
          <h3>{{ t('services.servicesCount', { count: status.services.length }) }}</h3>
          <div class="service-list">
            <div v-for="svc in status.services" :key="svc.name" class="service-card">
              <div class="service-icon">{{ getServiceIcon(svc.type) }}</div>
              <div class="service-info">
                <div class="service-name">{{ svc.name }}</div>
                <div class="service-details">{{ svc.details || '—' }}</div>
              </div>
              <div class="service-right">
                <NTag :type="getStatusType(svc.status)" size="small">{{ svc.status }}</NTag>
                <span v-if="svc.pid" class="service-pid">{{ t('services.pidLabel', { pid: svc.pid }) }}</span>
                <span v-if="svc.uptime" class="service-uptime">{{ svc.uptime }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Service Logs -->
        <section class="section">
          <div class="section-title-row">
            <h3>{{ t('services.serviceLogs') }}</h3>
            <div class="section-actions">
              <span class="logs-hint" v-if="logsLoading">{{ t('services.refreshing') }}</span>
              <NButton size="tiny" tertiary @click="logsCollapsed = !logsCollapsed">
                {{ logsCollapsed ? t('services.expandLogs') : t('services.collapseLogs') }}
              </NButton>
            </div>
          </div>
          <div v-show="!logsCollapsed" class="logs-panel-scroll">
            <div class="logs-grid">
              <div v-for="name in logTargets" :key="name" class="log-card">
                <div class="log-card-title">{{ t(`services.logTarget.${name}`) }}</div>
                <pre class="log-pre">{{ (serviceLogs[name] || []).join('\n') }}</pre>
              </div>
            </div>
          </div>
        </section>

        <!-- Active Sessions -->
        <section class="section">
          <h3>{{ t('services.activeSessionsCount', { count: activeSessions.length }) }}</h3>
          <NEmpty v-if="activeSessions.length === 0" :description="t('services.noActiveSessions')" />
          <div v-else class="session-list">
            <div v-for="sess in activeSessions" :key="sess.id" class="session-item">
              <div class="session-id">{{ sess.id.slice(0, 24) }}{{ sess.id.length > 24 ? '...' : '' }}</div>
              <div class="session-meta">
                <NTag size="tiny">{{ sess.source }}</NTag>
                <span v-if="sess.model" class="session-model">{{ sess.model }}</span>
                <span>{{ t('services.msgCount', { count: sess.message_count }) }}</span>
                <span>{{ t('services.toolCount', { count: sess.tool_call_count }) }}</span>
                <span>{{ formatSessionTime(sess.started_at) }}</span>
              </div>
            </div>
          </div>
        </section>
        </div>
      </NSpin>
    </div>
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
  padding: 0;
}

.services-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.page-header {
  margin-bottom: 0;
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;

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
  width: min(1120px, 100%);
  margin: 0 auto;
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
  flex: 1;
  min-height: 0;
  padding: 0;
}

.stats-grid {
  flex-shrink: 0;
}

.section {
  border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 84%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 92%, transparent),
    color-mix(in srgb, var(--theme-background-secondary, #14141f) 95%, transparent)
  );
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
}

.section h3 {
  font-size: 14px;
  font-weight: 600;
  color: $text-secondary;
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.legacy-brand-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.legacy-brand-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid $border-color;
}

.legacy-brand-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legacy-brand-name {
  font-size: 14px;
  font-weight: 700;
  color: $text-primary;
}

.legacy-brand-desc {
  font-size: 12px;
  color: $text-muted;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-title-row-top {
  align-items: flex-start;
  flex-direction: column;
}

.control-subtitle {
  font-size: 12px;
  color: $text-muted;
  line-height: 1.45;
}

.control-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-group {
  padding: 12px;
  border-radius: $radius-md;
  border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 82%, transparent);
  background: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 90%, transparent);
}

.control-group-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: $text-secondary;
  text-transform: uppercase;
  letter-spacing: 0.45px;
}

.control-group-tunnel {
  border-style: dashed;
}

.logs-hint {
  font-size: 12px;
  color: $text-muted;
}

.dashboard-url {
  font-size: 12px;
  color: $text-muted;
  font-family: $font-code;
}

.tunnel-bar {
  align-items: center;
}

.tunnel-target-input {
  min-width: 280px;
  max-width: 480px;
}

.tunnel-url-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tunnel-url {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid $border-color;
  background: $bg-secondary;
  color: $text-primary;
  font-family: $font-code;
  font-size: 12px;
}

.tunnel-meta {
  margin-top: 8px;
  font-size: 12px;
  color: $text-muted;
  line-height: 1.5;
}

.logs-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.logs-panel-scroll {
  max-height: 420px;
  overflow-y: auto;
  padding-right: 2px;
}

.log-card {
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  padding: 10px;
  min-height: 200px;
  max-height: 260px;
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

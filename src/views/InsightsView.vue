<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NButton,
  NCard,
  NStatistic,
  NGrid,
  NGridItem,
  NTag,
  NEmpty,
  NSpin,
  NSelect,
  NDatePicker,
  NProgress,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

type InsightTab = 'audit' | 'reports'

interface AuditLog {
  id: string
  timestamp: number
  action: string
  user: string
  resource: string
  details: string
  status: 'success' | 'warning' | 'error' | 'info'
}

interface Report {
  id: string
  date: number
  type: 'daily' | 'weekly' | 'monthly'
  summary: string
  metrics: {
    chats: number
    filesUploaded: number
    tasksCompleted: number
    skillsUsed: number
    errors: number
  }
  score: number
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const tab = ref<InsightTab>('audit')
const dateRange = ref<[number, number] | null>(null)

const selectedAction = ref('all')
const selectedStatus = ref('all')
const selectedType = ref<'all' | 'daily' | 'weekly' | 'monthly'>('all')

const auditLogs = ref<AuditLog[]>([])
const reports = ref<Report[]>([])

function initTabFromRoute() {
  const q = (route.query.tab as string | undefined)?.toLowerCase()
  if (q === 'reports') tab.value = 'reports'
  else tab.value = 'audit'
}

const mockAuditLogs: AuditLog[] = [
  { id: '1', timestamp: Date.now() - 45 * 60 * 1000, action: 'Gateway restart', user: 'admin', resource: 'services', details: 'Restarted Hermes gateway to apply config', status: 'success' },
  { id: '2', timestamp: Date.now() - 90 * 60 * 1000, action: 'Upload file', user: 'everett', resource: 'materials', details: 'Uploaded architecture-v3.pdf', status: 'success' },
  { id: '3', timestamp: Date.now() - 150 * 60 * 1000, action: 'Create cron job', user: 'everett', resource: 'jobs', details: 'Created daily market digest job', status: 'success' },
  { id: '4', timestamp: Date.now() - 220 * 60 * 1000, action: 'Delete repo', user: 'everett', resource: 'github', details: 'Attempted delete without enough permission', status: 'warning' },
  { id: '5', timestamp: Date.now() - 8 * 60 * 60 * 1000, action: 'Token check', user: 'system', resource: 'github', details: 'GitHub token expired, re-auth needed', status: 'error' },
  { id: '6', timestamp: Date.now() - 12 * 60 * 60 * 1000, action: 'Session start', user: 'everett', resource: 'chat', details: 'Started architecture planning session', status: 'info' },
]

const mockReports: Report[] = [
  {
    id: 'r1',
    date: Date.now() - 24 * 60 * 60 * 1000,
    type: 'daily',
    summary: 'Focused on deployment stability and i18n quality, with reduced error rate and faster iteration cycle.',
    metrics: { chats: 14, filesUploaded: 6, tasksCompleted: 9, skillsUsed: 5, errors: 1 },
    score: 89,
  },
  {
    id: 'r2',
    date: Date.now() - 2 * 24 * 60 * 60 * 1000,
    type: 'daily',
    summary: 'Mainly handled UI polishing and service observability, improved response clarity across modules.',
    metrics: { chats: 10, filesUploaded: 3, tasksCompleted: 7, skillsUsed: 4, errors: 2 },
    score: 82,
  },
]

const filteredAuditLogs = computed(() => {
  let result = auditLogs.value
  if (dateRange.value) {
    const [start, end] = dateRange.value
    result = result.filter((log) => log.timestamp >= start && log.timestamp <= end)
  }
  if (selectedAction.value !== 'all') {
    result = result.filter((log) => log.action === selectedAction.value)
  }
  if (selectedStatus.value !== 'all') {
    result = result.filter((log) => log.status === selectedStatus.value)
  }
  return result
})

const filteredReports = computed(() => {
  let result = reports.value
  if (dateRange.value) {
    const [start, end] = dateRange.value
    result = result.filter((report) => report.date >= start && report.date <= end)
  }
  if (selectedType.value !== 'all') {
    result = result.filter((report) => report.type === selectedType.value)
  }
  return result
})

const auditStats = computed(() => {
  const total = filteredAuditLogs.value.length
  const success = filteredAuditLogs.value.filter((l) => l.status === 'success').length
  const users = new Set(filteredAuditLogs.value.map((l) => l.user)).size

  const actionCounts: Record<string, number> = {}
  filteredAuditLogs.value.forEach((log) => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
  })

  const topActions = Object.entries(actionCounts)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    totalActions: total,
    successRate: total ? (success / total) * 100 : 0,
    activeUsers: users,
    topActions,
  }
})

const reportStats = computed(() => {
  const total = filteredReports.value.length
  const generatedToday = filteredReports.value.filter((r) => {
    const today = new Date()
    return new Date(r.date).toDateString() === today.toDateString()
  }).length
  const averageScore = total ? filteredReports.value.reduce((sum, r) => sum + r.score, 0) / total : 0

  const latest = filteredReports.value[0]
  const topMetrics = latest
    ? [
        { name: t('reports.metrics.chats'), value: latest.metrics.chats },
        { name: t('reports.metrics.filesUploaded'), value: latest.metrics.filesUploaded },
        { name: t('reports.metrics.tasksCompleted'), value: latest.metrics.tasksCompleted },
        { name: t('reports.metrics.skillsUsed'), value: latest.metrics.skillsUsed },
        { name: t('reports.metrics.errors'), value: latest.metrics.errors },
      ]
    : []

  return {
    totalReports: total,
    generatedToday,
    averageScore,
    topMetrics,
  }
})

const cockpitStats = computed(() => {
  const logs = filteredAuditLogs.value
  const success = logs.filter((x) => x.status === 'success').length
  const warning = logs.filter((x) => x.status === 'warning').length
  const error = logs.filter((x) => x.status === 'error').length
  const info = logs.filter((x) => x.status === 'info').length
  const safeTotal = logs.length || 1

  const securityHealth = Math.max(0, Math.min(100, ((success + info * 0.7) / safeTotal) * 100 - error * 6))
  const automationRate = Math.max(0, Math.min(100, (reports.value.reduce((sum, r) => sum + r.metrics.tasksCompleted, 0) / Math.max(1, reports.value.reduce((sum, r) => sum + r.metrics.chats, 0))) * 100))
  const errorPressure = Math.max(0, Math.min(100, ((error * 2 + warning) / safeTotal) * 100))

  const trend7d = Array.from({ length: 7 }).map((_, i) => {
    const day = 6 - i
    const base = logs.length + reports.value.length * 2
    const value = Math.max(5, Math.min(95, base * 5 + (6 - day) * 4 - error * 3 + (success - warning) * 2))
    return { day: i + 1, value }
  })

  return {
    securityHealth,
    automationRate,
    errorPressure,
    activeSignals: success + warning + error,
    trend7d,
  }
})

const auditActionOptions = computed(() => {
  const actions = [...new Set(auditLogs.value.map((log) => log.action))]
  return [{ label: t('audit.allActions'), value: 'all' }, ...actions.map((a) => ({ label: a, value: a }))]
})

const statusOptions = computed(() => [
  { label: t('audit.allStatuses'), value: 'all' },
  { label: t('audit.status.success'), value: 'success' },
  { label: t('audit.status.warning'), value: 'warning' },
  { label: t('audit.status.error'), value: 'error' },
  { label: t('audit.status.info'), value: 'info' },
])

const reportTypeOptions = computed(() => [
  { label: t('audit.allActions'), value: 'all' },
  { label: t('reports.daily'), value: 'daily' },
  { label: t('reports.weekly'), value: 'weekly' },
  { label: t('reports.monthly'), value: 'monthly' },
])

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'error'
    default: return 'info'
  }
}

function getScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

function switchTab(next: InsightTab) {
  tab.value = next
  router.replace({ name: 'insights', query: { tab: next } })
}

onMounted(() => {
  loading.value = true
  initTabFromRoute()
  auditLogs.value = [...mockAuditLogs]
  reports.value = [...mockReports].sort((a, b) => b.date - a.date)
  loading.value = false
})
</script>

<template>
  <div class="insights-view">
    <header class="insights-header">
      <div class="header-left">
        <h2 class="header-title">{{ t('sidebar.insights') }}</h2>
        <div class="tab-switch">
          <button class="tab-btn" :class="{ active: tab === 'audit' }" @click="switchTab('audit')">{{ t('sidebar.audit') }}</button>
          <button class="tab-btn" :class="{ active: tab === 'reports' }" @click="switchTab('reports')">{{ t('sidebar.reports') }}</button>
        </div>
      </div>
      <div class="header-actions">
        <NDatePicker v-model:value="dateRange" type="daterange" clearable :placeholder="tab === 'audit' ? t('audit.dateRange') : t('reports.date')" class="date-picker" />

        <template v-if="tab === 'audit'">
          <NSelect v-model:value="selectedAction" :options="auditActionOptions" size="small" style="width: 180px" :placeholder="t('audit.filterByAction')" />
          <NSelect v-model:value="selectedStatus" :options="statusOptions" size="small" style="width: 160px" :placeholder="t('audit.filterByStatus')" />
        </template>

        <template v-else>
          <NSelect v-model:value="selectedType" :options="reportTypeOptions" size="small" style="width: 180px" :placeholder="t('reports.type')" />
          <NButton type="primary" class="btn-generate">{{ t('reports.generate') }}</NButton>
        </template>
      </div>
    </header>

    <div class="insights-content">
      <NSpin :show="loading">
        <section class="cockpit-section">
          <h3 class="section-title">{{ t('insights.cockpitTitle') }}</h3>
          <NGrid :x-gap="12" :y-gap="12" :cols="4" class="cockpit-grid">
            <NGridItem>
              <NCard size="small" class="cockpit-card">
                <NStatistic :label="t('insights.securityHealth')" :value="cockpitStats.securityHealth.toFixed(1)" suffix="%" />
                <NProgress :percentage="cockpitStats.securityHealth" :show-indicator="false" :height="6" color="#2ecc71" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="cockpit-card">
                <NStatistic :label="t('insights.automationRate')" :value="cockpitStats.automationRate.toFixed(1)" suffix="%" />
                <NProgress :percentage="cockpitStats.automationRate" :show-indicator="false" :height="6" color="#667eea" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="cockpit-card">
                <NStatistic :label="t('insights.errorPressure')" :value="cockpitStats.errorPressure.toFixed(1)" suffix="%" />
                <NProgress :percentage="cockpitStats.errorPressure" :show-indicator="false" :height="6" color="#ff6b81" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="cockpit-card">
                <NStatistic :label="t('insights.activeSignals')" :value="cockpitStats.activeSignals" />
                <div class="signals-row">
                  <NTag size="tiny" type="success">{{ t('audit.status.success') }}</NTag>
                  <NTag size="tiny" type="warning">{{ t('audit.status.warning') }}</NTag>
                  <NTag size="tiny" type="error">{{ t('audit.status.error') }}</NTag>
                </div>
              </NCard>
            </NGridItem>
          </NGrid>

          <NCard size="small" class="trend-card">
            <div class="trend-header">
              <span class="trend-title">{{ t('insights.trend7d') }}</span>
            </div>
            <div class="trend-bars">
              <div v-for="item in cockpitStats.trend7d" :key="item.day" class="trend-item">
                <div class="trend-bar-wrap">
                  <div class="trend-bar" :style="{ height: `${item.value}%` }"></div>
                </div>
                <span class="trend-label">D{{ item.day }}</span>
              </div>
            </div>
          </NCard>
        </section>

        <template v-if="tab === 'audit'">
          <div class="statistics-section">
            <h3 class="section-title">{{ t('audit.statistics.title') }}</h3>
            <NGrid :x-gap="12" :y-gap="12" :cols="4">
              <NGridItem><NCard size="small"><NStatistic :label="t('audit.statistics.totalActions')" :value="auditStats.totalActions" /></NCard></NGridItem>
              <NGridItem><NCard size="small"><NStatistic :label="t('audit.statistics.successRate')" :value="`${auditStats.successRate.toFixed(1)}%`" /></NCard></NGridItem>
              <NGridItem><NCard size="small"><NStatistic :label="t('audit.statistics.activeUsers')" :value="auditStats.activeUsers" /></NCard></NGridItem>
              <NGridItem><NCard size="small"><NStatistic :label="t('audit.statistics.topActions')" :value="auditStats.topActions.length" /></NCard></NGridItem>
            </NGrid>
          </div>

          <div class="top-actions-section">
            <h3 class="section-title">{{ t('audit.topActions.title') }}</h3>
            <div class="top-actions-grid">
              <NCard v-for="item in auditStats.topActions" :key="item.action" size="small">
                <div class="action-item">
                  <span class="action-name">{{ item.action }}</span>
                  <span class="action-count">{{ item.count }} {{ t('audit.times') }}</span>
                </div>
              </NCard>
            </div>
          </div>

          <div class="audit-logs-section">
            <h3 class="section-title">{{ t('audit.recentLogs') }}</h3>
            <div v-if="filteredAuditLogs.length > 0" class="logs-table">
              <div class="table-header">
                <div class="col-time">{{ t('audit.time') }}</div>
                <div class="col-action">{{ t('audit.action') }}</div>
                <div class="col-user">{{ t('audit.user') }}</div>
                <div class="col-resource">{{ t('audit.resource') }}</div>
                <div class="col-details">{{ t('audit.details') }}</div>
                <div class="col-status">{{ t('audit.status.title') }}</div>
              </div>
              <div class="table-body">
                <div v-for="log in filteredAuditLogs" :key="log.id" class="table-row">
                  <div class="col-time">{{ formatDateTime(log.timestamp) }}</div>
                  <div class="col-action">{{ log.action }}</div>
                  <div class="col-user">{{ log.user }}</div>
                  <div class="col-resource">{{ log.resource }}</div>
                  <div class="col-details">{{ log.details }}</div>
                  <div class="col-status"><NTag :type="getStatusColor(log.status)" size="small">{{ t(`audit.status.${log.status}`) }}</NTag></div>
                </div>
              </div>
            </div>
            <NEmpty v-else :description="t('audit.noLogs')" />
          </div>
        </template>

        <template v-else>
          <div class="statistics-section">
            <h3 class="section-title">{{ t('reports.statistics.title') }}</h3>
            <NGrid :x-gap="12" :y-gap="12" :cols="4">
              <NGridItem><NCard size="small"><NStatistic :label="t('reports.statistics.totalReports')" :value="reportStats.totalReports" /></NCard></NGridItem>
              <NGridItem><NCard size="small"><NStatistic :label="t('reports.statistics.generatedToday')" :value="reportStats.generatedToday" /></NCard></NGridItem>
              <NGridItem><NCard size="small"><NStatistic :label="t('reports.statistics.averageScore')" :value="reportStats.averageScore.toFixed(1)" /></NCard></NGridItem>
              <NGridItem><NCard size="small"><NStatistic :label="t('reports.statistics.topMetrics')" :value="reportStats.topMetrics.length" /></NCard></NGridItem>
            </NGrid>
          </div>

          <div class="top-metrics-section">
            <h3 class="section-title">{{ t('reports.statistics.topMetrics') }}</h3>
            <div class="metrics-grid">
              <NCard v-for="metric in reportStats.topMetrics" :key="metric.name" size="small">
                <div class="metric-header">
                  <span class="metric-name">{{ metric.name }}</span>
                  <span class="metric-value">{{ metric.value }}</span>
                </div>
                <NProgress :percentage="Math.min(metric.value * 10, 100)" :show-indicator="false" :height="6" :border-radius="3" color="#667eea" />
              </NCard>
            </div>
          </div>

          <div class="reports-list-section">
            <h3 class="section-title">{{ t('reports.recentReports') }}</h3>
            <div v-if="filteredReports.length > 0" class="reports-grid">
              <NCard v-for="report in filteredReports" :key="report.id" size="small" class="report-card">
                <div class="report-header">
                  <div class="report-date">{{ formatDate(report.date) }}</div>
                  <NTag :type="getScoreColor(report.score)" size="small">{{ report.score }} {{ t('reports.score') }}</NTag>
                </div>
                <div class="report-summary">{{ report.summary }}</div>
                <div class="report-metrics">
                  <div class="metric-item"><span class="metric-label">{{ t('reports.metrics.chats') }}</span><span class="metric-value">{{ report.metrics.chats }}</span></div>
                  <div class="metric-item"><span class="metric-label">{{ t('reports.metrics.filesUploaded') }}</span><span class="metric-value">{{ report.metrics.filesUploaded }}</span></div>
                  <div class="metric-item"><span class="metric-label">{{ t('reports.metrics.tasksCompleted') }}</span><span class="metric-value">{{ report.metrics.tasksCompleted }}</span></div>
                  <div class="metric-item"><span class="metric-label">{{ t('reports.metrics.skillsUsed') }}</span><span class="metric-value">{{ report.metrics.skillsUsed }}</span></div>
                  <div class="metric-item"><span class="metric-label">{{ t('reports.metrics.errors') }}</span><span class="metric-value">{{ report.metrics.errors }}</span></div>
                </div>
                <div class="report-actions">
                  <NButton size="small" quaternary>{{ t('reports.details') }}</NButton>
                  <NButton size="small" quaternary>{{ t('reports.export') }}</NButton>
                </div>
              </NCard>
            </div>
            <NEmpty v-else :description="t('reports.noReports')" />
          </div>
        </template>
      </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.insights-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.insights-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
}

.tab-switch {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: $bg-secondary;
  border-radius: $radius-sm;
}

.tab-btn {
  border: none;
  background: transparent;
  color: $text-secondary;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;

  &.active {
    color: $text-primary;
    background: rgba($accent-primary, 0.15);
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-picker {
  width: 260px;
}

.insights-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: $text-primary;
}

.cockpit-section,
.statistics-section,
.top-actions-section,
.top-metrics-section,
.audit-logs-section,
.reports-list-section {
  margin-bottom: 24px;
}

.top-actions-grid,
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.cockpit-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.signals-row {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.trend-card {
  margin-top: 12px;
}

.trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.trend-title {
  font-size: 12px;
  color: $text-secondary;
}

.trend-bars {
  height: 120px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  align-items: end;
}

.trend-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.trend-bar-wrap {
  width: 100%;
  height: 92px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  align-items: end;
  padding: 3px;
}

.trend-bar {
  width: 100%;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba($accent-primary, 0.95), rgba($accent-primary, 0.35));
}

.trend-label {
  font-size: 11px;
  color: $text-muted;
}

.action-item,
.metric-header,
.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.action-name,
.metric-name,
.report-summary,
.metric-label {
  color: $text-secondary;
}

.action-count,
.metric-value,
.report-date {
  color: $text-muted;
  font-size: 12px;
}

.logs-table {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  overflow: hidden;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr 2fr 1fr;
  gap: 10px;
  padding: 10px 12px;
  font-size: 12px;
}

.table-header {
  font-weight: 600;
  color: $text-secondary;
  border-bottom: 1px solid $border-color;
  background: $bg-secondary;
}

.table-body {
  max-height: 380px;
  overflow-y: auto;
}

.table-row {
  color: $text-primary;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.col-time,
.col-action,
.col-user,
.col-resource,
.col-details,
.col-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.report-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-summary {
  color: $text-primary;
  line-height: 1.5;
}

.report-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.report-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

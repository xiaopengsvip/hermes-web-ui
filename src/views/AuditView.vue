<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NCard, NStatistic, NGrid, NGridItem, NTag, NEmpty, NSpin, NSelect, NDatePicker } from 'naive-ui'
import { useI18n } from 'vue-i18n'

interface AuditLog {
  id: string
  timestamp: number
  action: string
  user: string
  resource: string
  details: string
  status: 'success' | 'warning' | 'error' | 'info'
  ip?: string
  userAgent?: string
}

interface AuditStats {
  totalActions: number
  successRate: number
  activeUsers: number
  topActions: { action: string; count: number }[]
}

const { t } = useI18n()

const auditLogs = ref<AuditLog[]>([])
const loading = ref(false)
const dateRange = ref<[number, number] | null>(null)
const selectedAction = ref('all')
const selectedStatus = ref('all')

// Mock audit data
const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: Date.now() - 3600000,
    action: '登录',
    user: 'admin',
    resource: '系统',
    details: '用户登录成功',
    status: 'success',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },
  {
    id: '2',
    timestamp: Date.now() - 7200000,
    action: '上传文件',
    user: 'user1',
    resource: '素材库',
    details: '上传了项目介绍.pptx',
    status: 'success',
    ip: '192.168.1.101',
    userAgent: 'Mozilla/5.0'
  },
  {
    id: '3',
    timestamp: Date.now() - 10800000,
    action: '创建任务',
    user: 'user2',
    resource: '定时任务',
    details: '创建了每日备份任务',
    status: 'success',
    ip: '192.168.1.102',
    userAgent: 'Mozilla/5.0'
  },
  {
    id: '4',
    timestamp: Date.now() - 14400000,
    action: '删除文件',
    user: 'user1',
    resource: '素材库',
    details: '尝试删除系统文件',
    status: 'error',
    ip: '192.168.1.101',
    userAgent: 'Mozilla/5.0'
  },
  {
    id: '5',
    timestamp: Date.now() - 18000000,
    action: '修改设置',
    user: 'admin',
    resource: '系统设置',
    details: '修改了API配置',
    status: 'warning',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },
  {
    id: '6',
    timestamp: Date.now() - 21600000,
    action: '聊天会话',
    user: 'user3',
    resource: '聊天',
    details: '创建了新会话',
    status: 'info',
    ip: '192.168.1.103',
    userAgent: 'Mozilla/5.0'
  }
]

// Computed properties
const filteredLogs = computed(() => {
  let result = auditLogs.value

  // Filter by date range
  if (dateRange.value) {
    const [start, end] = dateRange.value
    result = result.filter(log => log.timestamp >= start && log.timestamp <= end)
  }

  // Filter by action
  if (selectedAction.value !== 'all') {
    result = result.filter(log => log.action === selectedAction.value)
  }

  // Filter by status
  if (selectedStatus.value !== 'all') {
    result = result.filter(log => log.status === selectedStatus.value)
  }

  return result
})

const auditStats = computed<AuditStats>(() => {
  const stats: AuditStats = {
    totalActions: auditLogs.value.length,
    successRate: auditLogs.value.filter(log => log.status === 'success').length / auditLogs.value.length * 100,
    activeUsers: new Set(auditLogs.value.map(log => log.user)).size,
    topActions: []
  }

  // Calculate top actions
  const actionCounts: Record<string, number> = {}
  auditLogs.value.forEach(log => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
  })
  stats.topActions = Object.entries(actionCounts)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return stats
})

const actionOptions = computed(() => {
  const actions = [...new Set(auditLogs.value.map(log => log.action))]
  return [
    { label: t('audit.allActions'), value: 'all' },
    ...actions.map(action => ({ label: action, value: action }))
  ]
})

const statusOptions = computed(() => [
  { label: t('audit.allStatuses'), value: 'all' },
  { label: t('audit.status.success'), value: 'success' },
  { label: t('audit.status.warning'), value: 'warning' },
  { label: t('audit.status.error'), value: 'error' },
  { label: t('audit.status.info'), value: 'info' }
])

// Helper functions
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'error'
    default: return 'info'
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'success': return '✓'
    case 'warning': return '⚠'
    case 'error': return '✗'
    default: return 'ℹ'
  }
}

// Lifecycle
onMounted(() => {
  loading.value = true
  // Load mock data
  auditLogs.value = [...mockAuditLogs]
  loading.value = false
})
</script>

<template>
  <div class="audit-view">
    <header class="audit-header">
      <h2 class="header-title">{{ t('audit.title') }}</h2>
      <div class="header-actions">
        <NDatePicker
          v-model:value="dateRange"
          type="daterange"
          clearable
          :placeholder="t('audit.dateRange')"
          class="date-picker"
        />
        <NSelect
          v-model:value="selectedAction"
          :options="actionOptions"
          size="small"
          style="width: 150px"
          :placeholder="t('audit.filterByAction')"
        />
        <NSelect
          v-model:value="selectedStatus"
          :options="statusOptions"
          size="small"
          style="width: 150px"
          :placeholder="t('audit.filterByStatus')"
        />
      </div>
    </header>

    <div class="audit-content">
      <NSpin :show="loading">
        <!-- Statistics Section -->
        <div class="statistics-section">
          <h3 class="section-title">{{ t('audit.statistics.title') }}</h3>
          <NGrid :x-gap="12" :y-gap="12" :cols="4">
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('audit.statistics.totalActions')" :value="auditStats.totalActions" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('audit.statistics.successRate')" :value="auditStats.successRate.toFixed(1) + '%'" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('audit.statistics.activeUsers')" :value="auditStats.activeUsers" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('audit.statistics.topActions')" :value="auditStats.topActions.length" />
              </NCard>
            </NGridItem>
          </NGrid>
        </div>

        <!-- Top Actions Section -->
        <div class="top-actions-section">
          <h3 class="section-title">{{ t('audit.topActions.title') }}</h3>
          <div class="top-actions-grid">
            <NCard
              v-for="item in auditStats.topActions"
              :key="item.action"
              size="small"
              class="glass-card"
            >
              <div class="action-item">
                <span class="action-name">{{ item.action }}</span>
                <span class="action-count">{{ item.count }} {{ t('audit.times') }}</span>
              </div>
            </NCard>
          </div>
        </div>

        <!-- Audit Logs Section -->
        <div class="audit-logs-section">
          <h3 class="section-title">{{ t('audit.recentLogs') }}</h3>
          <div v-if="filteredLogs.length > 0" class="logs-table">
            <div class="table-header">
              <div class="col-time">{{ t('audit.time') }}</div>
              <div class="col-action">{{ t('audit.action') }}</div>
              <div class="col-user">{{ t('audit.user') }}</div>
              <div class="col-resource">{{ t('audit.resource') }}</div>
              <div class="col-details">{{ t('audit.details') }}</div>
              <div class="col-status">{{ t('audit.status.title') }}</div>
            </div>
            <div class="table-body">
              <div
                v-for="log in filteredLogs"
                :key="log.id"
                class="table-row"
              >
                <div class="col-time">{{ formatTime(log.timestamp) }}</div>
                <div class="col-action">{{ log.action }}</div>
                <div class="col-user">{{ log.user }}</div>
                <div class="col-resource">{{ log.resource }}</div>
                <div class="col-details">{{ log.details }}</div>
                <div class="col-status">
                  <NTag :type="getStatusColor(log.status)" size="small">
                    {{ getStatusIcon(log.status) }} {{ t(`audit.status.${log.status}`) }}
                  </NTag>
                </div>
              </div>
            </div>
          </div>
          <NEmpty v-else :description="t('audit.noLogs')" />
        </div>
      </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/liquid-glass' as *;
@use '@/styles/variables' as *;

.audit-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-primary;
}

.audit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
  gap: 12px;
  background: $bg-sidebar;
  backdrop-filter: blur($blur-md);
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
  @extend .text-gradient;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-picker {
  width: 250px;
}

.audit-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 12px;
}

.statistics-section {
  margin-bottom: 24px;
}

.top-actions-section {
  margin-bottom: 24px;
}

.top-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-name {
  font-size: 14px;
  color: $text-primary;
}

.action-count {
  font-size: 12px;
  color: $text-muted;
}

.audit-logs-section {
  margin-bottom: 24px;
}

.logs-table {
  @extend .glass;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 2fr 1fr;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
  font-weight: 600;
  color: $text-secondary;
  border-bottom: 1px solid $border-color;
}

.table-body {
  max-height: 400px;
  overflow-y: auto;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 2fr 1fr;
  gap: 12px;
  padding: 12px 16px;
  font-size: 12px;
  color: $text-primary;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background $transition-fast;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
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

.col-status {
  display: flex;
  align-items: center;
}
</style>
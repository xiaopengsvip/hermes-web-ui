<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NCard, NStatistic, NGrid, NGridItem, NTag, NEmpty, NSpin, NSelect, NDatePicker, NProgress } from 'naive-ui'
import { useI18n } from 'vue-i18n'

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
  activities: string[]
  achievements: string[]
  issues: string[]
  nextSteps: string[]
  score: number
}

interface ReportStats {
  totalReports: number
  generatedToday: number
  averageScore: number
  topMetrics: { name: string; value: number }[]
}

const { t } = useI18n()

const reports = ref<Report[]>([])
const loading = ref(false)
const dateRange = ref<[number, number] | null>(null)
const selectedType = ref('all')

// Mock report data
const mockReports: Report[] = [
  {
    id: '1',
    date: Date.now() - 86400000,
    type: 'daily',
    summary: '今天完成了多项任务，包括上传了5个文件，完成了3个定时任务，使用了2个技能。',
    metrics: {
      chats: 8,
      filesUploaded: 5,
      tasksCompleted: 3,
      skillsUsed: 2,
      errors: 1
    },
    activities: [
      '与Hermes Agent进行了8次对话',
      '上传了5个文件到素材库',
      '完成了3个定时任务',
      '使用了2个技能'
    ],
    achievements: [
      '成功处理了复杂的数据分析任务',
      '优化了系统性能',
      '创建了新的自动化流程'
    ],
    issues: [
      '网络连接偶尔不稳定',
      '某个文件上传失败'
    ],
    nextSteps: [
      '继续优化系统性能',
      '添加更多自动化功能',
      '完善文档和教程'
    ],
    score: 85
  },
  {
    id: '2',
    date: Date.now() - 172800000,
    type: 'daily',
    summary: '昨天主要进行了系统维护和优化，修复了几个问题。',
    metrics: {
      chats: 12,
      filesUploaded: 3,
      tasksCompleted: 5,
      skillsUsed: 4,
      errors: 2
    },
    activities: [
      '进行了12次技术讨论',
      '上传了3个配置文件',
      '完成了5个维护任务',
      '使用了4个技能进行调试'
    ],
    achievements: [
      '修复了系统关键bug',
      '提高了系统稳定性',
      '完善了监控功能'
    ],
    issues: [
      '遇到了一些兼容性问题',
      '性能需要进一步优化'
    ],
    nextSteps: [
      '继续修复已知问题',
      '进行性能测试',
      '更新系统文档'
    ],
    score: 78
  }
]

// Computed properties
const filteredReports = computed(() => {
  let result = reports.value

  // Filter by date range
  if (dateRange.value) {
    const [start, end] = dateRange.value
    result = result.filter(report => report.date >= start && report.date <= end)
  }

  // Filter by type
  if (selectedType.value !== 'all') {
    result = result.filter(report => report.type === selectedType.value)
  }

  return result
})

const reportStats = computed<ReportStats>(() => {
  const stats: ReportStats = {
    totalReports: reports.value.length,
    generatedToday: reports.value.filter(r => {
      const today = new Date()
      const reportDate = new Date(r.date)
      return reportDate.toDateString() === today.toDateString()
    }).length,
    averageScore: reports.value.reduce((sum, r) => sum + r.score, 0) / reports.value.length,
    topMetrics: []
  }

  // Calculate top metrics
  if (reports.value.length > 0) {
    const latestReport = reports.value[0]
    stats.topMetrics = [
      { name: t('reports.metrics.chats'), value: latestReport.metrics.chats },
      { name: t('reports.metrics.filesUploaded'), value: latestReport.metrics.filesUploaded },
      { name: t('reports.metrics.tasksCompleted'), value: latestReport.metrics.tasksCompleted },
      { name: t('reports.metrics.skillsUsed'), value: latestReport.metrics.skillsUsed },
      { name: t('reports.metrics.errors'), value: latestReport.metrics.errors }
    ]
  }

  return stats
})

const typeOptions = computed(() => [
  { label: t('reports.daily'), value: 'daily' },
  { label: t('reports.weekly'), value: 'weekly' },
  { label: t('reports.monthly'), value: 'monthly' }
])

// Helper functions
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

function getScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

// Lifecycle
onMounted(() => {
  loading.value = true
  // Load mock data
  reports.value = [...mockReports]
  loading.value = false
})
</script>

<template>
  <div class="reports-view">
    <header class="reports-header">
      <h2 class="header-title">{{ t('reports.title') }}</h2>
      <div class="header-actions">
        <NDatePicker
          v-model:value="dateRange"
          type="daterange"
          clearable
          :placeholder="t('reports.date')"
          class="date-picker"
        />
        <NSelect
          v-model:value="selectedType"
          :options="typeOptions"
          size="small"
          style="width: 150px"
          :placeholder="t('reports.type')"
        />
        <NButton type="primary" class="btn-gradient">
          {{ t('reports.generate') }}
        </NButton>
      </div>
    </header>

    <div class="reports-content">
      <NSpin :show="loading">
        <!-- Statistics Section -->
        <div class="statistics-section">
          <h3 class="section-title">{{ t('reports.statistics.title') }}</h3>
          <NGrid :x-gap="12" :y-gap="12" :cols="4">
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('reports.statistics.totalReports')" :value="reportStats.totalReports" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('reports.statistics.generatedToday')" :value="reportStats.generatedToday" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('reports.statistics.averageScore')" :value="reportStats.averageScore.toFixed(1)" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('reports.statistics.topMetrics')" :value="reportStats.topMetrics.length" />
              </NCard>
            </NGridItem>
          </NGrid>
        </div>

        <!-- Top Metrics Section -->
        <div class="top-metrics-section">
          <h3 class="section-title">{{ t('reports.statistics.topMetrics') }}</h3>
          <div class="metrics-grid">
            <NCard
              v-for="metric in reportStats.topMetrics"
              :key="metric.name"
              size="small"
              class="glass-card metric-card"
            >
              <div class="metric-header">
                <span class="metric-name">{{ metric.name }}</span>
                <span class="metric-value">{{ metric.value }}</span>
              </div>
              <NProgress
                :percentage="Math.min(metric.value * 10, 100)"
                :show-indicator="false"
                :height="6"
                :border-radius="3"
                color="#667eea"
              />
            </NCard>
          </div>
        </div>

        <!-- Reports List Section -->
        <div class="reports-list-section">
          <h3 class="section-title">{{ t('reports.recentReports') }}</h3>
          <div v-if="filteredReports.length > 0" class="reports-grid">
            <NCard
              v-for="report in filteredReports"
              :key="report.id"
              size="small"
              class="glass-card report-card"
            >
              <div class="report-header">
                <div class="report-date">{{ formatDate(report.date) }}</div>
                <NTag :type="getScoreColor(report.score)" size="small">
                  {{ report.score }} {{ t('reports.score') }}
                </NTag>
              </div>
              <div class="report-summary">{{ report.summary }}</div>
              <div class="report-metrics">
                <div class="metric-item">
                  <span class="metric-label">{{ t('reports.metrics.chats') }}:</span>
                  <span class="metric-value">{{ report.metrics.chats }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">{{ t('reports.metrics.filesUploaded') }}:</span>
                  <span class="metric-value">{{ report.metrics.filesUploaded }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">{{ t('reports.metrics.tasksCompleted') }}:</span>
                  <span class="metric-value">{{ report.metrics.tasksCompleted }}</span>
                </div>
              </div>
              <div class="report-actions">
                <NButton size="small" quaternary>{{ t('reports.details') }}</NButton>
                <NButton size="small" quaternary>{{ t('reports.export') }}</NButton>
              </div>
            </NCard>
          </div>
          <NEmpty v-else :description="t('reports.noReports')" />
        </div>
      </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/liquid-glass' as *;
@use '@/styles/variables' as *;

.reports-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-primary;
}

.reports-header {
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

.reports-content {
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

.top-metrics-section {
  margin-bottom: 24px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.metric-card {
  transition: all $transition-normal;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-glass, $shadow-glow;
  }
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.metric-name {
  font-size: 12px;
  color: $text-secondary;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.reports-list-section {
  margin-bottom: 24px;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.report-card {
  transition: all $transition-normal;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-glass, $shadow-glow;
  }
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.report-date {
  font-size: 12px;
  color: $text-muted;
}

.report-summary {
  font-size: 14px;
  color: $text-primary;
  line-height: 1.5;
  margin-bottom: 12px;
}

.report-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.metric-item {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 10px;
  color: $text-muted;
}

.metric-value {
  font-size: 12px;
  font-weight: 600;
  color: $text-primary;
}

.report-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NCard, NCollapse, NCollapseItem,
  NGrid, NGridItem, NStatistic, useMessage
} from 'naive-ui'
import { fetchVersionInfo, type VersionInfo } from '@/api/version'

const { t } = useI18n()
const message = useMessage()

const info = ref<VersionInfo | null>(null)
const loading = ref(true)
const error = ref('')

const categoryIcons: Record<string, string> = {
  Core: '⚙️',
  Monitoring: '📊',
  System: '🖥️',
  Integration: '🔗',
  UI: '🎨',
}

const categoryOrder = ['Core', 'Monitoring', 'System', 'Integration', 'UI']

const sortedCategories = computed(() => {
  if (!info.value) return []
  const cats = info.value.features.categories
  return categoryOrder.filter(c => cats[c]).map(c => ({
    name: c,
    icon: categoryIcons[c] || '📦',
    features: cats[c],
  }))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    info.value = await fetchVersionInfo()
  } catch (err: any) {
    error.value = err.message || 'Failed to load version info'
  } finally {
    loading.value = false
  }
}

function copyVersion() {
  if (!info.value) return
  const text = [
    `EVR-AI开发工作系统 v1`,
    `Hermes Agent: ${info.value.hermes.version}`,
    `Node.js: ${info.value.runtime.node}`,
    `Platform: ${info.value.runtime.platform}/${info.value.runtime.arch}`,
    `Features: ${info.value.features.total}`,
    `Dependencies: ${info.value.dependencies.length}`,
  ].join('\n')
  navigator.clipboard.writeText(text).then(
    () => message.success(t('common.copied')),
    () => message.error(t('common.copyFailed'))
  )
}

function getStatusType(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'running': return 'success'
    case 'stopped': return 'warning'
    case 'error': return 'error'
    default: return 'default'
  }
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET': return '#4facfe'
    case 'POST': return '#00f2fe'
    case 'PUT': return '#f6d365'
    case 'DELETE': return '#ff6b6b'
    default: return '#667eea'
  }
}

onMounted(load)
</script>

<template>
  <div class="version-view">
    <header class="page-header">
      <h2>{{ t('version.title') }}</h2>
      <div class="header-actions">
        <NButton size="small" @click="copyVersion" :disabled="!info">
          {{ t('common.copy') }}
        </NButton>
        <NButton size="small" @click="load" :loading="loading">
          {{ t('common.refresh') }}
        </NButton>
      </div>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="version-content">
      <NSpin :show="loading && !info" style="min-height: 200px">
        <div v-if="info" class="content">

        <!-- Version Cards -->
        <NGrid :cols="4" :x-gap="12" :y-gap="12" class="stats-grid">
          <NGridItem>
            <NCard size="small" class="stat-card">
              <NStatistic :label="t('version.webUi')">
                <template #default>
                  <span class="version-value">v1</span>
                </template>
              </NStatistic>
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small" class="stat-card">
              <NStatistic :label="t('version.hermesAgent')">
                <template #default>
                  <span class="version-value">{{ info.hermes.version }}</span>
                </template>
              </NStatistic>
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small" class="stat-card">
              <NStatistic label="Node.js">
                <template #default>
                  <span class="version-value">{{ info.runtime.node }}</span>
                </template>
              </NStatistic>
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small" class="stat-card">
              <NStatistic :label="t('version.uptime')">
                <template #default>
                  <span class="version-value">{{ info.runtime.uptime_human }}</span>
                </template>
              </NStatistic>
            </NCard>
          </NGridItem>
        </NGrid>

        <!-- System Info Row -->
        <section class="section">
          <h3>{{ t('version.systemInfo') }}</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">{{ t('version.platform') }}</span>
              <span class="info-value">{{ info.runtime.platform }} / {{ info.runtime.arch }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">PID</span>
              <span class="info-value">{{ info.runtime.pid }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('version.serverPort') }}</span>
              <span class="info-value">{{ info.server.port }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('version.upstream') }}</span>
              <span class="info-value">
                {{ info.upstream.url }}
                <NTag :type="getStatusType(info.upstream.status)" size="tiny" style="margin-left: 6px">
                  {{ info.upstream.status }}
                </NTag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('version.gateway') }}</span>
              <span class="info-value">
                <NTag :type="getStatusType(info.hermes.gateway_status)" size="tiny">
                  {{ info.hermes.gateway_status }}
                </NTag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('version.license') }}</span>
              <span class="info-value">{{ info.web_ui.license }}</span>
            </div>
          </div>
        </section>

        <!-- Features by Category -->
        <section class="section">
          <h3>{{ t('version.features') }} ({{ info.features.total }})</h3>
          <NCollapse :default-expanded-names="categoryOrder" class="feature-collapse">
            <NCollapseItem
              v-for="cat in sortedCategories"
              :key="cat.name"
              :title="`${cat.icon} ${cat.name} (${cat.features.length})`"
              :name="cat.name"
            >
              <div class="feature-list">
                <div v-for="feat in cat.features" :key="feat.name" class="feature-card">
                  <div class="feature-header">
                    <span class="feature-name">{{ feat.name }}</span>
                    <NTag size="tiny" :bordered="false">{{ cat.name }}</NTag>
                  </div>
                  <p class="feature-desc">{{ feat.description }}</p>
                  <div v-if="feat.endpoints && feat.endpoints.length" class="feature-endpoints">
                    <code
                      v-for="ep in feat.endpoints"
                      :key="ep"
                      class="endpoint-tag"
                    >
                      {{ ep }}
                    </code>
                  </div>
                </div>
              </div>
            </NCollapseItem>
          </NCollapse>
        </section>

        <!-- Backend Routes -->
        <section class="section">
          <h3>{{ t('version.backendRoutes') }} ({{ info.backend_routes.length }})</h3>
          <div class="route-list">
            <div v-for="route in info.backend_routes" :key="route.path" class="route-item">
              <span
                class="route-method"
                :style="{ color: getMethodColor(route.method) }"
              >{{ route.method }}</span>
              <code class="route-path">{{ route.path }}</code>
              <span class="route-desc">{{ route.desc }}</span>
            </div>
          </div>
        </section>

        <!-- Dependencies -->
        <NCollapse class="deps-collapse">
          <NCollapseItem :title="`${t('version.dependencies')} (${info.dependencies.length})`" name="deps">
            <div class="dep-grid">
              <div v-for="dep in info.dependencies" :key="dep.name" class="dep-item">
                <span class="dep-name">{{ dep.name }}</span>
                <span class="dep-version">{{ dep.version }}</span>
              </div>
            </div>
          </NCollapseItem>
          <NCollapseItem :title="`${t('version.devDependencies')} (${info.dev_dependencies.length})`" name="dev-deps">
            <div class="dep-grid">
              <div v-for="dep in info.dev_dependencies" :key="dep.name" class="dep-item">
                <span class="dep-name">{{ dep.name }}</span>
                <span class="dep-version">{{ dep.version }}</span>
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>

        <!-- Footer -->
        <div class="version-footer">
          <span>{{ t('version.generated') }}: {{ new Date(info.timestamp).toLocaleString() }}</span>
        </div>

      </div>
    </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.version-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
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

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.version-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
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

.stat-card {
  text-align: center;

  .version-value {
    font-size: 18px;
    font-weight: 700;
    color: $accent-primary;
    font-family: $font-code;
  }
}

.section h3 {
  font-size: 14px;
  font-weight: 600;
  color: $text-secondary;
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
}

.info-label {
  font-size: 12px;
  color: $text-muted;
  min-width: 90px;
  flex-shrink: 0;
}

.info-value {
  font-size: 13px;
  color: $text-primary;
  font-family: $font-code;
  display: flex;
  align-items: center;
}

.feature-collapse {
  :deep(.n-collapse-item__header) {
    font-weight: 600;
    font-size: 14px;
  }
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
  padding: 4px 0;
}

.feature-card {
  padding: 12px 16px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  transition: border-color $transition-fast;

  &:hover {
    border-color: $accent-primary;
  }
}

.feature-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.feature-name {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.feature-desc {
  font-size: 12px;
  color: $text-secondary;
  margin: 0 0 8px;
  line-height: 1.5;
}

.feature-endpoints {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.endpoint-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba($accent-primary, 0.1);
  color: $accent-primary;
  border-radius: 4px;
  font-family: $font-code;
  white-space: nowrap;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.route-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: $bg-secondary;
  border-radius: $radius-sm;
}

.route-method {
  font-size: 11px;
  font-weight: 700;
  font-family: $font-code;
  min-width: 50px;
}

.route-path {
  font-size: 12px;
  color: $text-primary;
  font-family: $font-code;
  flex-shrink: 0;
}

.route-desc {
  font-size: 12px;
  color: $text-muted;
}

.deps-collapse {
  :deep(.n-collapse-item__header) {
    font-weight: 600;
    font-size: 14px;
  }
}

.dep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 4px;
}

.dep-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: $bg-secondary;
  border-radius: 4px;
  font-size: 12px;
}

.dep-name {
  color: $text-secondary;
  font-family: $font-code;
}

.dep-version {
  color: $accent-primary;
  font-family: $font-code;
  font-weight: 500;
}

.version-footer {
  text-align: center;
  padding: 12px 0;
  font-size: 11px;
  color: $text-muted;
  border-top: 1px solid $border-color;
}
</style>

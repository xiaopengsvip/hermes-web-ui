<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const { t } = useI18n()
const appStore = useAppStore()
const expanded = ref(false)

const routeKeyMap: Record<string, string> = {
  chat: 'chat',
  jobs: 'jobs',
  materials: 'materials',
  projectCenter: 'projectCenter',
  configCenter: 'configCenter',
  insights: 'insights',
  skills: 'skills',
  memory: 'memory',
  logs: 'logs',
  github: 'github',
  vercel: 'vercel',
  cloudflare: 'cloudflare',
  services: 'services',
  settings: 'settings',
  version: 'version',
}

const routeKey = computed(() => routeKeyMap[String(route.name || 'chat')] || 'chat')
const title = computed(() => t(`sidebar.${routeKey.value}`))
const subtitle = computed(() => t(`routeMeta.${routeKey.value}.subtitle`))
const description = computed(() => t(`routeMeta.${routeKey.value}.description`))

const totalModels = computed(() => appStore.modelGroups.reduce((sum, group) => sum + group.models.length, 0))
const currentModel = computed(() => appStore.selectedModel || t('routeMeta.common.notConfigured'))

const statItems = computed(() => ([
  {
    key: 'status',
    label: t('routeMeta.common.connection'),
    value: appStore.connected ? t('routeMeta.common.online') : t('routeMeta.common.offline'),
    tone: appStore.connected ? 'success' : 'danger',
  },
  {
    key: 'models',
    label: t('routeMeta.common.availableModels'),
    value: `${totalModels.value}`,
    tone: 'info',
  },
  {
    key: 'model',
    label: t('routeMeta.common.currentModel'),
    value: currentModel.value,
    tone: 'neutral',
  },
]))
</script>

<template>
  <section class="route-meta-card">
    <div class="route-meta-main">
      <div class="route-meta-title-block">
        <div class="route-meta-title-row">
          <span class="route-title-icon" aria-hidden="true">
            <svg v-if="routeKey === 'chat'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <svg v-else-if="routeKey === 'jobs'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <svg v-else-if="routeKey === 'materials'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <svg v-else-if="routeKey === 'projectCenter'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="8" height="8" rx="2" ry="2" />
              <rect x="13" y="3" width="8" height="8" rx="2" ry="2" />
              <rect x="3" y="13" width="8" height="8" rx="2" ry="2" />
              <path d="M13 17h8" />
              <path d="M17 13v8" />
            </svg>
            <svg v-else-if="routeKey === 'configCenter'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1v4" />
              <path d="M12 19v4" />
              <path d="M4.22 4.22l2.83 2.83" />
              <path d="M16.95 16.95l2.83 2.83" />
              <path d="M1 12h4" />
              <path d="M19 12h4" />
              <path d="M4.22 19.78l2.83-2.83" />
              <path d="M16.95 7.05l2.83-2.83" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <svg v-else-if="routeKey === 'insights'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 17 9 11 13 15 21 7" />
              <polyline points="14 7 21 7 21 14" />
            </svg>
            <svg v-else-if="routeKey === 'skills'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <svg v-else-if="routeKey === 'memory'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </svg>
            <svg v-else-if="routeKey === 'logs'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <svg v-else-if="routeKey === 'github'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
            <svg v-else-if="routeKey === 'vercel'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 19h20L12 2z"/>
            </svg>
            <svg v-else-if="routeKey === 'cloudflare'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <path d="M8 12l2-4 2 4-2 4-2-4z"/>
              <path d="M14 8l2 4-2 4"/>
            </svg>
            <svg v-else-if="routeKey === 'services'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <svg v-else-if="routeKey === 'version'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <h1 class="route-meta-title">{{ title }}</h1>
        </div>
        <p class="route-meta-subtitle">{{ subtitle }}</p>
      </div>

      <div class="route-meta-stats" role="list">
        <article
          v-for="item in statItems"
          :key="item.key"
          class="route-stat"
          :class="`is-${item.tone}`"
          role="listitem"
        >
          <span class="route-stat-label">{{ item.label }}</span>
          <span class="route-stat-value" :title="item.value">{{ item.value }}</span>
        </article>
      </div>
    </div>

    <div class="route-meta-explain">
      <button class="expand-btn" type="button" @click="expanded = !expanded">
        {{ expanded ? t('routeMeta.common.collapseIntro') : t('routeMeta.common.expandIntro') }}
      </button>
      <p v-if="expanded" class="route-meta-description">{{ description }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.route-meta-card {
  width: min(var(--page-content-wide-width, 1320px), calc(100% - 16px));
  margin: 10px auto 0;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--theme-border, rgba(255, 255, 255, 0.2)) 78%, transparent);
  background: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 92%, transparent);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.route-meta-main {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.route-meta-title-block {
  min-width: 0;
}

.route-meta-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.route-title-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--theme-primary, #7dd3ff) 88%, #ffffff 12%);
  background: color-mix(in srgb, var(--theme-primary, #7dd3ff) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-primary, #7dd3ff) 46%, transparent);
  box-shadow: 0 0 10px rgba(var(--theme-primary-rgb, 125, 211, 255), 0.22);
  flex-shrink: 0;
}

.route-meta-title {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.2;
}

.route-meta-subtitle {
  margin: 8px 0 0;
  color: var(--theme-text-secondary, #95a3bf);
  font-size: 13px;
  line-height: 1.55;
}

.route-meta-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: 8px;
  min-width: min(52vw, 520px);
}

.route-stat {
  border-radius: 10px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--theme-border, rgba(255, 255, 255, 0.24)) 78%, transparent);
  background: color-mix(in srgb, var(--theme-background-secondary, rgba(255, 255, 255, 0.06)) 80%, transparent);
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 56px;
  justify-content: center;
}

.route-stat-label {
  font-size: 11px;
  color: var(--theme-text-muted, #7f8aa3);
}

.route-stat-value {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-stat.is-success .route-stat-value {
  color: #58d68d;
}

.route-stat.is-danger .route-stat-value {
  color: #ff8f8f;
}

.route-stat.is-info .route-stat-value {
  color: color-mix(in srgb, var(--theme-primary, #7dd3ff) 86%, #ffffff 14%);
}

.route-meta-explain {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.expand-btn {
  border: 1px solid color-mix(in srgb, var(--theme-border, rgba(255, 255, 255, 0.2)) 82%, transparent);
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text-secondary, #b6c3db);
  font-size: 12px;
  padding: 6px 10px;
  cursor: pointer;
}

.route-meta-description {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-text-secondary, #afbdd8);
}

@media (max-width: 1100px) {
  .route-meta-main {
    flex-direction: column;
  }

  .route-meta-stats {
    min-width: 100%;
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}

@media (max-width: 900px) {
  .route-meta-card {
    width: calc(100% - 12px);
  }
}

@media (max-width: 768px) {
  .route-meta-card {
    width: calc(100% - 8px);
    margin: 8px auto 0;
    padding: 12px;
    border-radius: 12px;
  }

  .route-meta-title {
    font-size: 18px;
  }

  .route-title-icon {
    width: 30px;
    height: 30px;
    border-radius: 9px;
  }

  .route-meta-subtitle {
    font-size: 12px;
    margin-top: 6px;
  }

  .route-meta-stats {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .route-stat {
    min-height: 52px;
  }
}
</style>

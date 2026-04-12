<script setup lang="ts">
import { computed } from 'vue'
import { NPopselect, NCard, NGrid, NGridItem } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'

const { t } = useI18n()
const themeStore = useThemeStore()

const currentTheme = computed(() => themeStore.currentTheme)

const themeOptions = computed(() =>
  themeStore.themes.map(theme => ({
    label: theme.nameZh,
    value: theme.id
  }))
)

function handleThemeChange(themeId: string) {
  themeStore.setTheme(themeId)
}

function getThemePreviewStyle(themeId: string) {
  const theme = themeStore.getThemeById(themeId)
  if (!theme) return {}
  return {
    background: theme.colors.background,
    color: theme.colors.text,
    border: `2px solid ${theme.colors.primary}`
  }
}
</script>

<template>
  <NPopselect
    :value="currentTheme.id"
    :options="themeOptions"
    @update:value="handleThemeChange"
    trigger="click"
    placement="top-end"
    :width="300"
  >
    <button class="theme-switcher" :title="currentTheme.nameZh">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <span class="theme-name">{{ currentTheme.nameZh }}</span>
    </button>
    <template #header>
      <div class="theme-header">
        <span class="header-title">{{ t('theme.title') }}</span>
        <span class="header-subtitle">{{ t('theme.subtitle') }}</span>
      </div>
    </template>
    <template #action>
      <div class="theme-grid">
        <NGrid :x-gap="8" :y-gap="8" :cols="2">
          <NGridItem v-for="theme in themeStore.themes" :key="theme.id">
            <NCard
              size="small"
              class="theme-card"
              :class="{ active: theme.id === currentTheme.id }"
              @click="handleThemeChange(theme.id)"
            >
              <div class="theme-preview" :style="getThemePreviewStyle(theme.id)">
                <div class="preview-header">
                  <div class="preview-dot" :style="{ background: theme.colors.primary }"></div>
                  <div class="preview-dot" :style="{ background: theme.colors.secondary }"></div>
                  <div class="preview-dot" :style="{ background: theme.colors.accent }"></div>
                </div>
                <div class="preview-body">
                  <div class="preview-line" :style="{ background: theme.colors.text }"></div>
                  <div class="preview-line short" :style="{ background: theme.colors.textSecondary }"></div>
                </div>
              </div>
              <div class="theme-info">
                <span class="theme-name">{{ theme.nameZh }}</span>
                <span class="theme-desc">{{ theme.description }}</span>
              </div>
            </NCard>
          </NGridItem>
        </NGrid>
      </div>
    </template>
  </NPopselect>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.theme-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: $text-secondary;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: $text-primary;
  }

  svg {
    flex-shrink: 0;
  }

  .theme-name {
    font-size: 12px;
    font-weight: 500;
  }
}

.theme-header {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;

  .header-title {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 2px;
  }

  .header-subtitle {
    display: block;
    font-size: 11px;
    color: $text-muted;
  }
}

.theme-grid {
  padding: 4px 0;
}

.theme-card {
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  &.active {
    border-color: $accent-primary;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
  }
}

.theme-preview {
  height: 60px;
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-header {
  display: flex;
  gap: 4px;
}

.preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
}

.preview-line {
  height: 4px;
  border-radius: 2px;
  opacity: 0.8;

  &.short {
    width: 60%;
  }
}

.theme-info {
  .theme-name {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 2px;
  }

  .theme-desc {
    display: block;
    font-size: 10px;
    color: $text-muted;
    line-height: 1.3;
  }
}
</style>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { NPopover, NButton, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'

const { t, locale } = useI18n()
const themeStore = useThemeStore()

const filterMode = ref<'all' | 'dark' | 'light' | 'pro'>('pro')
const styleGroup = ref<'all' | 'minimal' | 'tech' | 'neon'>('all')

const currentTheme = computed(() => themeStore.currentTheme)

const featuredThemeIds = ['vercel-silk', 'linear-night', 'aurora-frost', 'liquid-glass']
const styleMap: Record<string, 'minimal' | 'tech' | 'neon'> = {
  'pure-ink': 'minimal',
  'vercel-silk': 'minimal',
  'liquid-glass': 'tech',
  'ocean-blue': 'tech',
  'forest-green': 'tech',
  'linear-night': 'tech',
  'sunset-orange': 'neon',
  'midnight-purple': 'neon',
  'aurora-frost': 'neon',
}

const filteredThemes = computed(() => {
  let list = themeStore.themes
  if (filterMode.value === 'dark') list = list.filter(t => t.isDark)
  if (filterMode.value === 'light') list = list.filter(t => !t.isDark)
  if (filterMode.value === 'pro') list = list.filter(t => featuredThemeIds.includes(t.id))
  if (styleGroup.value !== 'all') list = list.filter(t => styleMap[t.id] === styleGroup.value)
  return list
})

function handleThemeChange(themeId: string) {
  themeStore.setTheme(themeId)
}

function setRandomTheme() {
  const candidates = filteredThemes.value.length > 0 ? filteredThemes.value : themeStore.themes
  const random = candidates[Math.floor(Math.random() * candidates.length)]
  if (random) themeStore.setTheme(random.id)
}

function setDensity(mode: 'compact' | 'comfortable') {
  themeStore.setDensity(mode)
}

function setMotion(mode: 'low' | 'medium' | 'high') {
  themeStore.setMotion(mode)
}

function setFontMode(mode: 'auto' | 'balanced' | 'readable') {
  themeStore.setFontMode(mode)
}

function getThemeName(theme: { name: string; nameZh: string }): string {
  return locale.value === 'zh-CN' ? theme.nameZh : theme.name
}

function getStyleLabel(themeId: string) {
  const kind = styleMap[themeId] || 'tech'
  if (kind === 'minimal') return t('theme.styleMinimal')
  if (kind === 'neon') return t('theme.styleNeon')
  return t('theme.styleTech')
}

function getThemePreviewStyle(themeId: string) {
  const theme = themeStore.getThemeById(themeId)
  if (!theme) return {}
  return {
    background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.backgroundSecondary} 100%)`,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  }
}
</script>

<template>
  <NPopover trigger="click" placement="top-end" :width="360">
    <template #trigger>
      <button class="theme-switcher" :title="getThemeName(currentTheme)">
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
        <span class="theme-name">{{ getThemeName(currentTheme) }}</span>
      </button>
    </template>

    <div class="theme-panel">
      <div class="theme-header">
        <div>
          <div class="header-title">{{ t('theme.title') }}</div>
          <div class="header-subtitle">{{ t('theme.subtitle') }}</div>
        </div>
        <NButton size="tiny" secondary @click="setRandomTheme">{{ t('theme.random') }}</NButton>
      </div>

      <div class="theme-filters">
        <button class="filter-btn" :class="{ active: filterMode === 'pro' }" @click="filterMode = 'pro'">{{ t('theme.featured') }}</button>
        <button class="filter-btn" :class="{ active: filterMode === 'all' }" @click="filterMode = 'all'">{{ t('theme.all') }}</button>
        <button class="filter-btn" :class="{ active: filterMode === 'dark' }" @click="filterMode = 'dark'">{{ t('theme.dark') }}</button>
        <button class="filter-btn" :class="{ active: filterMode === 'light' }" @click="filterMode = 'light'">{{ t('theme.light') }}</button>
      </div>

      <div class="style-filters">
        <button class="style-btn" :class="{ active: styleGroup === 'all' }" @click="styleGroup = 'all'">{{ t('theme.styleAll') }}</button>
        <button class="style-btn" :class="{ active: styleGroup === 'minimal' }" @click="styleGroup = 'minimal'">{{ t('theme.styleMinimal') }}</button>
        <button class="style-btn" :class="{ active: styleGroup === 'tech' }" @click="styleGroup = 'tech'">{{ t('theme.styleTech') }}</button>
        <button class="style-btn" :class="{ active: styleGroup === 'neon' }" @click="styleGroup = 'neon'">{{ t('theme.styleNeon') }}</button>
      </div>

      <div class="ux-controls">
        <div class="ux-row">
          <span class="ux-label">{{ t('theme.density') }}</span>
          <div class="ux-actions">
            <button class="ux-btn" :class="{ active: themeStore.densityMode === 'compact' }" @click="setDensity('compact')">{{ t('theme.compact') }}</button>
            <button class="ux-btn" :class="{ active: themeStore.densityMode === 'comfortable' }" @click="setDensity('comfortable')">{{ t('theme.comfortable') }}</button>
          </div>
        </div>
        <div class="ux-row">
          <span class="ux-label">{{ t('theme.motion') }}</span>
          <div class="ux-actions">
            <button class="ux-btn" :class="{ active: themeStore.motionMode === 'low' }" @click="setMotion('low')">{{ t('theme.low') }}</button>
            <button class="ux-btn" :class="{ active: themeStore.motionMode === 'medium' }" @click="setMotion('medium')">{{ t('theme.medium') }}</button>
            <button class="ux-btn" :class="{ active: themeStore.motionMode === 'high' }" @click="setMotion('high')">{{ t('theme.high') }}</button>
          </div>
        </div>
        <div class="ux-row">
          <span class="ux-label">{{ t('theme.font') }}</span>
          <div class="ux-actions">
            <button class="ux-btn" :class="{ active: themeStore.fontMode === 'auto' }" @click="setFontMode('auto')">{{ t('theme.fontAuto') }}</button>
            <button class="ux-btn" :class="{ active: themeStore.fontMode === 'balanced' }" @click="setFontMode('balanced')">{{ t('theme.fontBalanced') }}</button>
            <button class="ux-btn" :class="{ active: themeStore.fontMode === 'readable' }" @click="setFontMode('readable')">{{ t('theme.fontReadable') }}</button>
          </div>
        </div>
      </div>

      <div class="theme-grid">
        <button
          v-for="theme in filteredThemes"
          :key="theme.id"
          class="theme-card"
          :class="{ active: theme.id === currentTheme.id }"
          @click="handleThemeChange(theme.id)"
        >
          <div class="theme-preview" :style="getThemePreviewStyle(theme.id)">
            <div class="preview-glow" :style="{ background: `radial-gradient(circle at top right, ${theme.colors.primary}66, transparent 65%)` }"></div>
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
            <div class="theme-name-row">
              <span class="theme-name">{{ getThemeName(theme) }}</span>
              <NTag size="tiny" :type="theme.isDark ? 'info' : 'default'" round>
                {{ theme.isDark ? t('theme.dark') : t('theme.light') }}
              </NTag>
            </div>
            <div class="theme-tags">
              <NTag size="tiny" round>{{ getStyleLabel(theme.id) }}</NTag>
            </div>
            <span class="theme-desc">{{ theme.description }}</span>
          </div>
        </button>
      </div>
    </div>
  </NPopover>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.theme-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
  border-radius: 10px;
  color: $text-secondary;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: color-mix(in srgb, var(--theme-primary, #667eea) 45%, transparent);
    color: $text-primary;
  }

  .theme-name {
    font-size: 12px;
    font-weight: 500;
    max-width: 82px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.theme-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 72vh;
}

.theme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  .header-title {
    font-size: 14px;
    font-weight: 700;
    color: $text-primary;
  }

  .header-subtitle {
    font-size: 11px;
    color: $text-muted;
  }
}

.theme-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.style-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.filter-btn {
  border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
  background: rgba(255, 255, 255, 0.03);
  color: $text-muted;
  border-radius: 8px;
  padding: 5px 0;
  font-size: 11px;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
  }

  &.active {
    border-color: color-mix(in srgb, var(--theme-primary, #667eea) 65%, transparent);
    color: var(--theme-primary, #667eea);
    background: color-mix(in srgb, var(--theme-primary, #667eea) 12%, transparent);
    font-weight: 600;
  }
}

.style-btn {
  border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
  background: rgba(255, 255, 255, 0.02);
  color: $text-muted;
  border-radius: 8px;
  padding: 5px 0;
  font-size: 10px;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
  }

  &.active {
    border-color: color-mix(in srgb, var(--theme-primary, #667eea) 50%, transparent);
    color: var(--theme-primary, #667eea);
    background: color-mix(in srgb, var(--theme-primary, #667eea) 10%, transparent);
  }
}

.ux-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  border: 1px dashed var(--theme-border, rgba(255, 255, 255, 0.15));
  background: rgba(255, 255, 255, 0.03);
}

.ux-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.ux-label {
  font-size: 11px;
  color: $text-muted;
  font-weight: 600;
}

.ux-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ux-btn {
  border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
  background: rgba(255, 255, 255, 0.02);
  color: $text-muted;
  border-radius: 8px;
  padding: 3px 7px;
  font-size: 10px;
  cursor: pointer;
  transition: all $transition-fast;

  &.active {
    border-color: color-mix(in srgb, var(--theme-primary, #667eea) 60%, transparent);
    color: var(--theme-primary, #667eea);
    background: color-mix(in srgb, var(--theme-primary, #667eea) 14%, transparent);
  }
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  overflow-y: auto;
  padding-right: 2px;
}

.theme-card {
  text-align: left;
  border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--theme-primary, #667eea) 45%, transparent);
    background: rgba(255, 255, 255, 0.06);
  }

  &.active {
    border-color: var(--theme-primary, #667eea);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary, #667eea) 28%, transparent);
  }
}

.theme-preview {
  position: relative;
  overflow: hidden;
  height: 62px;
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 8px;
}

.preview-glow {
  position: absolute;
  inset: 0;
  opacity: 0.9;
}

.preview-header,
.preview-body {
  position: relative;
  z-index: 1;
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
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.preview-line {
  height: 4px;
  border-radius: 99px;
  opacity: 0.9;

  &.short {
    width: 62%;
  }
}

.theme-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.theme-tags {
  margin-top: 4px;
  display: flex;
  gap: 4px;
}

.theme-info {
  .theme-name {
    font-size: 12px;
    font-weight: 600;
    color: $text-primary;
  }

  .theme-desc {
    margin-top: 2px;
    display: block;
    font-size: 10px;
    color: $text-muted;
    line-height: 1.35;
  }
}
</style>

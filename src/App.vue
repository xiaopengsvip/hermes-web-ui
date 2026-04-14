<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider } from 'naive-ui'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import { useAppStore } from '@/stores/app'
import { useThemeStore } from '@/stores/theme'

const appStore = useAppStore()
const themeStore = useThemeStore()

const themeOverrides = computed(() => themeStore.currentTheme.naiveOverrides)

onMounted(() => {
  themeStore.initTheme()
  appStore.loadModels()
  appStore.startHealthPolling()
})

onUnmounted(() => {
  appStore.stopHealthPolling()
})

useKeyboard()
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <div class="app-layout">
            <AppSidebar />
            <main class="app-main">
              <div class="view-shell">
                <router-view />
              </div>
            </main>
          </div>
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-main {
  --layout-header-min-height: var(--layout-header-min-height, 56px);
  --layout-header-padding-y: var(--layout-header-padding-y, 12px);
  --layout-header-padding-x: var(--layout-header-padding-x, 16px);
  --layout-header-radius: var(--layout-header-radius, 14px);

  flex: 1;
  overflow: hidden;
  padding: calc(12px * var(--ui-density-padding, 1));
  background:
    radial-gradient(circle at 8% 2%, rgba(var(--theme-primary-rgb, 102, 126, 234), 0.13), transparent 32%),
    radial-gradient(circle at 100% 100%, rgba(var(--theme-primary-rgb, 102, 126, 234), 0.1), transparent 35%),
    var(--theme-background, $bg-primary);
  color: var(--theme-text, $text-primary);
}

.view-shell {
  height: 100%;
  border-radius: calc(18px * var(--ui-density-gap, 1));
  border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 92%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-background-secondary, #12121a) 88%, transparent),
    color-mix(in srgb, var(--theme-background, #0a0a0f) 95%, transparent)
  );
  box-shadow:
    0 24px 54px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 color-mix(in srgb, var(--theme-text, #fff) 12%, transparent);
  overflow: hidden;
  transition: border-radius var(--ui-motion-normal) ease, box-shadow var(--ui-motion-normal) ease;
}

.view-shell > * {
  height: 100%;
}

.app-main :is(
  .page-header,
  .chat-header,
  .terminal-header,
  .settings-header,
  .logs-header,
  .reports-header,
  .memory-header,
  .services-header,
  .github-header,
  .vercel-header,
  .cloudflare-header,
  .audit-header,
  .jobs-header,
  .skills-header,
  .materials-header
) {
  min-height: var(--layout-header-min-height, 56px);
  padding: var(--layout-header-padding-y, 12px) var(--layout-header-padding-x, 16px) !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  backdrop-filter: blur(10px);
  border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 80%, transparent);
  border-radius: var(--layout-header-radius, 14px);
  background: color-mix(in srgb, var(--theme-card, rgba(255,255,255,.08)) 86%, transparent);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);
}

.app-main :is(.page-header, .chat-header, .terminal-header, .settings-header) :is(h1, h2, .header-title) {
  margin: 0;
}

.app-main .n-card {
  border-radius: 14px;
}

@media (max-width: 768px) {
  .app-main {
    --layout-header-min-height: 52px;
    --layout-header-padding-y: 10px;
    --layout-header-padding-x: 12px;

    padding: 8px;
  }

  .view-shell {
    border-radius: 14px;
  }
}
</style>

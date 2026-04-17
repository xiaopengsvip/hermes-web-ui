<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider } from 'naive-ui'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import RouteMetaHeader from '@/components/layout/RouteMetaHeader.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import { useAppStore } from '@/stores/app'
import { useThemeStore } from '@/stores/theme'

const appStore = useAppStore()
const themeStore = useThemeStore()

const themeOverrides = computed(() => themeStore.currentTheme.naiveOverrides)
const mobileMenuOpen = ref(false)

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMobileMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
  themeStore.initTheme()
  appStore.loadModels()
  appStore.startHealthPolling()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  appStore.stopHealthPolling()
})

useKeyboard()
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <div class="app-layout" :class="{ 'mobile-menu-open': mobileMenuOpen }">
            <button class="mobile-menu-toggle" type="button" @click="mobileMenuOpen = true" aria-label="Open menu">
              <span></span>
              <span></span>
              <span></span>
            </button>
            <button v-if="mobileMenuOpen" class="mobile-sidebar-backdrop" type="button" @click="closeMobileMenu" aria-label="Close menu overlay"></button>
            <AppSidebar :mobile-open="mobileMenuOpen" @close-mobile="closeMobileMenu" />
            <main class="app-main">
              <div class="view-shell">
                <div class="route-shell">
                  <RouteMetaHeader />
                  <div class="route-content">
                    <router-view />
                  </div>
                </div>
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
  position: relative;
}

.mobile-menu-toggle {
  display: none;
}

.mobile-sidebar-backdrop {
  display: none;
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

.route-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.route-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 8px 8px 10px;
}

.route-content > * {
  height: 100%;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
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

.app-main {
  --page-content-max-width: 1120px;
  --page-content-padding-y: 20px;
  --page-content-padding-x: 16px;
  --panel-radius: 14px;
  --panel-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
}

.app-main :is(.services-scroll, .github-content, .vercel-content, .cloudflare-content, .settings-scroll) {
  padding: var(--page-content-padding-y) var(--page-content-padding-x) !important;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-main :is(.services-scroll, .github-content, .vercel-content, .cloudflare-content, .settings-scroll) > * {
  width: min(var(--page-content-max-width), 100%);
}

.app-main :is(.header-actions, .section-actions, .action-bar) {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.app-main :is(.header-actions, .section-actions, .action-bar) :is(.n-button, button) {
  min-height: 30px;
}

.app-main :is(.section, .tab-content, .repo-card, .project-card, .zone-card, .worker-card, .service-card) {
  border-radius: var(--panel-radius);
  box-shadow: var(--panel-shadow);
  border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 78%, transparent);
  background: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 92%, transparent);
}

.app-main :is(.n-tabs-tab, .n-button, .n-input, .n-base-selection, .n-card) {
  transition:
    border-color var(--ui-motion-fast) ease,
    background-color var(--ui-motion-fast) ease,
    color var(--ui-motion-fast) ease,
    box-shadow var(--ui-motion-fast) ease;
}

.app-main :is(.n-card, .n-modal, .n-popover) {
  border-color: color-mix(in srgb, var(--theme-border, #fff) 82%, transparent);
}

@media (max-width: 900px) {
  .mobile-menu-toggle {
    position: fixed;
    top: 18px;
    left: 14px;
    z-index: 260;
    width: 38px;
    height: 38px;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 76%, transparent);
    background: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.12)) 90%, transparent);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    cursor: pointer;
  }

  .mobile-menu-toggle span {
    width: 16px;
    height: 2px;
    border-radius: 999px;
    background: var(--theme-text, #fff);
  }

  .mobile-menu-open .mobile-menu-toggle {
    opacity: 0;
    pointer-events: none;
  }

  .mobile-sidebar-backdrop {
    position: fixed;
    inset: 0;
    display: block;
    z-index: 230;
    border: 0;
    margin: 0;
    padding: 0;
    background: rgba(2, 6, 23, 0.56);
    backdrop-filter: blur(2px);
  }

  .app-main {
    padding: 8px;
  }

  .route-shell {
    padding-top: 44px;
  }

  .route-content {
    padding: 6px 6px 8px;
  }
}

@media (max-width: 768px) {
  .app-main {
    --layout-header-min-height: 52px;
    --layout-header-padding-y: 10px;
    --layout-header-padding-x: 12px;
    --page-content-padding-y: 14px;
    --page-content-padding-x: 10px;

    padding: 8px;
  }

  .view-shell {
    border-radius: 14px;
  }

  .route-shell {
    padding-top: 40px;
  }

  .route-content {
    padding: 4px 4px 6px;
  }

  .route-content > * {
    border-radius: 10px;
  }

  .app-main :is(.header-actions, .section-actions, .action-bar) {
    width: 100%;
  }
}
</style>

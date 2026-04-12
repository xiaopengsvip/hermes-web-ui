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
              <router-view />
            </main>
          </div>
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow: hidden;
  background-color: var(--theme-background, $bg-primary);
  color: var(--theme-text, $text-primary);
}
</style>

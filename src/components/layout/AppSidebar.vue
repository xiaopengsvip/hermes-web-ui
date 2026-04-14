<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import ModelSelector from './ModelSelector.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const collapsed = ref(false)

const selectedKey = computed(() => route.name as string)

function handleNav(key: string) {
  router.push({ name: key })
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

defineExpose({ collapsed })
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="sidebar-logo" @click="router.push('/')">
        <img src="/assets/logo.png" alt="Hermes" class="logo-img" />
        <span v-if="!collapsed" class="logo-text">{{ t('sidebar.logo') }}</span>
      </div>
      <button class="collapse-btn" @click="toggleCollapse" :title="collapsed ? 'Expand' : 'Collapse'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="collapsed">
            <polyline points="9 18 15 12 9 6" />
          </template>
          <template v-else>
            <polyline points="15 18 9 12 15 6" />
          </template>
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      <button
        class="nav-item"
        :class="{ active: selectedKey === 'chat' }"
        @click="handleNav('chat')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{{ t('sidebar.chat') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'jobs' }"
        @click="handleNav('jobs')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{{ t('sidebar.jobs') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'terminal' }"
        @click="handleNav('terminal')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span>{{ t('sidebar.terminal') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'materials' }"
        @click="handleNav('materials')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>{{ t('sidebar.materials') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'audit' }"
        @click="handleNav('audit')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>{{ t('sidebar.audit') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'reports' }"
        @click="handleNav('reports')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>{{ t('sidebar.reports') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'skills' }"
        @click="handleNav('skills')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span>{{ t('sidebar.skills') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'memory' }"
        @click="handleNav('memory')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
        <span>{{ t('sidebar.memory') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'logs' }"
        @click="handleNav('logs')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>{{ t('sidebar.logs') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'github' }"
        @click="handleNav('github')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
        </svg>
        <span>{{ t('sidebar.github') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'vercel' }"
        @click="handleNav('vercel')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 19h20L12 2z"/>
        </svg>
        <span>{{ t('sidebar.vercel') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'cloudflare' }"
        @click="handleNav('cloudflare')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          <path d="M8 12l2-4 2 4-2 4-2-4z"/>
          <path d="M14 8l2 4-2 4"/>
        </svg>
        <span>{{ t('sidebar.cloudflare') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'services' }"
        @click="handleNav('services')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
        <span>{{ t('sidebar.services') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'version' }"
        @click="handleNav('version')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{{ t('sidebar.version') }}</span>
      </button>
    </nav>

    <ModelSelector v-if="!collapsed" />

    <div class="sidebar-footer">
      <div class="status-row">
        <div class="status-indicator" :class="{ connected: appStore.connected, disconnected: !appStore.connected }">
          <span class="status-dot"></span>
          <span v-if="!collapsed" class="status-text">{{ appStore.connected ? t('sidebar.connected') : t('sidebar.disconnected') }}</span>
        </div>
      </div>
      <div v-if="!collapsed" class="switchers">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
      <div v-if="!collapsed" class="version-info">{{ t('sidebar.logo') }} {{ appStore.serverVersion || 'v0.1.0' }}</div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/liquid-glass' as *;
@use '@/styles/variables' as *;

.sidebar {
  width: $sidebar-width;
  height: 100vh;
  background-color: var(--theme-sidebar, $bg-sidebar);
  backdrop-filter: blur(var(--theme-blur, $blur-md));
  -webkit-backdrop-filter: blur(var(--theme-blur, $blur-md));
  border-right: 1px solid var(--theme-border, $border-color);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  flex-shrink: 0;
  transition: all $transition-normal;

  &.collapsed {
    width: 60px;
    padding: 20px 8px;

    .sidebar-logo {
      justify-content: center;
      padding: 4px 0 20px;
    }

    .nav-item {
      justify-content: center;
      padding: 10px;
    }

    .status-row {
      justify-content: center;
      padding: 8px 0;
    }

    .collapse-btn {
      margin: 0;
    }
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--theme-text-secondary, $text-secondary);
  cursor: pointer;
  border-radius: $radius-sm;
  transition: all $transition-fast;
  flex-shrink: 0;

  &:hover {
    background: var(--theme-hover, rgba(var(--theme-primary-rgb, 102, 126, 234), 0.06));
    color: var(--theme-text, $text-primary);
  }
}

.logo-img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 20px;
  color: var(--theme-text, $text-primary);
  cursor: pointer;

  .logo-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: none;
  color: var(--theme-text-secondary, $text-secondary);
  font-size: 14px;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;
  width: 100%;
  text-align: left;

  &:hover {
    background-color: var(--theme-hover, rgba(var(--theme-primary-rgb, 102, 126, 234), 0.06));
    color: var(--theme-text, $text-primary);
  }

  &.active {
    background-color: var(--theme-active, rgba(var(--theme-primary-rgb, 102, 126, 234), 0.12));
    color: var(--theme-primary, $accent-primary);
  }
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--theme-border, $border-color);
}

.switchers {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &.connected .status-dot {
    background-color: var(--theme-success, $success);
    box-shadow: 0 0 6px var(--theme-success-glow, rgba(79, 172, 254, 0.5));
  }

  &.disconnected .status-dot {
    background-color: var(--theme-error, $error);
  }

  .status-text {
    color: var(--theme-text-secondary, $text-secondary);
  }
}

.version-info {
  padding: 2px 12px 8px;
  font-size: 11px;
  color: var(--theme-text-muted, $text-muted);
}
</style>

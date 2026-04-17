<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import ModelSelector from './ModelSelector.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'

const props = withDefaults(defineProps<{ mobileOpen?: boolean }>(), {
  mobileOpen: false,
})

const emit = defineEmits<{
  (event: 'close-mobile'): void
}>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const collapsed = ref(false)

const selectedKey = computed(() => route.name as string)

function handleNav(key: string) {
  router.push({ name: key })
  emit('close-mobile')
}

function toggleCollapse() {
  if (props.mobileOpen) {
    emit('close-mobile')
    return
  }
  collapsed.value = !collapsed.value
}

defineExpose({ collapsed })
</script>

<template>
  <aside class="sidebar" :class="{ collapsed, 'mobile-open': props.mobileOpen }">
    <div class="sidebar-header">
      <div class="sidebar-logo" @click="handleNav('chat')">
        <img src="/everettlogo.jpg" :alt="t('sidebar.logo')" class="logo-img" />
        <span v-if="!collapsed" class="logo-text">{{ t('sidebar.logo') }}</span>
      </div>
      <button class="collapse-btn" @click="toggleCollapse" :title="collapsed ? t('sidebar.expand') : t('sidebar.collapse')">
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
        :class="{ active: selectedKey === 'projectCenter' }"
        @click="handleNav('projectCenter')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="2" ry="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" ry="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" ry="2" />
          <path d="M13 17h8" />
          <path d="M17 13v8" />
        </svg>
        <span>{{ t('sidebar.projectCenter') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'configCenter' }"
        @click="handleNav('configCenter')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
        <span>{{ t('sidebar.configCenter') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'insights' }"
        @click="handleNav('insights')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 17 9 11 13 15 21 7" />
          <polyline points="14 7 21 7 21 14" />
        </svg>
        <span>{{ t('sidebar.insights') }}</span>
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
      <button
        class="nav-item footer-auth-btn"
        :class="{ active: selectedKey === 'settings' }"
        @click="handleNav('settings')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>{{ t('sidebar.authSwitch') }}</span>
      </button>

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
      <div v-if="!collapsed" class="version-info">{{ t('sidebar.logo') }} v1</div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/liquid-glass' as *;
@use '@/styles/variables' as *;

.sidebar {
  --sb-accent-rgb: var(--theme-primary-rgb, 102, 126, 234);
  --sb-border: color-mix(in srgb, var(--theme-border, rgba(255, 255, 255, 0.15)) 84%, transparent);

  width: 224px;
  height: 100vh;
  background:
    radial-gradient(circle at 10% 0%, rgba(var(--sb-accent-rgb), 0.16), transparent 35%),
    radial-gradient(circle at 100% 20%, rgba(var(--sb-accent-rgb), 0.1), transparent 32%),
    var(--theme-sidebar, $bg-sidebar);
  backdrop-filter: blur(var(--theme-blur, $blur-md));
  -webkit-backdrop-filter: blur(var(--theme-blur, $blur-md));
  border-right: 1px solid var(--sb-border);
  display: flex;
  flex-direction: column;
  padding: 14px 10px;
  flex-shrink: 0;
  overflow: hidden;
  transition:
    width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    border-color $transition-normal,
    background-color $transition-normal;

  &.collapsed {
    width: 68px;
    padding: 14px 8px;

    .sidebar-header {
      justify-content: center;
      gap: 6px;
    }

    .sidebar-logo {
      justify-content: center;
      padding: 4px 0 12px;
    }

    .nav-item {
      justify-content: center;
      min-height: 40px;
      padding: 0;
      border-radius: 12px;

      span {
        display: none;
      }

      &:hover {
        transform: none;
      }
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
  gap: 8px;
  min-height: 32px;
  margin-bottom: 2px;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 74%, transparent);
  color: var(--theme-text-secondary, $text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all $transition-fast;
  flex-shrink: 0;

  &:hover {
    background: rgba(var(--sb-accent-rgb), 0.24);
    color: var(--theme-text, $text-primary);
  }
}

.logo-img {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  flex-shrink: 0;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--theme-border, #fff) 70%, transparent),
    0 0 18px rgba(var(--sb-accent-rgb), 0.34);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 20px;
  color: var(--theme-text, $text-primary);
  cursor: pointer;

  .logo-text {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.4px;
  }
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  overflow-y: auto;
  padding-right: 2px;
}

.nav-item {
  --nav-accent: rgba(var(--sb-accent-rgb), 0.82);
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid transparent;
  background: transparent;
  color: color-mix(in srgb, var(--theme-text-secondary, #c6d4e8) 92%, transparent);
  font-size: 13px;
  border-radius: 11px;
  cursor: pointer;
  transition: all $transition-fast;
  width: 100%;
  text-align: left;

  svg {
    width: 16px;
    height: 16px;
    color: currentColor;
    stroke: currentColor;
    stroke-width: 1.75;
    flex-shrink: 0;
    transition: color $transition-fast, filter $transition-fast;
  }

  &:hover {
    background: rgba(var(--sb-accent-rgb), 0.1);
    border-color: rgba(var(--sb-accent-rgb), 0.32);
    color: var(--theme-text, #e4f0ff);
    transform: translateX(2px);

    svg {
      filter: drop-shadow(0 0 6px rgba(var(--sb-accent-rgb), 0.28));
    }
  }

  &:focus-visible {
    outline: none;
    border-color: rgba(var(--sb-accent-rgb), 0.65);
    box-shadow: 0 0 0 2px rgba(var(--sb-accent-rgb), 0.2);
  }

  &.active {
    background: linear-gradient(120deg, rgba(var(--sb-accent-rgb), 0.2), rgba(var(--sb-accent-rgb), 0.1));
    border-color: rgba(var(--sb-accent-rgb), 0.48);
    color: color-mix(in srgb, var(--theme-primary, #7dd3ff) 86%, #ffffff 14%);
    box-shadow:
      inset 0 0 0 1px rgba(var(--sb-accent-rgb), 0.2),
      0 6px 16px rgba(24, 76, 128, 0.16);

    svg {
      filter: drop-shadow(0 0 8px rgba(var(--sb-accent-rgb), 0.36));
    }
  }
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--theme-border, $border-color);
}

.footer-auth-btn {
  margin-bottom: 6px;
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

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(82vw, 320px);
    max-width: 320px;
    z-index: 240;
    transform: translateX(-108%);
    transition: transform 0.24s ease;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);

    &.mobile-open {
      transform: translateX(0);
    }

    &.collapsed {
      width: min(82vw, 320px);
      padding: 14px 10px;

      .sidebar-header {
        justify-content: space-between;
      }

      .sidebar-logo {
        justify-content: flex-start;
        padding: 4px 12px 20px;
      }

      .nav-item {
        justify-content: flex-start;
        padding: 8px 10px;

        span {
          display: inline;
        }
      }

      .status-row {
        justify-content: space-between;
        padding: 8px 12px;
      }
    }
  }
}
</style>

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
  width: $sidebar-width;
  height: 100vh;
  background:
    radial-gradient(circle at 10% 0%, rgba(88, 124, 255, 0.18), transparent 35%),
    radial-gradient(circle at 100% 20%, rgba(55, 200, 170, 0.12), transparent 32%),
    var(--theme-sidebar, $bg-sidebar);
  backdrop-filter: blur(var(--theme-blur, $blur-md));
  -webkit-backdrop-filter: blur(var(--theme-blur, $blur-md));
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  flex-shrink: 0;
  transition: all $transition-normal;

  &.collapsed {
    width: 68px;
    padding: 16px 8px;

    .sidebar-logo {
      justify-content: center;
      padding: 4px 0 16px;
    }

    .nav-item {
      justify-content: center;
      padding: 10px 8px;

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
  margin-bottom: 0;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: var(--theme-text-secondary, $text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all $transition-fast;
  flex-shrink: 0;

  &:hover {
    background: linear-gradient(135deg, rgba(96, 129, 255, 0.24), rgba(92, 221, 195, 0.2));
    color: var(--theme-text, $text-primary);
  }
}

.logo-img {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  flex-shrink: 0;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.2),
    0 0 18px rgba(134, 59, 255, 0.38);
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
  gap: 6px;
  margin-top: 8px;
  overflow-y: auto;
  padding-right: 2px;
}

.nav-item {
  --nav-accent: #7c8dff;
  --nav-accent-2: #4ecbff;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.02);
  color: var(--theme-text-secondary, $text-secondary);
  font-size: 13px;
  border-radius: 10px;
  cursor: pointer;
  transition: all $transition-fast;
  width: 100%;
  text-align: left;

  svg {
    width: 16px;
    height: 16px;
    padding: 5px;
    border-radius: 8px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--nav-accent) 78%, #ffffff 8%),
      color-mix(in srgb, var(--nav-accent-2) 82%, #ffffff 6%)
    );
    color: #ffffff;
    stroke: currentColor;
    box-shadow:
      0 8px 16px color-mix(in srgb, var(--nav-accent) 38%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.34);
    flex-shrink: 0;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: color-mix(in srgb, var(--nav-accent) 45%, transparent);
    color: var(--theme-text, $text-primary);
    transform: translateX(2px);
  }

  &.active {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--nav-accent) 24%, transparent),
      rgba(255, 255, 255, 0.03)
    );
    border-color: color-mix(in srgb, var(--nav-accent) 58%, transparent);
    color: var(--theme-text, $text-primary);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nav-accent) 24%, transparent);
  }
}

.sidebar-nav .nav-item:nth-child(1) { --nav-accent: #4f9dff; --nav-accent-2: #2ee6d6; }
.sidebar-nav .nav-item:nth-child(2) { --nav-accent: #8a5bff; --nav-accent-2: #d17dff; }
.sidebar-nav .nav-item:nth-child(3) { --nav-accent: #ff9f43; --nav-accent-2: #ffd166; }
.sidebar-nav .nav-item:nth-child(4) { --nav-accent: #2ecc71; --nav-accent-2: #00d2d3; }
.sidebar-nav .nav-item:nth-child(5) { --nav-accent: #ff6b81; --nav-accent-2: #ff8ec7; }
.sidebar-nav .nav-item:nth-child(6) { --nav-accent: #feca57; --nav-accent-2: #ff9ff3; }
.sidebar-nav .nav-item:nth-child(7) { --nav-accent: #1dd1a1; --nav-accent-2: #48dbfb; }
.sidebar-nav .nav-item:nth-child(8) { --nav-accent: #54a0ff; --nav-accent-2: #5f27cd; }
.sidebar-nav .nav-item:nth-child(9) { --nav-accent: #00d2d3; --nav-accent-2: #0984e3; }
.sidebar-nav .nav-item:nth-child(10) { --nav-accent: #576574; --nav-accent-2: #8395a7; }
.sidebar-nav .nav-item:nth-child(11) { --nav-accent: #24292f; --nav-accent-2: #6e7681; }
.sidebar-nav .nav-item:nth-child(12) { --nav-accent: #000000; --nav-accent-2: #555555; }
.sidebar-nav .nav-item:nth-child(13) { --nav-accent: #f38020; --nav-accent-2: #faae40; }
.sidebar-nav .nav-item:nth-child(14) { --nav-accent: #10ac84; --nav-accent-2: #2ed573; }
.sidebar-nav .nav-item:nth-child(15) { --nav-accent: #8395a7; --nav-accent-2: #c8d6e5; }

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
</style>

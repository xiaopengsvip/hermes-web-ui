<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NCard, NInput, NSpace, NTag, useMessage } from 'naive-ui'
import {
  fetchTunnels,
  restartTunnel,
  startTunnel,
  stopTunnel,
  type TunnelName,
  type TunnelStatus,
} from '@/api/hermes/tunnels'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const actionLoading = ref<string>('')
const tunnelMap = ref<Record<TunnelName, TunnelStatus> | null>(null)
const targetForm = reactive<Record<TunnelName, string>>({
  frontend: '',
  backend: '',
})

let pollTimer: ReturnType<typeof setInterval> | null = null

const tunnelCards = computed(() => {
  const tunnels = tunnelMap.value
  if (!tunnels) return []

  return [
    {
      key: 'frontend' as TunnelName,
      title: t('tunnels.frontendTitle'),
      description: t('tunnels.frontendDescription'),
      status: tunnels.frontend,
    },
    {
      key: 'backend' as TunnelName,
      title: t('tunnels.backendTitle'),
      description: t('tunnels.backendDescription'),
      status: tunnels.backend,
    },
  ]
})

async function loadTunnels() {
  loading.value = true
  try {
    const tunnels = await fetchTunnels()
    tunnelMap.value = tunnels
    targetForm.frontend = tunnels.frontend?.target_url || ''
    targetForm.backend = tunnels.backend?.target_url || ''
  } catch (error: any) {
    message.error(error?.message || t('tunnels.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function refreshOnly() {
  try {
    const tunnels = await fetchTunnels()
    tunnelMap.value = tunnels
  } catch {
    // keep silent during polling
  }
}

async function handleStart(name: TunnelName) {
  actionLoading.value = `${name}-start`
  try {
    const next = await startTunnel(name, targetForm[name] || undefined)
    tunnelMap.value = {
      ...(tunnelMap.value || ({} as Record<TunnelName, TunnelStatus>)),
      [name]: next,
    }
    message.success(t('tunnels.startSuccess'))
    await refreshOnly()
  } catch (error: any) {
    message.error(error?.message || t('tunnels.startFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function handleStop(name: TunnelName) {
  actionLoading.value = `${name}-stop`
  try {
    const next = await stopTunnel(name)
    tunnelMap.value = {
      ...(tunnelMap.value || ({} as Record<TunnelName, TunnelStatus>)),
      [name]: next,
    }
    message.success(t('tunnels.stopSuccess'))
  } catch (error: any) {
    message.error(error?.message || t('tunnels.stopFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function handleRestart(name: TunnelName) {
  actionLoading.value = `${name}-restart`
  try {
    const next = await restartTunnel(name, targetForm[name] || undefined)
    tunnelMap.value = {
      ...(tunnelMap.value || ({} as Record<TunnelName, TunnelStatus>)),
      [name]: next,
    }
    message.success(t('tunnels.restartSuccess'))
    await refreshOnly()
  } catch (error: any) {
    message.error(error?.message || t('tunnels.restartFailed'))
  } finally {
    actionLoading.value = ''
  }
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    message.success(t('common.copied'))
  } catch {
    message.error(t('tunnels.copyFailed'))
  }
}

onMounted(async () => {
  await loadTunnels()
  pollTimer = setInterval(() => {
    void refreshOnly()
  }, 5000)
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="tunnels-view">
    <header class="page-header">
      <h2 class="header-title">{{ t('tunnels.title') }}</h2>
      <p class="header-subtitle">{{ t('tunnels.subtitle') }}</p>
    </header>

    <div class="tunnels-content" v-if="tunnelMap">
      <NAlert type="info" :show-icon="false" class="tip-alert">
        {{ t('tunnels.tip') }}
      </NAlert>

      <div class="tunnel-grid">
        <NCard v-for="item in tunnelCards" :key="item.key" class="tunnel-card" size="small">
          <template #header>
            <div class="card-header">
              <div>
                <div class="card-title">{{ item.title }}</div>
                <div class="card-desc">{{ item.description }}</div>
              </div>
              <NTag :type="item.status.running ? 'success' : 'default'" round>
                {{ item.status.running ? t('tunnels.running') : t('tunnels.stopped') }}
              </NTag>
            </div>
          </template>

          <div class="field-row">
            <div class="field-label">{{ t('tunnels.targetUrl') }}</div>
            <NInput
              v-model:value="targetForm[item.key]"
              :disabled="item.status.running"
              :placeholder="t('tunnels.targetPlaceholder')"
            />
          </div>

          <div class="field-row">
            <div class="field-label">{{ t('tunnels.publicUrl') }}</div>
            <div v-if="item.status.public_url" class="public-url-row">
              <a :href="item.status.public_url" target="_blank" rel="noopener noreferrer">{{ item.status.public_url }}</a>
              <NButton text @click="copyUrl(item.status.public_url)">{{ t('common.copy') }}</NButton>
            </div>
            <div v-else class="empty-url">{{ t('tunnels.noPublicUrl') }}</div>
          </div>

          <div v-if="item.status.error" class="field-row">
            <NAlert type="error" :show-icon="false">{{ item.status.error }}</NAlert>
          </div>

          <NSpace>
            <NButton
              v-if="!item.status.running"
              type="primary"
              :loading="actionLoading === `${item.key}-start`"
              @click="handleStart(item.key)"
            >
              {{ t('common.start') }}
            </NButton>
            <NButton
              v-if="item.status.running"
              type="warning"
              :loading="actionLoading === `${item.key}-stop`"
              @click="handleStop(item.key)"
            >
              {{ t('common.stop') }}
            </NButton>
            <NButton
              tertiary
              :loading="actionLoading === `${item.key}-restart`"
              @click="handleRestart(item.key)"
            >
              {{ t('tunnels.restart') }}
            </NButton>
          </NSpace>
        </NCard>
      </div>
    </div>

    <div v-else class="loading-wrap">
      <span>{{ loading ? t('common.loading') : t('common.noData') }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.tunnels-view {
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.header-subtitle {
  margin-top: 6px;
  color: $text-muted;
  font-size: 13px;
}

.tunnels-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tip-alert {
  margin-bottom: 16px;
}

.tunnel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.tunnel-card {
  border-radius: $radius-md;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
}

.card-desc {
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
}

.field-row {
  margin-bottom: 12px;
}

.field-label {
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 6px;
}

.public-url-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  a {
    color: $accent-primary;
    word-break: break-all;
  }
}

.empty-url {
  font-size: 12px;
  color: $text-muted;
}

.loading-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;
}
</style>

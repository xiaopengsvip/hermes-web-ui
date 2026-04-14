<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  NButton, NSwitch, NSlider, NDataTable, NSelect, NTag, useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { fetchAuthCredentials, fetchAuthStream, switchAuthCredential, type AuthProviderCredentials, type AuthStreamEvent } from '@/api/auth'

const { t } = useI18n()
const appStore = useAppStore()
const message = useMessage()

const testingConnection = ref(false)
const switchingAccount = ref(false)
const authProviders = ref<AuthProviderCredentials[]>([])
const selectedProvider = ref('')
const authStream = ref<AuthStreamEvent[]>([])
const streamLoading = ref(false)
let streamTimer: ReturnType<typeof setInterval> | null = null

const providerOptions = computed(() => authProviders.value.map(p => ({
  label: p.provider,
  value: p.provider,
})))

const currentProviderAccounts = computed(() => authProviders.value.find(p => p.provider === selectedProvider.value)?.entries || [])
const currentActiveAccount = computed(() => currentProviderAccounts.value.find(e => e.index === 1) || null)

function prettyTime(iso?: string | null) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function loadAuthStream() {
  streamLoading.value = true
  try {
    const data = await fetchAuthStream()
    authStream.value = data.events || []
  } catch {
    // silent for polling, keep last known stream
  } finally {
    streamLoading.value = false
  }
}

async function loadAuthAccounts() {
  try {
    const data = await fetchAuthCredentials()
    authProviders.value = data.providers || []
    if (!selectedProvider.value && authProviders.value.length > 0) {
      selectedProvider.value = authProviders.value[0].provider
    }
  } catch (e: any) {
    message.error(e.message || t('settings.authLoadFailed'))
  }
}

async function handleSwitchAccount(index: number) {
  if (!selectedProvider.value) return
  switchingAccount.value = true
  try {
    const resp = await switchAuthCredential(selectedProvider.value, index)
    if (resp?.success) {
      message.success(t('settings.authSwitchSuccess'))
      await loadAuthAccounts()
      await loadAuthStream()
      await appStore.loadModels()
    } else {
      message.error(resp?.error || t('settings.authSwitchFailed'))
    }
  } catch (e: any) {
    message.error(e.message || t('settings.authSwitchFailed'))
  } finally {
    switchingAccount.value = false
  }
}

async function handleTestConnection() {
  testingConnection.value = true
  try {
    await appStore.checkConnection()
    if (appStore.connected) {
      message.success(t('settings.connected'))
    } else {
      message.error(t('settings.connectionFailed'))
    }
  } catch (e: any) {
    message.error(e.message)
  } finally {
    testingConnection.value = false
  }
}

const MODEL_PREVIEW_LIMIT = 6
const modelExpandedMap = ref<Record<string, boolean>>({})

function modelGroupKey(group: { provider: string; label: string; base_url?: string }) {
  return `${group.provider}::${group.base_url || group.label}`
}

function isExpanded(group: { provider: string; label: string; base_url?: string }) {
  return Boolean(modelExpandedMap.value[modelGroupKey(group)])
}

function toggleModels(group: { provider: string; label: string; base_url?: string }) {
  const key = modelGroupKey(group)
  modelExpandedMap.value[key] = !modelExpandedMap.value[key]
}

function visibleModels(group: { models: string[]; provider: string; label: string; base_url?: string }) {
  if (isExpanded(group)) return group.models
  return group.models.slice(0, MODEL_PREVIEW_LIMIT)
}

const expandableModelGroups = computed(() => appStore.modelGroups.filter(g => g.models.length > MODEL_PREVIEW_LIMIT))
const hasExpandableGroups = computed(() => expandableModelGroups.value.length > 0)
const allModelGroupsExpanded = computed(() => {
  if (expandableModelGroups.value.length === 0) return false
  return expandableModelGroups.value.every(g => isExpanded(g))
})

function toggleAllModels() {
  const next = !allModelGroupsExpanded.value
  for (const group of expandableModelGroups.value) {
    modelExpandedMap.value[modelGroupKey(group)] = next
  }
}

const endpoints = [
  { method: 'GET', endpoint: '/health', description: 'Health Check' },
  { method: 'POST', endpoint: '/v1/runs', description: 'Start Async Run' },
  { method: 'GET', endpoint: '/v1/runs/{id}/events', description: 'SSE Event Stream' },
  { method: 'GET', endpoint: '/api/jobs', description: 'List Jobs' },
  { method: 'POST', endpoint: '/api/jobs', description: 'Create Job' },
  { method: 'POST', endpoint: '/api/jobs/{id}/run', description: 'Trigger Job Now' },
]

onMounted(() => {
  loadAuthAccounts()
  loadAuthStream()
  streamTimer = setInterval(() => {
    loadAuthStream()
  }, 3000)
})

onBeforeUnmount(() => {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
})
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <h2 class="header-title">{{ t('settings.title') }}</h2>
    </header>

    <div class="settings-content">
      <!-- API Configuration -->
      <section class="settings-section">
        <h3 class="section-title">{{ t('settings.apiConfig') }}</h3>
        <div class="form-group">
          <div class="connection-status">
            <span class="status-dot" :class="{ on: appStore.connected, off: !appStore.connected }"></span>
            <span>{{ appStore.connected ? t('sidebar.connected') : t('sidebar.disconnected') }}</span>
            <span v-if="appStore.serverVersion" class="version">v{{ appStore.serverVersion }}</span>
          </div>
          <NButton type="primary" size="small" :loading="testingConnection" @click="handleTestConnection">
            {{ t('settings.healthCheck') }}
          </NButton>
        </div>
      </section>

      <!-- Model Management -->
      <section class="settings-section">
        <h3 class="section-title">{{ t('settings.modelManagement') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ t('settings.currentModel') }}</label>
          <div class="current-model">{{ appStore.selectedModel || 'Not set' }}</div>
        </div>

        <div v-if="appStore.modelGroups.length > 0" class="form-group">
          <div class="model-toolbar">
            <label class="form-label">{{ t('settings.availableModels') }}</label>
            <NButton v-if="hasExpandableGroups" size="tiny" tertiary @click="toggleAllModels">
              {{ allModelGroupsExpanded ? t('settings.collapseAll') : t('settings.expandAll') }}
            </NButton>
          </div>
          <p class="form-hint">{{ t('settings.modelsSource') }}</p>
          <div class="model-groups">
            <div v-for="group in appStore.modelGroups" :key="`${group.provider}-${group.base_url || group.label}`" class="model-group-card">
              <div class="model-group-head">
                <div class="model-group-provider">{{ group.label }}</div>
                <NTag size="small" type="info">{{ t('settings.modelsCount', { count: group.models.length }) }}</NTag>
              </div>
              <div v-if="group.base_url" class="model-group-base">{{ group.base_url }}</div>
              <div class="model-group-list">
                <NTag
                  v-for="model in visibleModels(group)"
                  :key="`${group.provider}-${model}`"
                  size="small"
                  class="model-pill"
                >
                  {{ model }}
                </NTag>
              </div>
              <NButton
                v-if="group.models.length > MODEL_PREVIEW_LIMIT"
                size="tiny"
                tertiary
                @click="toggleModels(group)"
              >
                {{ isExpanded(group) ? t('settings.showLess') : t('settings.showMore', { count: group.models.length - MODEL_PREVIEW_LIMIT }) }}
              </NButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Account Switch -->
      <section class="settings-section">
        <h3 class="section-title">{{ t('settings.authManager') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ t('settings.authProvider') }}</label>
          <NSelect
            v-model:value="selectedProvider"
            :options="providerOptions"
            :placeholder="t('settings.authProviderPlaceholder')"
            size="small"
          />
        </div>

        <div v-if="currentProviderAccounts.length > 0" class="auth-layout">
          <div class="auth-left">
            <div class="auth-current-card">
              <div class="auth-current-title">{{ t('settings.authCurrentStatus') }}</div>
              <div class="auth-current-main">
                <div class="auth-current-label">{{ currentActiveAccount?.label || '-' }}</div>
                <NTag size="small" type="success">{{ t('settings.authCurrent') }}</NTag>
              </div>
              <div class="auth-current-meta">
                <div>status: {{ currentActiveAccount?.status || '-' }}</div>
                <div>error_code: {{ currentActiveAccount?.meta?.last_error_code ?? '-' }}</div>
                <div>last_status_at: {{ prettyTime(currentActiveAccount?.meta?.last_status_at) }}</div>
                <div>reset_at: {{ prettyTime(currentActiveAccount?.meta?.last_error_reset_at) }}</div>
              </div>
            </div>

            <div class="auth-accounts">
              <div v-for="entry in currentProviderAccounts" :key="`${selectedProvider}-${entry.id || entry.index}`" class="auth-account-item">
                <div class="auth-account-meta">
                  <span class="auth-account-label">{{ entry.label }}</span>
                  <NTag size="small" :type="entry.index === 1 ? 'success' : 'default'">
                    {{ entry.index === 1 ? t('settings.authCurrent') : `${t('settings.authRank')} #${entry.index}` }}
                  </NTag>
                </div>
                <NButton
                  size="tiny"
                  type="primary"
                  tertiary
                  :loading="switchingAccount"
                  @click="handleSwitchAccount(entry.index)"
                >
                  {{ t('settings.authSwitchButton') }}
                </NButton>
              </div>
            </div>
          </div>

          <div class="auth-right">
            <div class="auth-stream-header">
              <span>{{ t('settings.authStreamTitle') }}</span>
              <NButton size="tiny" tertiary :loading="streamLoading" @click="loadAuthStream">{{ t('settings.refresh') }}</NButton>
            </div>
            <div class="auth-stream-list">
              <div v-if="authStream.length === 0" class="empty-text">{{ t('settings.authStreamEmpty') }}</div>
              <div v-for="evt in authStream" :key="evt.id" class="auth-stream-item">
                <div class="auth-stream-top">
                  <NTag size="tiny" :type="evt.type === 'error' ? 'error' : (evt.type === 'switch' ? 'success' : 'info')">{{ evt.type }}</NTag>
                  <span class="auth-stream-time">{{ prettyTime(evt.timestamp) }}</span>
                </div>
                <div class="auth-stream-message">{{ evt.message }}</div>
                <pre v-if="evt.payload" class="auth-stream-payload">{{ JSON.stringify(evt.payload, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <p v-else class="empty-text">{{ t('settings.authNoAccounts') }}</p>
      </section>

      <!-- Chat Settings -->
      <section class="settings-section">
        <h3 class="section-title">{{ t('settings.chatSettings') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ t('settings.streamResponses') }}</label>
          <NSwitch v-model:value="appStore.streamEnabled" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('settings.sessionPersistence') }}</label>
          <NSwitch v-model:value="appStore.sessionPersistence" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Tokens: {{ appStore.maxTokens }}</label>
          <NSlider v-model:value="appStore.maxTokens" :min="256" :max="32768" :step="256" />
        </div>
      </section>

      <!-- About -->
      <section class="settings-section">
        <h3 class="section-title">{{ t('settings.about') }}</h3>
        <p class="about-text">
          Hermes Agent Web UI
          <br />Version 0.1.3
        </p>
        <div class="endpoint-table">
          <NDataTable
            :columns="[{ title: 'Method', key: 'method', width: 80 }, { title: 'Endpoint', key: 'endpoint' }, { title: 'Description', key: 'description' }]"
            :data="endpoints"
            :bordered="false"
            size="small"
            :row-props="() => ({ style: 'cursor: default;' })"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.settings-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  max-width: 1080px;
}

.settings-section {
  margin-bottom: 28px;

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid $border-light;
  }
}

.form-group {
  margin-bottom: 14px;

  .form-label {
    display: block;
    font-size: 13px;
    color: $text-secondary;
    margin-bottom: 6px;
  }
}

.form-hint {
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 10px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: $text-secondary;
  margin-bottom: 10px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;

    &.on {
      background-color: $success;
      box-shadow: 0 0 6px rgba($success, 0.5);
    }

    &.off {
      background-color: $error;
    }
  }

  .version {
    color: $text-muted;
    font-size: 12px;
  }
}

.current-model {
  font-size: 14px;
  font-weight: 500;
  color: $text-primary;
  padding: 6px 10px;
  background: $bg-secondary;
  border-radius: $radius-sm;
  display: inline-block;
}

.model-groups {
  display: grid;
  gap: 10px;
}

.model-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.model-group-card {
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  padding: 10px;
  background: rgba($bg-secondary, 0.6);
}

.model-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.model-group-provider {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.model-group-base {
  font-size: 11px;
  color: $text-muted;
  margin-bottom: 8px;
  word-break: break-all;
}

.model-group-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.model-pill {
  max-width: 100%;
}

.empty-text {
  font-size: 13px;
  color: $text-muted;
  font-style: italic;
}

.auth-accounts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: $bg-secondary;
  border-radius: $radius-sm;
}

.auth-account-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auth-account-label {
  font-size: 13px;
  color: $text-primary;
  font-weight: 500;
}

.auth-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.auth-left,
.auth-right {
  min-width: 0;
}

.auth-current-card {
  margin-bottom: 8px;
  padding: 10px;
  border-radius: $radius-sm;
  background: rgba($accent-primary, 0.04);
  border: 1px solid $border-light;
}

.auth-current-title {
  font-size: 12px;
  color: $text-secondary;
  margin-bottom: 8px;
}

.auth-current-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.auth-current-label {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.auth-current-meta {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: $text-secondary;
}

.auth-stream-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: $text-secondary;
}

.auth-stream-list {
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background: rgba($bg-secondary, 0.7);
  max-height: 360px;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-stream-item {
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  padding: 8px;
  background: $bg-secondary;
}

.auth-stream-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.auth-stream-time {
  font-size: 11px;
  color: $text-muted;
}

.auth-stream-message {
  font-size: 12px;
  color: $text-primary;
  margin-bottom: 6px;
}

.auth-stream-payload {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: $text-secondary;
  white-space: pre-wrap;
  word-break: break-word;
}

.about-text {
  font-size: 13px;
  color: $text-secondary;
  line-height: 1.6;
  margin-bottom: 14px;
}

.endpoint-table {
  :deep(.n-data-table) {
    --n-td-color: transparent;
    --n-th-color: rgba($accent-primary, 0.04);
  }
}
</style>

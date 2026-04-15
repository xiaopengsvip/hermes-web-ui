<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  NButton, NSwitch, NSlider, NDataTable, NSelect, NTag, NInput, useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { fetchAuthCredentials, fetchAuthStream, switchAuthCredential, addAuthCredential, startOAuthFlow, getOAuthFlow, cancelOAuthFlow, type AuthProviderCredentials, type AuthStreamEvent, type OAuthFlowSession } from '@/api/auth'

const { t } = useI18n()
const appStore = useAppStore()
const message = useMessage()

const testingConnection = ref(false)
const switchingAccount = ref(false)
const authProviders = ref<AuthProviderCredentials[]>([])
const selectedProvider = ref('')
const authStream = ref<AuthStreamEvent[]>([])
const streamLoading = ref(false)
const addingAccount = ref(false)
const addProvider = ref('openrouter')
const addLabel = ref('')
const addApiKey = ref('')
const addSetActive = ref(true)

const oauthStarting = ref(false)
const oauthProvider = ref('openai-codex')
const oauthLabel = ref('')
const oauthSession = ref<OAuthFlowSession | null>(null)
let oauthTimer: ReturnType<typeof setInterval> | null = null
let streamTimer: ReturnType<typeof setInterval> | null = null

const providerOptions = computed(() => authProviders.value.map(p => ({
  label: p.provider,
  value: p.provider,
})))

const currentProviderAccounts = computed(() => authProviders.value.find(p => p.provider === selectedProvider.value)?.entries || [])
const currentActiveAccount = computed(() => currentProviderAccounts.value.find(e => e.index === 1) || null)

const allAccounts = computed(() => authProviders.value.flatMap(provider =>
  (provider.entries || []).map(entry => ({
    provider: provider.provider,
    entry,
    isCurrent: entry.index === 1,
  })),
))

function providerDisplayName(provider: string) {
  if (provider === 'openai-codex') return 'openai-codex（Codex）'
  if (provider === 'nous') return 'nous（Nous）'
  return provider
}

function accountStatusType(status?: string): 'success' | 'warning' | 'error' | 'default' {
  const s = (status || '').toLowerCase()
  if (s === 'ok' || s === 'active' || s === 'valid') return 'success'
  if (s === 'warning' || s === 'expiring') return 'warning'
  if (s === 'error' || s === 'invalid' || s === 'expired') return 'error'
  return 'default'
}

function accountStatusLabel(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'ok' || s === 'active' || s === 'valid') return t('settings.accountStatusAvailable')
  if (s === 'warning' || s === 'expiring') return t('settings.accountStatusWarning')
  if (s === 'error' || s === 'invalid' || s === 'expired') return t('settings.accountStatusUnavailable')
  return t('settings.accountStatusUnknown')
}

function prettyTime(input?: string | number | null) {
  if (input === null || input === undefined || input === '') return '-'
  try {
    if (typeof input === 'number' && Number.isFinite(input)) {
      const ms = input < 1e12 ? input * 1000 : input
      return new Date(ms).toLocaleString()
    }
    if (typeof input === 'string') {
      const trimmed = input.trim()
      if (!trimmed) return '-'
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(trimmed)) {
        const ms = numeric < 1e12 ? numeric * 1000 : numeric
        return new Date(ms).toLocaleString()
      }
      return new Date(trimmed).toLocaleString()
    }
    return String(input)
  } catch {
    return String(input)
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

async function handleSwitchAccount(provider: string, index: number) {
  if (!provider) return
  selectedProvider.value = provider
  switchingAccount.value = true
  try {
    const resp = await switchAuthCredential(provider, index)
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

function handleAccountRowKeydown(event: KeyboardEvent, provider: string, index: number, disabled: boolean) {
  if (disabled) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  handleSwitchAccount(provider, index)
}

async function handleAddAccount() {
  if (!addProvider.value.trim() || !addApiKey.value.trim()) {
    message.error(t('settings.authAddMissingFields'))
    return
  }

  addingAccount.value = true
  try {
    const resp = await addAuthCredential({
      provider: addProvider.value.trim(),
      label: addLabel.value.trim() || undefined,
      api_key: addApiKey.value.trim(),
      set_active: addSetActive.value,
    })

    if (!resp?.success) {
      message.error(resp?.error || t('settings.authAddFailed'))
      return
    }

    message.success(t('settings.authAddSuccess'))
    addApiKey.value = ''
    addLabel.value = ''
    await loadAuthAccounts()
    selectedProvider.value = addProvider.value.trim()
    await loadAuthStream()
    await appStore.loadModels()
  } catch (e: any) {
    message.error(e.message || t('settings.authAddFailed'))
  } finally {
    addingAccount.value = false
  }
}

async function pollOAuthSession(forceStop = false) {
  if (!oauthSession.value?.id) return
  try {
    const resp = await getOAuthFlow(oauthSession.value.id)
    oauthSession.value = resp.session

    if (resp.session.status === 'authorized') {
      if (oauthTimer) {
        clearInterval(oauthTimer)
        oauthTimer = null
      }
      message.success(t('settings.authOAuthSuccess'))
      await loadAuthAccounts()
      selectedProvider.value = resp.session.provider
      await loadAuthStream()
      await appStore.loadModels()
      return
    }

    if (resp.session.status === 'failed' || resp.session.status === 'cancelled' || forceStop) {
      if (oauthTimer) {
        clearInterval(oauthTimer)
        oauthTimer = null
      }
      if (resp.session.status === 'failed') {
        message.error(resp.session.error || t('settings.authOAuthFailed'))
      }
    }
  } catch (e: any) {
    if (forceStop && oauthTimer) {
      clearInterval(oauthTimer)
      oauthTimer = null
    }
    if (forceStop) {
      message.error(e.message || t('settings.authOAuthFailed'))
    }
  }
}

async function handleStartOAuth() {
  if (!oauthProvider.value.trim()) {
    message.error(t('settings.authOAuthProviderRequired'))
    return
  }

  oauthStarting.value = true
  try {
    const resp = await startOAuthFlow(oauthProvider.value.trim(), oauthLabel.value.trim() || undefined)
    oauthSession.value = resp.session

    if (oauthTimer) {
      clearInterval(oauthTimer)
      oauthTimer = null
    }

    oauthTimer = setInterval(() => {
      pollOAuthSession()
    }, 2000)

    await pollOAuthSession()
  } catch (e: any) {
    message.error(e.message || t('settings.authOAuthStartFailed'))
  } finally {
    oauthStarting.value = false
  }
}

async function handleCancelOAuth() {
  if (!oauthSession.value?.id) return
  try {
    await cancelOAuthFlow(oauthSession.value.id)
    await pollOAuthSession(true)
  } catch (e: any) {
    message.error(e.message || t('settings.authOAuthCancelFailed'))
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
  if (oauthTimer) {
    clearInterval(oauthTimer)
    oauthTimer = null
  }
})
</script>

<template>
  <div class="settings-view">
    <header class="page-header">
      <h2 class="header-title">{{ t('settings.title') }}</h2>
    </header>

    <div class="settings-body">
      <div class="settings-scroll">
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
          <label class="form-label">{{ t('settings.authQuickSwitch') }}</label>
          <div v-if="allAccounts.length" class="auth-accounts auth-accounts-global">
            <article
              v-for="row in allAccounts"
              :key="`${row.provider}-${row.entry.id || row.entry.index}`"
              class="auth-account-item"
              :class="{ clickable: !row.isCurrent, current: row.isCurrent }"
              role="button"
              tabindex="0"
              :aria-label="`切换到 ${row.provider} ${row.entry.label}`"
              @click="!row.isCurrent && handleSwitchAccount(row.provider, row.entry.index)"
              @keydown="handleAccountRowKeydown($event, row.provider, row.entry.index, row.isCurrent)"
            >
              <div class="auth-account-info">
                <div class="auth-account-meta">
                  <span class="auth-account-label">{{ row.entry.label || '-' }}</span>
                  <NTag size="small" :type="row.isCurrent ? 'success' : 'default'">
                    {{ row.isCurrent ? t('settings.authCurrent') : `${t('settings.authRank')} #${row.entry.index}` }}
                  </NTag>
                  <NTag size="small" :type="accountStatusType(row.entry.status)">{{ accountStatusLabel(row.entry.status) }}</NTag>
                </div>
                <div class="auth-account-submeta">
                  <span>{{ t('settings.authProvider') }}: {{ providerDisplayName(row.provider) }}</span>
                  <span>{{ t('settings.authTypeLabel') }}: {{ row.entry.auth_type || '-' }}</span>
                  <span>{{ t('settings.authSourceLabel') }}: {{ row.entry.source || '-' }}</span>
                  <span>ID: {{ row.entry.id || '-' }}</span>
                </div>
              </div>
              <NButton
                size="tiny"
                type="primary"
                tertiary
                :disabled="row.isCurrent"
                :loading="switchingAccount"
                @click.stop="handleSwitchAccount(row.provider, row.entry.index)"
              >
                {{ row.isCurrent ? t('settings.authCurrent') : t('settings.authSwitchButton') }}
              </NButton>
            </article>
          </div>
          <p v-else class="empty-text">{{ t('settings.authNoAccounts') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('settings.authProvider') }}</label>
          <NSelect
            v-model:value="selectedProvider"
            :options="providerOptions"
            :placeholder="t('settings.authProviderPlaceholder')"
            size="small"
          />
        </div>

        <div class="auth-add-card">
          <div class="auth-add-title">{{ t('settings.authAddTitle') }}</div>
          <p class="form-hint">{{ t('settings.authAddHint') }}</p>
          <div class="auth-add-grid">
            <NInput v-model:value="addProvider" size="small" :placeholder="t('settings.authAddProviderPlaceholder')" />
            <NInput v-model:value="addLabel" size="small" :placeholder="t('settings.authAddLabelPlaceholder')" />
            <NInput v-model:value="addApiKey" size="small" type="password" show-password-on="click" :placeholder="t('settings.authAddApiKeyPlaceholder')" />
          </div>
          <div class="auth-add-actions">
            <div class="auth-add-switch">
              <span>{{ t('settings.authAddSetActive') }}</span>
              <NSwitch v-model:value="addSetActive" size="small" />
            </div>
            <NButton type="primary" size="small" :loading="addingAccount" @click="handleAddAccount">
              {{ t('settings.authAddButton') }}
            </NButton>
          </div>
        </div>

        <div class="auth-oauth-card">
          <div class="auth-add-title">{{ t('settings.authOAuthTitle') }}</div>
          <p class="form-hint">{{ t('settings.authOAuthHint') }}</p>
          <div class="auth-add-grid auth-oauth-grid">
            <NSelect
              v-model:value="oauthProvider"
              size="small"
              :options="[
                { label: 'openai-codex', value: 'openai-codex' },
                { label: 'nous', value: 'nous' }
              ]"
              :placeholder="t('settings.authOAuthProviderPlaceholder')"
            />
            <NInput v-model:value="oauthLabel" size="small" :placeholder="t('settings.authOAuthLabelPlaceholder')" />
          </div>
          <div class="auth-add-actions">
            <NButton type="primary" size="small" :loading="oauthStarting" @click="handleStartOAuth">
              {{ t('settings.authOAuthStartButton') }}
            </NButton>
            <NButton size="small" tertiary :disabled="!oauthSession || oauthSession.status !== 'pending'" @click="handleCancelOAuth">
              {{ t('settings.authOAuthCancelButton') }}
            </NButton>
          </div>

          <div v-if="oauthSession" class="auth-oauth-session">
            <div>status: {{ oauthSession.status }}</div>
            <div>provider: {{ oauthSession.provider }}</div>
            <div>label: {{ oauthSession.label }}</div>
            <div v-if="oauthSession.user_code">code: <strong>{{ oauthSession.user_code }}</strong></div>
            <div v-if="oauthSession.verification_url" class="oauth-link-line">
              <a :href="oauthSession.verification_url" target="_blank" rel="noopener noreferrer">{{ oauthSession.verification_url }}</a>
            </div>
            <div v-if="oauthSession.error" class="oauth-error">{{ oauthSession.error }}</div>
            <pre v-if="oauthSession.logs?.length" class="auth-oauth-logs">{{ oauthSession.logs.slice(-10).join('\n') }}</pre>
          </div>
        </div>

        <div v-if="currentProviderAccounts.length > 0" class="auth-layout">
          <div class="auth-left">
            <div class="auth-current-card">
              <div class="auth-current-title">{{ t('settings.authCurrentStatus') }}</div>
              <div class="auth-current-main">
                <div class="auth-current-label">{{ currentActiveAccount?.label || '-' }}</div>
                <NTag size="small" type="success">{{ t('settings.authCurrent') }}</NTag>
                <NTag size="small" :type="accountStatusType(currentActiveAccount?.status)">{{ accountStatusLabel(currentActiveAccount?.status) }}</NTag>
              </div>
              <div class="auth-current-meta">
                <div>{{ t('settings.authProvider') }}: {{ providerDisplayName(selectedProvider) }}</div>
                <div>{{ t('settings.authStatusLabel') }}: {{ currentActiveAccount?.status || '-' }}</div>
                <div>{{ t('settings.authErrorCodeLabel') }}: {{ currentActiveAccount?.meta?.last_error_code ?? '-' }}</div>
                <div>{{ t('settings.authExpiresAtLabel') }}: {{ prettyTime(currentActiveAccount?.meta?.expires_at) }}</div>
                <div>{{ t('settings.authLastRefreshLabel') }}: {{ prettyTime(currentActiveAccount?.meta?.last_refresh) }}</div>
                <div>{{ t('settings.authLastStatusAtLabel') }}: {{ prettyTime(currentActiveAccount?.meta?.last_status_at) }}</div>
                <div>{{ t('settings.authResetAtLabel') }}: {{ prettyTime(currentActiveAccount?.meta?.last_error_reset_at) }}</div>
              </div>
            </div>

            <div class="auth-accounts">
              <div v-for="entry in currentProviderAccounts" :key="`${selectedProvider}-${entry.id || entry.index}`" class="auth-account-item" :class="{ clickable: entry.index !== 1, current: entry.index === 1 }">
                <div class="auth-account-info">
                  <div class="auth-account-meta">
                    <span class="auth-account-label">{{ entry.label || '-' }}</span>
                    <NTag size="small" :type="entry.index === 1 ? 'success' : 'default'">
                      {{ entry.index === 1 ? t('settings.authCurrent') : `${t('settings.authRank')} #${entry.index}` }}
                    </NTag>
                    <NTag size="small" :type="accountStatusType(entry.status)">{{ accountStatusLabel(entry.status) }}</NTag>
                  </div>
                  <div class="auth-account-submeta">
                    <span>{{ t('settings.authStatusLabel') }}: {{ entry.status || '-' }}</span>
                    <span>{{ t('settings.authTypeLabel') }}: {{ entry.auth_type || '-' }}</span>
                    <span>{{ t('settings.authSourceLabel') }}: {{ entry.source || '-' }}</span>
                    <span>{{ t('settings.authExpiresShortLabel') }}: {{ prettyTime(entry.meta?.expires_at) }}</span>
                  </div>
                </div>
                <NButton
                  size="tiny"
                  type="primary"
                  tertiary
                  :disabled="entry.index === 1"
                  :loading="switchingAccount"
                  @click="handleSwitchAccount(selectedProvider, entry.index)"
                >
                  {{ entry.index === 1 ? t('settings.authCurrent') : t('settings.authSwitchButton') }}
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
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.settings-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 0;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
}

.settings-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.settings-content {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}

.settings-section {
  margin-bottom: 14px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(
    180deg,
    rgba($bg-secondary, 0.92),
    rgba($bg-secondary, 0.75)
  );
  padding: 14px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);

  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.65px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dashed $border-light;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.form-group {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

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

.auth-accounts-global {
  max-height: 300px;
  overflow: auto;
  padding-right: 2px;
}

.auth-add-card {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background: rgba($bg-secondary, 0.7);
}

.auth-oauth-card {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid rgba($accent-primary, 0.25);
  border-radius: $radius-sm;
  background: rgba($accent-primary, 0.04);
}

.auth-add-title {
  font-size: 12px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 4px;
}

.auth-add-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.auth-oauth-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.auth-add-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.auth-add-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: $text-secondary;
}

.auth-oauth-session {
  margin-top: 10px;
  padding: 8px;
  border-radius: $radius-sm;
  background: rgba($bg-secondary, 0.8);
  border: 1px dashed $border-light;
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: $text-secondary;
}

.oauth-link-line a {
  color: $accent-primary;
  word-break: break-all;
  text-decoration: underline;
}

.oauth-error {
  color: $error;
}

.auth-oauth-logs {
  margin: 6px 0 0;
  max-height: 160px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.4;
  color: $text-muted;
  white-space: pre-wrap;
  word-break: break-word;
}

.auth-account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: $bg-secondary;
  border-radius: $radius-sm;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease;

  &.clickable {
    cursor: pointer;

    &:hover {
      border-color: rgba($accent-primary, 0.45);
      background: rgba($accent-primary, 0.08);
    }

    &:focus-visible {
      outline: none;
      border-color: rgba($accent-primary, 0.65);
      box-shadow: 0 0 0 2px rgba($accent-primary, 0.2);
    }
  }

  &.current {
    border-color: rgba($success, 0.35);
    background: rgba($success, 0.08);
  }
}

.auth-account-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auth-account-info {
  min-width: 0;
}

.auth-account-submeta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 11px;
  color: $text-muted;
}

.auth-account-label {
  font-size: 13px;
  color: $text-primary;
  font-weight: 500;
}

.auth-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 14px;

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
  min-height: 220px;
  max-height: 420px;
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
  overflow-x: auto;

  :deep(.n-data-table) {
    --n-td-color: transparent;
    --n-th-color: rgba($accent-primary, 0.04);
  }
}

@media (max-width: 900px) {
  .settings-scroll {
    padding: 14px;
  }

  .settings-section {
    padding: 12px;
  }

  .auth-add-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .auth-account-item {
    flex-direction: column;
    align-items: stretch;
  }

  .auth-account-submeta {
    justify-content: space-between;
  }
}
</style>

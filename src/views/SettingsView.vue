<script setup lang="ts">
import { ref } from 'vue'
import {
  NButton, NSwitch, NSlider, NDataTable, useMessage,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
const appStore = useAppStore()
const message = useMessage()

const testingConnection = ref(false)

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

const providerColumns = [
  { title: t('settings.provider'), key: 'provider' },
  { title: t('settings.models'), key: 'models' },
  { title: t('settings.baseUrl'), key: 'base_url' },
]

const endpoints = [
  { method: 'GET', endpoint: '/health', description: 'Health Check' },
  { method: 'POST', endpoint: '/v1/runs', description: 'Start Async Run' },
  { method: 'GET', endpoint: '/v1/runs/{id}/events', description: 'SSE Event Stream' },
  { method: 'GET', endpoint: '/api/jobs', description: 'List Jobs' },
  { method: 'POST', endpoint: '/api/jobs', description: 'Create Job' },
  { method: 'POST', endpoint: '/api/jobs/{id}/run', description: 'Trigger Job Now' },
]
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
          <label class="form-label">{{ t('settings.availableModels') }}</label>
          <p class="form-hint">{{ t('settings.modelsSource') }}</p>
          <NDataTable
            :columns="providerColumns"
            :data="appStore.modelGroups.map(g => ({
              provider: g.label,
              models: g.models.join(', '),
              base_url: g.base_url,
            }))"
            :bordered="false"
            size="small"
            :row-props="() => ({ style: 'cursor: default;' })"
          />
        </div>
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
  max-width: 640px;
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

.empty-text {
  font-size: 13px;
  color: $text-muted;
  font-style: italic;
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

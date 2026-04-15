<script setup lang="ts">
import { computed } from 'vue'
import { NSelect } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
const appStore = useAppStore()

function reasonText(reason: string) {
  if (reason === 'missing_base_url') return t('settings.unavailableReasonMissingBaseUrl')
  if (reason === 'missing_token') return t('settings.unavailableReasonMissingToken')
  if (reason === 'all_credentials_exhausted') return t('settings.unavailableReasonExhausted')
  if (reason === 'empty_model_list') return t('settings.unavailableReasonEmpty')
  if (reason.startsWith('http_')) return t('settings.unavailableReasonHttp', { code: reason.replace('http_', '') })
  if (reason.startsWith('fetch_failed:')) return t('settings.unavailableReasonFetchFailed')
  return t('settings.unavailableReasonUnknown')
}

const options = computed(() => {
  const availableGroups = appStore.modelGroups.map(g => ({
    label: g.label,
    type: 'group' as const,
    key: `available-${g.provider}`,
    children: g.models.map(m => ({
      label: m,
      value: m,
    })),
  }))

  const unavailableGroups = appStore.unavailableModelGroups.map(g => ({
    label: `${g.label} · ${t('modelSelector.unavailableGroup')}`,
    type: 'group' as const,
    key: `unavailable-${g.provider}`,
    children: (g.models.length > 0 ? g.models : [g.label]).map(m => ({
      label: `${m} (${reasonText(g.reason)})`,
      value: `${g.provider}::${m}`,
      disabled: true,
    })),
  }))

  return [...availableGroups, ...unavailableGroups]
})

function handleChange(value: string | number | Array<string | number>) {
  if (typeof value === 'string') {
    appStore.switchModel(value)
  }
}
</script>

<template>
  <div class="model-selector">
    <div class="model-label">{{ t('modelSelector.title') }}</div>
    <NSelect
      :value="appStore.selectedModel"
      :options="options"
      size="small"
      :placeholder="t('modelSelector.selectModel')"
      @update:value="handleChange"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.model-selector {
  padding: 0 12px;
  margin-bottom: 8px;
}

.model-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
</style>

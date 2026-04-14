<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NButton, NCard, NInput, NInputNumber, NSwitch, NTag, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { fetchConfigCenter, saveConfigCenter, type ConfigCenterState } from '@/api/config-center'

const { t } = useI18n()
const message = useMessage()
const loading = ref(false)

const model = ref<ConfigCenterState>({
  profile: {
    relayBaseUrl: '',
    relayHealthPath: '/health',
    workerEnabled: true,
    workerRoute: '/relay',
  },
  platforms: {
    githubOwner: '',
    githubRepo: '',
    vercelProjectId: '',
    cloudflareZoneId: '',
  },
  secrets: {
    githubToken: '',
    vercelToken: '',
    cloudflareToken: '',
    relayApiKey: '',
    hermesApiKey: '',
  },
  secretsConfigured: {},
  audit: {
    enabled: true,
    dailyHour: 3,
    autoFix: true,
  },
  updatedAt: 0,
})

const secretInputs = ref({
  githubToken: '',
  vercelToken: '',
  cloudflareToken: '',
  relayApiKey: '',
  hermesApiKey: '',
})

async function load() {
  loading.value = true
  try {
    model.value = await fetchConfigCenter()
  } finally {
    loading.value = false
  }
}

async function save() {
  loading.value = true
  try {
    const payload = {
      profile: model.value.profile,
      platforms: model.value.platforms,
      audit: model.value.audit,
      secrets: {
        githubToken: secretInputs.value.githubToken,
        vercelToken: secretInputs.value.vercelToken,
        cloudflareToken: secretInputs.value.cloudflareToken,
        relayApiKey: secretInputs.value.relayApiKey,
        hermesApiKey: secretInputs.value.hermesApiKey,
      },
    }
    const res = await saveConfigCenter(payload)
    model.value = res.config
    secretInputs.value = {
      githubToken: '',
      vercelToken: '',
      cloudflareToken: '',
      relayApiKey: '',
      hermesApiKey: '',
    }
    message.success(t('configCenter.saved'))
  } catch (err: any) {
    message.error(err?.message || String(err))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="config-center-view">
    <header class="page-header">
      <div>
        <h2>{{ t('configCenter.title') }}</h2>
        <p>{{ t('configCenter.subtitle') }}</p>
      </div>
      <NButton type="primary" :loading="loading" @click="save">{{ t('common.save') }}</NButton>
    </header>

    <div class="content-grid">
      <NCard :title="t('configCenter.platformTargets')" class="panel-card">
        <div class="grid-2">
          <NInput v-model:value="model.platforms.githubOwner" :placeholder="t('projectCenter.ownerPlaceholder')" />
          <NInput v-model:value="model.platforms.githubRepo" :placeholder="t('projectCenter.repoPlaceholder')" />
          <NInput v-model:value="model.platforms.vercelProjectId" :placeholder="t('projectCenter.projectIdPlaceholder')" />
          <NInput v-model:value="model.platforms.cloudflareZoneId" :placeholder="t('projectCenter.zoneIdPlaceholder')" />
        </div>
      </NCard>

      <NCard :title="t('configCenter.relayAndWorker')" class="panel-card">
        <div class="grid-2">
          <NInput v-model:value="model.profile.relayBaseUrl" :placeholder="t('projectCenter.relayBaseUrlPlaceholder')" />
          <NInput v-model:value="model.profile.relayHealthPath" :placeholder="t('projectCenter.relayHealthPathPlaceholder')" />
          <NInput v-model:value="model.profile.workerRoute" :placeholder="t('configCenter.workerRoutePlaceholder')" />
          <div class="switch-row">
            <span>{{ t('configCenter.enableWorkerBridge') }}</span>
            <NSwitch v-model:value="model.profile.workerEnabled" />
          </div>
        </div>
      </NCard>

      <NCard :title="t('configCenter.secretsVault')" class="panel-card">
        <div class="grid-2">
          <NInput v-model:value="secretInputs.githubToken" type="password" :placeholder="t('configCenter.secretGithub')" />
          <NTag :type="model.secretsConfigured?.githubToken ? 'success' : 'default'">{{ model.secrets.githubToken || '-' }}</NTag>

          <NInput v-model:value="secretInputs.vercelToken" type="password" :placeholder="t('configCenter.secretVercel')" />
          <NTag :type="model.secretsConfigured?.vercelToken ? 'success' : 'default'">{{ model.secrets.vercelToken || '-' }}</NTag>

          <NInput v-model:value="secretInputs.cloudflareToken" type="password" :placeholder="t('configCenter.secretCloudflare')" />
          <NTag :type="model.secretsConfigured?.cloudflareToken ? 'success' : 'default'">{{ model.secrets.cloudflareToken || '-' }}</NTag>

          <NInput v-model:value="secretInputs.relayApiKey" type="password" :placeholder="t('configCenter.secretRelay')" />
          <NTag :type="model.secretsConfigured?.relayApiKey ? 'success' : 'default'">{{ model.secrets.relayApiKey || '-' }}</NTag>

          <NInput v-model:value="secretInputs.hermesApiKey" type="password" :placeholder="t('configCenter.secretHermes')" />
          <NTag :type="model.secretsConfigured?.hermesApiKey ? 'success' : 'default'">{{ model.secrets.hermesApiKey || '-' }}</NTag>
        </div>
        <p class="hint">{{ t('configCenter.secretHint') }}</p>
      </NCard>

      <NCard :title="t('configCenter.auditPolicy')" class="panel-card">
        <div class="grid-2">
          <div class="switch-row">
            <span>{{ t('configCenter.auditEnabled') }}</span>
            <NSwitch v-model:value="model.audit.enabled" />
          </div>
          <div class="switch-row">
            <span>{{ t('configCenter.auditAutoFix') }}</span>
            <NSwitch v-model:value="model.audit.autoFix" />
          </div>
          <NInputNumber v-model:value="model.audit.dailyHour" :min="0" :max="23" :placeholder="t('configCenter.auditHour')" />
        </div>
      </NCard>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
.config-center-view { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  h2 { margin: 0; font-size: 20px; }
  p { margin: 4px 0 0; color: $text-muted; font-size: 13px; }
}
.content-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; gap: 10px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.switch-row { display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba($border-color, 0.7); border-radius: 10px; padding: 8px 10px; }
.hint { color: $text-muted; font-size: 12px; margin-top: 8px; }
@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
</style>

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { checkHealth, fetchAvailableModels, updateDefaultModel, type AvailableModelGroup, type UnavailableModelGroup } from '@/api/system'

export const useAppStore = defineStore('app', () => {
  const connected = ref(false)
  const serverVersion = ref('')
  const modelGroups = ref<AvailableModelGroup[]>([])
  const unavailableModelGroups = ref<UnavailableModelGroup[]>([])
  const selectedModel = ref('')
  const healthPollTimer = ref<ReturnType<typeof setInterval>>()

  // Settings
  const streamEnabled = ref(true)
  const sessionPersistence = ref(true)
  const maxTokens = ref(4096)

  async function checkConnection() {
    try {
      const res = await checkHealth()
      connected.value = true
      if (res.version) serverVersion.value = res.version
    } catch {
      connected.value = false
    }
  }

  async function loadModels() {
    try {
      const res = await fetchAvailableModels()
      modelGroups.value = res.groups
      unavailableModelGroups.value = res.unavailable_groups || []
      selectedModel.value = res.default
    } catch {
      // ignore
    }
  }

  async function switchModel(modelId: string, providerOverride?: string): Promise<boolean> {
    try {
      // Find the group containing this model to get provider info
      const group = modelGroups.value.find(g => g.models.includes(modelId))
      const provider = providerOverride || group?.provider || ''
      await updateDefaultModel({ default: modelId, provider })
      selectedModel.value = modelId
      return true
    } catch (err: any) {
      console.error('Failed to switch model:', err)
      return false
    }
  }

  function startHealthPolling(interval = 30000) {
    stopHealthPolling()
    checkConnection()
    healthPollTimer.value = setInterval(checkConnection, interval)
  }

  function stopHealthPolling() {
    if (healthPollTimer.value) {
      clearInterval(healthPollTimer.value)
      healthPollTimer.value = undefined
    }
  }

  return {
    connected,
    serverVersion,
    modelGroups,
    unavailableModelGroups,
    selectedModel,
    streamEnabled,
    sessionPersistence,
    maxTokens,
    checkConnection,
    loadModels,
    switchModel,
    startHealthPolling,
    stopHealthPolling,
  }
})

<script setup lang="ts">
import { onMounted } from 'vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

onMounted(() => {
  appStore.loadModels()
})
</script>

<template>
  <div class="chat-view">
    <ChatPanel />
  </div>
</template>

<style scoped lang="scss">
.chat-view {
  height: 100%;
  min-height: 0;
  display: flex;
}
</style>

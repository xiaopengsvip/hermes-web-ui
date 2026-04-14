<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import TerminalView from '@/views/TerminalView.vue'
import { useAppStore } from '@/stores/app'
import { useChatStore } from '@/stores/chat'

const route = useRoute()
const appStore = useAppStore()
const chatStore = useChatStore()

const terminalVisible = computed(() => route.query.panel === 'terminal')

onMounted(() => {
  appStore.loadModels()
  chatStore.loadSessions()
})
</script>

<template>
  <div class="chat-view">
    <div class="content-stage">
      <Transition name="panel-fade" mode="out-in">
        <TerminalView v-if="terminalVisible" key="terminal" />
        <ChatPanel v-else key="chat" />
      </Transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  gap: 8px;
}

.content-stage {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>

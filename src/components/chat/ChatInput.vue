<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { NButton, NTooltip, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Attachment } from '@/stores/chat'
import { useChatStore } from '@/stores/chat'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
const toast = useMessage()
const chatStore = useChatStore()
const appStore = useAppStore()
const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()
const attachments = ref<Attachment[]>([])
const isDragging = ref(false)
const dragCounter = ref(0)
const isComposing = ref(false)
const isPreparing = ref(false)
const inputError = ref<string | null>(null)

const MAX_FILES = 8
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_TOTAL_SIZE = 50 * 1024 * 1024

// Voice recording state
const isRecording = ref(false)
const isVoiceSupported = ref(false)
const voiceError = ref<string | null>(null)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

const totalAttachmentSize = computed(() => attachments.value.reduce((sum, a) => sum + a.size, 0))
const canSend = computed(() => (inputText.value.trim() || attachments.value.length > 0) && !isPreparing.value)
const draftKey = computed(() => `chat:draft:${chatStore.activeSessionId || 'new'}`)

// Check voice support on mount
onMounted(() => {
  isVoiceSupported.value = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  inputText.value = localStorage.getItem(draftKey.value) || ''
  requestAnimationFrame(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 180) + 'px'
    }
  })
})

watch(draftKey, (nextKey) => {
  inputText.value = localStorage.getItem(nextKey) || ''
  requestAnimationFrame(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 180) + 'px'
    }
  })
})

watch(inputText, (value) => {
  if (value.trim()) {
    localStorage.setItem(draftKey.value, value)
  } else {
    localStorage.removeItem(draftKey.value)
  }
})

function revokeAttachmentUrls(list: Attachment[]) {
  for (const item of list) {
    try {
      URL.revokeObjectURL(item.url)
    } catch {
      // ignore
    }
  }
}

function clearAttachments() {
  revokeAttachmentUrls(attachments.value)
  attachments.value = []
}

// Clean up on unmount
onUnmounted(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  clearAttachments()
})

// --- Voice recording ---
async function startRecording() {
  if (!isVoiceSupported.value) {
    voiceError.value = t('chat.voiceNotSupported')
    return
  }

  try {
    voiceError.value = null
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    audioChunks = []

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data)
    }

    mediaRecorder.onstop = () => {
      const pickedType = mediaRecorder?.mimeType || 'audio/webm'
      const ext = pickedType.includes('wav') ? 'wav' : 'webm'
      const audioBlob = new Blob(audioChunks, { type: pickedType })
      const audioUrl = URL.createObjectURL(audioBlob)
      const audioFile = new File([audioBlob], `voice-${Date.now()}.${ext}`, { type: pickedType })

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      attachments.value.push({
        id,
        name: audioFile.name,
        type: audioFile.type,
        size: audioFile.size,
        url: audioUrl,
        file: audioFile,
      })

      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.start()
    isRecording.value = true
  } catch (error: any) {
    voiceError.value = error.message || t('chat.voiceStartFailed')
    console.error(t('chat.voiceRecordErrorLog'), error)
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
    isRecording.value = false
  }
}

function toggleRecording() {
  if (isRecording.value) stopRecording()
  else startRecording()
}

// --- File attachment helpers ---
function addFile(file: File) {
  inputError.value = null

  if (attachments.value.length >= MAX_FILES) {
    inputError.value = t('chat.maxFilesExceeded', { max: MAX_FILES })
    toast.warning(inputError.value)
    return
  }

  if (file.size > MAX_FILE_SIZE) {
    inputError.value = t('chat.fileTooLarge', { size: formatSize(MAX_FILE_SIZE) })
    toast.warning(inputError.value)
    return
  }

  if (totalAttachmentSize.value + file.size > MAX_TOTAL_SIZE) {
    inputError.value = t('chat.totalSizeExceeded', { size: formatSize(MAX_TOTAL_SIZE) })
    toast.warning(inputError.value)
    return
  }

  if (attachments.value.find(a => a.name === file.name && a.size === file.size)) {
    return
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const url = URL.createObjectURL(file)
  attachments.value.push({
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    url,
    file,
  })
}

function handleAttachClick() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  for (const file of input.files) addFile(file)
  input.value = ''
}

// --- Paste image ---
function handlePaste(e: ClipboardEvent) {
  const items = Array.from(e.clipboardData?.items || [])
  const imageItems = items.filter(i => i.type.startsWith('image/'))
  if (!imageItems.length) return
  e.preventDefault()
  for (const item of imageItems) {
    const blob = item.getAsFile()
    if (!blob) continue
    const ext = item.type.split('/')[1] || 'png'
    const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: item.type })
    addFile(file)
  }
}

// --- Drag and drop ---
function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter.value++
    isDragging.value = true
  }
}

function handleDragLeave() {
  dragCounter.value--
  if (dragCounter.value <= 0) {
    dragCounter.value = 0
    isDragging.value = false
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter.value = 0
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  if (!files.length) return
  for (const file of files) addFile(file)
  textareaRef.value?.focus()
}

async function executeSlashCommand(raw: string): Promise<boolean> {
  if (!raw.startsWith('/')) return false

  const [cmd, ...rest] = raw.slice(1).trim().split(/\s+/)
  const arg = rest.join(' ').trim()

  switch ((cmd || '').toLowerCase()) {
    case 'new':
      chatStore.newChat()
      inputText.value = ''
      localStorage.removeItem(draftKey.value)
      toast.success(t('chat.command.newDone'))
      return true
    case 'clear':
      chatStore.clearCurrentSessionMessages()
      inputText.value = ''
      clearAttachments()
      localStorage.removeItem(draftKey.value)
      toast.success(t('chat.command.clearDone'))
      return true
    case 'model': {
      if (!arg) {
        toast.info(t('chat.command.modelCurrent', { model: appStore.selectedModel || '--' }))
        return true
      }
      const allModels = appStore.modelGroups.flatMap(g => g.models)
      const exact = allModels.find(m => m.toLowerCase() === arg.toLowerCase())
      const fuzzy = exact || allModels.find(m => m.toLowerCase().includes(arg.toLowerCase()))
      if (!fuzzy) {
        toast.warning(t('chat.command.modelNotFound', { keyword: arg }))
        return true
      }
      await appStore.switchModel(fuzzy)
      await chatStore.switchSessionModel(fuzzy)
      toast.success(t('chat.command.modelSwitched', { model: fuzzy }))
      return true
    }
    default:
      toast.warning(t('chat.command.unknown', { command: cmd }))
      return true
  }
}

// --- Send ---
async function handleSend() {
  const text = inputText.value.trim()
  if ((!text && attachments.value.length === 0) || isPreparing.value || chatStore.isStreaming) return

  if (attachments.value.length === 0 && text.startsWith('/')) {
    const consumed = await executeSlashCommand(text)
    if (consumed) return
  }

  isPreparing.value = true
  inputError.value = null
  try {
    const sendingAttachments = [...attachments.value]
    await chatStore.sendMessage(text, sendingAttachments.length > 0 ? sendingAttachments : undefined)
    inputText.value = ''
    localStorage.removeItem(draftKey.value)
    clearAttachments()

    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  } catch (err: any) {
    const msg = err?.message || t('chat.sendFailed')
    inputError.value = msg
    toast.error(msg)
  } finally {
    isPreparing.value = false
  }
}

function handleCompositionStart() {
  isComposing.value = true
}

function handleCompositionEnd() {
  requestAnimationFrame(() => {
    isComposing.value = false
  })
}

function isImeEnter(e: KeyboardEvent): boolean {
  return isComposing.value || e.isComposing || e.keyCode === 229
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey) return
  if (isImeEnter(e)) return

  e.preventDefault()
  handleSend()
}

function handleInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 180) + 'px'
}

function removeAttachment(id: string) {
  const idx = attachments.value.findIndex(a => a.id === id)
  if (idx !== -1) {
    URL.revokeObjectURL(attachments.value[idx].url)
    attachments.value.splice(idx, 1)
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return t('chat.size.byte', { value: bytes })
  if (bytes < 1024 * 1024) return t('chat.size.kb', { value: (bytes / 1024).toFixed(1) })
  return t('chat.size.mb', { value: (bytes / (1024 * 1024)).toFixed(1) })
}

function isImage(type: string): boolean {
  return type.startsWith('image/')
}
</script>

<template>
  <div class="chat-input-area">
    <div v-if="inputError || voiceError" class="input-errors">
      <div v-if="inputError" class="error-chip">{{ inputError }}</div>
      <div v-if="voiceError" class="error-chip">{{ voiceError }}</div>
    </div>

    <!-- Attachment previews -->
    <div v-if="attachments.length > 0" class="attachment-previews">
      <div
        v-for="att in attachments"
        :key="att.id"
        class="attachment-preview"
        :class="{ image: isImage(att.type) }"
      >
        <template v-if="isImage(att.type)">
          <img :src="att.url" :alt="att.name" class="attachment-thumb" />
        </template>
        <template v-else>
          <div class="attachment-file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="file-name">{{ att.name }}</span>
            <span class="file-size">{{ formatSize(att.size) }}</span>
          </div>
        </template>
        <button class="attachment-remove" @click="removeAttachment(att.id)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div
      class="input-wrapper"
      :class="{ 'drag-over': isDragging }"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div v-if="isDragging" class="drop-overlay">{{ t('chat.dropHint') }}</div>
      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="file-input-hidden"
        @change="handleFileChange"
      />
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="input-textarea"
        :placeholder="t('chat.inputPlaceholder')"
        rows="1"
        @keydown="handleKeydown"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
        @input="handleInput"
        @paste="handlePaste"
      ></textarea>
      <div class="input-actions">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton quaternary size="small" @click="handleAttachClick" circle>
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </template>
            </NButton>
          </template>
          {{ t('chat.attachFiles') }}
        </NTooltip>

        <NTooltip v-if="isVoiceSupported" trigger="hover">
          <template #trigger>
            <NButton
              quaternary
              size="small"
              circle
              :type="isRecording ? 'error' : 'default'"
              @click="toggleRecording"
            >
              <template #icon>
                <svg v-if="!isRecording" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </template>
            </NButton>
          </template>
          {{ isRecording ? t('chat.stopRecording') : t('chat.startRecording') }}
        </NTooltip>

        <NButton
          v-if="chatStore.isStreaming"
          size="small"
          type="error"
          @click="chatStore.stopStreaming()"
        >
          {{ t('chat.stop') }}
        </NButton>

        <NButton
          size="small"
          type="primary"
          :disabled="!canSend || chatStore.isStreaming"
          :loading="isPreparing"
          @click="handleSend"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </template>
          {{ t('chat.send') }}
        </NButton>
      </div>
    </div>

    <div class="input-hint-row">
      <span>{{ t('chat.inputHint') }}</span>
      <span>{{ t('chat.attachmentUsage', { count: attachments.length, size: formatSize(totalAttachmentSize) }) }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-input-area {
  padding: 12px 20px 16px;
  border-top: 1px solid rgba($border-color, 0.9);
  background: linear-gradient(180deg, rgba($bg-primary, 0.84), rgba($bg-primary, 0.95));
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.input-errors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.error-chip {
  font-size: 12px;
  color: $error;
  background: rgba($error, 0.08);
  border: 1px solid rgba($error, 0.3);
  border-radius: 999px;
  padding: 4px 10px;
}

.attachment-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 0 10px;
}

.attachment-preview {
  position: relative;
  border-radius: $radius-sm;
  overflow: hidden;
  background-color: $bg-secondary;
  border: 1px solid $border-color;

  &.image {
    width: 64px;
    height: 64px;
  }
}

.attachment-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attachment-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 12px;
  min-width: 80px;
  max-width: 140px;
  color: $text-secondary;

  .file-name {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .file-size {
    font-size: 10px;
    color: $text-muted;
  }
}

.attachment-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity $transition-fast;

  .attachment-preview:hover & {
    opacity: 1;
  }
}

.file-input-hidden {
  display: none;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: $bg-input;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 10px 12px;
  transition: border-color $transition-fast;

  &:focus-within {
    border-color: $accent-primary;
  }
}

.drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba($accent-primary, 0.08);
  color: $accent-primary;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  z-index: 2;
  border-radius: inherit;
}

.input-textarea {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: $text-primary;
  font-family: $font-ui;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  max-height: 180px;
  min-height: 22px;
  overflow-y: auto;

  &::placeholder {
    color: $text-muted;
  }
}

.input-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}

.input-hint-row {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: $text-muted;
}

// Drag-over state
.input-wrapper.drag-over {
  border-color: #4a90d9;
  border-style: dashed;
  background-color: rgba(74, 144, 217, 0.04);
}
</style>

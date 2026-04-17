<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { NButton, NTooltip, NModal, useMessage } from 'naive-ui'
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
const albumInputRef = ref<HTMLInputElement>()
const attachments = ref<Attachment[]>([])
const isDragging = ref(false)
const dragCounter = ref(0)
const isComposing = ref(false)
const isPreparing = ref(false)
const inputError = ref<string | null>(null)

const MAX_FILES = 99
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_TOTAL_SIZE = 500 * 1024 * 1024

// Voice recording state
const isRecording = ref(false)
const isVoiceSupported = ref(false)
const voiceError = ref<string | null>(null)
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

interface ArchiveEntrySummary {
  name: string
  size?: number
  isDir: boolean
}

const showImagePreview = ref(false)
const imagePreviewIndex = ref(0)
const showArchivePreview = ref(false)
const archiveLoading = ref(false)
const archivePreviewTitle = ref('')
const archiveEntries = ref<ArchiveEntrySummary[]>([])
const archivePreviewError = ref('')

const totalAttachmentSize = computed(() => attachments.value.reduce((sum, a) => sum + a.size, 0))
const imageAttachments = computed(() => attachments.value.filter((item) => isImage(item.type)))
const imageAttachmentCount = computed(() => imageAttachments.value.length)
const fileAttachmentCount = computed(() => attachments.value.length - imageAttachmentCount.value)
const currentPreviewImage = computed(() => imageAttachments.value[imagePreviewIndex.value] || null)
const canPreviewPrevImage = computed(() => imagePreviewIndex.value > 0)
const canPreviewNextImage = computed(() => imagePreviewIndex.value < imageAttachments.value.length - 1)
const canSend = computed(() => (inputText.value.trim() || attachments.value.length > 0) && !isPreparing.value)
const draftKey = computed(() => `chat:draft:${chatStore.activeSessionId || 'new'}`)
const sessionAttachmentKey = computed(() => chatStore.activeSessionId || 'new')

// Check voice support on mount
onMounted(() => {
  isVoiceSupported.value = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  inputText.value = localStorage.getItem(draftKey.value) || ''
  attachments.value = chatStore.getAttachmentDraft(sessionAttachmentKey.value)
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

watch(sessionAttachmentKey, (nextKey, prevKey) => {
  if (prevKey) {
    chatStore.setAttachmentDraft(prevKey, attachments.value)
  }
  attachments.value = chatStore.getAttachmentDraft(nextKey)
})

watch(inputText, (value) => {
  if (value.trim()) {
    localStorage.setItem(draftKey.value, value)
  } else {
    localStorage.removeItem(draftKey.value)
  }
})

watch(attachments, (value) => {
  chatStore.setAttachmentDraft(sessionAttachmentKey.value, value)
}, { deep: true })

watch(imageAttachments, (list) => {
  if (!list.length) {
    imagePreviewIndex.value = 0
    showImagePreview.value = false
    return
  }
  if (imagePreviewIndex.value > list.length - 1) {
    imagePreviewIndex.value = list.length - 1
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
  chatStore.setAttachmentDraft(sessionAttachmentKey.value, attachments.value)
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

function addFiles(files: File[]) {
  for (const file of files) addFile(file)
}

function handleAttachClick() {
  fileInputRef.value?.click()
}

function handleAlbumClick() {
  albumInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  addFiles(Array.from(input.files))
  input.value = ''
}

function handleAlbumChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  const files = Array.from(input.files)
  addFiles(files)
  if (files.length > 0) {
    toast.success(t('chat.albumAdded', { count: files.length }))
  }
  input.value = ''
}

// --- Paste image ---
function handlePaste(e: ClipboardEvent) {
  const items = Array.from(e.clipboardData?.items || [])
  const imageItems = items.filter(i => i.type.startsWith('image/'))
  if (!imageItems.length) return
  e.preventDefault()
  const files: File[] = []
  for (const item of imageItems) {
    const blob = item.getAsFile()
    if (!blob) continue
    const ext = item.type.split('/')[1] || 'png'
    files.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type: item.type }))
  }
  addFiles(files)
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
  addFiles(files)
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
      chatStore.clearAttachmentDraft(sessionAttachmentKey.value)
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
    await chatStore.sendHybridInput(text, sendingAttachments.length > 0 ? sendingAttachments : undefined)
    inputText.value = ''
    localStorage.removeItem(draftKey.value)
    clearAttachments()
    chatStore.clearAttachmentDraft(sessionAttachmentKey.value)

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

function openImagePreviewByAttachment(attachmentId: string) {
  const index = imageAttachments.value.findIndex((item) => item.id === attachmentId)
  if (index < 0) return
  imagePreviewIndex.value = index
  showImagePreview.value = true
}

function closeImagePreview() {
  showImagePreview.value = false
}

function previewPrevImage() {
  if (!canPreviewPrevImage.value) return
  imagePreviewIndex.value -= 1
}

function previewNextImage() {
  if (!canPreviewNextImage.value) return
  imagePreviewIndex.value += 1
}

async function openArchivePreview(att: Attachment) {
  archivePreviewTitle.value = att.name
  archiveEntries.value = []
  archivePreviewError.value = ''
  showArchivePreview.value = true
  archiveLoading.value = true

  try {
    if (!att.file) {
      throw new Error(t('chat.archivePreviewUnavailable'))
    }

    const lower = att.name.toLowerCase()
    if (!lower.endsWith('.zip')) {
      throw new Error(t('chat.archivePreviewZipOnly'))
    }

    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(att.file)
    const entries = Object.values(zip.files).map((entry) => {
      const rawEntry = entry as any
      return {
        name: entry.name,
        size: rawEntry?._data?.uncompressedSize,
        isDir: entry.dir,
      }
    })

    archiveEntries.value = entries.slice(0, 200)
    if (!archiveEntries.value.length) {
      archivePreviewError.value = t('chat.archivePreviewEmpty')
    }
  } catch (err: any) {
    archivePreviewError.value = err?.message || t('chat.archivePreviewFailed')
  } finally {
    archiveLoading.value = false
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

function isArchiveFile(name: string, type: string): boolean {
  const lower = name.toLowerCase()
  if (type.includes('zip') || type.includes('x-7z') || type.includes('x-rar')) return true
  return ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz', '.tbz2', '.txz', '.tar.gz', '.tar.bz2', '.tar.xz'].some((ext) => lower.endsWith(ext))
}

function applySlashCommand(command: '/new' | '/clear' | '/model') {
  inputText.value = command === '/model' ? '/model ' : command
  requestAnimationFrame(() => {
    textareaRef.value?.focus()
    if (textareaRef.value) {
      const len = textareaRef.value.value.length
      textareaRef.value.setSelectionRange(len, len)
    }
  })
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
          <img :src="att.url" :alt="att.name" class="attachment-thumb" @click="openImagePreviewByAttachment(att.id)" />
        </template>
        <template v-else>
          <div class="attachment-file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="file-name">{{ att.name }}</span>
            <span class="file-size">{{ formatSize(att.size) }}</span>
            <div class="file-tags-row">
              <span v-if="isArchiveFile(att.name, att.type)" class="file-archive-tag">{{ t('chat.archiveTag') }}</span>
              <button
                v-if="isArchiveFile(att.name, att.type)"
                class="archive-preview-btn"
                type="button"
                @click="openArchivePreview(att)"
              >
                {{ t('chat.previewArchive') }}
              </button>
            </div>
          </div>
        </template>
        <button class="attachment-remove" @click="removeAttachment(att.id)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div v-if="imageAttachmentCount > 1" class="album-summary">
      {{ t('chat.albumSummary', { count: imageAttachmentCount }) }}
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
      <input
        ref="albumInputRef"
        type="file"
        accept="image/*"
        multiple
        class="file-input-hidden"
        @change="handleAlbumChange"
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

        <NTooltip trigger="hover">
          <template #trigger>
            <NButton quaternary size="small" @click="handleAlbumClick" circle>
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="1.5" />
                  <path d="M21 16l-5-5-6 6-3-3-4 4" />
                </svg>
              </template>
            </NButton>
          </template>
          {{ t('chat.addAlbum') }}
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
      <div class="input-hint-left">
        <span>{{ t('chat.inputHint') }}</span>
        <div class="slash-shortcuts">
          <button @click="applySlashCommand('/new')">/new</button>
          <button @click="applySlashCommand('/clear')">/clear</button>
          <button @click="applySlashCommand('/model')">/model</button>
        </div>
      </div>
      <span>
        {{ t('chat.attachmentUsage', { count: attachments.length, size: formatSize(totalAttachmentSize) }) }}
        · {{ t('chat.imageCount', { count: imageAttachmentCount }) }}
        · {{ t('chat.fileCount', { count: fileAttachmentCount }) }}
      </span>
    </div>

    <NModal v-model:show="showImagePreview" preset="card" :title="currentPreviewImage?.name || t('chat.albumPreviewTitle')" class="album-preview-modal" size="huge" :bordered="false">
      <div v-if="currentPreviewImage" class="album-preview-body">
        <img :src="currentPreviewImage.url" :alt="currentPreviewImage.name" class="album-preview-image" />
        <div class="album-preview-meta">
          <span>{{ t('chat.albumPreviewIndex', { index: imagePreviewIndex + 1, total: imageAttachmentCount }) }}</span>
          <span>{{ formatSize(currentPreviewImage.size) }}</span>
        </div>
        <div class="album-preview-actions">
          <NButton size="small" secondary :disabled="!canPreviewPrevImage" @click="previewPrevImage">{{ t('chat.prevImage') }}</NButton>
          <NButton size="small" secondary :disabled="!canPreviewNextImage" @click="previewNextImage">{{ t('chat.nextImage') }}</NButton>
          <NButton size="small" @click="closeImagePreview">{{ t('common.done') }}</NButton>
        </div>
      </div>
    </NModal>

    <NModal v-model:show="showArchivePreview" preset="card" :title="t('chat.archivePreviewTitle', { name: archivePreviewTitle })" class="archive-preview-modal" size="large" :bordered="false">
      <div class="archive-preview-body">
        <div v-if="archiveLoading" class="archive-preview-loading">{{ t('common.loading') }}</div>
        <div v-else-if="archivePreviewError" class="archive-preview-error">{{ archivePreviewError }}</div>
        <div v-else class="archive-preview-list">
          <div class="archive-preview-row" v-for="entry in archiveEntries" :key="entry.name">
            <span class="archive-entry-name">{{ entry.name }}</span>
            <span class="archive-entry-size">{{ entry.isDir ? t('chat.archiveDirectory') : formatSize(entry.size || 0) }}</span>
          </div>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-input-area {
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  background: linear-gradient(180deg, rgba($bg-primary, 0.66), rgba($bg-primary, 0.92));
  backdrop-filter: blur(16px);
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

.album-summary {
  margin-top: -2px;
  margin-bottom: 10px;
  font-size: 11px;
  color: $text-muted;
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
  cursor: zoom-in;
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

  .file-tags-row {
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .file-archive-tag {
    font-size: 10px;
    color: #ffd79a;
    border: 1px solid rgba(255, 215, 154, 0.5);
    border-radius: 999px;
    padding: 0 6px;
    line-height: 1.4;
  }

  .archive-preview-btn {
    border: 1px solid rgba(#6dddff, 0.4);
    border-radius: 999px;
    background: rgba(#6dddff, 0.1);
    color: #ccefff;
    font-size: 10px;
    padding: 0 6px;
    line-height: 1.5;
    cursor: pointer;
  }
}

.attachment-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.56);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity $transition-fast, border-color $transition-fast;

  &:hover {
    border-color: rgba(#6dddff, 0.6);
  }

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
  background: rgba(31, 39, 43, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 10px 12px;
  transition: border-color $transition-fast, box-shadow $transition-fast, background-color $transition-fast;

  &:focus-within {
    border-color: rgba(#6dddff, 0.75);
    box-shadow: 0 0 0 1px rgba(#6dddff, 0.3), 0 0 24px rgba(#6dddff, 0.12);
    background: rgba(31, 39, 43, 0.52);
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
  color: rgba($text-muted, 0.95);
  padding-inline: 4px;
  flex-wrap: wrap;
}

.input-hint-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.slash-shortcuts {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;

  button {
    border: 1px solid rgba($border-color, 0.7);
    background: rgba($bg-secondary, 0.45);
    color: $text-secondary;
    border-radius: 999px;
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;

    &:hover {
      color: #d7edff;
      border-color: rgba(#6dddff, 0.48);
      background: rgba(#6dddff, 0.14);
    }
  }
}

.album-preview-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.album-preview-image {
  width: 100%;
  max-height: min(68vh, 720px);
  border-radius: 12px;
  object-fit: contain;
  background: rgba(0, 0, 0, 0.35);
}

.album-preview-meta {
  display: flex;
  justify-content: space-between;
  color: $text-muted;
  font-size: 12px;
}

.album-preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.archive-preview-body {
  max-height: min(65vh, 560px);
  overflow-y: auto;
}

.archive-preview-loading,
.archive-preview-error {
  font-size: 13px;
  color: $text-muted;
}

.archive-preview-error {
  color: $error;
}

.archive-preview-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.archive-preview-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid rgba($border-color, 0.6);
  border-radius: 8px;
  padding: 6px 8px;
  background: rgba($bg-secondary, 0.5);
}

.archive-entry-name {
  font-size: 12px;
  color: $text-primary;
  word-break: break-all;
}

.archive-entry-size {
  font-size: 11px;
  color: $text-muted;
  white-space: nowrap;
}

// Drag-over state
.input-wrapper.drag-over {
  border-color: #4a90d9;
  border-style: dashed;
  background-color: rgba(74, 144, 217, 0.04);
}
</style>

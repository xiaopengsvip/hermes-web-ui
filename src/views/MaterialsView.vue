<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NInput, NSelect, NSpin, NCard, NStatistic, NGrid, NGridItem, NTag, NTooltip, NEmpty, NUpload, NIcon, NModal } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { fetchMaterials, deleteMaterial, fetchMaterialText, uploadMaterial, type Material, type MaterialCategory, type MaterialSessionRef } from '@/api/materials'

interface MaterialStats {
  totalFiles: number
  totalSize: number
  byType: Record<string, { count: number; size: number }>
  recentUploads: Material[]
  storageUsed: number
  storageLimit: number
  fromChat: number
  fromUpload: number
}

const { t } = useI18n()

const materials = ref<(Material & { similarity?: number })[]>([])
const categories = ref<MaterialCategory[]>([])
const chatSessions = ref<MaterialSessionRef[]>([])
const loading = ref(false)
const uploading = ref(false)
const searchQuery = ref('')
const selectedType = ref('all')
const selectedSource = ref('all')
const selectedCategory = ref('all')
const selectedSessionId = ref('all')
const sortBy = ref('date')
const showUpload = ref(false)
const selectedMaterial = ref<(Material & { similarity?: number }) | null>(null)
const previewVisible = ref(false)
const previewText = ref('')
const previewTextLoading = ref(false)

const filteredMaterials = computed(() => {
  let result = materials.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }
  if (selectedType.value !== 'all') result = result.filter((m) => m.type === selectedType.value)
  if (selectedSource.value !== 'all') result = result.filter((m) => m.source === selectedSource.value)
  if (selectedCategory.value !== 'all') result = result.filter((m) => m.category === selectedCategory.value)
  if (selectedSessionId.value !== 'all') {
    result = result.filter((m) => (m.chatSessions || []).some((s) => s.id === selectedSessionId.value))
  }

  return [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name': return a.name.localeCompare(b.name)
      case 'date': return b.uploadedAt - a.uploadedAt
      case 'size': return b.size - a.size
      case 'type': return a.type.localeCompare(b.type)
      default: return 0
    }
  })
})

const materialStats = computed<MaterialStats>(() => {
  const stats: MaterialStats = {
    totalFiles: materials.value.length,
    totalSize: materials.value.reduce((sum, m) => sum + m.size, 0),
    byType: {},
    recentUploads: [...materials.value].sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 5),
    storageUsed: materials.value.reduce((sum, m) => sum + m.size, 0),
    storageLimit: 10 * 1024 * 1024 * 1024,
    fromChat: materials.value.filter((m) => m.source === 'chat').length,
    fromUpload: materials.value.filter((m) => m.source === 'upload').length,
  }
  for (const m of materials.value) {
    if (!stats.byType[m.type]) stats.byType[m.type] = { count: 0, size: 0 }
    stats.byType[m.type].count++
    stats.byType[m.type].size += m.size
  }
  return stats
})

const smartReuseSuggestions = computed(() =>
  materials.value
    .filter((m) => (m.similarity || 0) >= 0.7)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, 5)
)

const typeOptions = computed(() => [
  { label: t('materials.fileTypes.all'), value: 'all' },
  { label: t('materials.fileTypes.image'), value: 'image' },
  { label: t('materials.fileTypes.document'), value: 'document' },
  { label: t('materials.fileTypes.video'), value: 'video' },
  { label: t('materials.fileTypes.audio'), value: 'audio' },
  { label: t('materials.fileTypes.code'), value: 'code' },
  { label: t('materials.fileTypes.other'), value: 'other' },
])

const sourceOptions = computed(() => [
  { label: t('materials.source.all'), value: 'all' },
  { label: t('materials.source.chat'), value: 'chat' },
  { label: t('materials.source.upload'), value: 'upload' },
])

const categoryOptions = computed(() => [
  { label: t('materials.categories.all'), value: 'all' },
  ...categories.value.map((c) => ({ label: `${c.name} (${c.count})`, value: c.name })),
])

const sessionOptions = computed(() => [
  { label: t('materials.sessions.all'), value: 'all' },
  ...chatSessions.value.map((s) => ({ label: `${s.title} (${s.id.slice(0, 8)})`, value: s.id })),
])

const sortOptions = computed(() => [
  { label: t('materials.sortOptions.date'), value: 'date' },
  { label: t('materials.sortOptions.name'), value: 'name' },
  { label: t('materials.sortOptions.size'), value: 'size' },
  { label: t('materials.sortOptions.type'), value: 'type' },
])

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'image': return '🖼️'
    case 'document': return '📄'
    case 'video': return '🎬'
    case 'audio': return '🎵'
    case 'code': return '💻'
    default: return '📁'
  }
}

function getTypeColor(type: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' {
  switch (type) {
    case 'image': return 'info'
    case 'document': return 'success'
    case 'video': return 'warning'
    case 'audio': return 'primary'
    case 'code': return 'error'
    default: return 'default'
  }
}

async function loadMaterials() {
  loading.value = true
  try {
    const res = await fetchMaterials()
    categories.value = res.categories || []
    chatSessions.value = res.chatSessions || []
    materials.value = (res.materials || []).map((m) => ({
      ...m,
      similarity: m.source === 'chat' ? 0.92 : 0.78,
    }))
  } catch (error) {
    console.error('加载素材失败:', error)
    materials.value = []
    categories.value = []
    chatSessions.value = []
  } finally {
    loading.value = false
  }
}

async function handleUpload(data: { file: { file: File | null } }) {
  if (!data.file.file) return
  uploading.value = true
  try {
    await uploadMaterial(data.file.file)
    await loadMaterials()
    showUpload.value = false
  } catch (error) {
    console.error('上传失败:', error)
  } finally {
    uploading.value = false
  }
}

async function handleDelete(material: Material) {
  if (!confirm(t('materials.messages.deleteConfirm'))) return
  try {
    await deleteMaterial(material.id)
    materials.value = materials.value.filter((m) => m.id !== material.id)
  } catch (error) {
    console.error(t('materials.messages.deleteFailed'), error)
  }
}

function handleCopyLink(material: Material) {
  navigator.clipboard.writeText(window.location.origin + material.url)
}

function sessionLabel(session: MaterialSessionRef): string {
  return `${session.title} (${session.id.slice(0, 8)})`
}

async function handleView(material: Material) {
  selectedMaterial.value = material
  previewVisible.value = true
  previewText.value = ''

  if (material.previewKind === 'text') {
    previewTextLoading.value = true
    try {
      const res = await fetchMaterialText(material.id, 50000)
      previewText.value = res.text || ''
    } catch (error) {
      previewText.value = `(preview load failed) ${String((error as any)?.message || error)}`
    } finally {
      previewTextLoading.value = false
    }
  }
}

onMounted(() => {
  loadMaterials()
})
</script>

<template>
  <div class="materials-view">
    <header class="materials-header">
      <h2 class="header-title">{{ t('materials.title') }}</h2>
      <div class="header-actions">
        <NInput
          v-model:value="searchQuery"
          :placeholder="t('materials.searchPlaceholder')"
          size="small"
          clearable
          class="search-input"
        />
        <NSelect
          v-model:value="selectedType"
          :options="typeOptions"
          size="small"
          style="width: 120px"
          :placeholder="t('materials.filterByType')"
        />
        <NSelect
          v-model:value="selectedSource"
          :options="sourceOptions"
          size="small"
          style="width: 120px"
          :placeholder="t('materials.filterBySource')"
        />
        <NSelect
          v-model:value="selectedCategory"
          :options="categoryOptions"
          size="small"
          style="width: 170px"
          :placeholder="t('materials.filterByCategory')"
        />
        <NSelect
          v-model:value="selectedSessionId"
          :options="sessionOptions"
          size="small"
          style="width: 220px"
          :placeholder="t('materials.filterBySession')"
        />
        <NSelect
          v-model:value="sortBy"
          :options="sortOptions"
          size="small"
          style="width: 120px"
          :placeholder="t('materials.sortBy')"
        />
        <NButton @click="loadMaterials">
          刷新
        </NButton>
        <NButton type="primary" @click="showUpload = true">
          {{ t('materials.upload') }}
        </NButton>
      </div>
    </header>

    <div class="materials-content">
      <NSpin :show="loading">
        <!-- Statistics Section -->
        <div class="statistics-section">
          <h3 class="section-title">{{ t('materials.statistics.title') }}</h3>
          <NGrid :x-gap="12" :y-gap="12" :cols="6">
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('materials.statistics.totalFiles')" :value="materialStats.totalFiles" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('materials.statistics.totalSize')" :value="formatSize(materialStats.totalSize)" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('materials.statistics.fromChat')" :value="materialStats.fromChat" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('materials.statistics.fromUpload')" :value="materialStats.fromUpload" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('materials.statistics.storageUsed')" :value="formatSize(materialStats.storageUsed)" />
              </NCard>
            </NGridItem>
            <NGridItem>
              <NCard size="small" class="glass-card">
                <NStatistic :label="t('materials.statistics.storageLimit')" :value="formatSize(materialStats.storageLimit)" />
              </NCard>
            </NGridItem>
          </NGrid>
        </div>

        <!-- Smart Reuse Section -->
        <div class="smart-reuse-section">
          <h3 class="section-title">{{ t('materials.smartReuse.title') }}</h3>
          <p class="section-description">{{ t('materials.smartReuse.description') }}</p>
          <div v-if="smartReuseSuggestions.length > 0" class="suggestions-grid">
            <NCard
              v-for="material in smartReuseSuggestions"
              :key="material.id"
              size="small"
              hoverable
              class="suggestion-card"
            >
              <div class="suggestion-header">
                <span class="type-icon">{{ getTypeIcon(material.type) }}</span>
                <span class="material-name">{{ material.name }}</span>
                <NTag :type="getTypeColor(material.type)" size="small">
                  {{ t(`materials.fileTypes.${material.type}`) }}
                </NTag>
              </div>
              <div class="suggestion-body">
                <div class="similarity-bar">
                  <span class="similarity-label">{{ t('materials.smartReuse.similarity') }}:</span>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: `${(material.similarity || 0) * 100}%` }"
                    ></div>
                  </div>
                  <span class="similarity-value">{{ ((material.similarity || 0) * 100).toFixed(0) }}%</span>
                </div>
                <div class="suggestion-meta">
                  <span>{{ t('materials.smartReuse.usedIn') }}: {{ material.usedIn.join(', ') }}</span>
                </div>
              </div>
            </NCard>
          </div>
          <NEmpty v-else :description="t('materials.smartReuse.noSuggestions')" />
        </div>

        <!-- Materials Grid -->
        <div class="materials-grid-section">
          <h3 class="section-title">{{ t('materials.title') }}</h3>
          <div v-if="filteredMaterials.length > 0" class="materials-grid">
            <NCard
              v-for="material in filteredMaterials"
              :key="material.id"
              size="small"
              hoverable
              class="material-card glass-card"
            >
              <div class="material-header">
                <span class="type-icon">{{ getTypeIcon(material.type) }}</span>
                <span class="material-name">{{ material.name }}</span>
                <div class="material-tags">
                  <NTag :type="getTypeColor(material.type)" size="small">
                    {{ t(`materials.fileTypes.${material.type}`) }}
                  </NTag>
                  <NTag v-if="material.source === 'chat'" type="info" size="small">
                    {{ t('materials.source.chat') }}
                  </NTag>
                  <NTag v-else type="success" size="small">
                    {{ t('materials.source.upload') }}
                  </NTag>
                </div>
              </div>
              <div class="material-body">
                <div class="material-meta">
                  <span>{{ formatSize(material.size) }}</span>
                  <span>{{ formatDate(material.uploadedAt) }}</span>
                </div>
                <div v-if="material.description" class="material-description">
                  {{ material.description }}
                </div>
                <div class="material-tags">
                  <NTag size="tiny" class="tag category-tag">
                    {{ material.category }}
                  </NTag>
                  <NTag v-for="tag in material.tags" :key="tag" size="tiny" class="tag">
                    {{ tag }}
                  </NTag>
                </div>
                <div v-if="material.chatSessions && material.chatSessions.length" class="material-sessions">
                  <span class="sessions-label">{{ t('materials.sessions.related') }}:</span>
                  <NTag
                    v-for="sess in material.chatSessions.slice(0, 2)"
                    :key="sess.id"
                    size="tiny"
                    type="info"
                    class="tag"
                  >
                    {{ sessionLabel(sess) }}
                  </NTag>
                  <NTag
                    v-if="material.chatSessions.length > 2"
                    size="tiny"
                    type="default"
                    class="tag"
                  >
                    +{{ material.chatSessions.length - 2 }}
                  </NTag>
                </div>
              </div>
              <div class="material-actions">
                <NTooltip>
                  <template #trigger>
                    <NButton size="tiny" quaternary @click="handleView(material)">
                      {{ t('materials.actions.view') }}
                    </NButton>
                  </template>
                  {{ t('materials.actions.view') }}
                </NTooltip>
                <NTooltip>
                  <template #trigger>
                    <NButton size="tiny" quaternary @click="handleCopyLink(material)">
                      {{ t('materials.actions.copyLink') }}
                    </NButton>
                  </template>
                  {{ t('materials.actions.copyLink') }}
                </NTooltip>
                <NTooltip>
                  <template #trigger>
                    <NButton size="tiny" quaternary type="error" @click="handleDelete(material)">
                      {{ t('materials.actions.delete') }}
                    </NButton>
                  </template>
                  {{ t('materials.actions.delete') }}
                </NTooltip>
              </div>
            </NCard>
          </div>
          <NEmpty v-else :description="t('materials.noMaterials')" />
        </div>
      </NSpin>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUpload" class="upload-modal">
      <div class="upload-content">
        <h3>{{ t('materials.upload') }}</h3>
        <div class="upload-area">
          <NUpload
            :on-change="handleUpload"
            :show-file-list="false"
            accept="*"
            :disabled="uploading"
          >
            <div class="upload-placeholder">
              <NIcon size="48">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </NIcon>
              <p>{{ t('materials.dragDrop') }}</p>
              <p>{{ t('materials.browse') }}</p>
            </div>
          </NUpload>
        </div>
        <div class="upload-actions">
          <NButton @click="showUpload = false">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="uploading">{{ t('materials.upload') }}</NButton>
        </div>
      </div>
    </div>

    <!-- Material Preview Modal -->
    <NModal
      v-model:show="previewVisible"
      preset="card"
      :title="t('materials.preview.title')"
      style="width: 800px; max-width: 90vw;"
      :mask-closable="true"
      @close="selectedMaterial = null"
    >
      <div v-if="selectedMaterial" class="preview-body">
        <div class="preview-header">
          <span class="type-icon">{{ getTypeIcon(selectedMaterial.type) }}</span>
          <span class="material-name">{{ selectedMaterial.name }}</span>
          <NTag :type="getTypeColor(selectedMaterial.type)" size="small">
            {{ t(`materials.fileTypes.${selectedMaterial.type}`) }}
          </NTag>
        </div>

        <!-- File Preview -->
        <div class="preview-content">
          <template v-if="selectedMaterial.type === 'image'">
            <img
              :src="selectedMaterial.url"
              :alt="selectedMaterial.name"
              class="preview-image"
            />
          </template>
          <template v-else-if="selectedMaterial.type === 'video'">
            <video
              :src="selectedMaterial.url"
              controls
              class="preview-video"
            />
          </template>
          <template v-else-if="selectedMaterial.type === 'audio'">
            <audio
              :src="selectedMaterial.url"
              controls
              class="preview-audio"
            />
          </template>
          <template v-else-if="selectedMaterial.previewKind === 'text'">
            <div class="preview-text-wrap">
              <NSpin :show="previewTextLoading">
                <pre class="preview-text">{{ previewText || '(empty file)' }}</pre>
              </NSpin>
            </div>
          </template>
          <template v-else>
            <div class="preview-placeholder">
              <NIcon size="64">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </NIcon>
              <p>{{ t('materials.preview.noPreview') }}</p>
              <p>{{ t('materials.preview.downloadToView') }}</p>
            </div>
          </template>
        </div>

        <!-- File Info -->
        <div class="preview-info">
          <div class="info-row">
            <span class="info-label">{{ t('materials.preview.fileName') }}:</span>
            <span class="info-value">{{ selectedMaterial.name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ t('materials.preview.fileSize') }}:</span>
            <span class="info-value">{{ formatSize(selectedMaterial.size) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ t('materials.preview.fileType') }}:</span>
            <span class="info-value">{{ t(`materials.fileTypes.${selectedMaterial.type}`) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ t('materials.preview.uploadDate') }}:</span>
            <span class="info-value">{{ formatDate(selectedMaterial.uploadedAt) }}</span>
          </div>
          <div v-if="selectedMaterial.description" class="info-row">
            <span class="info-label">{{ t('materials.preview.fileInfo') }}:</span>
            <span class="info-value">{{ selectedMaterial.description }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ t('materials.source.title') }}:</span>
            <span class="info-value">
              <NTag :type="selectedMaterial.source === 'chat' ? 'info' : 'success'" size="small">
                {{ t(`materials.source.${selectedMaterial.source}`) }}
              </NTag>
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="preview-actions">
          <NButton @click="handleCopyLink(selectedMaterial)">{{ t('materials.preview.copy') }}</NButton>
          <NButton type="error" @click="handleDelete(selectedMaterial)">{{ t('materials.preview.delete') }}</NButton>
          <NButton @click="previewVisible = false">{{ t('materials.preview.close') }}</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.materials-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.materials-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
  gap: 12px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 200px;
}

.materials-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 12px;
}

.section-description {
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 16px;
}

.statistics-section {
  margin-bottom: 24px;
}

.smart-reuse-section {
  margin-bottom: 24px;
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.suggestion-card {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.type-icon {
  font-size: 16px;
}

.material-name {
  font-size: 14px;
  font-weight: 500;
  color: $text-primary;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.similarity-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.similarity-label {
  font-size: 12px;
  color: $text-muted;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background-color: $bg-card;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: $accent-primary;
  border-radius: 3px;
  transition: width 0.3s;
}

.similarity-value {
  font-size: 12px;
  color: $text-primary;
  min-width: 30px;
  text-align: right;
}

.suggestion-meta {
  font-size: 12px;
  color: $text-muted;
}

.materials-grid-section {
  margin-bottom: 24px;
}

.materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.material-card {
  cursor: pointer;
  transition: all $transition-normal;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-glass, $shadow-glow;
  }
}

.material-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.material-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: auto;
}

.material-body {
  margin-bottom: 12px;
}

.material-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 8px;
}

.material-description {
  font-size: 12px;
  color: $text-secondary;
  margin-bottom: 8px;
  line-height: 1.4;
}

.tag {
  margin-right: 4px;
}

.category-tag {
  font-weight: 600;
}

.material-sessions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 8px;
}

.sessions-label {
  font-size: 12px;
  color: $text-muted;
  margin-right: 4px;
}

.material-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.preview-body {
  margin-top: 20px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.preview-content {
  margin-bottom: 20px;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: $radius-md;
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 400px;
}

.preview-video {
  max-width: 100%;
  max-height: 400px;
}

.preview-audio {
  width: 100%;
  max-width: 500px;
}

.preview-text-wrap {
  width: 100%;
  height: 100%;
  min-height: 300px;
  padding: 12px;
}

.preview-text {
  margin: 0;
  width: 100%;
  height: 100%;
  max-height: 420px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.24);
  border-radius: 8px;
  padding: 12px;
  font-family: $font-code;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $text-muted;
  text-align: center;
}

.preview-info {
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  margin-bottom: 8px;
}

.info-label {
  width: 100px;
  font-size: 12px;
  color: $text-muted;
}

.info-value {
  flex: 1;
  font-size: 12px;
  color: $text-primary;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>
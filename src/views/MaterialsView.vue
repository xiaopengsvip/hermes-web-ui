<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NInput, NSelect, NSpin, NCard, NStatistic, NGrid, NGridItem, NTag, NTooltip, NEmpty, NUpload, NIcon, NModal } from 'naive-ui'
import { useI18n } from 'vue-i18n'

interface Material {
  id: string
  name: string
  type: 'image' | 'document' | 'video' | 'audio' | 'code' | 'other'
  size: number
  uploadedAt: number
  lastModified: number
  url: string
  tags: string[]
  description?: string
  usedIn: string[]
  similarity?: number
  source: 'upload' | 'chat'
  chatSessionId?: string
  chatMessageId?: string
}

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

const materials = ref<Material[]>([])
const loading = ref(false)
const uploading = ref(false)
const searchQuery = ref('')
const selectedType = ref('all')
const sortBy = ref('date')
const showUpload = ref(false)
const selectedMaterial = ref<Material | null>(null)
const previewVisible = ref(false)

// Mock data for demonstration
const mockMaterials: Material[] = [
  {
    id: '1',
    name: '项目介绍.pptx',
    type: 'document',
    size: 2048576,
    uploadedAt: Date.now() - 86400000 * 2,
    lastModified: Date.now() - 86400000,
    url: '/materials/项目介绍.pptx',
    tags: ['演示文稿', '项目'],
    description: 'Hermes Agent 项目介绍演示文稿',
    usedIn: ['聊天会话', '定时任务'],
    similarity: 0.85,
    source: 'upload'
  },
  {
    id: '2',
    name: '系统架构图.png',
    type: 'image',
    size: 1024000,
    uploadedAt: Date.now() - 86400000 * 5,
    lastModified: Date.now() - 86400000 * 5,
    url: '/materials/系统架构图.png',
    tags: ['架构', '设计'],
    description: 'Hermes Agent 系统架构图',
    usedIn: ['文档', '演示'],
    similarity: 0.72,
    source: 'upload'
  },
  {
    id: '3',
    name: 'API文档.md',
    type: 'document',
    size: 512000,
    uploadedAt: Date.now() - 86400000 * 10,
    lastModified: Date.now() - 86400000 * 8,
    url: '/materials/API文档.md',
    tags: ['API', '文档'],
    description: 'Hermes Agent API 接口文档',
    usedIn: ['开发', '测试'],
    similarity: 0.93,
    source: 'upload'
  },
  {
    id: '4',
    name: '演示视频.mp4',
    type: 'video',
    size: 52428800,
    uploadedAt: Date.now() - 86400000 * 15,
    lastModified: Date.now() - 86400000 * 15,
    url: '/materials/演示视频.mp4',
    tags: ['演示', '视频'],
    description: 'Hermes Agent 功能演示视频',
    usedIn: ['宣传', '培训'],
    similarity: 0.68,
    source: 'upload'
  },
  {
    id: '5',
    name: '背景音乐.mp3',
    type: 'audio',
    size: 3145728,
    uploadedAt: Date.now() - 86400000 * 20,
    lastModified: Date.now() - 86400000 * 20,
    url: '/materials/背景音乐.mp3',
    tags: ['音乐', '背景'],
    description: '应用背景音乐',
    usedIn: ['视频', '演示'],
    similarity: 0.45,
    source: 'upload'
  },
  {
    id: '6',
    name: '配置文件.json',
    type: 'code',
    size: 102400,
    uploadedAt: Date.now() - 86400000 * 1,
    lastModified: Date.now() - 86400000 * 1,
    url: '/materials/配置文件.json',
    tags: ['配置', 'JSON'],
    description: '系统配置文件',
    usedIn: ['部署', '配置'],
    similarity: 0.88,
    source: 'upload'
  }
]

// Computed properties
const filteredMaterials = computed(() => {
  let result = materials.value

  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.tags.some(tag => tag.toLowerCase().includes(q))
    )
  }

  // Filter by type
  if (selectedType.value !== 'all') {
    result = result.filter(m => m.type === selectedType.value)
  }

  // Sort
  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'date':
        return b.uploadedAt - a.uploadedAt
      case 'size':
        return b.size - a.size
      case 'type':
        return a.type.localeCompare(b.type)
      default:
        return 0
    }
  })

  return result
})

const materialStats = computed<MaterialStats>(() => {
  const stats: MaterialStats = {
    totalFiles: materials.value.length,
    totalSize: materials.value.reduce((sum, m) => sum + m.size, 0),
    byType: {},
    recentUploads: [...materials.value]
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, 5),
    storageUsed: materials.value.reduce((sum, m) => sum + m.size, 0),
    storageLimit: 1073741824, // 1GB
    fromChat: materials.value.filter(m => m.source === 'chat').length,
    fromUpload: materials.value.filter(m => m.source === 'upload').length
  }

  // Calculate statistics by type
  materials.value.forEach(m => {
    if (!stats.byType[m.type]) {
      stats.byType[m.type] = { count: 0, size: 0 }
    }
    stats.byType[m.type].count++
    stats.byType[m.type].size += m.size
  })

  return stats
})

const smartReuseSuggestions = computed(() => {
  return materials.value
    .filter(m => m.similarity && m.similarity > 0.7)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, 5)
})

const typeOptions = computed(() => [
  { label: t('materials.fileTypes.all'), value: 'all' },
  { label: t('materials.fileTypes.image'), value: 'image' },
  { label: t('materials.fileTypes.document'), value: 'document' },
  { label: t('materials.fileTypes.video'), value: 'video' },
  { label: t('materials.fileTypes.audio'), value: 'audio' },
  { label: t('materials.fileTypes.code'), value: 'code' },
  { label: t('materials.fileTypes.other'), value: 'other' }
])

const sortOptions = computed(() => [
  { label: t('materials.sortOptions.date'), value: 'date' },
  { label: t('materials.sortOptions.name'), value: 'name' },
  { label: t('materials.sortOptions.size'), value: 'size' },
  { label: t('materials.sortOptions.type'), value: 'type' }
])

// Helper functions
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
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

// Event handlers
async function handleUpload(data: { file: { file: File | null } }) {
  if (!data.file.file) return
  uploading.value = true
  try {
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 1000))
    const newMaterial: Material = {
      id: Date.now().toString(),
      name: data.file.file!.name,
      type: getFileType(data.file.file!.name),
      size: data.file.file!.size,
      uploadedAt: Date.now(),
      lastModified: Date.now(),
      url: URL.createObjectURL(data.file.file!),
      tags: [],
      usedIn: [],
      source: 'upload'
    }
    materials.value.unshift(newMaterial)
    console.log('上传成功:', data.file.file!.name)
  } catch (error) {
    console.error('上传失败:', error)
  } finally {
    uploading.value = false
  }
}

function getFileType(filename: string): Material['type'] {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md'].includes(ext)) return 'document'
  if (['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return 'audio'
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'json', 'xml', 'html', 'css'].includes(ext)) return 'code'
  return 'other'
}

function handleDelete(material: Material) {
  if (confirm(t('materials.messages.deleteConfirm'))) {
    materials.value = materials.value.filter(m => m.id !== material.id)
    console.log(t('materials.messages.deleteSuccess'))
  }
}

function handleCopyLink(material: Material) {
  navigator.clipboard.writeText(window.location.origin + material.url)
  console.log(t('materials.messages.copySuccess'))
}

function handleView(material: Material) {
  selectedMaterial.value = material
  previewVisible.value = true
}

// Lifecycle
onMounted(() => {
  loading.value = true
  // Load mock data
  materials.value = [...mockMaterials]
  loading.value = false
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
          v-model:value="sortBy"
          :options="sortOptions"
          size="small"
          style="width: 120px"
          :placeholder="t('materials.sortBy')"
        />
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
                  <NTag v-for="tag in material.tags" :key="tag" size="tiny" class="tag">
                    {{ tag }}
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
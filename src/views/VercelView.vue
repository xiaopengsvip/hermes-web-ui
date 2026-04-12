<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NEmpty, NPopconfirm, useMessage, NModal
} from 'naive-ui'
import {
  fetchVercelProjects, fetchVercelDeployments, fetchVercelDomains,
  redeployVercelProject, deleteVercelProject,
  type VercelProject, type VercelDeployment, type VercelDomain
} from '@/api/vercel'

useI18n()
const message = useMessage()

const projects = ref<VercelProject[]>([])
const deployments = ref<VercelDeployment[]>([])
const loading = ref(true)
const loadingDeployments = ref(false)
const error = ref('')

// Detail modal
const showDetailModal = ref(false)
const selectedProject = ref<VercelProject | null>(null)
const projectDeployments = ref<VercelDeployment[]>([])
const projectDomains = ref<VercelDomain[]>([])

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [projRes, depRes] = await Promise.all([
      fetchVercelProjects(30),
      fetchVercelDeployments({ limit: 20 }),
    ])
    projects.value = projRes.projects
    deployments.value = depRes.deployments
  } catch (err: any) {
    error.value = err.message || 'Failed to load Vercel data'
  } finally {
    loading.value = false
  }
}

async function showDetails(project: VercelProject) {
  selectedProject.value = project
  showDetailModal.value = true
  loadingDeployments.value = true
  projectDeployments.value = []
  projectDomains.value = []
  try {
    const [depRes, domRes] = await Promise.all([
      fetchVercelDeployments({ projectId: project.id, limit: 10 }),
      fetchVercelDomains(project.id).catch(() => ({ domains: [] })),
    ])
    projectDeployments.value = depRes.deployments
    projectDomains.value = domRes.domains
  } catch {
    // ignore
  } finally {
    loadingDeployments.value = false
  }
}

async function handleRedeploy(project: VercelProject) {
  try {
    await redeployVercelProject(project.id)
    message.success('Redeployment triggered')
    await loadData()
  } catch (err: any) {
    message.error(err.message || 'Redeploy failed')
  }
}

async function handleDelete(project: VercelProject) {
  try {
    await deleteVercelProject(project.id)
    message.success('Project deleted')
    showDetailModal.value = false
    await loadData()
  } catch (err: any) {
    message.error(err.message || 'Delete failed')
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getStateColor(state: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (state) {
    case 'READY': case 'ready': return 'success'
    case 'BUILDING': case 'building': return 'warning'
    case 'ERROR': case 'error': return 'error'
    case 'QUEUED': case 'queued': return 'info'
    default: return 'default'
  }
}

function getFrameworkIcon(framework: string | null): string {
  if (!framework) return '📦'
  const icons: Record<string, string> = {
    nextjs: '▲', vue: '💚', react: '⚛️', vite: '⚡',
    svelte: '🔥', nuxt: '💚', astro: '🚀',
  }
  return icons[framework.toLowerCase()] || '📦'
}

onMounted(loadData)
</script>

<template>
  <div class="vercel-view">
    <header class="page-header">
      <h2>Vercel</h2>
      <div class="header-actions">
        <NButton size="small" @click="loadData" :loading="loading">Refresh</NButton>
      </div>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <NSpin :show="loading" style="min-height: 200px">
      <NEmpty v-if="!loading && projects.length === 0" description="No Vercel projects or token not configured" />
      <div v-else class="content-grid">
        <!-- Projects -->
        <section class="section">
          <h3>Projects ({{ projects.length }})</h3>
          <div class="project-list">
            <div
              v-for="project in projects"
              :key="project.id"
              class="project-card"
              @click="showDetails(project)"
            >
              <div class="project-header">
                <span class="project-icon">{{ getFrameworkIcon(project.framework) }}</span>
                <span class="project-name">{{ project.name }}</span>
                <span v-if="project.framework" class="project-framework">{{ project.framework }}</span>
              </div>
              <div class="project-meta">
                <span>Updated {{ formatRelativeTime(project.updatedAt) }}</span>
                <span v-if="project.link" class="project-repo">
                  {{ project.link.org }}/{{ project.link.repo }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Recent Deployments -->
        <section class="section">
          <h3>Recent Deployments</h3>
          <div class="deploy-list">
            <div v-for="dep in deployments" :key="dep.uid" class="deploy-item">
              <div class="deploy-left">
                <NTag :type="getStateColor(dep.state)" size="small">{{ dep.state }}</NTag>
                <span class="deploy-name">{{ dep.name }}</span>
                <span v-if="dep.meta?.githubCommitRef" class="deploy-branch">{{ dep.meta.githubCommitRef }}</span>
              </div>
              <div class="deploy-right">
                <a v-if="dep.state === 'READY'" :href="`https://${dep.url}`" target="_blank" class="deploy-url">
                  {{ dep.url }}
                </a>
                <span class="deploy-time">{{ formatRelativeTime(dep.createdAt) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </NSpin>

    <!-- Detail Modal -->
    <NModal
      v-model:show="showDetailModal"
      preset="card"
      :title="selectedProject?.name || ''"
      style="width: 650px; max-width: 90vw"
    >
      <div v-if="selectedProject" class="project-detail">
        <div class="detail-actions">
          <NButton size="small" type="primary" @click="handleRedeploy(selectedProject)">
            Redeploy
          </NButton>
          <NPopconfirm @positive-click="handleDelete(selectedProject)">
            <template #trigger>
              <NButton size="small" type="error">Delete Project</NButton>
            </template>
            Delete project "{{ selectedProject.name }}"?
          </NPopconfirm>
        </div>

        <div v-if="projectDomains.length > 0">
          <h4>Domains</h4>
          <div class="domain-list">
            <div v-for="domain in projectDomains" :key="domain.name" class="domain-item">
              <a :href="`https://${domain.name}`" target="_blank">{{ domain.name }}</a>
              <NTag v-if="domain.verified" size="tiny" type="success">verified</NTag>
              <NTag v-else size="tiny" type="warning">unverified</NTag>
            </div>
          </div>
        </div>

        <h4>Deployments</h4>
        <NSpin :show="loadingDeployments">
          <NEmpty v-if="!loadingDeployments && projectDeployments.length === 0" description="No deployments" />
          <div v-else class="deploy-detail-list">
            <div v-for="dep in projectDeployments" :key="dep.uid" class="deploy-detail-item">
              <div class="deploy-detail-header">
                <NTag :type="getStateColor(dep.state)" size="small">{{ dep.state }}</NTag>
                <span class="deploy-detail-time">{{ formatDate(dep.createdAt) }}</span>
              </div>
              <div v-if="dep.meta?.githubCommitMessage" class="deploy-detail-commit">
                {{ dep.meta.githubCommitMessage }}
              </div>
              <div v-if="dep.state === 'READY'" class="deploy-detail-url">
                <a :href="`https://${dep.url}`" target="_blank">{{ dep.url }}</a>
              </div>
            </div>
          </div>
        </NSpin>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.vercel-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-shrink: 0;

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: $text-primary;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-banner {
  padding: 10px 16px;
  background: rgba($error, 0.1);
  color: $error;
  border-radius: $radius-sm;
  margin-bottom: 16px;
  font-size: 13px;
}

.content-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  flex: 1;
}

.section h3 {
  font-size: 14px;
  font-weight: 600;
  color: $text-secondary;
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.project-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.project-card {
  padding: 12px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: $accent-primary;
  }
}

.project-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.project-icon { font-size: 16px; }

.project-name {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.project-framework {
  font-size: 11px;
  color: $text-muted;
  background: $bg-input;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: $text-muted;
}

.project-repo {
  font-family: $font-code;
  font-size: 11px;
}

.deploy-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.deploy-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: $bg-secondary;
  border-radius: $radius-sm;
  font-size: 13px;
}

.deploy-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deploy-name {
  font-weight: 500;
  color: $text-primary;
}

.deploy-branch {
  font-size: 11px;
  color: $text-muted;
  font-family: $font-code;
}

.deploy-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.deploy-url {
  font-size: 12px;
  color: $accent-primary;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.deploy-time {
  font-size: 11px;
  color: $text-muted;
}

.project-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.domain-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.domain-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  a {
    color: $accent-primary;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}

.deploy-detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deploy-detail-item {
  padding: 8px 0;
  border-bottom: 1px solid $border-color;
  &:last-child { border-bottom: none; }
}

.deploy-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deploy-detail-time {
  font-size: 12px;
  color: $text-muted;
}

.deploy-detail-commit {
  font-size: 13px;
  color: $text-primary;
  margin-top: 4px;
}

.deploy-detail-url {
  margin-top: 4px;
  a {
    font-size: 12px;
    color: $accent-primary;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}
</style>

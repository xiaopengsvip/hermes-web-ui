<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NEmpty, NInput, NModal,
  NPopconfirm, useMessage
} from 'naive-ui'
import {
  fetchGitHubRepos, fetchGitHubUser, fetchGitHubCommits,
  createGitHubRepo, deleteGitHubRepo,
  type GitHubRepo, type GitHubUser, type GitHubCommit
} from '@/api/github'

useI18n()
const message = useMessage()

const repos = ref<GitHubRepo[]>([])
const user = ref<GitHubUser | null>(null)
const loading = ref(true)
const error = ref('')
const sortField = ref('updated')
const searchQuery = ref('')

// Create modal
const showCreateModal = ref(false)
const newRepoName = ref('')
const newRepoDesc = ref('')
const newRepoPrivate = ref(false)
const creating = ref(false)

// Detail modal
const showDetailModal = ref(false)
const selectedRepo = ref<GitHubRepo | null>(null)
const commits = ref<GitHubCommit[]>([])
const loadingCommits = ref(false)

const filteredRepos = computed(() => {
  let result = repos.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.full_name.toLowerCase().includes(q)
    )
  }
  return result
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [userRes, reposRes] = await Promise.all([
      fetchGitHubUser().catch(() => null),
      fetchGitHubRepos({ sort: sortField.value, per_page: 100 }),
    ])
    user.value = userRes
    repos.value = reposRes.repos
  } catch (err: any) {
    error.value = err.message || 'Failed to load GitHub data'
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!newRepoName.value.trim()) return
  creating.value = true
  try {
    await createGitHubRepo({
      name: newRepoName.value.trim(),
      description: newRepoDesc.value.trim() || undefined,
      private: newRepoPrivate.value,
      auto_init: true,
    })
    message.success('Repository created')
    showCreateModal.value = false
    newRepoName.value = ''
    newRepoDesc.value = ''
    newRepoPrivate.value = false
    await loadData()
  } catch (err: any) {
    message.error(err.message || 'Create failed')
  } finally {
    creating.value = false
  }
}

async function handleDelete(repo: GitHubRepo) {
  try {
    const [owner, name] = repo.full_name.split('/')
    await deleteGitHubRepo(owner, name)
    message.success('Repository deleted')
    await loadData()
  } catch (err: any) {
    message.error(err.message || 'Delete failed')
  }
}

async function showDetails(repo: GitHubRepo) {
  selectedRepo.value = repo
  showDetailModal.value = true
  loadingCommits.value = true
  commits.value = []
  try {
    const [owner, name] = repo.full_name.split('/')
    const res = await fetchGitHubCommits(owner, name, 10)
    commits.value = res.commits
  } catch {
    // ignore
  } finally {
    loadingCommits.value = false
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getLangColor(lang: string | null): string {
  const colors: Record<string, string> = {
    TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
    Vue: '#41b883', Go: '#00ADD8', Rust: '#dea584',
    Java: '#b07219', CSS: '#563d7c', HTML: '#e34c26',
    Shell: '#89e051', Ruby: '#701516',
  }
  return colors[lang || ''] || '#888'
}

onMounted(loadData)
</script>

<template>
  <div class="github-view">
    <header class="page-header">
      <div class="header-left">
        <h2>GitHub</h2>
        <div v-if="user" class="user-info">
          <img :src="user.avatar_url" :alt="user.login" class="user-avatar" />
          <span class="user-name">{{ user.name || user.login }}</span>
        </div>
      </div>
      <div class="header-actions">
        <NInput
          v-model:value="searchQuery"
          placeholder="Search repos..."
          size="small"
          clearable
          style="width: 200px"
        />
        <NButton size="small" @click="loadData" :loading="loading">
          Refresh
        </NButton>
        <NButton size="small" type="primary" @click="showCreateModal = true">
          New Repo
        </NButton>
      </div>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <NSpin :show="loading" style="min-height: 200px">
      <NEmpty v-if="!loading && filteredRepos.length === 0" description="No repositories" />
      <div v-else class="repo-grid">
        <div
          v-for="repo in filteredRepos"
          :key="repo.full_name"
          class="repo-card"
          @click="showDetails(repo)"
        >
          <div class="repo-header">
            <div class="repo-name">
              <svg v-if="repo.private" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lock-icon">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{{ repo.name }}</span>
            </div>
            <NPopconfirm @positive-click.stop="handleDelete(repo)">
              <template #trigger>
                <button class="delete-btn" @click.stop>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </template>
              Delete {{ repo.full_name }}?
            </NPopconfirm>
          </div>
          <p v-if="repo.description" class="repo-desc">{{ repo.description }}</p>
          <div class="repo-meta">
            <span v-if="repo.language" class="repo-lang">
              <span class="lang-dot" :style="{ backgroundColor: getLangColor(repo.language) }"></span>
              {{ repo.language }}
            </span>
            <span class="repo-stars">★ {{ repo.stargazers_count }}</span>
            <span class="repo-forks">⑂ {{ repo.forks_count }}</span>
            <span class="repo-updated">{{ formatRelativeTime(repo.pushed_at) }}</span>
          </div>
          <div v-if="repo.topics?.length" class="repo-topics">
            <NTag v-for="topic in repo.topics.slice(0, 4)" :key="topic" size="tiny" round>
              {{ topic }}
            </NTag>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- Create Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="dialog"
      title="Create Repository"
      positive-text="Create"
      :loading="creating"
      @positive-click="handleCreate"
    >
      <div class="modal-form">
        <div class="form-field">
          <label>Name</label>
          <NInput v-model:value="newRepoName" placeholder="repository-name" />
        </div>
        <div class="form-field">
          <label>Description</label>
          <NInput v-model:value="newRepoDesc" type="textarea" placeholder="Optional description" :rows="2" />
        </div>
        <div class="form-field">
          <label>
            <input type="checkbox" v-model="newRepoPrivate" />
            Private repository
          </label>
        </div>
      </div>
    </NModal>

    <!-- Detail Modal -->
    <NModal
      v-model:show="showDetailModal"
      preset="card"
      :title="selectedRepo?.full_name || ''"
      style="width: 600px; max-width: 90vw"
    >
      <div v-if="selectedRepo" class="repo-detail">
        <div class="detail-links">
          <a :href="selectedRepo.html_url" target="_blank" class="link-btn">
            Open in GitHub →
          </a>
          <span class="clone-url">{{ selectedRepo.ssh_url }}</span>
        </div>
        <div class="detail-info">
          <span>Branch: <strong>{{ selectedRepo.default_branch }}</strong></span>
          <span>Issues: {{ selectedRepo.open_issues_count }}</span>
          <span>Updated: {{ formatDate(selectedRepo.updated_at) }}</span>
        </div>
        <h4>Recent Commits</h4>
        <NSpin :show="loadingCommits">
          <NEmpty v-if="!loadingCommits && commits.length === 0" description="No commits" />
          <div v-else class="commit-list">
            <div v-for="commit in commits" :key="commit.sha" class="commit-item">
              <span class="commit-sha">{{ commit.sha }}</span>
              <a :href="commit.url" target="_blank" class="commit-msg">{{ commit.message }}</a>
              <span class="commit-date">{{ formatRelativeTime(commit.author.date) }}</span>
            </div>
          </div>
        </NSpin>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.github-view {
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

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.user-name {
  font-size: 13px;
  color: $text-secondary;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.error-banner {
  padding: 10px 16px;
  background: rgba($error, 0.1);
  color: $error;
  border-radius: $radius-sm;
  margin-bottom: 16px;
  font-size: 13px;
}

.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  overflow-y: auto;
  flex: 1;
}

.repo-card {
  padding: 14px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: $accent-primary;
    background: rgba($accent-primary, 0.03);
  }
}

.repo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.repo-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: $accent-primary;

  svg { flex-shrink: 0; color: $text-muted; }
}

.delete-btn {
  opacity: 0;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: $text-muted;
  border-radius: 4px;
  transition: all $transition-fast;

  .repo-card:hover & { opacity: 0.5; }
  &:hover { opacity: 1; color: $error; background: rgba($error, 0.1); }
}

.repo-desc {
  font-size: 12px;
  color: $text-secondary;
  margin: 4px 0 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: $text-muted;
}

.repo-lang {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.repo-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 10px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 13px;
    color: $text-secondary;
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.repo-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.link-btn {
  font-size: 13px;
  color: $accent-primary;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.clone-url {
  font-size: 12px;
  color: $text-muted;
  font-family: $font-code;
  background: $bg-secondary;
  padding: 2px 8px;
  border-radius: 4px;
}

.detail-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: $text-secondary;
}

.commit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.commit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 0;
  border-bottom: 1px solid $border-color;

  &:last-child { border-bottom: none; }
}

.commit-sha {
  font-family: $font-code;
  color: $accent-primary;
  font-size: 11px;
}

.commit-msg {
  flex: 1;
  color: $text-primary;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &:hover { text-decoration: underline; }
}

.commit-date {
  color: $text-muted;
  font-size: 11px;
  flex-shrink: 0;
}
</style>

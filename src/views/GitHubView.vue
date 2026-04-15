<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NEmpty, NInput, NModal,
  NPopconfirm, useMessage
} from 'naive-ui'
import {
  fetchGitHubRepos, fetchGitHubUser, fetchGitHubCommits,
  createGitHubRepo, deleteGitHubRepo, checkGitHubToken, saveGitHubToken,
  type GitHubRepo, type GitHubUser, type GitHubCommit
} from '@/api/github'

const { t } = useI18n()
const message = useMessage()

const repos = ref<GitHubRepo[]>([])
const user = ref<GitHubUser | null>(null)
const loading = ref(true)
const error = ref('')
const sortField = ref('updated')
const searchQuery = ref('')

// Token setup
const tokenChecked = ref(false)
const tokenConfigured = ref(false)
const setupToken = ref('')
const savingToken = ref(false)

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
const defaultProjectAvatar = '/everettlogo.jpg'

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

async function checkToken() {
  try {
    const res = await checkGitHubToken()
    tokenConfigured.value = res.configured
  } catch {
    tokenConfigured.value = false
  }
  tokenChecked.value = true
}

async function handleSaveToken() {
  if (!setupToken.value.trim()) return
  savingToken.value = true
  try {
    const res = await saveGitHubToken(setupToken.value.trim())
    if (res.success || !res.error) {
      message.success(t('github.messages.tokenSaved'))
      tokenConfigured.value = true
      setupToken.value = ''
      await loadData()
    } else {
      message.error(res.error || t('github.messages.saveTokenFailed'))
    }
  } catch (err: any) {
    message.error(err.message || t('github.messages.saveTokenFailed'))
  } finally {
    savingToken.value = false
  }
}

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
    const msg = err.message || t('github.messages.loadFailed')
    if (msg.includes('No GitHub token') || msg.includes('401')) {
      tokenConfigured.value = false
      tokenChecked.value = true
    } else {
      error.value = msg
    }
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
    message.success(t('github.messages.repoCreated'))
    showCreateModal.value = false
    newRepoName.value = ''
    newRepoDesc.value = ''
    newRepoPrivate.value = false
    await loadData()
  } catch (err: any) {
    message.error(err.message || t('github.messages.createFailed'))
  } finally {
    creating.value = false
  }
}

async function handleDelete(repo: GitHubRepo) {
  try {
    const [owner, name] = repo.full_name.split('/')
    await deleteGitHubRepo(owner, name)
    message.success(t('github.messages.repoDeleted'))
    await loadData()
  } catch (err: any) {
    message.error(err.message || t('github.messages.deleteFailed'))
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
  if (mins < 60) return t('github.time.minutesAgo', { value: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('github.time.hoursAgo', { value: hours })
  const days = Math.floor(hours / 24)
  return t('github.time.daysAgo', { value: days })
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

onMounted(async () => {
  await checkToken()
  if (tokenConfigured.value) {
    await loadData()
  } else {
    loading.value = false
  }
})
</script>

<template>
  <div class="github-view">
    <!-- Token Setup Screen -->
    <div v-if="tokenChecked && !tokenConfigured" class="setup-screen">
      <div class="setup-card">
        <div class="setup-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
          </svg>
        </div>
        <h2>{{ t('github.connectTitle') }}</h2>
        <p class="setup-desc">
          {{ t('github.connectDesc') }}
        </p>
        <div class="setup-form">
          <NInput
            v-model:value="setupToken"
            type="password"
            :placeholder="t('github.placeholder.token')"
            show-password-on="click"
            size="large"
          />
          <NButton
            type="primary"
            size="large"
            block
            :loading="savingToken"
            :disabled="!setupToken.trim()"
            @click="handleSaveToken"
                    >
            {{ t('github.actions.saveToken') }}
          </NButton>
        </div>
        <p class="setup-help">
          {{ t('github.tokenHelp') }}
        </p>
      </div>
    </div>

    <!-- Main Content (token configured) -->
    <template v-else-if="tokenConfigured">
      <header class="page-header">
        <div class="header-left">
          <h2>{{ t('sidebar.github') }}</h2>
          <div v-if="user" class="user-info">
            <img :src="user.avatar_url" :alt="user.login" class="user-avatar" />
            <span class="user-name">{{ user.name || user.login }}</span>
          </div>
        </div>
        <div class="header-actions">
          <NInput
            v-model:value="searchQuery"
            :placeholder="t('github.placeholder.searchRepos')"
            size="small"
            clearable
            style="width: 200px"
          />
          <NButton size="small" @click="loadData" :loading="loading">
            {{ t('common.refresh') }}
          </NButton>
          <NButton size="small" type="primary" @click="showCreateModal = true">
            {{ t('github.actions.newRepo') }}
          </NButton>
        </div>
      </header>

      <div class="github-content">
        <div v-if="error" class="error-banner">{{ error }}</div>

      <NSpin :show="loading" style="min-height: 200px">
        <NEmpty v-if="!loading && filteredRepos.length === 0" :description="t('github.empty.noRepos')" />
        <div v-else class="repo-grid">
          <div
            v-for="repo in filteredRepos"
            :key="repo.full_name"
            class="repo-card"
            @click="showDetails(repo)"
          >
            <div class="repo-header">
              <img :src="defaultProjectAvatar" :alt="t('github.repoAvatarAlt')" class="repo-avatar" />
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
                {{ t('github.messages.deleteConfirm', { name: repo.full_name }) }}
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
        :title="t('github.modal.createRepo')"
        :positive-text="t('common.create')"
        :loading="creating"
        @positive-click="handleCreate"
      >
        <div class="modal-form">
          <div class="form-field">
            <label>{{ t('github.fields.name') }}</label>
            <NInput v-model:value="newRepoName" :placeholder="t('github.placeholder.repoName')" />
          </div>
          <div class="form-field">
            <label>{{ t('github.fields.description') }}</label>
            <NInput v-model:value="newRepoDesc" type="textarea" :placeholder="t('github.placeholder.repoDesc')" :rows="2" />
          </div>
          <div class="form-field">
            <label>
              <input type="checkbox" v-model="newRepoPrivate" />
              {{ t('github.fields.privateRepo') }}
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
              {{ t('github.actions.openInGithub') }}
            </a>
            <span class="clone-url">{{ selectedRepo.ssh_url }}</span>
          </div>
          <div class="detail-info">
            <span>{{ t('github.fields.branch') }}: <strong>{{ selectedRepo.default_branch }}</strong></span>
            <span>{{ t('github.fields.issues') }}: {{ selectedRepo.open_issues_count }}</span>
            <span>{{ t('github.fields.updated') }}: {{ formatDate(selectedRepo.updated_at) }}</span>
          </div>
          <h4>{{ t('github.recentCommits') }}</h4>
          <NSpin :show="loadingCommits">
            <NEmpty v-if="!loadingCommits && commits.length === 0" :description="t('github.empty.noCommits')" />
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

    <!-- Loading state -->
    <NSpin v-else style="min-height: 200px" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.github-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

// Setup Screen
.setup-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  padding: 24px 16px;
}

.setup-card {
  text-align: center;
  max-width: 520px;
  width: 100%;
  padding: 32px 28px;
  border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 84%, transparent);
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 92%, transparent),
    color-mix(in srgb, var(--theme-background-secondary, #14141f) 95%, transparent)
  );
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);

  h2 {
    font-size: 22px;
    font-weight: 600;
    color: $text-primary;
    margin: 16px 0 8px;
  }
}

.setup-icon {
  color: $text-muted;
  margin-bottom: 8px;

  svg {
    opacity: 0.6;
  }
}

.setup-desc {
  font-size: 14px;
  color: $text-secondary;
  margin: 0 0 24px;
  line-height: 1.5;
}

.setup-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setup-help {
  font-size: 12px;
  color: $text-muted;
  margin: 16px 0 0;
}

// Main content
.page-header {
  margin-bottom: 0;
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: $text-primary;
  }
}

.github-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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
  border: 1px solid color-mix(in srgb, var(--theme-border, #fff) 84%, transparent);
  border-radius: 14px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-card, rgba(255, 255, 255, 0.08)) 93%, transparent),
    color-mix(in srgb, var(--theme-background-secondary, #14141f) 96%, transparent)
  );
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
  cursor: pointer;
  transition: transform $transition-fast, border-color $transition-fast, box-shadow $transition-fast;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba($accent-primary, 0.55);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
  }
}

.repo-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.repo-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid $border-color;
  flex-shrink: 0;
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
  margin-left: auto;
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
  gap: 10px;
  padding: 6px 10px;
  background: $bg-secondary;
  border-radius: $radius-sm;
}

.commit-sha {
  font-size: 11px;
  font-family: $font-code;
  color: $accent-primary;
  flex-shrink: 0;
}

.commit-msg {
  font-size: 12px;
  color: $text-primary;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;

  &:hover { color: $accent-primary; text-decoration: underline; }
}

.commit-date {
  font-size: 11px;
  color: $text-muted;
  flex-shrink: 0;
}
</style>

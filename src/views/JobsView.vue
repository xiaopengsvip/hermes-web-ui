<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { NAlert, NButton, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import JobsPanel from '@/components/jobs/JobsPanel.vue'
import JobFormModal from '@/components/jobs/JobFormModal.vue'
import { useJobsStore } from '@/stores/jobs'
import type { Job } from '@/api/jobs'
import { appendJobRuntimeNotification } from '@/utils/jobNotifications'

const { t } = useI18n()
const message = useMessage()
const jobsStore = useJobsStore()
const showModal = ref(false)
const editingJob = ref<string | null>(null)
const timer = ref<number | null>(null)
const hasBaseline = ref(false)
const statusSnapshot = ref<Record<string, string>>({})
const isRefreshing = ref(false)

const POLL_ACTIVE_MS = 15000
const POLL_HIDDEN_MS = 60000

function jobKey(job: Job): string {
  return job.job_id || job.id
}

function jobSnapshotValue(job: Job): string {
  return `${job.last_run_at || ''}|${job.last_status || ''}|${job.last_delivery_error || ''}`
}

function deliveryHint(job: Job): string {
  if (job.deliver === 'origin' && job.origin) {
    return `${job.origin.platform}:${job.origin.chat_name || job.origin.chat_id}`
  }
  if (job.deliver === 'origin' && !job.origin) {
    return t('jobs.target.originMissing')
  }
  if (job.deliver === 'local') {
    return t('jobs.target.local')
  }
  return job.deliver
}

async function refreshJobs(emitRuntimeNotice = true) {
  if (isRefreshing.value) return
  isRefreshing.value = true

  try {
    await jobsStore.fetchJobs()

    const nextSnapshot: Record<string, string> = {}
    for (const job of jobsStore.jobs) {
      const key = jobKey(job)
      const nextSig = jobSnapshotValue(job)
      const prevSig = statusSnapshot.value[key]
      nextSnapshot[key] = nextSig

      if (!hasBaseline.value || !emitRuntimeNotice) continue
      if (!job.last_run_at || !prevSig || prevSig === nextSig) continue

      if (job.last_status === 'ok' && !job.last_delivery_error) {
        const target = deliveryHint(job)
        message.success(t('jobs.messages.jobDelivered', { name: job.name, target }))
        appendJobRuntimeNotification({
          key,
          jobId: key,
          name: job.name,
          status: 'ok',
          target,
          runAt: job.last_run_at,
        })
        continue
      }

      if (job.last_delivery_error) {
        message.warning(t('jobs.messages.jobDeliveryFailed', {
          name: job.name,
          error: job.last_delivery_error,
        }))
        appendJobRuntimeNotification({
          key,
          jobId: key,
          name: job.name,
          status: 'error',
          target: deliveryHint(job),
          error: job.last_delivery_error,
          runAt: job.last_run_at,
        })
        continue
      }

      message.warning(t('jobs.messages.jobRunStateChanged', {
        name: job.name,
        status: job.last_status || 'unknown',
      }))
      appendJobRuntimeNotification({
        key,
        jobId: key,
        name: job.name,
        status: 'state',
        target: deliveryHint(job),
        error: job.last_status || 'unknown',
        runAt: job.last_run_at,
      })
    }

    statusSnapshot.value = nextSnapshot
    hasBaseline.value = true
  } finally {
    isRefreshing.value = false
  }
}

function clearPollingTimer() {
  if (timer.value) {
    window.clearInterval(timer.value)
    timer.value = null
  }
}

function schedulePolling() {
  clearPollingTimer()
  const interval = document.hidden ? POLL_HIDDEN_MS : POLL_ACTIVE_MS
  timer.value = window.setInterval(() => {
    refreshJobs(true)
  }, interval)
}

async function handleVisibilityChange() {
  schedulePolling()
  if (!document.hidden) {
    await refreshJobs(true)
  }
}

onMounted(async () => {
  await refreshJobs(false)
  schedulePolling()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  clearPollingTimer()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

function openCreateModal() {
  editingJob.value = null
  showModal.value = true
}

function openEditModal(jobId: string) {
  editingJob.value = jobId
  showModal.value = true
}

function handleModalClose() {
  showModal.value = false
  editingJob.value = null
}

async function handleSave() {
  await refreshJobs(false)
  handleModalClose()
}
</script>

<template>
  <div class="jobs-view">
    <header class="jobs-header">
      <h2 class="header-title">{{ t('jobs.scheduledJobs') }}</h2>
      <NButton type="primary" @click="openCreateModal">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </template>
        {{ t('jobs.createJob') }}
      </NButton>
    </header>

    <div class="jobs-content">
      <NAlert type="info" class="jobs-tip" :show-icon="false">
        {{ t('jobs.originHelp') }}
      </NAlert>
      <NSpin :show="jobsStore.loading && jobsStore.jobs.length === 0">
        <JobsPanel @edit="openEditModal" />
      </NSpin>
    </div>

    <JobFormModal
      v-if="showModal"
      :job-id="editingJob"
      @close="handleModalClose"
      @saved="handleSave"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.jobs-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.jobs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid color-mix(in srgb, $border-color 84%, transparent);
  flex-shrink: 0;
}

.header-title {
  font-size: 17px;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: 0.02em;
}

.jobs-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.jobs-content > * {
  width: min(1120px, 100%);
}

.jobs-tip {
  margin-bottom: 0;
  border: 1px solid color-mix(in srgb, $border-color 80%, transparent);
  border-radius: 12px;
}

@media (max-width: 768px) {
  .jobs-header {
    padding: 10px 12px;
  }

  .jobs-content {
    padding: 12px 10px 18px;
  }
}
</style>

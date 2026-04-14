<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpin, NTag, NEmpty, NInput, NModal,
  NPopconfirm, useMessage, NSelect
} from 'naive-ui'
import {
  fetchCloudflareZones, fetchDnsRecords, createDnsRecord, deleteDnsRecord,
  fetchCloudflareWorkers, purgeCache,
  type CloudflareZone, type CloudflareDnsRecord, type CloudflareWorker
} from '@/api/cloudflare'

const { t } = useI18n()
const message = useMessage()

const zones = ref<CloudflareZone[]>([])
const workers = ref<CloudflareWorker[]>([])
const loading = ref(true)
const error = ref('')
const activeTab = ref<'zones' | 'dns' | 'workers'>('zones')

// Zone selection
const selectedZone = ref<CloudflareZone | null>(null)
const dnsRecords = ref<CloudflareDnsRecord[]>([])
const loadingDns = ref(false)

// DNS Create
const showCreateDns = ref(false)
const newDnsType = ref('A')
const newDnsName = ref('')
const newDnsContent = ref('')
const newDnsProxied = ref(true)
const creatingDns = ref(false)

const dnsTypeOptions = [
  { label: 'A', value: 'A' },
  { label: 'AAAA', value: 'AAAA' },
  { label: 'CNAME', value: 'CNAME' },
  { label: 'MX', value: 'MX' },
  { label: 'TXT', value: 'TXT' },
  { label: 'NS', value: 'NS' },
  { label: 'SRV', value: 'SRV' },
  { label: 'CAA', value: 'CAA' },
]

const filteredZones = computed(() => zones.value)

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [z, w] = await Promise.all([
      fetchCloudflareZones(),
      fetchCloudflareWorkers()
    ])
    zones.value = z
    workers.value = w
    if (z.length > 0 && !selectedZone.value) {
      selectedZone.value = z[0]
      await loadDnsRecords(z[0].id)
    }
  } catch (err: any) {
    error.value = err.message || t('cloudflare.messages.loadFailed')
  } finally {
    loading.value = false
  }
}

async function loadDnsRecords(zoneId: string) {
  loadingDns.value = true
  try {
    dnsRecords.value = await fetchDnsRecords(zoneId)
  } finally {
    loadingDns.value = false
  }
}

async function selectZone(zone: CloudflareZone) {
  selectedZone.value = zone
  activeTab.value = 'dns'
  await loadDnsRecords(zone.id)
}

async function handleCreateDns() {
  if (!selectedZone.value || !newDnsName.value.trim() || !newDnsContent.value.trim()) return
  creatingDns.value = true
  try {
    const record = await createDnsRecord(selectedZone.value.id, {
      type: newDnsType.value,
      name: newDnsName.value.trim(),
      content: newDnsContent.value.trim(),
      proxied: newDnsProxied.value,
    })
    if (record) {
      dnsRecords.value.push(record)
      message.success(t('cloudflare.messages.recordCreated'))
      showCreateDns.value = false
      newDnsName.value = ''
      newDnsContent.value = ''
    }
  } catch (err: any) {
    message.error(err.message || t('cloudflare.messages.createFailed'))
  } finally {
    creatingDns.value = false
  }
}

async function handleDeleteDns(record: CloudflareDnsRecord) {
  if (!selectedZone.value) return
  const ok = await deleteDnsRecord(selectedZone.value.id, record.id)
  if (ok) {
    dnsRecords.value = dnsRecords.value.filter(r => r.id !== record.id)
    message.success(t('cloudflare.messages.recordDeleted'))
  } else {
    message.error(t('cloudflare.messages.deleteFailed'))
  }
}

async function handlePurgeCache() {
  if (!selectedZone.value) return
  const ok = await purgeCache(selectedZone.value.id)
  if (ok) {
    message.success(t('cloudflare.messages.cachePurged'))
  } else {
    message.error(t('cloudflare.messages.purgeFailed'))
  }
}

function getStatusType(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'active': return 'success'
    case 'pending': return 'warning'
    case 'moved': return 'info'
    default: return 'error'
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return t('cloudflare.units.byte', { value: bytes })
  if (bytes < 1024 * 1024) {
    return t('cloudflare.units.kb', { value: (bytes / 1024).toFixed(1) })
  }
  return t('cloudflare.units.mb', { value: (bytes / (1024 * 1024)).toFixed(1) })
}

onMounted(loadData)
</script>

<template>
  <div class="cloudflare-view">
    <header class="page-header">
      <div class="header-left">
        <h2>{{ t('sidebar.cloudflare') }}</h2>
        <div v-if="selectedZone" class="zone-badge">
          <NTag :type="getStatusType(selectedZone.status)" size="tiny">{{ selectedZone.status }}</NTag>
          <span class="zone-name">{{ selectedZone.name }}</span>
        </div>
      </div>
      <div class="header-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'zones' }"
          @click="activeTab = 'zones'"
                >{{ t('cloudflare.tabs.zones') }}</button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'dns' }"
          @click="activeTab = 'dns'"
        >{{ t('cloudflare.tabs.dns') }}</button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'workers' }"
          @click="activeTab = 'workers'"
        >{{ t('cloudflare.tabs.workers') }}</button>
      </div>
      <div class="header-actions">
        <NButton v-if="selectedZone && activeTab === 'dns'" size="small" @click="handlePurgeCache">
          {{ t('cloudflare.actions.purgeCache') }}
        </NButton>
        <NButton v-if="activeTab === 'dns' && selectedZone" size="small" type="primary" @click="showCreateDns = true">
          {{ t('cloudflare.actions.addRecord') }}
        </NButton>
        <NButton size="small" @click="loadData" :loading="loading">{{ t('common.refresh') }}</NButton>
      </div>
    </header>

    <div class="cloudflare-content">
      <div v-if="error" class="error-banner">{{ error }}</div>

      <!-- Zones Tab -->
      <div v-if="activeTab === 'zones'" class="tab-content">
        <NSpin :show="loading && zones.length === 0" style="min-height: 200px">
          <NEmpty v-if="!loading && zones.length === 0" :description="t('cloudflare.empty.noZones')" />
          <div v-else class="zone-grid">
            <div
              v-for="zone in filteredZones"
              :key="zone.id"
              class="zone-card"
              :class="{ selected: selectedZone?.id === zone.id }"
              @click="selectZone(zone)"
            >
              <div class="zone-card-header">
                <span class="zone-card-name">{{ zone.name }}</span>
                <NTag :type="getStatusType(zone.status)" size="tiny">{{ zone.status }}</NTag>
              </div>
              <div class="zone-card-meta">
                <span class="meta-item">
                  <span class="meta-label">{{ t('cloudflare.fields.plan') }}</span>
                  <span class="meta-value">{{ zone.plan?.name || t('cloudflare.fields.freePlan') }}</span>
                </span>
                <span class="meta-item">
                  <span class="meta-label">{{ t('cloudflare.fields.ns') }}</span>
                  <span class="meta-value">{{ zone.name_servers?.[0] || '—' }}</span>
                </span>
              </div>
              <div class="zone-card-footer">
                <span class="meta-date">{{ formatDate(zone.created_on) }}</span>
              </div>
            </div>
          </div>
        </NSpin>
      </div>

      <!-- DNS Tab -->
      <div v-if="activeTab === 'dns'" class="tab-content">
        <div v-if="!selectedZone" class="empty-state">
          <NEmpty :description="t('cloudflare.empty.selectZoneForDns')" />
        </div>
        <NSpin v-else :show="loadingDns" style="min-height: 200px">
          <NEmpty v-if="!loadingDns && dnsRecords.length === 0" :description="t('cloudflare.empty.noDnsRecords')" />
          <div v-else class="dns-table">
            <div class="dns-header-row">
              <span class="dns-col-type">{{ t('cloudflare.fields.type') }}</span>
              <span class="dns-col-name">{{ t('cloudflare.fields.name') }}</span>
              <span class="dns-col-content">{{ t('cloudflare.fields.content') }}</span>
              <span class="dns-col-proxied">{{ t('cloudflare.fields.proxied') }}</span>
              <span class="dns-col-ttl">{{ t('cloudflare.fields.ttl') }}</span>
              <span class="dns-col-actions"></span>
            </div>
            <div v-for="record in dnsRecords" :key="record.id" class="dns-row">
              <span class="dns-col-type">
                <NTag size="tiny" :type="record.type === 'A' || record.type === 'AAAA' ? 'success' : 'info'">{{ record.type }}</NTag>
              </span>
              <span class="dns-col-name" :title="record.name">{{ record.name }}</span>
              <span class="dns-col-content" :title="record.content">{{ record.content }}</span>
              <span class="dns-col-proxied">
                <span class="proxy-dot" :class="{ active: record.proxied }"></span>
              </span>
              <span class="dns-col-ttl">{{ record.ttl === 1 ? t('cloudflare.fields.auto') : t('cloudflare.fields.ttlSeconds', { value: record.ttl }) }}</span>
              <span class="dns-col-actions">
                <NPopconfirm @positive-click="handleDeleteDns(record)">
                  <template #trigger>
                    <button class="delete-btn" @click.stop>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </template>
                  {{ t('cloudflare.messages.deleteRecordConfirm', { name: record.name }) }}
                </NPopconfirm>
              </span>
            </div>
          </div>
        </NSpin>
      </div>

      <!-- Workers Tab -->
      <div v-if="activeTab === 'workers'" class="tab-content">
        <NSpin :show="loading && workers.length === 0" style="min-height: 200px">
          <NEmpty v-if="!loading && workers.length === 0" :description="t('cloudflare.empty.noWorkers')" />
          <div v-else class="worker-grid">
            <div v-for="worker in workers" :key="worker.id" class="worker-card">
              <div class="worker-name">{{ worker.name }}</div>
              <div class="worker-meta">
                <span>{{ formatSize(worker.size) }}</span>
                <span>{{ formatDate(worker.modified_on) }}</span>
              </div>
            </div>
          </div>
        </NSpin>
      </div>
    </div>

    <!-- Create DNS Modal -->
    <NModal
      v-model:show="showCreateDns"
      preset="dialog"
      :title="t('cloudflare.modal.addDnsRecord')"
      :positive-text="t('common.create')"
      :negative-text="t('common.cancel')"
      :positive-button-props="{ loading: creatingDns, disabled: !newDnsName.trim() || !newDnsContent.trim() }"
      @positive-click="handleCreateDns"
    >
      <div class="dns-form">
        <div class="form-row">
          <label>{{ t('cloudflare.fields.type') }}</label>
          <NSelect v-model:value="newDnsType" :options="dnsTypeOptions" style="width: 100px" />
        </div>
        <div class="form-row">
          <label>{{ t('cloudflare.fields.name') }}</label>
          <NInput v-model:value="newDnsName" :placeholder="t('cloudflare.placeholder.nameExample')" />
        </div>
        <div class="form-row">
          <label>{{ t('cloudflare.fields.content') }}</label>
          <NInput v-model:value="newDnsContent" :placeholder="t('cloudflare.placeholder.contentExample')" />
        </div>
        <div class="form-row">
          <label>{{ t('cloudflare.fields.proxied') }}</label>
          <button class="proxy-toggle" :class="{ active: newDnsProxied }" @click="newDnsProxied = !newDnsProxied">
            <span class="proxy-dot" :class="{ active: newDnsProxied }"></span>
            {{ newDnsProxied ? t('common.yes') : t('common.no') }}
          </button>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.cloudflare-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: $text-primary;
  }
}

.zone-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zone-name {
  font-size: 13px;
  color: $text-secondary;
  font-family: $font-code;
}

.header-tabs {
  display: flex;
  gap: 4px;
  background: $bg-secondary;
  border-radius: $radius-sm;
  padding: 3px;
}

.tab-btn {
  padding: 6px 16px;
  border: none;
  background: none;
  color: $text-secondary;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
  }

  &.active {
    background: $bg-primary;
    color: $accent-primary;
    font-weight: 500;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.cloudflare-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-content {
  min-height: 200px;
}

.error-banner {
  padding: 10px 16px;
  background: rgba($error, 0.1);
  color: $error;
  border-radius: $radius-sm;
  margin-bottom: 16px;
  font-size: 13px;
}

// Zones
.zone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.zone-card {
  padding: 16px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: rgba($accent-primary, 0.3);
    transform: translateY(-1px);
  }

  &.selected {
    border-color: $accent-primary;
    background: rgba($accent-primary, 0.05);
  }
}

.zone-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.zone-card-name {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
}

.zone-card-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: $text-muted;
  text-transform: uppercase;
}

.meta-value {
  font-size: 13px;
  color: $text-secondary;
}

.meta-date {
  font-size: 11px;
  color: $text-muted;
}

// DNS Table
.dns-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dns-header-row,
.dns-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 12px;
}

.dns-header-row {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid $border-color;
}

.dns-row {
  background: $bg-secondary;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text-primary;
  transition: background $transition-fast;

  &:hover {
    background: rgba($accent-primary, 0.04);
  }
}

.dns-col-type { width: 70px; flex-shrink: 0; }
.dns-col-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dns-col-content { flex: 1.5; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: $text-secondary; font-family: $font-code; font-size: 12px; }
.dns-col-proxied { width: 50px; flex-shrink: 0; text-align: center; }
.dns-col-ttl { width: 70px; flex-shrink: 0; color: $text-muted; font-size: 12px; }
.dns-col-actions { width: 40px; flex-shrink: 0; text-align: right; }

.proxy-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $text-muted;

  &.active {
    background: $success;
    box-shadow: 0 0 6px rgba($success, 0.5);
  }
}

.delete-btn {
  padding: 4px;
  border: none;
  background: none;
  color: $text-muted;
  cursor: pointer;
  border-radius: 4px;
  transition: all $transition-fast;

  &:hover {
    color: $error;
    background: rgba($error, 0.1);
  }
}

// Workers
.worker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.worker-card {
  padding: 16px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.worker-name {
  font-size: 14px;
  font-weight: 600;
  color: $accent-primary;
  margin-bottom: 8px;
  font-family: $font-code;
}

.worker-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: $text-muted;
}

// DNS Form
.dns-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;

  label {
    width: 70px;
    font-size: 13px;
    color: $text-secondary;
    flex-shrink: 0;
  }
}

.proxy-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid $border-color;
  background: $bg-secondary;
  color: $text-secondary;
  border-radius: $radius-sm;
  cursor: pointer;
  font-size: 13px;
  transition: all $transition-fast;

  &.active {
    border-color: $success;
    color: $success;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}
</style>

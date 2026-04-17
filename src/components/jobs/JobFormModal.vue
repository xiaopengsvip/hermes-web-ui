<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NSelect, NInputNumber, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useJobsStore } from '@/stores/jobs'

const { t } = useI18n()
const props = defineProps<{
  jobId: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const jobsStore = useJobsStore()
const message = useMessage()

const showModal = ref(true)
const loading = ref(false)

const formData = ref({
  name: '',
  schedule: '',
  prompt: '',
  deliver: 'local',
  repeat_times: null as number | null,
})

const presetValue = ref<string | null>(null)

const isEdit = computed(() => !!props.jobId)

const schedulePresets = [
  { label: t('jobs.presets.everyMinute'), value: '* * * * *' },
  { label: t('jobs.presets.every5Minutes'), value: '*/5 * * * *' },
  { label: t('jobs.presets.everyHour'), value: '0 * * * *' },
  { label: t('jobs.presets.midnight'), value: '0 0 * * *' },
  { label: t('jobs.presets.morning'), value: '0 9 * * *' },
  { label: t('jobs.presets.everyMondayMorning'), value: '0 9 * * 1' },
  { label: t('jobs.presets.everyMonthFirstMorning'), value: '0 9 1 * *' },
]

const targetOptions = [
  { label: t('jobs.target.origin'), value: 'origin' },
  { label: t('jobs.target.local'), value: 'local' },
]

const cronSummary = computed(() => {
  const v = formData.value.schedule.trim()
  if (!v) return t('jobs.cronSummary.empty')
  const hit = schedulePresets.find((item) => item.value === v)
  if (hit) return t('jobs.cronSummary.fromPreset', { label: hit.label })
  if (/^\* \* \* \* \*$/.test(v)) return t('jobs.cronSummary.everyMinute')
  if (/^\*\/\d+ \* \* \* \*$/.test(v)) return t('jobs.cronSummary.everyNMinutes')
  if (/^0 \* \* \* \*$/.test(v)) return t('jobs.cronSummary.everyHour')
  return t('jobs.cronSummary.custom')
})

function applyPreset(value: string | null) {
  if (!value) return
  presetValue.value = value
  formData.value.schedule = value
}

onMounted(async () => {
  if (props.jobId) {
    try {
      const { getJob } = await import('@/api/jobs')
      const job = await getJob(props.jobId)
      formData.value = {
        name: job.name,
        schedule: typeof job.schedule === 'string' ? job.schedule : (job.schedule?.expr || job.schedule_display || ''),
        prompt: job.prompt,
        deliver: job.deliver || 'local',
        repeat_times: typeof job.repeat === 'number' ? job.repeat : (typeof job.repeat === 'object' ? job.repeat.times : null),
      }
    } catch (e: any) {
      message.error(`${t('jobs.messages.failedLoadJob')}: ${e.message}`)
    }
  }
})

async function handleSave() {
  if (!formData.value.name.trim()) {
    message.warning(t('jobs.validation.nameRequired'))
    return
  }
  if (!formData.value.schedule.trim()) {
    message.warning(t('jobs.validation.scheduleRequired'))
    return
  }

  loading.value = true
  try {
    const payload = {
      name: formData.value.name,
      schedule: formData.value.schedule,
      prompt: formData.value.prompt,
      deliver: formData.value.deliver,
      repeat: formData.value.repeat_times ?? undefined,
    }

    if (isEdit.value) {
      await jobsStore.updateJob(props.jobId!, payload)
      message.success(t('jobs.messages.jobUpdated'))
    } else {
      await jobsStore.createJob(payload)
      message.success(t('jobs.messages.jobCreated'))
    }
    emit('saved')
  } catch (e: any) {
    message.error(e.message)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  showModal.value = false
  setTimeout(() => emit('close'), 200)
}
</script>

<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    :title="isEdit ? t('jobs.editJob') : t('jobs.createJob')"
    :style="{ width: 'min(520px, 94vw)' }"
    :mask-closable="!loading"
    @after-leave="emit('close')"
  >
    <NForm label-placement="top">
      <NFormItem :label="t('jobs.jobName')" required>
        <NInput
          v-model:value="formData.name"
          :placeholder="t('jobs.placeholder.jobName')"
          maxlength="200"
          show-count
        />
      </NFormItem>

      <NFormItem :label="t('jobs.scheduleCron')" required>
        <NInput
          v-model:value="formData.schedule"
          :placeholder="t('jobs.placeholder.scheduleExample')"
        />
        <div class="cron-helper">
          <p>{{ t('jobs.cronGuide') }}</p>
          <small>{{ cronSummary }}</small>
        </div>
      </NFormItem>

      <NFormItem :label="t('jobs.quickPresets')">
        <NSelect
          v-model:value="presetValue"
          :options="schedulePresets"
          :placeholder="t('jobs.placeholder.selectPreset')"
          @update:value="v => applyPreset(v)"
        />
        <div class="preset-chip-row">
          <button
            v-for="item in schedulePresets"
            :key="`chip-${item.value}`"
            type="button"
            class="preset-chip"
            :class="{ active: formData.schedule === item.value }"
            @click="applyPreset(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </NFormItem>

      <NFormItem :label="t('jobs.jobPrompt')" required>
        <NInput
          v-model:value="formData.prompt"
          type="textarea"
          :placeholder="t('jobs.placeholder.prompt')"
          :rows="4"
          maxlength="5000"
          show-count
        />
      </NFormItem>

      <NFormItem :label="t('jobs.deliverTarget')">
        <NSelect
          v-model:value="formData.deliver"
          :options="targetOptions"
        />
      </NFormItem>

      <NFormItem :label="t('jobs.repeatCountOptional')">
        <NInputNumber
          v-model:value="formData.repeat_times"
          :min="1"
          :placeholder="t('jobs.placeholder.repeatCount')"
          clearable
          style="width: 100%"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="handleClose">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          {{ isEdit ? t('common.edit') : t('common.create') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.cron-helper {
  margin-top: 6px;
  border: 1px solid color-mix(in srgb, rgba(255, 255, 255, 0.2) 82%, transparent);
  border-radius: 10px;
  padding: 8px 10px;
  background: color-mix(in srgb, rgba(103, 166, 255, 0.14) 72%, transparent);
  display: grid;
  gap: 4px;

  p {
    margin: 0;
    font-size: 12px;
    color: rgba(223, 238, 255, 0.92);
  }

  small {
    color: rgba(183, 211, 239, 0.88);
    font-size: 11px;
  }
}

.preset-chip-row {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  border: 1px solid color-mix(in srgb, rgba(121, 194, 255, 0.36) 90%, transparent);
  background: color-mix(in srgb, rgba(84, 149, 224, 0.18) 76%, transparent);
  color: rgba(215, 234, 255, 0.92);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;

  &:hover {
    border-color: rgba(121, 194, 255, 0.66);
    background: rgba(94, 166, 255, 0.24);
  }

  &.active {
    border-color: rgba(116, 214, 255, 0.86);
    background: rgba(86, 191, 255, 0.3);
    color: #f4fbff;
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

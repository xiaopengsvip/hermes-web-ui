export interface JobRuntimeNotification {
  id: string
  key: string
  jobId: string
  name: string
  status: 'ok' | 'error' | 'state'
  target: string
  error?: string
  runAt?: string | null
  createdAt: number
}

const STORAGE_KEY = 'jobs:runtime-notifications'
const EVENT_NAME = 'jobs:runtime-notification'
const MAX_ITEMS = 80

function safeParse(raw: string | null): JobRuntimeNotification[] {
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.filter(Boolean)
  } catch {
    return []
  }
}

export function getJobRuntimeNotifications(): JobRuntimeNotification[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(STORAGE_KEY))
}

export function saveJobRuntimeNotifications(list: JobRuntimeNotification[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)))
}

export function appendJobRuntimeNotification(payload: Omit<JobRuntimeNotification, 'id' | 'createdAt'>): JobRuntimeNotification {
  if (typeof window !== 'undefined') {
    const current = getJobRuntimeNotifications()
    const dedup = current.find((item) =>
      item.key === payload.key
      && item.status === payload.status
      && (item.runAt || '') === (payload.runAt || '')
      && (item.error || '') === (payload.error || ''),
    )
    if (dedup) return dedup

    const next: JobRuntimeNotification = {
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    }
    const merged = [next, ...current]
    saveJobRuntimeNotifications(merged)
    window.dispatchEvent(new CustomEvent<JobRuntimeNotification>(EVENT_NAME, { detail: next }))
    return next
  }

  return {
    ...payload,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  }
}

export function clearJobRuntimeNotifications() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function jobRuntimeNotificationEventName() {
  return EVENT_NAME
}

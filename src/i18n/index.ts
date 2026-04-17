import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'

export type LocaleCode = 'zh-CN' | 'en-US'

function normalizeLocale(locale?: string | null): LocaleCode {
  return locale === 'en-US' ? 'en-US' : 'zh-CN'
}

// Get saved language or default to Chinese
function getDefaultLocale(): LocaleCode {
  const saved = localStorage.getItem('hermes_locale')
  if (saved === 'zh-CN' || saved === 'en-US') return saved

  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('en')) return 'en-US'
  return 'zh-CN'
}

const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

function syncLocaleMeta(locale: LocaleCode) {
  document.documentElement.lang = locale
  document.documentElement.setAttribute('data-locale', locale)
  document.body?.setAttribute('data-locale', locale)
}

syncLocaleMeta(i18n.global.locale.value)

export default i18n

// Helper to switch language
export function setLocale(locale: string) {
  const normalized = normalizeLocale(locale)
  i18n.global.locale.value = normalized
  localStorage.setItem('hermes_locale', normalized)
  syncLocaleMeta(normalized)
}

// Get current locale
export function getLocale(): LocaleCode {
  return normalizeLocale(i18n.global.locale.value)
}

export function formatLocaleDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  const locale = getLocale()
  const target = value instanceof Date ? value : new Date(value)
  return target.toLocaleString(locale, options)
}

// Available locales
export const availableLocales = [
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
]
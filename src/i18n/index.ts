import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'

// Get saved language or default to Chinese
function getDefaultLocale(): 'zh-CN' | 'en-US' {
  const saved = localStorage.getItem('hermes_locale')
  if (saved === 'zh-CN' || saved === 'en-US') return saved
  // Check browser language
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) return 'zh-CN'
  return 'zh-CN' // Default to Chinese
}

const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getDefaultLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export default i18n

// Helper to switch language
export function setLocale(locale: string) {
  i18n.global.locale.value = locale as 'zh-CN' | 'en-US'
  localStorage.setItem('hermes_locale', locale)
  document.documentElement.lang = locale
}

// Get current locale
export function getLocale(): string {
  return i18n.global.locale.value
}

// Available locales
export const availableLocales = [
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' }
]
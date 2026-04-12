<script setup lang="ts">
import { computed } from 'vue'
import { NPopselect } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { setLocale, availableLocales } from '@/i18n'

const { locale } = useI18n()

const currentLocale = computed(() => {
  return availableLocales.find(l => l.code === locale.value) || availableLocales[0]
})

const options = availableLocales.map(l => ({
  label: `${l.flag} ${l.name}`,
  value: l.code
}))

function handleLocaleChange(newLocale: string) {
  setLocale(newLocale)
}
</script>

<template>
  <n-popselect
    :value="locale"
    :options="options"
    @update:value="handleLocaleChange"
    trigger="click"
  >
    <button class="lang-switcher" :title="currentLocale.name">
      <span class="flag">{{ currentLocale.flag }}</span>
      <span class="lang-code">{{ currentLocale.code === 'zh-CN' ? '中' : 'EN' }}</span>
    </button>
  </n-popselect>
</template>

<style scoped>
.lang-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.lang-switcher:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.flag {
  font-size: 14px;
  line-height: 1;
}

.lang-code {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
}
</style>
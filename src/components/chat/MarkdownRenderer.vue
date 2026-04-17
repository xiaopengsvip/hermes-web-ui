<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('zsh', bash)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)

const { t } = useI18n()
const props = defineProps<{ content: string }>()
const markdownRootRef = ref<HTMLElement | null>(null)

function buildCodeBlock(code: string, lang?: string): string {
  const escapedLang = lang ? md.utils.escapeHtml(lang) : ''
  const langBadge = escapedLang ? `<span class="code-lang">${escapedLang}</span>` : ''

  if (lang && hljs.getLanguage(lang)) {
    try {
      const rendered = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
      return `<pre class="hljs-code-block"><div class="code-header">${langBadge}<button class="copy-btn" data-copy-code="1" type="button">${t('common.copy')}</button></div><code class="hljs language-${escapedLang}">${rendered}</code></pre>`
    } catch {
      // fall through
    }
  }

  return `<pre class="hljs-code-block"><div class="code-header">${langBadge}<button class="copy-btn" data-copy-code="1" type="button">${t('common.copy')}</button></div><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    return buildCodeBlock(str, lang)
  },
})

async function handleMarkdownClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const button = target?.closest<HTMLButtonElement>('.copy-btn[data-copy-code="1"]')
  if (!button) return

  const block = button.closest('.hljs-code-block')
  const code = block?.querySelector('code')?.textContent ?? ''
  if (!code) return

  try {
    await navigator.clipboard.writeText(code)
    button.textContent = t('common.copied')
    window.setTimeout(() => {
      button.textContent = t('common.copy')
    }, 1200)
  } catch {
    button.textContent = t('common.copyFailed')
    window.setTimeout(() => {
      button.textContent = t('common.copy')
    }, 1200)
  }
}

onMounted(() => {
  markdownRootRef.value?.addEventListener('click', handleMarkdownClick)
})

onBeforeUnmount(() => {
  markdownRootRef.value?.removeEventListener('click', handleMarkdownClick)
})

const renderedHtml = computed(() => md.render(props.content))
</script>

<template>
  <div ref="markdownRootRef" class="markdown-body" v-html="renderedHtml"></div>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.markdown-body {
  font-size: 14px;
  line-height: 1.65;

  p {
    margin: 0 0 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  ul, ol {
    padding-left: 20px;
    margin: 4px 0 8px;
  }

  li {
    margin: 2px 0;
  }

  strong {
    color: $text-primary;
    font-weight: 600;
  }

  em {
    color: $text-secondary;
  }

  a {
    color: $accent-primary;
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: $accent-hover;
    }
  }

  blockquote {
    margin: 8px 0;
    padding: 4px 12px;
    border-left: 3px solid $border-color;
    color: $text-secondary;
  }

  code:not(.hljs) {
    background: $code-bg;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: $font-code;
    font-size: 13px;
    color: $accent-primary;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;

    th, td {
      padding: 6px 12px;
      border: 1px solid $border-color;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: rgba($accent-primary, 0.08);
      color: $text-primary;
      font-weight: 600;
    }

    td {
      color: $text-secondary;
    }
  }

  hr {
    border: none;
    border-top: 1px solid $border-color;
    margin: 12px 0;
  }
}

.hljs-code-block {
  margin: 8px 0;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $code-bg;
  border: 1px solid $border-color;

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.03);
    border-bottom: 1px solid $border-color;

    .code-lang {
      font-size: 11px;
      color: $text-muted;
      text-transform: uppercase;
    }

    .copy-btn {
      font-size: 11px;
      color: $text-muted;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 3px;
      transition: all $transition-fast;

      &:hover {
        color: $text-primary;
        background: rgba(0, 0, 0, 0.05);
      }
    }
  }

  code.hljs {
    display: block;
    padding: 12px;
    font-family: $font-code;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
  }
}

// highlight.js theme override — pure ink B&W
.hljs {
  color: #2a2a2a;
  background: none;
}

.hljs-keyword,
.hljs-selector-tag { color: #1a1a1a; font-weight: 600; }
.hljs-string,
.hljs-attr { color: #555555; }
.hljs-number { color: #333333; }
.hljs-comment { color: #999999; font-style: italic; }
.hljs-built_in { color: #444444; }
.hljs-type { color: #3a3a3a; }
.hljs-variable { color: #1a1a1a; }
.hljs-title,
.hljs-title\.function_ { color: #1a1a1a; }
.hljs-params { color: #2a2a2a; }
.hljs-meta { color: #999999; }
</style>

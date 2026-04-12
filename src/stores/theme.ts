import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { GlobalThemeOverrides } from 'naive-ui'

export interface Theme {
  id: string
  name: string
  nameZh: string
  description: string
  isDark: boolean
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    backgroundSecondary: string
    text: string
    textSecondary: string
    textMuted: string
    border: string
    success: string
    warning: string
    error: string
    info: string
  }
  naiveOverrides: GlobalThemeOverrides
}

export const themes: Theme[] = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    nameZh: '液态玻璃',
    description: 'Modern glass morphism design',
    isDark: true,
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#f093fb',
      background: '#0a0a0f',
      backgroundSecondary: '#12121a',
      text: 'rgba(255, 255, 255, 0.95)',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(255, 255, 255, 0.15)',
      success: '#4facfe',
      warning: '#f6d365',
      error: '#ff6b6b',
      info: '#667eea'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#667eea',
        primaryColorHover: '#5a6fd8',
        primaryColorPressed: '#4e5fc6',
        primaryColorSuppl: '#667eea',
        bodyColor: '#0a0a0f',
        cardColor: 'rgba(255, 255, 255, 0.08)',
        modalColor: 'rgba(18, 18, 26, 0.95)',
        popoverColor: 'rgba(18, 18, 26, 0.95)',
        tableColor: 'rgba(255, 255, 255, 0.05)',
        inputColor: 'rgba(255, 255, 255, 0.05)',
        actionColor: 'rgba(255, 255, 255, 0.08)',
        textColorBase: 'rgba(255, 255, 255, 0.95)',
        textColor1: 'rgba(255, 255, 255, 0.95)',
        textColor2: 'rgba(255, 255, 255, 0.7)',
        textColor3: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        dividerColor: 'rgba(255, 255, 255, 0.1)',
        hoverColor: 'rgba(255, 255, 255, 0.08)',
        clearColor: 'rgba(255, 255, 255, 0.5)',
        clearColorHover: 'rgba(255, 255, 255, 0.7)',
        clearColorPressed: 'rgba(255, 255, 255, 0.3)',
        scrollbarColor: 'rgba(255, 255, 255, 0.2)',
        scrollbarColorHover: 'rgba(255, 255, 255, 0.3)',
        progressRailColor: 'rgba(255, 255, 255, 0.1)',
        railColor: 'rgba(255, 255, 255, 0.1)',
        tableColorHover: 'rgba(255, 255, 255, 0.08)',
        tableColorStriped: 'rgba(255, 255, 255, 0.03)',
        tagColor: 'rgba(255, 255, 255, 0.08)',
        inputColorDisabled: 'rgba(255, 255, 255, 0.03)',
        buttonColor2: 'rgba(255, 255, 255, 0.08)',
        buttonColor2Hover: 'rgba(255, 255, 255, 0.12)',
        buttonColor2Pressed: 'rgba(255, 255, 255, 0.05)',
        boxShadow1: '0 8px 32px rgba(0, 0, 0, 0.3)',
        boxShadow2: '0 4px 16px rgba(0, 0, 0, 0.2)',
        boxShadow3: '0 2px 8px rgba(0, 0, 0, 0.1)'
      },
      Button: {
        colorPrimary: '#667eea',
        colorHoverPrimary: '#5a6fd8',
        colorPressedPrimary: '#4e5fc6',
        colorFocusPrimary: '#667eea',
        borderPrimary: '1px solid #667eea',
        borderHoverPrimary: '1px solid #5a6fd8',
        borderPressedPrimary: '1px solid #4e5fc6',
        textColorPrimary: '#fff',
        textColorHoverPrimary: '#fff',
        textColorPressedPrimary: '#fff',
        textColorFocusPrimary: '#fff'
      },
      Card: {
        color: 'rgba(255, 255, 255, 0.08)',
        colorEmbedded: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        actionColor: 'rgba(255, 255, 255, 0.05)'
      },
      Input: {
        color: 'rgba(255, 255, 255, 0.05)',
        colorFocus: 'rgba(255, 255, 255, 0.08)',
        colorDisabled: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderHover: '1px solid rgba(255, 255, 255, 0.25)',
        borderFocus: '1px solid #667eea',
        textColor: 'rgba(255, 255, 255, 0.95)',
        textColorDisabled: 'rgba(255, 255, 255, 0.5)',
        caretColor: '#667eea',
        placeholderColor: 'rgba(255, 255, 255, 0.5)',
        placeholderColorDisabled: 'rgba(255, 255, 255, 0.3)',
        clearColor: 'rgba(255, 255, 255, 0.5)',
        clearColorHover: 'rgba(255, 255, 255, 0.7)',
        clearColorPressed: 'rgba(255, 255, 255, 0.3)',
        countTextColor: 'rgba(255, 255, 255, 0.5)',
        countTextColorDisabled: 'rgba(255, 255, 255, 0.3)',
        iconColorHover: 'rgba(255, 255, 255, 0.7)',
        iconColorPressed: 'rgba(255, 255, 255, 0.3)',
        suffixTextColor: 'rgba(255, 255, 255, 0.5)',
        paddingSmall: '0 8px',
        paddingMedium: '0 12px',
        paddingLarge: '0 16px',
        fontSizeSmall: '12px',
        fontSizeMedium: '14px',
        fontSizeLarge: '16px',
        borderRadius: '8px',
        heightSmall: '28px',
        heightMedium: '34px',
        heightLarge: '40px',
        colorFocusPrimary: 'rgba(102, 126, 234, 0.1)',
        borderFocusPrimary: '1px solid #667eea',
        textColorFocusPrimary: 'rgba(255, 255, 255, 0.95)',
        caretColorPrimary: '#667eea'
      },
      Select: {
        peers: {
          InternalSelection: {
            color: 'rgba(255, 255, 255, 0.05)',
            colorActive: 'rgba(255, 255, 255, 0.08)',
            colorDisabled: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderHover: '1px solid rgba(255, 255, 255, 0.25)',
            borderActive: '1px solid #667eea',
            textColor: 'rgba(255, 255, 255, 0.95)',
            textColorDisabled: 'rgba(255, 255, 255, 0.5)',
            placeholderColor: 'rgba(255, 255, 255, 0.5)',
            placeholderColorDisabled: 'rgba(255, 255, 255, 0.3)',
            arrowColor: 'rgba(255, 255, 255, 0.5)',
            loadingColor: '#667eea'
          }
        }
      },
      Modal: {
        color: 'rgba(18, 18, 26, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        textColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      },
      Tag: {
        color: 'rgba(255, 255, 255, 0.08)',
        colorBordered: 'rgba(255, 255, 255, 0.08)',
        textColor: 'rgba(255, 255, 255, 0.7)',
        textColorBordered: 'rgba(255, 255, 255, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: '9999px',
        fontSizeSmall: '11px',
        fontSizeMedium: '12px',
        heightSmall: '22px',
        heightMedium: '26px',
        paddingSmall: '0 8px',
        paddingMedium: '0 10px'
      }
    }
  },
  {
    id: 'pure-ink',
    name: 'Pure Ink',
    nameZh: '纯墨',
    description: 'Minimalist black and white design',
    isDark: false,
    colors: {
      primary: '#333333',
      secondary: '#666666',
      accent: '#1a1a1a',
      background: '#fafafa',
      backgroundSecondary: '#f0f0f0',
      text: '#1a1a1a',
      textSecondary: '#666666',
      textMuted: '#999999',
      border: '#e0e0e0',
      success: '#2e7d32',
      warning: '#f57f17',
      error: '#c62828',
      info: '#333333'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#333333',
        primaryColorHover: '#1a1a1a',
        primaryColorPressed: '#000000',
        primaryColorSuppl: '#333333',
        bodyColor: '#fafafa',
        cardColor: '#ffffff',
        modalColor: '#ffffff',
        popoverColor: '#ffffff',
        tableColor: '#ffffff',
        inputColor: '#ffffff',
        actionColor: '#f0f0f0',
        textColorBase: '#1a1a1a',
        textColor1: '#1a1a1a',
        textColor2: '#666666',
        textColor3: '#999999',
        borderColor: '#e0e0e0',
        dividerColor: '#ebebeb',
        hoverColor: '#f5f5f5',
        clearColor: '#999999',
        clearColorHover: '#666666',
        clearColorPressed: '#333333',
        scrollbarColor: '#e0e0e0',
        scrollbarColorHover: '#999999',
        progressRailColor: '#e0e0e0',
        railColor: '#e0e0e0',
        tableColorHover: '#fafafa',
        tableColorStriped: '#f5f5f5',
        tagColor: '#f0f0f0',
        inputColorDisabled: '#f5f5f5',
        buttonColor2: '#f0f0f0',
        buttonColor2Hover: '#e0e0e0',
        buttonColor2Pressed: '#d0d0d0',
        boxShadow1: '0 2px 8px rgba(0, 0, 0, 0.1)',
        boxShadow2: '0 1px 4px rgba(0, 0, 0, 0.05)',
        boxShadow3: '0 0 2px rgba(0, 0, 0, 0.1)'
      }
    }
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    nameZh: '海洋蓝',
    description: 'Calming blue ocean theme',
    isDark: true,
    colors: {
      primary: '#0ea5e9',
      secondary: '#0284c7',
      accent: '#38bdf8',
      background: '#0c1929',
      backgroundSecondary: '#0f2744',
      text: 'rgba(255, 255, 255, 0.95)',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(255, 255, 255, 0.1)',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0ea5e9'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#0ea5e9',
        primaryColorHover: '#0284c7',
        primaryColorPressed: '#0369a1',
        primaryColorSuppl: '#0ea5e9',
        bodyColor: '#0c1929',
        cardColor: 'rgba(255, 255, 255, 0.05)',
        modalColor: 'rgba(15, 39, 68, 0.95)',
        popoverColor: 'rgba(15, 39, 68, 0.95)',
        tableColor: 'rgba(255, 255, 255, 0.03)',
        inputColor: 'rgba(255, 255, 255, 0.05)',
        actionColor: 'rgba(255, 255, 255, 0.05)',
        textColorBase: 'rgba(255, 255, 255, 0.95)',
        textColor1: 'rgba(255, 255, 255, 0.95)',
        textColor2: 'rgba(255, 255, 255, 0.7)',
        textColor3: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        dividerColor: 'rgba(255, 255, 255, 0.08)',
        hoverColor: 'rgba(255, 255, 255, 0.08)',
        clearColor: 'rgba(255, 255, 255, 0.5)',
        clearColorHover: 'rgba(255, 255, 255, 0.7)',
        clearColorPressed: 'rgba(255, 255, 255, 0.3)',
        scrollbarColor: 'rgba(255, 255, 255, 0.15)',
        scrollbarColorHover: 'rgba(255, 255, 255, 0.25)',
        progressRailColor: 'rgba(255, 255, 255, 0.08)',
        railColor: 'rgba(255, 255, 255, 0.08)',
        tableColorHover: 'rgba(255, 255, 255, 0.05)',
        tableColorStriped: 'rgba(255, 255, 255, 0.02)',
        tagColor: 'rgba(255, 255, 255, 0.05)',
        inputColorDisabled: 'rgba(255, 255, 255, 0.02)',
        buttonColor2: 'rgba(255, 255, 255, 0.05)',
        buttonColor2Hover: 'rgba(255, 255, 255, 0.08)',
        buttonColor2Pressed: 'rgba(255, 255, 255, 0.03)',
        boxShadow1: '0 8px 32px rgba(0, 0, 0, 0.3)',
        boxShadow2: '0 4px 16px rgba(0, 0, 0, 0.2)',
        boxShadow3: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }
    }
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    nameZh: '森林绿',
    description: 'Natural green forest theme',
    isDark: true,
    colors: {
      primary: '#22c55e',
      secondary: '#16a34a',
      accent: '#4ade80',
      background: '#0a1f0a',
      backgroundSecondary: '#0f2f0f',
      text: 'rgba(255, 255, 255, 0.95)',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(255, 255, 255, 0.1)',
      success: '#22c55e',
      warning: '#eab308',
      error: '#dc2626',
      info: '#22c55e'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#22c55e',
        primaryColorHover: '#16a34a',
        primaryColorPressed: '#15803d',
        primaryColorSuppl: '#22c55e',
        bodyColor: '#0a1f0a',
        cardColor: 'rgba(255, 255, 255, 0.05)',
        modalColor: 'rgba(15, 47, 15, 0.95)',
        popoverColor: 'rgba(15, 47, 15, 0.95)',
        tableColor: 'rgba(255, 255, 255, 0.03)',
        inputColor: 'rgba(255, 255, 255, 0.05)',
        actionColor: 'rgba(255, 255, 255, 0.05)',
        textColorBase: 'rgba(255, 255, 255, 0.95)',
        textColor1: 'rgba(255, 255, 255, 0.95)',
        textColor2: 'rgba(255, 255, 255, 0.7)',
        textColor3: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        dividerColor: 'rgba(255, 255, 255, 0.08)',
        hoverColor: 'rgba(255, 255, 255, 0.08)',
        clearColor: 'rgba(255, 255, 255, 0.5)',
        clearColorHover: 'rgba(255, 255, 255, 0.7)',
        clearColorPressed: 'rgba(255, 255, 255, 0.3)',
        scrollbarColor: 'rgba(255, 255, 255, 0.15)',
        scrollbarColorHover: 'rgba(255, 255, 255, 0.25)',
        progressRailColor: 'rgba(255, 255, 255, 0.08)',
        railColor: 'rgba(255, 255, 255, 0.08)',
        tableColorHover: 'rgba(255, 255, 255, 0.05)',
        tableColorStriped: 'rgba(255, 255, 255, 0.02)',
        tagColor: 'rgba(255, 255, 255, 0.05)',
        inputColorDisabled: 'rgba(255, 255, 255, 0.02)',
        buttonColor2: 'rgba(255, 255, 255, 0.05)',
        buttonColor2Hover: 'rgba(255, 255, 255, 0.08)',
        buttonColor2Pressed: 'rgba(255, 255, 255, 0.03)',
        boxShadow1: '0 8px 32px rgba(0, 0, 0, 0.3)',
        boxShadow2: '0 4px 16px rgba(0, 0, 0, 0.2)',
        boxShadow3: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }
    }
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    nameZh: '日落橙',
    description: 'Warm sunset colors',
    isDark: true,
    colors: {
      primary: '#f97316',
      secondary: '#ea580c',
      accent: '#fb923c',
      background: '#1a0a00',
      backgroundSecondary: '#2a1500',
      text: 'rgba(255, 255, 255, 0.95)',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(255, 255, 255, 0.1)',
      success: '#22c55e',
      warning: '#f97316',
      error: '#dc2626',
      info: '#f97316'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#f97316',
        primaryColorHover: '#ea580c',
        primaryColorPressed: '#c2410c',
        primaryColorSuppl: '#f97316',
        bodyColor: '#1a0a00',
        cardColor: 'rgba(255, 255, 255, 0.05)',
        modalColor: 'rgba(42, 21, 0, 0.95)',
        popoverColor: 'rgba(42, 21, 0, 0.95)',
        tableColor: 'rgba(255, 255, 255, 0.03)',
        inputColor: 'rgba(255, 255, 255, 0.05)',
        actionColor: 'rgba(255, 255, 255, 0.05)',
        textColorBase: 'rgba(255, 255, 255, 0.95)',
        textColor1: 'rgba(255, 255, 255, 0.95)',
        textColor2: 'rgba(255, 255, 255, 0.7)',
        textColor3: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        dividerColor: 'rgba(255, 255, 255, 0.08)',
        hoverColor: 'rgba(255, 255, 255, 0.08)',
        clearColor: 'rgba(255, 255, 255, 0.5)',
        clearColorHover: 'rgba(255, 255, 255, 0.7)',
        clearColorPressed: 'rgba(255, 255, 255, 0.3)',
        scrollbarColor: 'rgba(255, 255, 255, 0.15)',
        scrollbarColorHover: 'rgba(255, 255, 255, 0.25)',
        progressRailColor: 'rgba(255, 255, 255, 0.08)',
        railColor: 'rgba(255, 255, 255, 0.08)',
        tableColorHover: 'rgba(255, 255, 255, 0.05)',
        tableColorStriped: 'rgba(255, 255, 255, 0.02)',
        tagColor: 'rgba(255, 255, 255, 0.05)',
        inputColorDisabled: 'rgba(255, 255, 255, 0.02)',
        buttonColor2: 'rgba(255, 255, 255, 0.05)',
        buttonColor2Hover: 'rgba(255, 255, 255, 0.08)',
        buttonColor2Pressed: 'rgba(255, 255, 255, 0.03)',
        boxShadow1: '0 8px 32px rgba(0, 0, 0, 0.3)',
        boxShadow2: '0 4px 16px rgba(0, 0, 0, 0.2)',
        boxShadow3: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }
    }
  },
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    nameZh: '午夜紫',
    description: 'Elegant purple night theme',
    isDark: true,
    colors: {
      primary: '#a855f7',
      secondary: '#9333ea',
      accent: '#c084fc',
      background: '#0a0014',
      backgroundSecondary: '#150029',
      text: 'rgba(255, 255, 255, 0.95)',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(255, 255, 255, 0.1)',
      success: '#22c55e',
      warning: '#eab308',
      error: '#dc2626',
      info: '#a855f7'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#a855f7',
        primaryColorHover: '#9333ea',
        primaryColorPressed: '#7e22ce',
        primaryColorSuppl: '#a855f7',
        bodyColor: '#0a0014',
        cardColor: 'rgba(255, 255, 255, 0.05)',
        modalColor: 'rgba(21, 0, 41, 0.95)',
        popoverColor: 'rgba(21, 0, 41, 0.95)',
        tableColor: 'rgba(255, 255, 255, 0.03)',
        inputColor: 'rgba(255, 255, 255, 0.05)',
        actionColor: 'rgba(255, 255, 255, 0.05)',
        textColorBase: 'rgba(255, 255, 255, 0.95)',
        textColor1: 'rgba(255, 255, 255, 0.95)',
        textColor2: 'rgba(255, 255, 255, 0.7)',
        textColor3: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        dividerColor: 'rgba(255, 255, 255, 0.08)',
        hoverColor: 'rgba(255, 255, 255, 0.08)',
        clearColor: 'rgba(255, 255, 255, 0.5)',
        clearColorHover: 'rgba(255, 255, 255, 0.7)',
        clearColorPressed: 'rgba(255, 255, 255, 0.3)',
        scrollbarColor: 'rgba(255, 255, 255, 0.15)',
        scrollbarColorHover: 'rgba(255, 255, 255, 0.25)',
        progressRailColor: 'rgba(255, 255, 255, 0.08)',
        railColor: 'rgba(255, 255, 255, 0.08)',
        tableColorHover: 'rgba(255, 255, 255, 0.05)',
        tableColorStriped: 'rgba(255, 255, 255, 0.02)',
        tagColor: 'rgba(255, 255, 255, 0.05)',
        inputColorDisabled: 'rgba(255, 255, 255, 0.02)',
        buttonColor2: 'rgba(255, 255, 255, 0.05)',
        buttonColor2Hover: 'rgba(255, 255, 255, 0.08)',
        buttonColor2Pressed: 'rgba(255, 255, 255, 0.03)',
        boxShadow1: '0 8px 32px rgba(0, 0, 0, 0.3)',
        boxShadow2: '0 4px 16px rgba(0, 0, 0, 0.2)',
        boxShadow3: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }
    }
  }
]

export const useThemeStore = defineStore('theme', () => {
  const currentThemeId = ref(localStorage.getItem('hermes_theme') || 'liquid-glass')
  const currentTheme = ref<Theme>(themes.find(t => t.id === currentThemeId.value) || themes[0])

  // Watch for theme changes
  watch(currentThemeId, (newId) => {
    const theme = themes.find(t => t.id === newId)
    if (theme) {
      currentTheme.value = theme
      localStorage.setItem('hermes_theme', newId)
      applyTheme(theme)
    }
  })

  // Apply theme to document
  function applyTheme(theme: Theme) {
    const root = document.documentElement
    
    // 基础颜色
    root.style.setProperty('--theme-primary', theme.colors.primary)
    root.style.setProperty('--theme-secondary', theme.colors.secondary)
    root.style.setProperty('--theme-accent', theme.colors.accent)
    root.style.setProperty('--theme-background', theme.colors.background)
    root.style.setProperty('--theme-background-secondary', theme.colors.backgroundSecondary)
    root.style.setProperty('--theme-text', theme.colors.text)
    root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary)
    root.style.setProperty('--theme-text-muted', theme.colors.textMuted)
    root.style.setProperty('--theme-border', theme.colors.border)
    root.style.setProperty('--theme-success', theme.colors.success)
    root.style.setProperty('--theme-warning', theme.colors.warning)
    root.style.setProperty('--theme-error', theme.colors.error)
    root.style.setProperty('--theme-info', theme.colors.info)

    // 侧边栏特定
    root.style.setProperty('--theme-sidebar', theme.isDark ? 'rgba(18, 18, 26, 0.8)' : 'rgba(255, 255, 255, 0.95)')
    root.style.setProperty('--theme-blur', theme.isDark ? '12px' : '8px')
    root.style.setProperty('--theme-hover', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-active', theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')

    // RGB值（用于rgba计算）
    const primaryRgb = hexToRgb(theme.colors.primary)
    if (primaryRgb) {
      root.style.setProperty('--theme-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`)
    }

    // 成功状态发光
    root.style.setProperty('--theme-success-glow', `${theme.colors.success}80`)

    // 滚动条
    root.style.setProperty('--theme-scrollbar', theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')
    root.style.setProperty('--theme-scrollbar-hover', theme.isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)')

    // 选择高亮
    root.style.setProperty('--theme-selection', theme.isDark ? 'rgba(102, 126, 234, 0.3)' : 'rgba(0, 0, 0, 0.1)')

    // 卡片和输入框
    root.style.setProperty('--theme-card', theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-card-hover', theme.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
    root.style.setProperty('--theme-input', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')

    // 消息气泡
    root.style.setProperty('--theme-msg-user', theme.isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(0, 0, 0, 0.1)')
    root.style.setProperty('--theme-msg-assistant', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)')
    root.style.setProperty('--theme-msg-system', theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')

    // 代码块
    root.style.setProperty('--theme-code', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')

    // 阴影
    root.style.setProperty('--theme-shadow-glass', theme.isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)')
    root.style.setProperty('--theme-shadow-glass-light', theme.isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-shadow-glow', `0 0 20px ${theme.colors.primary}40`)

    // 渐变
    root.style.setProperty('--theme-gradient-primary', `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`)
    root.style.setProperty('--theme-gradient-secondary', `linear-gradient(135deg, ${theme.colors.accent} 0%, ${theme.colors.primary} 100%)`)
    root.style.setProperty('--theme-gradient-success', `linear-gradient(135deg, ${theme.colors.success} 0%, ${theme.colors.info} 100%)`)
    root.style.setProperty('--theme-gradient-warning', `linear-gradient(135deg, ${theme.colors.warning} 0%, ${theme.colors.primary} 100%)`)
    root.style.setProperty('--theme-gradient-error', `linear-gradient(135deg, ${theme.colors.error} 0%, ${theme.colors.warning} 100%)`)

    // Glass效果
    root.style.setProperty('--theme-glass-bg', theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.95)')
    root.style.setProperty('--theme-glass-bg-light', theme.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.98)')
    root.style.setProperty('--theme-glass-bg-dark', theme.isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-glass-border', theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)')
    root.style.setProperty('--theme-glass-border-light', theme.isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)')

    // 强调色
    root.style.setProperty('--theme-accent-hover', adjustColor(theme.colors.primary, 20))
    root.style.setProperty('--theme-primary-hover', adjustColor(theme.colors.primary, -10))
    root.style.setProperty('--theme-primary-muted', `${theme.colors.primary}80`)

    // 更新 body 背景
    document.body.style.backgroundColor = theme.colors.background
    document.body.style.color = theme.colors.text

    // 更新 meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.colors.background)
    }

    // 添加主题切换动画类
    document.body.classList.add('theme-transition')
    setTimeout(() => {
      document.body.classList.remove('theme-transition')
    }, 300)
  }

  // 辅助函数：将hex转换为RGB
  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  // 辅助函数：调整颜色亮度
  function adjustColor(hex: string, amount: number): string {
    const rgb = hexToRgb(hex)
    if (!rgb) return hex
    
    const adjust = (channel: number) => {
      const adjusted = channel + amount
      return Math.max(0, Math.min(255, adjusted))
    }
    
    const toHex = (n: number) => {
      const hex = n.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }
    
    return `#${toHex(adjust(rgb.r))}${toHex(adjust(rgb.g))}${toHex(adjust(rgb.b))}`
  }

  // Set theme
  function setTheme(themeId: string) {
    currentThemeId.value = themeId
  }

  // Get theme by ID
  function getThemeById(themeId: string): Theme | undefined {
    return themes.find(t => t.id === themeId)
  }

  // Initialize theme on store creation
  function initTheme() {
    applyTheme(currentTheme.value)
  }

  return {
    currentThemeId,
    currentTheme,
    themes,
    setTheme,
    getThemeById,
    initTheme
  }
})
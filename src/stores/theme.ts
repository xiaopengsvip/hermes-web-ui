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
  },
  {
    id: 'vercel-silk',
    name: 'Vercel Silk',
    nameZh: 'Vercel 丝绸白',
    description: '黑白极简 + 柔和边界，适合工程审阅',
    isDark: false,
    colors: {
      primary: '#171717',
      secondary: '#4d4d4d',
      accent: '#0072f5',
      background: '#f7f8fa',
      backgroundSecondary: '#ffffff',
      text: '#171717',
      textSecondary: '#4d4d4d',
      textMuted: '#808080',
      border: 'rgba(23, 23, 23, 0.12)',
      success: '#0f9d58',
      warning: '#f5a524',
      error: '#ff5b4f',
      info: '#0072f5'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#171717',
        primaryColorHover: '#000000',
        primaryColorPressed: '#000000',
        bodyColor: '#f7f8fa',
        cardColor: '#ffffff',
        modalColor: '#ffffff',
        popoverColor: '#ffffff',
        inputColor: '#ffffff',
        actionColor: '#fafafa',
        textColorBase: '#171717',
        textColor1: '#171717',
        textColor2: '#4d4d4d',
        textColor3: '#808080',
        borderColor: 'rgba(23, 23, 23, 0.12)',
        hoverColor: 'rgba(23, 23, 23, 0.05)',
        boxShadow1: '0 16px 36px rgba(0, 0, 0, 0.08)'
      }
    }
  },
  {
    id: 'linear-night',
    name: 'Linear Night',
    nameZh: 'Linear 夜幕',
    description: '紫蓝冷调 + 高级暗色，适合长时开发',
    isDark: true,
    colors: {
      primary: '#7c6cff',
      secondary: '#4f46e5',
      accent: '#22d3ee',
      background: '#0c0d14',
      backgroundSecondary: '#131723',
      text: 'rgba(255, 255, 255, 0.95)',
      textSecondary: 'rgba(255, 255, 255, 0.74)',
      textMuted: 'rgba(255, 255, 255, 0.48)',
      border: 'rgba(255, 255, 255, 0.11)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#f87171',
      info: '#7c6cff'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#7c6cff',
        primaryColorHover: '#6f5cff',
        primaryColorPressed: '#624eff',
        bodyColor: '#0c0d14',
        cardColor: 'rgba(255, 255, 255, 0.06)',
        modalColor: 'rgba(19, 23, 35, 0.96)',
        popoverColor: 'rgba(19, 23, 35, 0.96)',
        inputColor: 'rgba(255, 255, 255, 0.05)',
        textColorBase: 'rgba(255, 255, 255, 0.95)',
        textColor1: 'rgba(255, 255, 255, 0.95)',
        textColor2: 'rgba(255, 255, 255, 0.74)',
        textColor3: 'rgba(255, 255, 255, 0.48)',
        borderColor: 'rgba(255, 255, 255, 0.11)',
        hoverColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow1: '0 18px 40px rgba(0, 0, 0, 0.4)'
      }
    }
  },
  {
    id: 'aurora-frost',
    name: 'Aurora Frost',
    nameZh: '极光冰川',
    description: '青蓝极光玻璃感，视觉更炫酷',
    isDark: true,
    colors: {
      primary: '#00d4ff',
      secondary: '#3b82f6',
      accent: '#67e8f9',
      background: '#04111e',
      backgroundSecondary: '#0a1f33',
      text: 'rgba(235, 250, 255, 0.96)',
      textSecondary: 'rgba(218, 241, 255, 0.76)',
      textMuted: 'rgba(190, 220, 238, 0.55)',
      border: 'rgba(125, 211, 252, 0.2)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#fb7185',
      info: '#00d4ff'
    },
    naiveOverrides: {
      common: {
        primaryColor: '#00d4ff',
        primaryColorHover: '#22d3ee',
        primaryColorPressed: '#06b6d4',
        bodyColor: '#04111e',
        cardColor: 'rgba(0, 212, 255, 0.08)',
        modalColor: 'rgba(10, 31, 51, 0.96)',
        popoverColor: 'rgba(10, 31, 51, 0.96)',
        inputColor: 'rgba(125, 211, 252, 0.08)',
        textColorBase: 'rgba(235, 250, 255, 0.96)',
        textColor1: 'rgba(235, 250, 255, 0.96)',
        textColor2: 'rgba(218, 241, 255, 0.76)',
        textColor3: 'rgba(190, 220, 238, 0.55)',
        borderColor: 'rgba(125, 211, 252, 0.2)',
        hoverColor: 'rgba(125, 211, 252, 0.16)',
        boxShadow1: '0 18px 44px rgba(0, 27, 46, 0.52)'
      }
    }
  }
]

export const useThemeStore = defineStore('theme', () => {
  const currentThemeId = ref(localStorage.getItem('hermes_theme') || 'liquid-glass')
  const currentTheme = ref<Theme>(themes.find(t => t.id === currentThemeId.value) || themes[0])

  const densityMode = ref<'compact' | 'comfortable'>(
    localStorage.getItem('hermes_density') === 'compact' ? 'compact' : 'comfortable',
  )

  const savedMotion = localStorage.getItem('hermes_motion')
  const motionMode = ref<'low' | 'medium' | 'high'>(
    savedMotion === 'low' || savedMotion === 'high' || savedMotion === 'medium' ? savedMotion : 'medium',
  )

  watch(currentThemeId, (newId) => {
    const theme = themes.find(t => t.id === newId)
    if (theme) {
      currentTheme.value = theme
      localStorage.setItem('hermes_theme', newId)
      applyTheme(theme)
    }
  })

  watch(densityMode, (mode) => {
    localStorage.setItem('hermes_density', mode)
    applyDensity(mode)
  })

  watch(motionMode, (mode) => {
    localStorage.setItem('hermes_motion', mode)
    applyMotion(mode)
  })

  function applyTheme(theme: Theme) {
    const root = document.documentElement

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

    root.style.setProperty('--theme-sidebar', theme.isDark ? 'rgba(18, 18, 26, 0.8)' : 'rgba(255, 255, 255, 0.95)')
    root.style.setProperty('--theme-blur', theme.isDark ? '12px' : '8px')
    root.style.setProperty('--theme-hover', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-active', theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')

    const primaryRgb = hexToRgb(theme.colors.primary)
    if (primaryRgb) {
      root.style.setProperty('--theme-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`)
    }

    root.style.setProperty('--theme-success-glow', `${theme.colors.success}80`)
    root.style.setProperty('--theme-scrollbar', theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')
    root.style.setProperty('--theme-scrollbar-hover', theme.isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)')
    root.style.setProperty('--theme-selection', theme.isDark ? 'rgba(102, 126, 234, 0.3)' : 'rgba(0, 0, 0, 0.1)')

    root.style.setProperty('--theme-card', theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-card-hover', theme.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
    root.style.setProperty('--theme-input', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')

    root.style.setProperty('--theme-msg-user', theme.isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(0, 0, 0, 0.1)')
    root.style.setProperty('--theme-msg-assistant', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)')
    root.style.setProperty('--theme-msg-system', theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')

    root.style.setProperty('--theme-code', theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')

    root.style.setProperty('--theme-shadow-glass', theme.isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)')
    root.style.setProperty('--theme-shadow-glass-light', theme.isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-shadow-glow', `0 0 20px ${theme.colors.primary}40`)

    root.style.setProperty('--theme-gradient-primary', `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`)
    root.style.setProperty('--theme-gradient-secondary', `linear-gradient(135deg, ${theme.colors.accent} 0%, ${theme.colors.primary} 100%)`)
    root.style.setProperty('--theme-gradient-success', `linear-gradient(135deg, ${theme.colors.success} 0%, ${theme.colors.info} 100%)`)
    root.style.setProperty('--theme-gradient-warning', `linear-gradient(135deg, ${theme.colors.warning} 0%, ${theme.colors.primary} 100%)`)
    root.style.setProperty('--theme-gradient-error', `linear-gradient(135deg, ${theme.colors.error} 0%, ${theme.colors.warning} 100%)`)

    root.style.setProperty('--theme-glass-bg', theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.95)')
    root.style.setProperty('--theme-glass-bg-light', theme.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.98)')
    root.style.setProperty('--theme-glass-bg-dark', theme.isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--theme-glass-border', theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)')
    root.style.setProperty('--theme-glass-border-light', theme.isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)')

    root.style.setProperty('--theme-accent-hover', adjustColor(theme.colors.primary, 20))
    root.style.setProperty('--theme-primary-hover', adjustColor(theme.colors.primary, -10))
    root.style.setProperty('--theme-primary-muted', `${theme.colors.primary}80`)

    document.body.style.backgroundColor = theme.colors.background
    document.body.style.color = theme.colors.text

    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.colors.background)
    }

    document.body.classList.add('theme-transition')
    setTimeout(() => {
      document.body.classList.remove('theme-transition')
    }, 300)
  }

  function applyDensity(mode: 'compact' | 'comfortable') {
    const root = document.documentElement
    const factor = mode === 'compact' ? '0.88' : '1'
    root.style.setProperty('--ui-density-gap', factor)
    root.style.setProperty('--ui-density-padding', mode === 'compact' ? '0.88' : '1')
    document.body.setAttribute('data-density', mode)
  }

  function applyMotion(mode: 'low' | 'medium' | 'high') {
    const root = document.documentElement
    const mapping = {
      low: { fast: '110ms', normal: '170ms', slow: '220ms' },
      medium: { fast: '150ms', normal: '260ms', slow: '360ms' },
      high: { fast: '210ms', normal: '340ms', slow: '520ms' },
    } as const

    const selected = mapping[mode]
    root.style.setProperty('--ui-motion-fast', selected.fast)
    root.style.setProperty('--ui-motion-normal', selected.normal)
    root.style.setProperty('--ui-motion-slow', selected.slow)
    document.body.setAttribute('data-motion', mode)
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null
  }

  function adjustColor(hex: string, amount: number): string {
    const rgb = hexToRgb(hex)
    if (!rgb) return hex

    const adjust = (channel: number) => {
      const adjusted = channel + amount
      return Math.max(0, Math.min(255, adjusted))
    }

    const toHex = (n: number) => {
      const asHex = n.toString(16)
      return asHex.length === 1 ? '0' + asHex : asHex
    }

    return `#${toHex(adjust(rgb.r))}${toHex(adjust(rgb.g))}${toHex(adjust(rgb.b))}`
  }

  function setTheme(themeId: string) {
    currentThemeId.value = themeId
  }

  function setDensity(mode: 'compact' | 'comfortable') {
    densityMode.value = mode
  }

  function setMotion(mode: 'low' | 'medium' | 'high') {
    motionMode.value = mode
  }

  function getThemeById(themeId: string): Theme | undefined {
    return themes.find(t => t.id === themeId)
  }

  function initTheme() {
    applyTheme(currentTheme.value)
    applyDensity(densityMode.value)
    applyMotion(motionMode.value)
  }

  return {
    currentThemeId,
    currentTheme,
    themes,
    densityMode,
    motionMode,
    setTheme,
    setDensity,
    setMotion,
    getThemeById,
    initTheme,
  }
})
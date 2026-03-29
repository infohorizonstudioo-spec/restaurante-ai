'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { THEMES, type ThemeId } from '@/lib/themes'

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
}

const ThemeCtx = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
})

export const useTheme = () => useContext(ThemeCtx)

function applyTheme(themeId: ThemeId) {
  const vars = THEMES[themeId].vars
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('dark')

  // Load saved theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rz-theme') as ThemeId | null
      if (saved && THEMES[saved]) {
        setThemeState(saved)
        applyTheme(saved)
      }
    } catch {
      // localStorage not available (SSR / incognito)
    }
  }, [])

  // Apply CSS vars whenever theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (t: ThemeId) => {
    setThemeState(t)
    try {
      localStorage.setItem('rz-theme', t)
    } catch {
      // localStorage not available
    }
  }

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

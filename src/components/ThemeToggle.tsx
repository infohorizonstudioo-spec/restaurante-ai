'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { THEMES, THEME_IDS, type ThemeId } from '@/lib/themes'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      background: 'var(--rz-surface-2)',
      border: '1px solid var(--rz-border)',
      borderRadius: 20,
      padding: 3,
    }}>
      {THEME_IDS.map((id: ThemeId) => {
        const t = THEMES[id]
        const active = theme === id
        return (
          <button
            key={id}
            onClick={() => setTheme(id)}
            title={t.label}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: active ? '2px solid var(--rz-amber)' : '2px solid transparent',
              background: active ? 'var(--rz-amber-dim)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              transition: 'all 0.2s ease',
              padding: 0,
            }}
          >
            {t.icon}
          </button>
        )
      })}
    </div>
  )
}

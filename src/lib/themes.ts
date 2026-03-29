/* ═══════════════════════════════════════════════════════════
   RESERVO.AI — Theme System
   3 themes: Dark (default), Light, Rosa
═══════════════════════════════════════════════════════════ */

export type ThemeId = 'dark' | 'light' | 'rosa'

export interface Theme {
  id: ThemeId
  label: string
  icon: string
  vars: Record<string, string>
}

export const THEMES: Record<ThemeId, Theme> = {
  dark: {
    id: 'dark',
    label: 'Oscuro',
    icon: '\u{1F319}',
    vars: {
      '--rz-bg':           '#0C1018',
      '--rz-surface':      '#131920',
      '--rz-surface-2':    '#1A2230',
      '--rz-surface-3':    '#202C3E',
      '--rz-border':       'rgba(255,255,255,0.07)',
      '--rz-border-md':    'rgba(255,255,255,0.11)',
      '--rz-text':         '#E8EEF6',
      '--rz-text-2':       '#8895A7',
      '--rz-text-3':       '#49566A',
      '--rz-amber':        '#F0A84E',
      '--rz-amber-2':      '#E8923A',
      '--rz-amber-dim':    'rgba(240,168,78,0.10)',
      '--rz-amber-glow':   'rgba(240,168,78,0.20)',
      '--rz-teal':         '#2DD4BF',
      '--rz-teal-dim':     'rgba(45,212,191,0.10)',
      '--rz-green':        '#34D399',
      '--rz-green-dim':    'rgba(52,211,153,0.10)',
      '--rz-red':          '#F87171',
      '--rz-red-dim':      'rgba(248,113,113,0.10)',
      '--rz-yellow':       '#FBB53F',
      '--rz-yellow-dim':   'rgba(251,181,63,0.10)',
      '--rz-violet':       '#A78BFA',
      '--rz-violet-dim':   'rgba(167,139,250,0.12)',
      '--rz-blue':         '#60A5FA',
      '--rz-blue-dim':     'rgba(96,165,250,0.10)',
      '--rz-shadow-sm':    '0 1px 3px rgba(0,0,0,0.4)',
      '--rz-shadow-md':    '0 4px 16px rgba(0,0,0,0.5)',
      '--rz-shadow-amber': '0 0 20px rgba(240,168,78,0.15)',
    },
  },

  light: {
    id: 'light',
    label: 'Claro',
    icon: '\u{2600}\u{FE0F}',
    vars: {
      '--rz-bg':           '#F5F7FA',
      '--rz-surface':      '#FFFFFF',
      '--rz-surface-2':    '#F0F2F5',
      '--rz-surface-3':    '#E8EBF0',
      '--rz-border':       'rgba(0,0,0,0.08)',
      '--rz-border-md':    'rgba(0,0,0,0.12)',
      '--rz-text':         '#1A1D23',
      '--rz-text-2':       '#5F6B7A',
      '--rz-text-3':       '#9BA5B4',
      '--rz-amber':        '#E8923A',
      '--rz-amber-2':      '#D47B22',
      '--rz-amber-dim':    'rgba(232,146,58,0.10)',
      '--rz-amber-glow':   'rgba(232,146,58,0.20)',
      '--rz-teal':         '#0D9488',
      '--rz-teal-dim':     'rgba(13,148,136,0.10)',
      '--rz-green':        '#16A34A',
      '--rz-green-dim':    'rgba(22,163,74,0.10)',
      '--rz-red':          '#DC2626',
      '--rz-red-dim':      'rgba(220,38,38,0.10)',
      '--rz-yellow':       '#D97706',
      '--rz-yellow-dim':   'rgba(217,119,6,0.10)',
      '--rz-violet':       '#7C3AED',
      '--rz-violet-dim':   'rgba(124,58,237,0.10)',
      '--rz-blue':         '#2563EB',
      '--rz-blue-dim':     'rgba(37,99,235,0.10)',
      '--rz-shadow-sm':    '0 1px 3px rgba(0,0,0,0.08)',
      '--rz-shadow-md':    '0 4px 16px rgba(0,0,0,0.10)',
      '--rz-shadow-amber': '0 0 20px rgba(232,146,58,0.12)',
    },
  },

  rosa: {
    id: 'rosa',
    label: 'Rosa',
    icon: '\u{1F338}',
    vars: {
      '--rz-bg':           '#FFF0F5',
      '--rz-surface':      '#FFFFFF',
      '--rz-surface-2':    '#FFF5F8',
      '--rz-surface-3':    '#FFE4ED',
      '--rz-border':       'rgba(219,39,119,0.10)',
      '--rz-border-md':    'rgba(219,39,119,0.15)',
      '--rz-text':         '#1A1D23',
      '--rz-text-2':       '#6B5B6E',
      '--rz-text-3':       '#A89BAD',
      '--rz-amber':        '#EC4899',
      '--rz-amber-2':      '#DB2777',
      '--rz-amber-dim':    'rgba(236,72,153,0.10)',
      '--rz-amber-glow':   'rgba(236,72,153,0.20)',
      '--rz-teal':         '#06B6D4',
      '--rz-teal-dim':     'rgba(6,182,212,0.10)',
      '--rz-green':        '#10B981',
      '--rz-green-dim':    'rgba(16,185,129,0.10)',
      '--rz-red':          '#EF4444',
      '--rz-red-dim':      'rgba(239,68,68,0.10)',
      '--rz-yellow':       '#F59E0B',
      '--rz-yellow-dim':   'rgba(245,158,11,0.10)',
      '--rz-violet':       '#8B5CF6',
      '--rz-violet-dim':   'rgba(139,92,246,0.10)',
      '--rz-blue':         '#3B82F6',
      '--rz-blue-dim':     'rgba(59,130,246,0.10)',
      '--rz-shadow-sm':    '0 1px 3px rgba(219,39,119,0.06)',
      '--rz-shadow-md':    '0 4px 16px rgba(219,39,119,0.08)',
      '--rz-shadow-amber': '0 0 20px rgba(236,72,153,0.15)',
    },
  },
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

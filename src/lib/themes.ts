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
      '--rz-bg':           '#F0F2F5',
      '--rz-surface':      '#FFFFFF',
      '--rz-surface-2':    '#E8EBF0',
      '--rz-surface-3':    '#D8DCE3',
      '--rz-border':       'rgba(0,0,0,0.12)',
      '--rz-border-md':    'rgba(0,0,0,0.18)',
      '--rz-text':         '#111318',
      '--rz-text-2':       '#4A5568',
      '--rz-text-3':       '#8896A6',
      '--rz-amber':        '#D97706',
      '--rz-amber-2':      '#B45309',
      '--rz-amber-dim':    'rgba(217,119,6,0.12)',
      '--rz-amber-glow':   'rgba(217,119,6,0.25)',
      '--rz-teal':         '#0D7377',
      '--rz-teal-dim':     'rgba(13,115,119,0.12)',
      '--rz-green':        '#15803D',
      '--rz-green-dim':    'rgba(21,128,61,0.12)',
      '--rz-red':          '#B91C1C',
      '--rz-red-dim':      'rgba(185,28,28,0.12)',
      '--rz-yellow':       '#A16207',
      '--rz-yellow-dim':   'rgba(161,98,7,0.12)',
      '--rz-violet':       '#6D28D9',
      '--rz-violet-dim':   'rgba(109,40,217,0.12)',
      '--rz-blue':         '#1D4ED8',
      '--rz-blue-dim':     'rgba(29,78,216,0.12)',
      '--rz-shadow-sm':    '0 1px 4px rgba(0,0,0,0.12)',
      '--rz-shadow-md':    '0 4px 20px rgba(0,0,0,0.15)',
      '--rz-shadow-amber': '0 0 20px rgba(217,119,6,0.15)',
    },
  },

  rosa: {
    id: 'rosa',
    label: 'Rosa',
    icon: '\u{1F338}',
    vars: {
      '--rz-bg':           '#FDE8F0',
      '--rz-surface':      '#FFF0F6',
      '--rz-surface-2':    '#FFDCE8',
      '--rz-surface-3':    '#FFCADB',
      '--rz-border':       'rgba(219,39,119,0.18)',
      '--rz-border-md':    'rgba(219,39,119,0.25)',
      '--rz-text':         '#2D1320',
      '--rz-text-2':       '#7A4562',
      '--rz-text-3':       '#B07A98',
      '--rz-amber':        '#DB2777',
      '--rz-amber-2':      '#BE185D',
      '--rz-amber-dim':    'rgba(219,39,119,0.15)',
      '--rz-amber-glow':   'rgba(219,39,119,0.30)',
      '--rz-teal':         '#0891B2',
      '--rz-teal-dim':     'rgba(8,145,178,0.12)',
      '--rz-green':        '#059669',
      '--rz-green-dim':    'rgba(5,150,105,0.12)',
      '--rz-red':          '#E11D48',
      '--rz-red-dim':      'rgba(225,29,72,0.12)',
      '--rz-yellow':       '#CA8A04',
      '--rz-yellow-dim':   'rgba(202,138,4,0.12)',
      '--rz-violet':       '#7C3AED',
      '--rz-violet-dim':   'rgba(124,58,237,0.12)',
      '--rz-blue':         '#2563EB',
      '--rz-blue-dim':     'rgba(37,99,235,0.12)',
      '--rz-shadow-sm':    '0 1px 4px rgba(219,39,119,0.10)',
      '--rz-shadow-md':    '0 4px 20px rgba(219,39,119,0.14)',
      '--rz-shadow-amber': '0 0 24px rgba(219,39,119,0.20)',
    },
  },
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

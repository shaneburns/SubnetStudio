// ── SubnetStudio Theme Definitions ────────────────────────────────────────────
// Each theme carries its full CSS variable map and BitNoise-specific config.
// Themes are applied by writing vars to document.documentElement.style so that
// CSS-var-using components pick them up instantly without any class changes.

export type ThemeId = 'default' | 'light' | 'dark';

export interface BitNoiseConfig {
  /** Color for the "ordinary" majority of bit cells */
  baseColor:    string;
  /** Accent colors drawn at random for a fraction of cells */
  accentColors: string[];
  /** Fraction of cells initialized as an accent color (0–1) */
  accentProb:   number;
  /** Peak opacity of bit characters (dark noise spots → 0, peaks → maxOpacity) */
  maxOpacity:   number;
}

export interface ThemeDef {
  id:          ThemeId;
  name:        string;
  description: string;
  vars:        Record<string, string>;
  noise:       BitNoiseConfig;
}

export const THEMES: ThemeDef[] = [
  // ── 1. Default — Deep Ocean Blue ────────────────────────────────────────────
  {
    id:          'default',
    name:        'Default',
    description: 'Deep ocean blue — the classic SubnetStudio palette',
    vars: {
      '--bg':               '#0B1E2D',
      '--panel':            '#0F2740',
      '--panel-2':          '#0C2236',
      '--grid':             '#1C3B54',
      '--grid-soft':        '#16314A',
      '--text':             '#E8EEF2',
      '--muted':            '#7E9AB0',
      '--muted-2':          '#5C7C92',
      '--network':          '#E8954A',
      '--network-dim':      '#5A4129',
      '--host':             '#4FC7D4',
      '--host-dim':         '#234A50',
      '--borrowed':         '#E8B84A',
      '--borrowed-dim':     '#5A4A29',
      '--base-fixed':       '#E8954A',
      '--base-fixed-dim':   '#5A4129',
      '--error':            '#D9776A',
      '--status-overflow':  '#D9776A',
      '--status-conflict':  '#E8B84A',
      '--radius':           '3px',
    },
    noise: {
      baseColor:    '#C8D8E8',
      accentColors: ['#E8954A', '#4FC7D4', '#E8B84A', '#9B7FD4', '#6CC97A'],
      accentProb:   0.13,
      maxOpacity:   0.22,
    },
  },

  // ── 2. Light — Slate & Sun ───────────────────────────────────────────────────
  {
    id:          'light',
    name:        'Light',
    description: 'Clean slate with warm amber and teal accents',
    vars: {
      '--bg':               '#E8EFF8',
      '--panel':            '#FFFFFF',
      '--panel-2':          '#F2F6FC',
      '--grid':             '#BCCEDE',
      '--grid-soft':        '#D4E2EE',
      '--text':             '#112030',
      '--muted':            '#486480',
      '--muted-2':          '#8098B4',
      '--network':          '#C0560C',
      '--network-dim':      '#FAEAD8',
      '--host':             '#187890',
      '--host-dim':         '#D0EEF4',
      '--borrowed':         '#9E6800',
      '--borrowed-dim':     '#FEF0CC',
      '--base-fixed':       '#C0560C',
      '--base-fixed-dim':   '#FAEAD8',
      '--error':            '#B83030',
      '--status-overflow':  '#B83030',
      '--status-conflict':  '#9E6800',
      '--radius':           '3px',
    },
    noise: {
      baseColor:    '#1C3048',
      accentColors: ['#C0560C', '#187890', '#9E6800', '#5A48A8', '#1E7840'],
      accentProb:   0.10,
      maxOpacity:   0.07,
    },
  },

  // ── 3. Dark — Void Terminal ──────────────────────────────────────────────────
  {
    id:          'dark',
    name:        'Dark',
    description: 'OLED black with vivid neon accent colors',
    vars: {
      '--bg':               '#07080D',
      '--panel':            '#0D0F18',
      '--panel-2':          '#0A0B14',
      '--grid':             '#181A2C',
      '--grid-soft':        '#10121E',
      '--text':             '#e8ecf3',
      '--muted':            '#a9b2d6',
      '--muted-2':          '#b6bde0',
      '--network':          '#FF8028',
      '--network-dim':      '#3C1E08',
      '--host':             '#1CD8F0',
      '--host-dim':         '#083038',
      '--borrowed':         '#FFD020',
      '--borrowed-dim':     '#342C00',
      '--base-fixed':       '#FF8028',
      '--base-fixed-dim':   '#3C1E08',
      '--error':            '#FF5050',
      '--status-overflow':  '#FF5050',
      '--status-conflict':  '#FFD020',
      '--radius':           '3px',
    },
    noise: {
      baseColor:    '#A8BCD4',
      accentColors: ['#FF8028', '#1CD8F0', '#FFD020', '#B870FF', '#38E878'],
      accentProb:   0.15,
      maxOpacity:   0.28,
    },
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'default';

/** Look up a theme by id, falling back to Default */
export function getTheme(id: string): ThemeDef {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

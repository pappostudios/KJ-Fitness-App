/**
 * KJ Fitness — Design System Colors (LIGHT THEME)
 *
 * Redesigned to the "KJ Fitness light theme" spec: a bright, teal-tinted white
 * system built around the brand teal (#15C2CB). Token names match the original
 * shape (bg0…bg3, line, inkHi…inkLo, accent*) so this is a drop-in swap — every
 * screen reads the same tokens and flips at once.
 *
 * NOTE: the export is still named `dark` because ~20 screens import `{ dark }`
 * for surface tokens. It now holds the LIGHT surface stack. The original dark
 * palette is preserved below as `trueDark` for a future theme switcher.
 */

export const ACCENT_PALETTES = {
  teal: {
    accent:     '#15C2CB', // KJ logo teal
    accentSoft: 'rgba(21, 194, 203, 0.14)',
    accentInk:  '#04282B', // deep teal-black — text/icon on teal bg (never white on teal)
    accentDark: '#0E9AA1',
  },
};

// ─── Preserved original dark palette (not wired — for a future dark mode) ─────
export const trueDark = {
  bg0: '#0D1517', bg1: '#152023', bg2: '#1D2B2E', bg3: '#26373B',
  line: '#2E4348', lineSoft: 'rgba(46, 67, 72, 0.55)',
  inkHi: '#F4F8F8', inkMd: '#B4C2C3', inkLo: '#7E8E90',
  ok: '#4BC878', warn: '#CBB02A',
  ...ACCENT_PALETTES.teal,
};

// ─── Active LIGHT surface stack (teal-tinted white) ───────────────────────────
export const light = {
  // Surfaces
  bg0:      '#F7FCFC', // screen background
  bg1:      '#FFFFFF', // cards
  bg2:      '#F4FBFB', // inset / raised
  bg3:      '#EAF6F7', // inputs / pressed

  // Borders — visible hairline on light (bolder outlines per design frames)
  line:     '#CFE2E4',
  lineSoft: 'rgba(10, 59, 62, 0.12)',

  // Ink (teal-dark text on light)
  inkHi:    '#0A3B3E', // primary text · 12.4:1
  inkMd:    '#4A6A6D', // secondary · 6.3:1
  inkLo:    '#7C9497', // muted · 3.4:1 — ≥13px only

  // Status
  ok:       '#1FB86A',
  warn:     '#E0A500',

  // Accent (KJ teal)
  ...ACCENT_PALETTES.teal,
};

// `dark` alias now carries the LIGHT tokens (see file header).
export const dark = light;

// ─── Gradients ────────────────────────────────────────────────────────────────
export const gradients = {
  // Header / hero backdrop — soft teal wash fading to the screen colour
  hero: ['#DCF3F5', '#F7FCFC'],
  // Accent gradient — KJ logo badge, primary CTAs (135°, flip to 225° under RTL)
  primary: ['#1AC8D1', '#0E9AA1'],
  // Avatar gradient
  avatar: ['#1AC8D1', '#0E9AA1'],
  // Accent card tint (top fade)
  accentCard: ['rgba(21, 194, 203, 0.16)', 'transparent'],
  // Full-bleed light teal stage wash
  stageDark: [
    'rgba(230, 250, 251, 0.85)',
    'transparent',
    'rgba(230, 250, 251, 0.4)',
    '#F7FCFC',
  ],
};

// ─── Elevation (light, teal-tinted shadows) ───────────────────────────────────
// iOS reads shadow*; Android reads elevation (and can't tint shadows — the teal
// glow uses a #7FE0E5 top hairline as its Android stand-in where needed).
export const elevation = {
  e0:   { borderWidth: 1, borderColor: '#E4F0F1' },
  e1:   { shadowColor: '#0A3B3E', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  e2:   { shadowColor: '#0A3B3E', shadowOpacity: 0.09, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 6 },
  e3:   { shadowColor: '#0A3B3E', shadowOpacity: 0.16, shadowRadius: 48, shadowOffset: { width: 0, height: 24 }, elevation: 16 },
  glow: { shadowColor: '#15C2CB', shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
};

// ─── Motion tokens (durations ms + cubic-bezier easings) ──────────────────────
export const motion = {
  dur:  { tap: 100, quick: 160, base: 220, enter: 340, data: 480, party: 1200, stagger: 45 },
  ease: {
    standard:   [0.2, 0.8, 0.2, 1],
    decelerate: [0, 0, 0.2, 1],
    accelerate: [0.4, 0, 1, 1],
    overshoot:  [0.34, 1.56, 0.64, 1],
  },
};

// ─── Semantic aliases ─────────────────────────────────────────────────────────
export const colors = {
  // Surfaces
  background:     light.bg0,
  backgroundAlt:  light.bg2,
  surface:        light.bg1,
  surfaceRaised:  light.bg2,
  input:          light.bg2,
  card:           light.bg1,
  cardRaised:     light.bg2,

  // Borders
  border:         light.line,
  borderSoft:     light.lineSoft,
  cardBorder:     light.line,

  // Text
  textPrimary:    light.inkHi,
  textSecondary:  light.inkMd,
  textMuted:      light.inkLo,

  // Brand / accent
  primary:        light.accent,
  primarySoft:    light.accentSoft,
  primaryInk:     light.accentInk,
  primaryDark:    light.accentDark,
  accent:         light.accent,
  accentSoft:     light.accentSoft,
  accentInk:      light.accentInk,
  accentDark:     light.accentDark,

  // Status
  success:        light.ok,
  warning:        light.warn,
  error:          '#E5484D',
  ok:             light.ok,
  warn:           light.warn,

  // Navigation
  tabBar:         light.bg1,
  tabBarBorder:   light.line,
  tabActive:      light.accent,
  tabInactive:    light.inkLo,

  // Utility
  transparent:    'transparent',
  overlay:        'rgba(4, 40, 43, 0.40)',   // dark-teal scrim behind modals
  scrim:          'rgba(4, 40, 43, 0.55)',
  white:          '#FFFFFF',

  // Legacy aliases used by coach screens
  primaryGlow:    light.accentSoft,
  divider:        light.lineSoft,
  cardElevated:   light.bg2,
};

export default colors;

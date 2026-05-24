/**
 * KJ Fitness — Design System Colors
 *
 * Ported from the hi-fi prototype (styles.css).
 * Source values are oklch; pre-converted to hex for React Native.
 *
 * Accent is themeable — default is red.
 * Use ACCENT_PALETTES[key] to swap the accent across the app.
 */

// ─── Accent palettes ──────────────────────────────────────────────────────────
// All accents share oklch(0.68 0.20 <hue>) — same chroma + lightness,
// so they stay harmonious when swapped via the Tweaks panel.
export const ACCENT_PALETTES = {
  red: {
    accent:     '#E53935', // oklch(0.68 0.20  25)
    accentSoft: 'rgba(229, 57, 53, 0.16)',
    accentInk:  '#1F1010', // oklch(0.15 0.01  30) — text on accent bg
    accentDark: '#C62828',
  },
  lime: {
    accent:     '#4EC94F', // oklch(0.68 0.20 145)
    accentSoft: 'rgba(78, 201, 79, 0.16)',
    accentInk:  '#0D1A0E',
    accentDark: '#388E3C',
  },
  cobalt: {
    accent:     '#4A8FFF', // oklch(0.68 0.20 250)
    accentSoft: 'rgba(74, 143, 255, 0.16)',
    accentInk:  '#0A1020',
    accentDark: '#1565C0',
  },
  amber: {
    accent:     '#C9A200', // oklch(0.68 0.20  75)
    accentSoft: 'rgba(201, 162, 0, 0.16)',
    accentInk:  '#1A1400',
    accentDark: '#F57F17',
  },
};

// ─── Dark theme (default) ─────────────────────────────────────────────────────
// Warm near-black surface stack — no pure black (oklch hue ~35)
export const dark = {
  // Surfaces
  bg0:      '#1C1412', // oklch(0.15 0.012 35) — screen background
  bg1:      '#2A1E1A', // oklch(0.21 0.012 35) — cards
  bg2:      '#342624', // oklch(0.26 0.014 35) — elevated cards
  bg3:      '#3E2F2B', // oklch(0.31 0.014 35) — inputs / pressed states

  // Borders
  line:     '#463530', // oklch(0.34 0.012 40)
  lineSoft: 'rgba(70, 53, 48, 0.5)',

  // Text
  inkHi:    '#F9F7F4', // oklch(0.98 0.006 70) — primary text
  inkMd:    '#C5BEB6', // oklch(0.78 0.01  50) — secondary text
  inkLo:    '#948E86', // oklch(0.58 0.012 45) — muted / disabled

  // Status
  ok:       '#4BC878', // oklch(0.78 0.16 145) — success / adherence
  warn:     '#CBB02A', // oklch(0.78 0.16  75) — warning / overdue

  // Accent (red default)
  ...ACCENT_PALETTES.red,
};

// ─── Light theme ─────────────────────────────────────────────────────────────
// Paper-warm, not blue-white
export const light = {
  // Surfaces
  bg0:      '#F9F7F3', // oklch(0.985 0.004 70)
  bg1:      '#F3F0EB', // oklch(0.965 0.006 70)
  bg2:      '#EDE9E2', // oklch(0.94  0.008 70)
  bg3:      '#E4DFD7', // oklch(0.91  0.01  70)

  // Borders
  line:     '#D9D4CC', // oklch(0.86  0.008 70)
  lineSoft: 'rgba(217, 212, 204, 0.7)',

  // Text
  inkHi:    '#2E221C', // oklch(0.20 0.014 40)
  inkMd:    '#6A5A52', // oklch(0.42 0.012 40)
  inkLo:    '#948E86', // same as dark

  // Status
  ok:       '#1E9E50',
  warn:     '#A07800',

  // Accent (red default — lighter alpha for light bg)
  ...ACCENT_PALETTES.red,
  accentSoft: 'rgba(229, 57, 53, 0.10)',
  accentInk:  '#FFFFFF',
};

// ─── Gradients ────────────────────────────────────────────────────────────────
export const gradients = {
  // Login hero overlay (bottom fade to bg)
  hero: ['transparent', 'rgba(28, 20, 18, 0.75)', '#1C1412'],
  // Accent gradient — KJ logo badge, primary buttons
  primary: ['#E53935', '#C62828'],
  // Avatar gradient
  avatar: ['#E53935', '#C62828'],
  // Accent card tint (top fade)
  accentCard: ['rgba(229, 57, 53, 0.16)', 'transparent'],
  // Stage background glow (from prototype .stage)
  stageDark: [
    'rgba(34, 26, 24, 0.85)',
    'transparent',
    'rgba(32, 26, 25, 0.4)',
    'rgba(23, 20, 18, 1)',
  ],
};

// ─── Semantic aliases (dark mode, matches prototype default) ──────────────────
// CSS variable → RN color mapping:
//   --bg-0  → background        --ink-hi → textPrimary
//   --bg-1  → surface / card    --ink-md → textSecondary
//   --bg-2  → surfaceRaised     --ink-lo → textMuted
//   --bg-3  → input             --accent → primary / accent
//   --line  → border
export const colors = {
  // Surfaces
  background:     dark.bg0,
  backgroundAlt:  dark.bg1,   // used by input fields, cards
  surface:        dark.bg1,
  surfaceRaised:  dark.bg2,
  input:          dark.bg3,
  card:           dark.bg1,   // alias used by LoginScreen etc.
  cardRaised:     dark.bg2,

  // Borders
  border:         dark.line,
  borderSoft:     dark.lineSoft,
  cardBorder:     dark.lineSoft,  // alias used by LoginScreen

  // Text
  textPrimary:    dark.inkHi,
  textSecondary:  dark.inkMd,
  textMuted:      dark.inkLo,

  // Brand / accent
  primary:        dark.accent,
  primarySoft:    dark.accentSoft,
  primaryInk:     dark.accentInk,
  primaryDark:    dark.accentDark,
  accent:         dark.accent,
  accentSoft:     dark.accentSoft,
  accentInk:      dark.accentInk,
  accentDark:     dark.accentDark,

  // Status
  success:        dark.ok,
  warning:        dark.warn,
  error:          '#EF5350',
  ok:             dark.ok,
  warn:           dark.warn,

  // Navigation
  tabBar:         dark.bg1,
  tabBarBorder:   dark.line,
  tabActive:      dark.accent,
  tabInactive:    dark.inkLo,

  // Utility
  transparent:    'transparent',
  overlay:        'rgba(0, 0, 0, 0.6)',
  scrim:          'rgba(28, 20, 18, 0.85)',
  white:          '#FFFFFF',

  // ─── Aliases used by coach screens ──────────────────────────────────────────
  // These map legacy names to the canonical theme tokens so nothing breaks.
  primaryGlow:    dark.accentSoft,   // was rgba(0,188,212,0.16) — now red accent soft
  divider:        dark.lineSoft,     // separator lines between list rows
  cardElevated:   dark.bg2,          // raised / elevated card surface
};

export default colors;

/**
 * KJ Fitness — Design System Typography
 *
 * UI font:      Sora   (geometric, athletic — display + body)
 * Numeric font: JetBrains Mono (weights, reps, timers — tabular numerics)
 *
 * Setup: load fonts in your root layout with expo-font:
 *
 *   import { useFonts } from 'expo-font';
 *   const [fontsLoaded] = useFonts({
 *     'Sora-Regular':    require('../assets/fonts/Sora-Regular.ttf'),
 *     'Sora-Medium':     require('../assets/fonts/Sora-Medium.ttf'),
 *     'Sora-SemiBold':   require('../assets/fonts/Sora-SemiBold.ttf'),
 *     'Sora-Bold':       require('../assets/fonts/Sora-Bold.ttf'),
 *     'Sora-ExtraBold':  require('../assets/fonts/Sora-ExtraBold.ttf'),
 *     'JetBrainsMono-Regular': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
 *     'JetBrainsMono-Medium':  require('../assets/fonts/JetBrainsMono-Medium.ttf'),
 *   });
 *
 * Fonts can be downloaded from Google Fonts:
 *   https://fonts.google.com/specimen/Sora
 *   https://fonts.google.com/specimen/JetBrains+Mono
 */

// Font family constants
export const FONTS = {
  ui:         'Sora-Regular',
  uiMedium:   'Sora-Medium',
  uiSemiBold: 'Sora-SemiBold',
  uiBold:     'Sora-Bold',
  uiExtraBold:'Sora-ExtraBold',
  mono:       'JetBrainsMono-Regular',
  monoMedium: 'JetBrainsMono-Medium',
};

// ─── Type scale ───────────────────────────────────────────────────────────────

export const typography = {
  // ── Display (hero numbers, greeting) ──────────────────────────────────────
  display: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 36,
    letterSpacing: -0.5,
    lineHeight: 42,
  },

  // ── Headings ──────────────────────────────────────────────────────────────
  h1: {
    fontFamily: FONTS.uiBold,
    fontSize: 26,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  h2: {
    fontFamily: FONTS.uiBold,
    fontSize: 20,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  h3: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 17,
    letterSpacing: -0.1,
    lineHeight: 24,
  },
  h4: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 15,
    letterSpacing: 0,
    lineHeight: 21,
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    fontFamily: FONTS.ui,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: FONTS.uiMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    lineHeight: 18,
  },
  bodySmallMedium: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Labels / eyebrows ─────────────────────────────────────────────────────
  // Uppercase small-caps — used for section headers, tab labels, badges
  label: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 10.5,
    letterSpacing: 2.88, // 0.18em at 16px base
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  labelMd: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 12,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    lineHeight: 16,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  button: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 14.5,
    letterSpacing: 0.16,
    lineHeight: 20,
  },
  buttonSm: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 13,
    letterSpacing: 0.64, // 0.04em
    textTransform: 'uppercase',
    lineHeight: 18,
  },

  // ── Caption / eyebrow ─────────────────────────────────────────────────────
  // Tiny all-caps — tab labels, timestamps, meta info
  caption: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  // Eyebrow: section headers (matches .eyebrow in prototype)
  eyebrow: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.89, // 0.18em
    textTransform: 'uppercase',
    lineHeight: 14,
  },

  // ── Numerics (weights, reps, timers) ──────────────────────────────────────
  // Mono font + tabular nums — these are the visual heroes in workout screens
  numXl: {
    fontFamily: FONTS.monoMedium,
    fontSize: 40,
    letterSpacing: -1,
    lineHeight: 44,
  },
  numLg: {
    fontFamily: FONTS.monoMedium,
    fontSize: 28,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  numMd: {
    fontFamily: FONTS.monoMedium,
    fontSize: 20,
    letterSpacing: 0,
    lineHeight: 24,
  },
  numSm: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 18,
  },
};

export default typography;

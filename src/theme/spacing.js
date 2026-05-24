/**
 * KJ Fitness — Design System Spacing & Radius
 *
 * Ported from the hi-fi prototype (styles.css --r-* variables).
 */

// ─── Border radii ─────────────────────────────────────────────────────────────
export const radius = {
  sm:   8,   // --r-sm: chips, small badges
  md:   14,  // --r-md: buttons (48px height), inputs
  lg:   20,  // --r-lg: cards
  xl:   28,  // --r-xl: bottom sheets, modal cards, iPhone-style full rounding
  full: 999, // pill / avatar circles
};

// ─── Spacing scale ────────────────────────────────────────────────────────────
// 4px base unit — matches prototype padding values
export const spacing = {
  xs:   4,
  sm:   8,
  md:   14,
  base: 18,  // default card padding
  lg:   22,  // screen horizontal padding
  xl:   32,
  xxl:  48,
};

// ─── Component-level tokens ───────────────────────────────────────────────────
export const layout = {
  // Bottom navigation (client app)
  bottomNavHeight:   72,   // bnav padding-bottom 30px + content
  bottomNavPadding:  { top: 8, horizontal: 4, bottom: 30 },

  // Coach sidebar
  sidebarWidth:      232,

  // Top bar (coach console)
  topbarHeight:      56,

  // Standard button heights
  btnHeight:         48,   // .btn
  btnHeightLg:       56,   // .btn-lg

  // Avatar
  avatarSize:        36,

  // Screen horizontal gutter
  screenPadding:     22,
};

export default { radius, spacing, layout };

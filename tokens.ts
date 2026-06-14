// tokens.ts
// Design tokens extracted from glean.com, v1 for chunk 2.
// Refine as the build surfaces gaps — first time a button needs a hover
// color you don't have, that's the signal to extract it from DevTools
// and add it here.
//
// Confirmed values (from glean.com inspect-element):
//   --midnight-blue: #0A0227   → body text, primary surface text
//   --grey-333: #333           → secondary body text
//   --blue-500: #343CED        → brand primary (logo, links)
//   --white-24: #FEFEFE        → near-white (text on dark CTAs)
//   Polysans Neutral           → primary typeface (licensed; Inter substitute)
//
// Glean's font-weight pattern: 400 across body AND headings. Hierarchy
// comes from size + tight letter-spacing (-0.15rem on headings), not
// weight. Mirror this — don't reach for font-weight: 700 unless there's
// a specific reason. Stays Glean-shaped.

export const tokens = {
  color: {
    background: {
      primary: "#FFFFFF",
      secondary: "#F6F6F6",          // chip/pill background
    },
    text: {
      primary: "#0A0227",            // Glean's --midnight-blue
      secondary: "#333333",          // Glean's --grey-333
      muted: "#D8D8D8",              // eyebrow / supporting text
      inverse: "#FEFEFE",            // Glean's --white-24, for text on dark surfaces
    },
    brand: {
      primary: "#343CED",            // Glean's --blue-500
      deep: "#010666",               // banner navy
    },
    surface: {
      dark: "#0A0227",               // primary CTA background (e.g., "Get a Demo" pill)
    },
    state: {
      // The one semantic token (SID-46 D2). Amber that reads as CAUTION, not
      // error — used ONLY on the escalate verdict pill (B.2). Resolve uses
      // brand.primary; refuse uses muted neutrals. Do not propagate elsewhere.
      warning: "#D97706",
    },
    border: "#E5E5EA",               // placeholder — refine when the build needs it
  },

  // Dark theme (SID-48 Phase 3). ADDED IN PARALLEL — the light `color` block
  // above is preserved, not replaced. Only the theme-FLIPPING roles live here;
  // the saturated/semantic colors (brand.primary, surface.dark, state.warning,
  // text.inverse) stay fixed across themes so verdict + accent meaning doesn't
  // shift. These values are mirrored as the `.dark` CSS variables in globals.css;
  // the active theme is switched there + via <html class="dark"> in layout.tsx.
  colorDark: {
    background: {
      primary: "#0D0D0E",            // near-black page
      secondary: "#18181B",          // panels / chips / snippet wells
    },
    text: {
      primary: "#EDEDED",            // near-white body / headings
      secondary: "#A1A1AA",          // muted
      muted: "#71717A",              // faint / eyebrow
    },
    border: "#2A2A2E",
  },

  font: {
    // Polysans Neutral is licensed. Inter is the closest free substitute.
    // If/when you license Polysans, replace the first entry.
    sans: '"Inter", "Polysans Neutral", Arial, sans-serif',
    mono: '"JetBrains Mono", monospace',
  },

  size: {
    body: "1rem",                    // confirmed — Glean's body size
    button: "1.125rem",              // confirmed — Glean's nav button size
    h1: "4.5rem",                    // confirmed — desktop hero
    h1Mobile: "38px",                // confirmed — mobile hero
  },

  weight: {
    regular: 400,                    // Glean uses 400 everywhere, including headings
    bold: 700,                       // available, but resist using for headings
  },

  lineHeight: {
    body: 1.3,                       // confirmed — Glean body
    heading: 1.08,                   // confirmed — Glean h1 base
    headingTight: 0.96,              // confirmed — homeexp hero variant
    button: 1.4,                     // confirmed — button text
  },

  letterSpacing: {
    heading: "-0.15rem",             // confirmed — Glean's tight tracking on headings
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
  },

  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    pill: "9999px",                  // Glean uses pill-shaped CTAs
  },
} as const;

export type Tokens = typeof tokens;

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

  // SID-67 — theme-INDEPENDENT semantic colors for the warm-dark "audit /
  // case-file" register. Fixed literals (don't flip); the app is dark-only.
  // Accent is amber/copper, used SPARINGLY (primary action + links only, never
  // decoration). Verdict colors are the warm restatement of resolve/escalate/
  // refuse — all clear WCAG AA (≥4.5:1) on bg and surface.
  accent: "#C68E3D",                 // amber/copper — Send button, links, focus
  verdict: {
    resolve: "#5B8F5B",              // warm green
    escalate: "#C46A3A",             // burnt orange (kept clear of accent amber)
    refuse: "#8A7E6B",               // muted gray-amber
  },

  // Dark theme (SID-48 Phase 3). ADDED IN PARALLEL — the light `color` block
  // above is preserved, not replaced. Only the theme-FLIPPING roles live here;
  // the saturated/semantic colors (brand.primary, surface.dark, state.warning,
  // text.inverse) stay fixed across themes so verdict + accent meaning doesn't
  // shift. These values are mirrored as the `.dark` CSS variables in globals.css;
  // the active theme is switched there + via <html class="dark"> in layout.tsx.
  //
  // SID-67: repointed to the warm-dark register. Warm near-black with a brown
  // undertone (not the old cold #0D0D0E), warm off-white text (never pure white),
  // hairline #2D2925. text.muted lightened to #948A7C so the 12px mono audit
  // labels clear WCAG AA (5.7:1 on bg, 4.7:1 on surface-2); the card's #6B6359
  // tested at 3.0:1 and would have failed. tertiary = hover / secondary surface.
  // SID-92: intensity reduced (Option X) — page + panels lifted ~one step to cut
  // visual weight; tertiary (hover) + all text colors held; border lightened to stay
  // crisp on the lighter base. All text/surface pairs still clear WCAG AA (muted on
  // the lightest surface = 4.66:1). Mirrored in globals.css .dark.
  colorDark: {
    background: {
      primary: "#17150F",            // warm dark page (lifted from #0F0E0C)
      secondary: "#211E19",          // panels / elevated surface (lifted from #1A1815)
      tertiary: "#252220",           // hover / secondary surface (unchanged)
    },
    text: {
      primary: "#F2EDE3",            // warm off-white (NOT pure white)
      secondary: "#A89F8E",          // warm secondary
      muted: "#948A7C",              // faint — audit labels; AA-safe warm (card #6B6359 → 3.0:1)
    },
    border: "#34302A",               // hairline rules (lightened from #2D2925)
  },

  font: {
    // SID-67 three-family system (loaded by next/font in layout.tsx, resolved via
    // CSS variables). sans = Inter (body, no character of its own); display =
    // Newsreader (wordmark + verdict text + eyebrows ONLY); mono = IBM Plex Mono
    // (evidence labels, identifiers, paths, scores). The generic fallbacks guard
    // the flash before the variable resolves.
    sans: "var(--font-sans), system-ui, sans-serif",
    display: "var(--font-display), Georgia, serif",
    mono: "var(--font-mono), ui-monospace, monospace",
  },

  size: {
    body: "1rem",                    // confirmed — Glean's body size
    button: "1.125rem",              // confirmed — Glean's nav button size
    h1: "4.5rem",                    // confirmed — desktop hero
    h1Mobile: "38px",                // confirmed — mobile hero
    // SID-67 register steps. Display serif moments + the mono audit vocabulary.
    displayLg: "30px",               // verdict moments (28–32px band)
    displaySm: "14px",               // section eyebrows (italic lowercase)
    monoLabel: "12px",               // evidence row labels (uppercase, tracked)
    monoValue: "13px",               // identifiers / paths / scores
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
    display: "-0.01em",              // SID-67 — gentle tightening on display serif
    monoLabel: "0.08em",             // SID-67 — tracked uppercase audit labels
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

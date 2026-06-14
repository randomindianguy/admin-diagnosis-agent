import type { Config } from "tailwindcss";
import { tokens } from "./tokens";

// Tailwind v3, pinned deliberately (CHUNK2-DESIGN-DECISIONS Q7). `tokens.ts` is
// the diff-able ground-truth: values below are wired VERBATIM, placeholders
// included. When something looks off later, fix the token — never override in a
// component. Missing tokens get raised as a question, not invented here.
//
// Token → theme mapping (full, nothing homeless):
//   color.*        → colors        font.sans/mono → fontFamily
//   size.*         → fontSize      weight.*       → fontWeight
//   lineHeight.*   → lineHeight    letterSpacing  → letterSpacing
//   spacing.*      → spacing       radius.*       → borderRadius
//
// Using `extend` (not replace) so Tailwind's defaults survive; token values win
// only where keys collide (e.g. borderRadius sm/md/lg, fontWeight bold).
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Theme-FLIPPING roles resolve to CSS variables (defined in globals.css:
      // :root = light, .dark = dark). The active theme is set by <html class="dark">.
      // Saturated/semantic roles (brand, surface, state, text.inverse) stay fixed
      // literals from tokens.color so verdict + accent meaning is theme-independent.
      colors: {
        background: {
          primary: "var(--color-bg-primary)",
          secondary: "var(--color-bg-secondary)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: tokens.color.text.inverse, // fixed: text on brand/dark surfaces
        },
        brand: {
          primary: tokens.color.brand.primary,
          deep: tokens.color.brand.deep,
        },
        surface: {
          dark: tokens.color.surface.dark,
        },
        state: {
          warning: tokens.color.state.warning,
        },
        border: "var(--color-border)",
      },
      fontFamily: {
        sans: [tokens.font.sans],
        mono: [tokens.font.mono],
      },
      fontSize: {
        body: tokens.size.body,
        button: tokens.size.button,
        h1: tokens.size.h1,
        h1Mobile: tokens.size.h1Mobile,
      },
      // Tailwind types fontWeight/lineHeight as string; tokens store them as
      // numbers. String() is a type coercion only — the value is preserved
      // exactly (400 → "400", 1.3 → "1.3"), so the token stays ground-truth.
      fontWeight: {
        regular: String(tokens.weight.regular),
        bold: String(tokens.weight.bold),
      },
      lineHeight: {
        body: String(tokens.lineHeight.body),
        heading: String(tokens.lineHeight.heading),
        headingTight: String(tokens.lineHeight.headingTight),
        button: String(tokens.lineHeight.button),
      },
      letterSpacing: {
        heading: tokens.letterSpacing.heading,
      },
      spacing: {
        xs: tokens.spacing.xs,
        sm: tokens.spacing.sm,
        md: tokens.spacing.md,
        lg: tokens.spacing.lg,
        xl: tokens.spacing.xl,
        "2xl": tokens.spacing["2xl"],
      },
      borderRadius: {
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        pill: tokens.radius.pill,
      },
    },
  },
  plugins: [],
};

export default config;

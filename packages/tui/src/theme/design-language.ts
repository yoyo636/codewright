/**
 * Aether — the codewright design language.
 *
 * Philosophy: "quiet power". Restrained, layered, near-monochrome with a single
 * refined accent (aurora). Surfaces are translucent glass stacked over a deep
 * ink background; depth comes from hairline borders and subtle elevation, not
 * from drop shadows or glow. Motion is short and ease-out — nothing bouncy.
 *
 * This file is the single source of truth for both the TUI theme and the web
 * landing page. Keep the token names in sync with `assets/codewright.json`.
 */

export const name = "aether" as const

export const spacing = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
} as const

export const radius = {
  sm: "8px",
  md: "14px",
  lg: "22px",
  xl: "30px",
  full: "9999px",
} as const

export const typography = {
  display: {
    family: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    weight: 700,
    tracking: "-0.045em",
    lineHeight: "1.02",
  },
  heading: {
    family: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    weight: 600,
    tracking: "-0.03em",
    lineHeight: "1.12",
  },
  body: {
    family: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    weight: 400,
    tracking: "0",
    lineHeight: "1.6",
  },
  mono: {
    family: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    weight: 500,
    tracking: "0",
    lineHeight: "1.7",
  },
} as const

export const color = {
  ink: "#07070a",
  inkSurface: "rgba(16, 16, 26, 0.72)",
  inkSurfaceStrong: "rgba(22, 22, 34, 0.82)",
  inkBorder: "rgba(255, 255, 255, 0.07)",
  inkBorderActive: "rgba(255, 255, 255, 0.14)",
  aurora: "#8b7cff",
  auroraSoft: "#5eead4",
  auroraLavender: "#c4b5fd",
  ember: "#f59e0b",
  emerald: "#34d399",
  rose: "#f87171",
  sky: "#60a5fa",
  text: "#e6e6ee",
  textMuted: "#777794",
} as const

export const motion = {
  fast: "120ms ease-out",
  base: "180ms ease-out",
  slow: "280ms ease-out",
} as const

export const elevation = {
  0: "0 0 0 1px rgba(255,255,255,0.03), 0 1px 2px rgba(0,0,0,0.3)",
  1: "0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.45)",
  2: "0 0 0 1px rgba(255,255,255,0.05), 0 20px 50px rgba(0,0,0,0.55)",
} as const

/** CSS variable map for the web landing page. */
export const cssVars = {
  "--aether-bg": color.ink,
  "--aether-surface": color.inkSurface,
  "--aether-surface-strong": color.inkSurfaceStrong,
  "--aether-border": color.inkBorder,
  "--aether-border-active": color.inkBorderActive,
  "--aether-text": color.text,
  "--aether-text-muted": color.textMuted,
  "--aether-aurora": color.aurora,
  "--aether-aurora-soft": color.auroraSoft,
  "--aether-aurora-lavender": color.auroraLavender,
  "--aether-ember": color.ember,
  "--aether-emerald": color.emerald,
  "--aether-rose": color.rose,
  "--aether-sky": color.sky,
  "--aether-radius-sm": radius.sm,
  "--aether-radius-md": radius.md,
  "--aether-radius-lg": radius.lg,
  "--aether-radius-xl": radius.xl,
  "--aether-motion-fast": motion.fast,
  "--aether-motion-base": motion.base,
  "--aether-motion-slow": motion.slow,
} as const

export const gradient = {
  aurora: `linear-gradient(135deg, ${color.aurora} 0%, ${color.auroraLavender} 50%, ${color.auroraSoft} 100%)`,
  auroraSoft: `linear-gradient(135deg, ${color.aurora} 0%, ${color.auroraSoft} 100%)`,
  mesh: `radial-gradient(ellipse at 20% 50%, rgba(139, 124, 255, 0.10) 0%, transparent 55%),
         radial-gradient(ellipse at 80% 20%, rgba(94, 234, 212, 0.07) 0%, transparent 55%),
         radial-gradient(ellipse at 50% 80%, rgba(196, 181, 253, 0.06) 0%, transparent 55%)`,
} as const
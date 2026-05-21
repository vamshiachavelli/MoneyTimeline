export const colors = {
  background: "#05080D",
  backgroundElevated: "#0B111A",
  surface: "#111923",
  surfaceStrong: "#172231",
  border: "#253242",
  borderSoft: "#182231",
  textPrimary: "#F7FAFC",
  textSecondary: "#AAB7C6",
  textMuted: "#6E7C8E",
  accent: "#43D88B",
  accentStrong: "#19B86C",
  accentSoft: "rgba(67, 216, 139, 0.16)",
  warning: "#F6A63B",
  danger: "#FF6B6B",
  personal: "#43D88B",
  shared: "#F6A63B",
  unclassified: "#7FA7FF"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999
} as const;

export const typography = {
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700" as const
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500" as const
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" as const
  }
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  typography
} as const;

export type AppTheme = typeof theme;

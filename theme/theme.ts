export const theme = {
  colors: {
    bg: {
      base:     "#080808",
      surface:  "#0f0f0f",
      elevated: "#161616",
      overlay:  "#1e1e1e",
      subtle:   "#252525",
    },
    accent:     "#f59e0b",
    accentLight:"#fbbf24",
    accentDim:  "#92400e",
    text: {
      primary: "#f0f0f0",
      muted:   "#8a8a8a",
      faint:   "#444444",
      inverse: "#080808",
    },
    border:       "#1f1f1f",
    borderLight:  "#2a2a2a",
    success:  "#22c55e",
    error:    "#ef4444",
    warning:  "#f59e0b",
    info:     "#3b82f6",
  },
  fonts: {
    heading: "'Space Grotesk', sans-serif",
    sans:    "'Inter', sans-serif",
    mono:    "'JetBrains Mono', monospace",
  },
  radii: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
  },
} as const;

export type Theme = typeof theme;

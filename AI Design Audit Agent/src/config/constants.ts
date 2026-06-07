export const DESIGN_PRINCIPLES = [
  "Visual Hierarchy",
  "Contrast (WCAG AA)",
  "Spacing",
  "Alignment",
  "Consistency",
  "Layout"
] as const;

export const SEVERITIES = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
} as const;

export const CHANGE_TYPES = {
  REGRESSION: "regression",
  IMPROVEMENT: "improvement",
  NEUTRAL: "neutral"
} as const;

export const VERDICTS = {
  IMPROVEMENT: "Net Improvement",
  MIXED: "Mixed Changes",
  REGRESSION: "Net Regression"
} as const;

export const API_CONFIG = {
  ENDPOINT: "/api/audit",
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_MIME_TYPES: ["image/png", "image/jpeg", "image/webp"],
  GEMINI_MODEL: "gemini-2.5-flash"
} as const;

export interface RegressionFinding {
  id: string;
  category: "Visual Hierarchy" | "Contrast (WCAG AA)" | "Spacing" | "Alignment" | "Consistency" | "Layout" | string;
  severity: "critical" | "high" | "medium" | "low";
  changeType: "regression" | "improvement" | "neutral";
  location: string;
  beforeValue: string;
  afterValue: string;
  impact: string;
  recommendation: string;
  confidence: number; // 0 to 100
  measurableEvidence: string;
}

export interface AuditSummary {
  verdict: "Net Improvement" | "Mixed Changes" | "Net Regression";
  totalRegressions: number;
  totalImprovements: number;
  totalNeutral: number;
  accessibilityScore: number; // 0 to 100
  averageConfidence: number; // 0 to 100
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface Level2AuditResponse {
  summary: AuditSummary;
  findings: RegressionFinding[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  status: "info" | "success" | "warning" | "error" | "loading";
  message: string;
}

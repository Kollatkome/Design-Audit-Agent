export interface Level1Finding {
  id: string;
  principle: "Visual Hierarchy" | "Contrast (WCAG AA)" | "Spacing" | "Alignment" | "Consistency" | string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number; // 0 to 100
  location: string;
  issue: string;
  userImpact: string;
  recommendation: string;
  evidence: string;
}

export interface AuditSummary {
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AuditResponse {
  summary: AuditSummary;
  findings: Level1Finding[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  status: "info" | "success" | "warning" | "error" | "loading";
  message: string;
}

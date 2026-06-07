export interface PlaywrightCrawlConfig {
  targetUrl: string;
  maxPages: number;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  noiseSelectors?: string[]; // CSS selectors to hide/ignore (spinners, ads, clocks)
}

export interface CrawlPageResult {
  url: string;
  slug: string;
  screenshotBase64: string;
  status: "success" | "failed";
  error?: string;
}

export interface BaselineSnapshot {
  id: string; // unique version id e.g. timestamp or v1, v2
  timestamp: string;
  url: string;
  slug: string;
  screenshotPath: string; // local relative path or base64
  status: "approved" | "pending" | "rolled_back";
}

export interface WatchdogFinding {
  id: string;
  category: "Layout Instability" | "Visual Regression" | "Accessibility Regression" | "Consistency" | "Functional Drift" | string;
  severity: "critical" | "high" | "medium" | "low";
  changeType: "regression" | "improvement" | "neutral";
  location: string; // selector or bounding box
  beforeState: string;
  afterState: string;
  impact: "cosmetic" | "usability" | "conversion-risk" | "accessibility-critical";
  measurableEvidence: string;
  recommendation: string;
  confidenceScore: number; // 0 to 100
}

export interface Level3AuditSummary {
  verdict: "PASS" | "FAIL";
  designHealth: number; // 0 to 100
  averageConfidence: number; // 0 to 100
  layoutStabilityScore: number; // 0 to 100 (measure of layout drift/shifts)
  totalRegressions: number;
  totalImprovements: number;
  reasoning: string; // why release gate is PASS or FAIL
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface Level3AuditResponse {
  summary: Level3AuditSummary;
  findings: WatchdogFinding[];
  pageUrl: string;
  pageSlug: string;
  baselineTimestamp?: string;
  crawlTimestamp?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  status: "info" | "success" | "warning" | "error" | "loading";
  message: string;
}

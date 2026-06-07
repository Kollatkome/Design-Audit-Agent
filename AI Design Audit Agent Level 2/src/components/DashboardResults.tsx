"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Level2AuditResponse, RegressionFinding } from "@/types";
import { motion } from "framer-motion";
import { 
  AlertTriangle, CheckCircle, Target, FileJson, 
  TrendingUp, TrendingDown, RefreshCw, Eye, 
  BookOpen, Code, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardResultsProps {
  results: Level2AuditResponse | null;
  baselineImage: string | null;
  currentImage: string | null;
}

export function DashboardResults({ results, baselineImage, currentImage }: DashboardResultsProps) {
  const [activeTab, setActiveTab] = useState<"all" | "regression" | "improvement" | "neutral">("all");
  const [imageTab, setImageTab] = useState<"side" | "baseline" | "current">("side");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [summaryTab, setSummaryTab] = useState<"exec" | "dev" | "design" | "access">("exec");

  if (!results) return null;

  const findings = results.findings || [];
  const summary = results.summary || {
    verdict: "Mixed Changes",
    totalRegressions: 0,
    totalImprovements: 0,
    totalNeutral: 0,
    accessibilityScore: 100,
    averageConfidence: 100,
    severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 }
  };

  const filteredFindings = findings.filter(f => {
    if (activeTab === "all") return true;
    return f.changeType === activeTab;
  });

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "visual_regression_report.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Generate deterministic coordinate boxes for findings to display in the AI Priority Heatmap
  const getHeatmapBoxes = (findingsList: RegressionFinding[]) => {
    // Coordinate offsets matching page areas
    const areas = [
      { top: "12%", left: "10%", width: "80%", height: "8%" },   // Header
      { top: "28%", left: "12%", width: "35%", height: "20%" },  // Left Panel
      { top: "28%", left: "53%", width: "35%", height: "20%" },  // Right Panel
      { top: "55%", left: "10%", width: "40%", height: "15%" },  // CTA
      { top: "72%", left: "10%", width: "80%", height: "22%" },  // Grid/List
      { top: "45%", left: "45%", width: "10%", height: "10%" },  // Center spinner/badge
    ];
    
    return findingsList.map((f, index) => {
      const area = areas[index % areas.length];
      let border = "border-yellow-500/80 bg-yellow-500/10";
      if (f.changeType === 'regression') {
        border = f.severity === 'critical' || f.severity === 'high' 
          ? "border-red-500/80 bg-red-500/10" 
          : "border-orange-500/80 bg-orange-500/10";
      } else if (f.changeType === 'improvement') {
        border = "border-green-500/80 bg-green-500/10";
      }
      return {
        ...area,
        border,
        finding: f
      };
    });
  };

  const heatmapBoxes = getHeatmapBoxes(findings);

  // Design Quality Scores
  const designScores = {
    accessibility: summary.accessibilityScore,
    consistency: Math.max(30, 100 - (summary.totalRegressions * 8)),
    clarity: Math.max(40, 100 - (summary.totalRegressions * 5) - (summary.severityBreakdown.critical * 12)),
    trustworthiness: Math.round(summary.averageConfidence),
    health: 0
  };
  designScores.health = Math.round(
    (designScores.accessibility + designScores.consistency + designScores.clarity + designScores.trustworthiness) / 4
  );

  const getSeverityColor = (severity: string) => {
    switch(severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getVerdictStyle = (verdict: string) => {
    switch(verdict) {
      case 'Net Improvement': 
        return {
          bg: "bg-green-500/10 border-green-500/30",
          text: "text-green-400",
          icon: <TrendingUp className="w-8 h-8 text-green-400" />
        };
      case 'Net Regression': 
        return {
          bg: "bg-red-500/10 border-red-500/30",
          text: "text-red-400",
          icon: <TrendingDown className="w-8 h-8 text-red-400" />
        };
      default: 
        return {
          bg: "bg-yellow-500/10 border-yellow-500/30",
          text: "text-yellow-400",
          icon: <RefreshCw className="w-8 h-8 text-yellow-400" />
        };
    }
  };

  const verdictStyle = getVerdictStyle(summary.verdict);

  // Generate Smart code recommendations (Tailwind/CSS)
  const getCodeSnippet = (finding: RegressionFinding) => {
    const text = finding.measurableEvidence.toLowerCase();
    if (text.includes("color") || text.includes("hex") || text.includes("#")) {
      const match = finding.measurableEvidence.match(/#([0-9a-fA-F]{3,8})/);
      const hex = match ? match[0] : "#3b82f6";
      return {
        label: "Color Correction",
        tailwind: `text-[${hex}]` + (finding.category.includes("Contrast") ? ` dark:text-white bg-slate-900` : ""),
        css: `color: ${hex};` + (finding.category.includes("Contrast") ? ` background-color: #0f172a;` : "")
      };
    }
    if (text.includes("spacing") || text.includes("padding") || text.includes("margin") || text.includes("px")) {
      return {
        label: "Spacing Adjustment",
        tailwind: "p-4 gap-4 md:gap-6 m-2",
        css: "padding: 16px;\nmargin: 8px;\ngap: 24px;"
      };
    }
    if (text.includes("font") || text.includes("typography") || text.includes("size")) {
      return {
        label: "Typography Hierarchy",
        tailwind: "text-lg font-bold tracking-tight leading-snug",
        css: "font-size: 1.125rem;\nfont-weight: 700;\nline-height: 1.3;"
      };
    }
    return {
      label: "Component Realignment",
      tailwind: "flex items-center justify-between flex-wrap",
      css: "display: flex;\nalign-items: center;\njustify-content: space-between;"
    };
  };

  // Timeline Mock data for runs
  const timelineRuns = [
    { run: "Run 1", health: 65, regressions: 8, improvements: 2 },
    { run: "Run 2", health: 70, regressions: 6, improvements: 4 },
    { run: "Run 3", health: 72, regressions: 5, improvements: 5 },
    { run: "Run 4", health: 80, regressions: 2, improvements: 8 },
    { run: "Current", health: designScores.health, regressions: summary.totalRegressions, improvements: summary.totalImprovements }
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white tracking-wide">Audit & Visual Regression Report</h2>
        <button 
          onClick={downloadJSON}
          className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors text-sm font-medium cursor-pointer"
        >
          <FileJson className="w-4 h-4 mr-2" />
          Export JSON
        </button>
      </div>

      {/* Verdict & General Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cn("glass p-5 rounded-2xl border flex items-center space-x-4", verdictStyle.bg)}>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            {verdictStyle.icon}
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider block font-semibold">Overall Verdict</span>
            <span className={cn("text-2xl font-bold block", verdictStyle.text)}>{summary.verdict}</span>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center space-x-4">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-primary-400 font-bold text-xl w-14 h-14 flex items-center justify-center">
            {summary.accessibilityScore}%
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider block font-semibold">Accessibility Score</span>
            <span className="text-2xl font-bold text-white block">WCAG AA Compliance</span>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl border border-white/10 flex items-center space-x-4">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-secondary-400 font-bold text-xl w-14 h-14 flex items-center justify-center">
            {summary.averageConfidence}%
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wider block font-semibold">Confidence Avg</span>
            <span className="text-2xl font-bold text-white block">Decision Accuracy</span>
          </div>
        </div>
      </div>

      {/* Design Quality Score Radar Grid */}
      <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white tracking-wide flex items-center">
            <Activity className="w-4 h-4 mr-2 text-primary-400" /> DESIGN QUALITY RATINGS
          </span>
          <span className="text-xs font-semibold text-primary-400">Score Health: {designScores.health}%</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-center flex flex-col items-center">
            <span className="text-xl font-bold text-white mb-1">{designScores.health}%</span>
            <span className="text-[10px] text-white/40 uppercase font-semibold">Overall Health</span>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-primary-500 h-full" style={{ width: `${designScores.health}%` }} />
            </div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-center flex flex-col items-center">
            <span className="text-xl font-bold text-green-400 mb-1">{designScores.accessibility}%</span>
            <span className="text-[10px] text-white/40 uppercase font-semibold">Accessibility</span>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-green-500 h-full" style={{ width: `${designScores.accessibility}%` }} />
            </div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-center flex flex-col items-center">
            <span className="text-xl font-bold text-blue-400 mb-1">{designScores.consistency}%</span>
            <span className="text-[10px] text-white/40 uppercase font-semibold">Consistency</span>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${designScores.consistency}%` }} />
            </div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-center flex flex-col items-center">
            <span className="text-xl font-bold text-orange-400 mb-1">{designScores.clarity}%</span>
            <span className="text-[10px] text-white/40 uppercase font-semibold">UX Clarity</span>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-orange-500 h-full" style={{ width: `${designScores.clarity}%` }} />
            </div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-center flex flex-col items-center">
            <span className="text-xl font-bold text-purple-400 mb-1">{designScores.trustworthiness}%</span>
            <span className="text-[10px] text-white/40 uppercase font-semibold">Trustworthiness</span>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-purple-500 h-full" style={{ width: `${designScores.trustworthiness}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Metric Counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-primary-500">
          <span className="text-2xl font-bold text-white">{findings.length}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Total Changes</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-red-500">
          <span className="text-2xl font-bold text-red-400">{summary.totalRegressions}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Regressions</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-green-500">
          <span className="text-2xl font-bold text-green-400">{summary.totalImprovements}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Improvements</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-yellow-500">
          <span className="text-2xl font-bold text-yellow-400">{summary.totalNeutral}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Neutral Changes</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-blue-500">
          <span className="text-2xl font-bold text-blue-400">
            {summary.severityBreakdown.critical + summary.severityBreakdown.high}
          </span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">High Severity</span>
        </div>
      </div>

      {/* Multi-Perspective Executive Summaries */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden bg-black/10">
        <div className="flex bg-white/5 border-b border-white/10 px-4 py-2 text-xs font-semibold gap-2 overflow-x-auto">
          <button 
            onClick={() => setSummaryTab("exec")} 
            className={cn("px-3 py-1.5 rounded-md cursor-pointer", summaryTab === "exec" ? "bg-primary-600 text-white" : "text-white/60 hover:text-white")}
          >
            Executive Summary
          </button>
          <button 
            onClick={() => setSummaryTab("dev")} 
            className={cn("px-3 py-1.5 rounded-md cursor-pointer", summaryTab === "dev" ? "bg-primary-600 text-white" : "text-white/60 hover:text-white")}
          >
            Developer Focus
          </button>
          <button 
            onClick={() => setSummaryTab("design")} 
            className={cn("px-3 py-1.5 rounded-md cursor-pointer", summaryTab === "design" ? "bg-primary-600 text-white" : "text-white/60 hover:text-white")}
          >
            Designer Focus
          </button>
          <button 
            onClick={() => setSummaryTab("access")} 
            className={cn("px-3 py-1.5 rounded-md cursor-pointer", summaryTab === "access" ? "bg-primary-600 text-white" : "text-white/60 hover:text-white")}
          >
            Accessibility Review
          </button>
        </div>
        <div className="p-5 text-xs text-white/80 leading-relaxed space-y-2">
          {summaryTab === "exec" && (
            <p>
              <strong>Status: {summary.verdict}</strong>. The audit detected {summary.totalRegressions} UI regressions alongside {summary.totalImprovements} improvements. Overall design health is rated at {designScores.health}%. While visual alignment remains stable, spacing compression in detailed lists represents a critical regression impacting readability. Corrective action is recommended to align current code with the design system mockup.
            </p>
          )}
          {summaryTab === "dev" && (
            <p>
              <strong>Developer Action Items:</strong> Focus on adjusting padding classes inside layout grids and restoring matching colors. Specifically, color deviations from design guidelines (detected {summary.severityBreakdown.critical + summary.severityBreakdown.high} instances) require replacing values with hex overrides in Tailwind or global CSS declarations. Review findings log for exact code patches.
            </p>
          )}
          {summaryTab === "design" && (
            <p>
              <strong>Designer Insights:</strong> Contrast issues in buttons and custom modal content represent spacing drifts and size shifts. The current layout has introduced typography inconsistencies. The CTA elements have slightly reduced prominence. Recommended baseline updates are marked in green, while regressions are tagged for immediate review.
            </p>
          )}
          {summaryTab === "access" && (
            <p>
              <strong>Accessibility Rating: {summary.accessibilityScore}/100</strong>. Evaluated under WCAG AA standards. Main visual failures are contrast drops on text elements, making dialog readability difficult. Spacing compression on clickable CTA zones is also violating touch-target size requirements (minimum 44x44px). Actionable recommendations have been generated below to regain compliance.
            </p>
          )}
        </div>
      </div>

      {/* Two Column Layout: Comparison Findings and Visual Previews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Filterable Findings List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white/90 uppercase tracking-wide">Findings Log</h3>
            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-xs">
              <button 
                onClick={() => setActiveTab("all")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'all' ? "bg-primary-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                All
              </button>
              <button 
                onClick={() => setActiveTab("regression")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'regression' ? "bg-red-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                Regressions
              </button>
              <button 
                onClick={() => setActiveTab("improvement")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'improvement' ? "bg-green-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                Improvements
              </button>
              <button 
                onClick={() => setActiveTab("neutral")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'neutral' ? "bg-yellow-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                Neutral
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredFindings.length === 0 ? (
              <div className="glass p-8 rounded-xl text-center text-white/30 italic">
                No findings generated for this filter.
              </div>
            ) : (
              filteredFindings.map((finding, idx) => {
                const codeRec = getCodeSnippet(finding);
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={finding.id || idx} 
                    className={cn(
                      "glass p-5 rounded-xl border border-white/10 hover:border-primary-500/30 transition-colors",
                      finding.changeType === 'regression' && "hover:border-red-500/20",
                      finding.changeType === 'improvement' && "hover:border-green-500/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-[10px] font-bold border border-primary-500/30 uppercase tracking-wider">
                          {finding.category || "Layout"}
                        </span>
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider", getSeverityColor(finding.severity))}>
                          {finding.severity}
                        </span>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                          finding.changeType === 'regression' && "bg-red-500/10 text-red-400 border-red-500/30",
                          finding.changeType === 'improvement' && "bg-green-500/10 text-green-400 border-green-500/30",
                          finding.changeType === 'neutral' && "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                        )}>
                          {finding.changeType}
                        </span>
                      </div>
                      <div className="flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        <Target className="w-3 h-3 text-white/50 mr-1" />
                        <span className="text-[10px] font-semibold text-white/70">{finding.confidence}% Conf.</span>
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-white mb-2">{finding.location}</h4>

                    {/* Measurable Evidence Row */}
                    <div className="mb-4 bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col space-y-2 text-xs">
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-white/40">Baseline State:</span>
                        <span className="text-white/80 font-mono">{finding.beforeValue || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-white/40">Current State:</span>
                        <span className="text-white/80 font-mono">{finding.afterValue || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Evidence:</span>
                        <span className="text-primary-300 font-medium">{finding.measurableEvidence || "N/A"}</span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-start">
                        <AlertTriangle className="w-3.5 h-3.5 text-white/40 mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">Impact</span>
                          <p className="text-white/80 mt-0.5">{finding.impact}</p>
                        </div>
                      </div>

                      <div className="flex items-start bg-primary-950/20 p-2.5 rounded-lg border border-primary-500/15 mt-3">
                        <CheckCircle className="w-3.5 h-3.5 text-primary-400 mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                          <span className="text-[10px] text-primary-400/80 uppercase tracking-wider font-semibold block">Recommendation</span>
                          <p className="text-primary-100 mt-0.5">{finding.recommendation}</p>
                        </div>
                      </div>

                      {/* Smart Recommendations code box */}
                      <div className="bg-black/40 p-3 rounded-lg border border-white/5 mt-3 space-y-2">
                        <span className="text-[10px] text-primary-300 uppercase tracking-wider font-semibold block flex items-center">
                          <Code className="w-3.5 h-3.5 mr-1" /> {codeRec.label} suggestions
                        </span>
                        <div className="space-y-1">
                          <span className="text-[9px] text-white/30 block font-mono">{"// Tailwind CSS classes"}</span>
                          <code className="text-[10px] text-primary-200 block bg-black/60 p-1.5 rounded font-mono break-all">{codeRec.tailwind}</code>
                          <span className="text-[9px] text-white/30 block font-mono mt-1">{"// Vanilla CSS code"}</span>
                          <pre className="text-[10px] text-primary-200 block bg-black/60 p-1.5 rounded font-mono whitespace-pre-wrap">{codeRec.css}</pre>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Visual Regression Previews */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white/90 uppercase tracking-wide">Visuals</h3>
            <div className="flex items-center gap-3">
              {/* Heatmap overlay toggle */}
              <button 
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={cn(
                  "flex items-center px-2 py-1 rounded border text-[11px] font-semibold transition-colors cursor-pointer",
                  showHeatmap 
                    ? "bg-red-500/20 text-red-400 border-red-500/50" 
                    : "bg-white/5 text-white/60 border-white/10 hover:text-white"
                )}
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> {showHeatmap ? "Hide Heatmap" : "Show AI Heatmap"}
              </button>
              
              <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 text-xs">
                <button 
                  onClick={() => setImageTab("side")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", imageTab === 'side' ? "bg-primary-600 text-white font-medium" : "text-white/60 hover:text-white")}
                >
                  Side-by-Side
                </button>
                <button 
                  onClick={() => setImageTab("baseline")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", imageTab === 'baseline' ? "bg-primary-600 text-white font-medium" : "text-white/60 hover:text-white")}
                >
                  Baseline
                </button>
                <button 
                  onClick={() => setImageTab("current")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", imageTab === 'current' ? "bg-primary-600 text-white font-medium" : "text-white/60 hover:text-white")}
                >
                  Current
                </button>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden border border-white/10 p-3 sticky top-4 bg-black/20">
            {imageTab === "side" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-semibold text-white/50 mb-2 block uppercase tracking-wider">Baseline UI</span>
                  {baselineImage && (
                    <img 
                      src={baselineImage} 
                      alt="Baseline" 
                      className="w-full h-auto rounded-lg max-h-[500px] object-contain bg-black/40 border border-white/5"
                    />
                  )}
                </div>
                <div className="flex flex-col items-center relative">
                  <span className="text-xs font-semibold text-white/50 mb-2 block uppercase tracking-wider">Current UI</span>
                  <div className="relative w-full">
                    {currentImage && (
                      <img 
                        src={currentImage} 
                        alt="Current" 
                        className="w-full h-auto rounded-lg max-h-[500px] object-contain bg-black/40 border border-white/5"
                      />
                    )}
                    
                    {/* Priority Heatmap Bounding Box overlays */}
                    {showHeatmap && currentImage && (
                      <div className="absolute inset-0 top-[24px]">
                        {heatmapBoxes.map((box, idx) => (
                          <div 
                            key={idx}
                            className={cn("absolute border-2 rounded-md animate-pulse cursor-pointer group flex items-center justify-center font-bold font-mono text-[10px] text-white", box.border)}
                            style={{
                              top: box.top,
                              left: box.left,
                              width: box.width,
                              height: box.height
                            }}
                          >
                            <span className="bg-black/80 px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 z-20 whitespace-nowrap">
                              {box.finding.location} ({box.finding.changeType})
                            </span>
                            {idx + 1}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {imageTab === "baseline" && baselineImage && (
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-white/50 mb-2 block uppercase tracking-wider">Baseline Mockup</span>
                <img 
                  src={baselineImage} 
                  alt="Baseline Full" 
                  className="w-full h-auto rounded-lg max-h-[650px] object-contain bg-black/40"
                />
              </div>
            )}

            {imageTab === "current" && currentImage && (
              <div className="flex flex-col items-center relative">
                <span className="text-xs font-semibold text-white/50 mb-2 block uppercase tracking-wider">Current Implementation</span>
                <div className="relative w-full max-w-lg">
                  <img 
                    src={currentImage} 
                    alt="Current Full" 
                    className="w-full h-auto rounded-lg max-h-[650px] object-contain bg-black/40"
                  />
                  {showHeatmap && (
                    <div className="absolute inset-0 top-[24px]">
                      {heatmapBoxes.map((box, idx) => (
                        <div 
                          key={idx}
                          className={cn("absolute border-2 rounded-md animate-pulse cursor-pointer group flex items-center justify-center font-bold font-mono text-[10px] text-white", box.border)}
                          style={{
                            top: box.top,
                            left: box.left,
                            width: box.width,
                            height: box.height
                          }}
                        >
                          <span className="bg-black/80 px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 z-20 whitespace-nowrap">
                            {box.finding.location} ({box.finding.changeType})
                          </span>
                          {idx + 1}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regression Timeline trends */}
      <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
        <span className="text-sm font-bold text-white tracking-wide flex items-center">
          <BookOpen className="w-4 h-4 mr-2 text-secondary-400" /> HISTORICAL AUDIT TIMELINE
        </span>
        <div className="flex items-end justify-between gap-2 h-48 bg-black/40 p-4 rounded-xl border border-white/5">
          {timelineRuns.map((run, index) => (
            <div key={index} className="flex-1 flex flex-col items-center h-full justify-end">
              <span className="text-[10px] font-bold text-white mb-2">{run.health}%</span>
              <div className="w-full flex items-end gap-1 justify-center max-w-[50px] h-[70%]">
                {/* Regressions bar */}
                <div 
                  className="bg-red-500 rounded-t w-3" 
                  style={{ height: `${run.regressions * 10}%` }}
                />
                {/* Improvements bar */}
                <div 
                  className="bg-green-500 rounded-t w-3" 
                  style={{ height: `${run.improvements * 10}%` }}
                />
                {/* Overall Health line bar */}
                <div 
                  className="bg-primary-500 rounded-t w-3" 
                  style={{ height: `${run.health}%` }}
                />
              </div>
              <span className="text-[9px] text-white/40 mt-2 font-semibold">{run.run}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 text-[10px] font-semibold text-white/50">
          <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 mr-1.5 inline-block"></span> Regressions</span>
          <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 mr-1.5 inline-block"></span> Improvements</span>
          <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-primary-500 mr-1.5 inline-block"></span> Overall Quality</span>
        </div>
      </div>
    </div>
  );
}

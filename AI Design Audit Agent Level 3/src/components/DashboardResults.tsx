"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Level3AuditResponse } from "@/types";
import { motion } from "framer-motion";
import { 
  AlertTriangle, CheckCircle, Target, FileJson, 
  TrendingUp, TrendingDown, 
  BookOpen, Code, Activity, ShieldCheck, ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardResultsProps {
  results: Level3AuditResponse | null;
  baselineImage: string | null;
  currentImage: string | null;
}

export function DashboardResults({ results, baselineImage, currentImage }: DashboardResultsProps) {
  const [activeTab, setActiveTab] = useState<"all" | "regression" | "improvement" | "neutral">("all");
  const [imageTab, setImageTab] = useState<"side" | "baseline" | "current">("side");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  if (!results) return null;

  const findings = results.findings || [];
  const summary = results.summary || {
    verdict: "PASS",
    designHealth: 100,
    averageConfidence: 100,
    layoutStabilityScore: 100,
    totalRegressions: 0,
    totalImprovements: 0,
    reasoning: "No comparison results.",
    severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 }
  };

  const filteredFindings = findings.filter(f => {
    // 1. Change type filter
    const matchesChange = activeTab === "all" || f.changeType === activeTab;
    // 2. Severity filter
    const matchesSeverity = severityFilter === "all" || f.severity === severityFilter;
    return matchesChange && matchesSeverity;
  });

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `regression_report_${results.pageSlug || 'audit'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const getSeverityColor = (severity: string) => {
    switch(severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getImpactBadgeColor = (impact: string) => {
    switch(impact?.toLowerCase()) {
      case 'accessibility-critical': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'conversion-risk': return 'bg-pink-500/20 text-pink-400 border-pink-500/50';
      case 'usability': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
      case 'cosmetic': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-white/5 text-white/50 border-white/10';
    }
  };

  function getSmartRecommendation(category: string, evidence: string) {
    const cat = category.toLowerCase();
    const ev = evidence.toLowerCase();

    if (cat.includes("spacing") || ev.includes("padding") || ev.includes("margin") || ev.includes("gap")) {
      return {
        label: "Spacing & Layout",
        tailwind: "gap-4 md:gap-6 p-4 md:p-6 my-4",
        css: ".component-layout {\n  gap: 1.5rem;\n  padding: 1.5rem;\n  margin-top: 1rem;\n  margin-bottom: 1rem;\n}"
      };
    }
    if (cat.includes("alignment") || ev.includes("align") || ev.includes("shift") || ev.includes("flex") || ev.includes("grid")) {
      return {
        label: "Flexbox Alignment & Centering",
        tailwind: "flex items-center justify-between flex-wrap",
        css: ".aligned-container {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  flex-wrap: wrap;\n}"
      };
    }
    if (cat.includes("contrast") || cat.includes("color") || ev.includes("contrast") || ev.includes("color")) {
      return {
        label: "WCAG Contrast & Color Correction",
        tailwind: "text-white/90 bg-primary-600 hover:bg-primary-500",
        css: ".accessible-element {\n  color: rgba(255, 255, 255, 0.9);\n  background-color: #2563eb; /* 4.5:1 min contrast ratio */\n}\n.accessible-element:hover {\n  background-color: #3b82f6;\n}"
      };
    }
    if (cat.includes("hierarchy") || cat.includes("typography") || ev.includes("font") || ev.includes("text")) {
      return {
        label: "Typography & Font Hierarchy",
        tailwind: "text-lg md:text-xl font-bold tracking-tight text-white",
        css: ".header-title {\n  font-size: 1.25rem;\n  font-weight: 700;\n  letter-spacing: -0.025em;\n  color: #ffffff;\n}"
      };
    }
    return {
      label: "CSS Rule Correction",
      tailwind: "w-full md:w-auto transition-all duration-300",
      css: ".responsive-fix {\n  width: 100%;\n  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n}"
    };
  }

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">QA Regression Dashboard</h2>
          <p className="text-xs text-white/50 mt-1">
            Analyzing page: <span className="text-primary-400 font-mono font-bold">/{results.pageSlug}</span>
          </p>
        </div>
        <button 
          onClick={downloadJSON}
          className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors text-sm font-medium cursor-pointer"
        >
          <FileJson className="w-4 h-4 mr-2" />
          Export JSON
        </button>
      </div>

      {/* Release Gate Alert Banner */}
      <div className={cn(
        "glass border p-6 rounded-2xl flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 transition-all duration-500 relative overflow-hidden",
        summary.verdict === "FAIL" 
          ? "border-red-500/30 bg-red-950/10 shadow-[0_0_20px_rgba(239,68,68,0.08)]" 
          : "border-green-500/30 bg-green-950/10 shadow-[0_0_20px_rgba(34,197,94,0.08)]"
      )}>
        {/* Glow edge indicator */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-2",
          summary.verdict === "FAIL" ? "bg-red-500" : "bg-green-500"
        )} />

        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 animate-pulse",
          summary.verdict === "FAIL" ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-green-500/20 border-green-500/40 text-green-400"
        )}>
          {summary.verdict === "FAIL" ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
        </div>
        <div className="flex-1 space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest block">Release Gate</span>
            <span className={cn(
              "px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider",
              summary.verdict === "FAIL" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"
            )}>
              {summary.verdict === "FAIL" ? "Blocked" : "Passed"}
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-wide">
            {summary.verdict === "FAIL" 
              ? "Release Blocked: Significant visual regressions detected" 
              : "Release Approved: No critical layout discrepancies"}
          </h3>
          <p className="text-xs text-white/70 leading-relaxed max-w-3xl">
            {summary.reasoning}
          </p>
        </div>
      </div>

      {/* Watchdog Telemetry Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Design Health */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-b-2 border-b-primary-500 h-28">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Design Health</span>
            <Activity className="w-4 h-4 text-primary-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{summary.designHealth}%</span>
            <span className="text-[10px] text-white/40">quality</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2 border border-white/5">
            <div 
              className="bg-primary-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${summary.designHealth}%` }}
            />
          </div>
        </div>

        {/* Layout Stability */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-b-2 border-b-purple-500 h-28">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Stability Index</span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{summary.layoutStabilityScore}%</span>
            <span className="text-[10px] text-white/40">drift score</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2 border border-white/5">
            <div 
              className="bg-purple-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${summary.layoutStabilityScore}%` }}
            />
          </div>
        </div>

        {/* Regressions count */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-b-2 border-b-red-500 h-28">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Regressions</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-red-400">{summary.totalRegressions}</span>
            <span className="text-[10px] text-white/40">issues found</span>
          </div>
          <p className="text-[9px] text-white/40 font-semibold uppercase truncate mt-1">
            {summary.severityBreakdown.critical} Critical / {summary.severityBreakdown.high} High
          </p>
        </div>

        {/* Improvements count */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-b-2 border-b-green-500 h-28">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Improvements</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-green-400">{summary.totalImprovements}</span>
            <span className="text-[10px] text-white/40">positive shifts</span>
          </div>
          <div className="text-[10px] text-white/50 mt-1 font-semibold flex items-center">
            Avg Confidence: {summary.averageConfidence}%
          </div>
        </div>
      </div>

      {/* Main Results Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: Filterable Audit Log */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            
            {/* Classification & Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white/90 uppercase tracking-wider flex items-center">
                <BookOpen className="w-4 h-4 mr-2 text-primary-400" /> Watchdog Audit Log
              </h3>
              
              <div className="flex flex-wrap bg-white/5 rounded-lg p-0.5 border border-white/10 text-xs">
                <button 
                  onClick={() => setActiveTab("all")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'all' ? "bg-primary-600 text-white font-medium" : "text-white/60 hover:text-white")}
                >
                  All
                </button>
                <button 
                  onClick={() => setActiveTab("regression")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'regression' ? "bg-red-500/25 text-red-400 font-medium" : "text-white/60 hover:text-white")}
                >
                  Regressions
                </button>
                <button 
                  onClick={() => setActiveTab("improvement")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'improvement' ? "bg-green-500/25 text-green-400 font-medium" : "text-white/60 hover:text-white")}
                >
                  Improvements
                </button>
                <button 
                  onClick={() => setActiveTab("neutral")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'neutral' ? "bg-white/10 text-white font-medium" : "text-white/60 hover:text-white")}
                >
                  Neutral
                </button>
              </div>
            </div>

            {/* Severity filter block */}
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <span>Filter by Severity:</span>
              <div className="flex bg-black/20 rounded-md p-0.5 border border-white/5">
                {(["all", "critical", "high", "medium", "low"] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={cn(
                      "px-2 py-0.5 rounded capitalize cursor-pointer",
                      severityFilter === sev ? "bg-white/10 text-white font-bold" : "hover:text-white"
                    )}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Findings List */}
            <div className="space-y-4 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredFindings.length === 0 ? (
                <div className="glass p-8 rounded-xl text-center text-white/30 italic">
                  No visual regression logs match the selected filters.
                </div>
              ) : (
                filteredFindings.map((finding, idx) => {
                  const codeRec = getSmartRecommendation(finding.category, finding.measurableEvidence);

                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={finding.id || idx} 
                      className={cn(
                        "glass p-5 rounded-xl border border-white/10 hover:border-primary-500/30 transition-colors",
                        finding.severity === 'critical' && "hover:border-red-500/20",
                        finding.severity === 'high' && "hover:border-orange-500/20"
                      )}
                    >
                      {/* Top badges */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-[10px] font-bold border border-primary-500/30 uppercase tracking-wider">
                            {finding.category}
                          </span>
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider", getSeverityColor(finding.severity))}>
                            {finding.severity}
                          </span>
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider", getImpactBadgeColor(finding.impact))}>
                            {finding.impact}
                          </span>
                        </div>
                        <div className="flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
                          <Target className="w-3 h-3 text-white/50 mr-1" />
                          <span className="text-[10px] font-semibold text-white/70">{finding.confidenceScore}% Conf.</span>
                        </div>
                      </div>

                      {/* Title Location */}
                      <h4 className="text-base font-bold text-white mb-2">{finding.location}</h4>

                      {/* Content details */}
                      <div className="space-y-3 text-xs mt-3">
                        {/* Comparison before/after */}
                        <div className="grid grid-cols-2 gap-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                          <div>
                            <span className="text-[9px] text-white/40 uppercase tracking-wider font-semibold block">Baseline (Expected)</span>
                            <p className="text-white/80 mt-0.5 leading-relaxed">{finding.beforeState}</p>
                          </div>
                          <div className="border-l border-white/10 pl-3">
                            <span className="text-[9px] text-primary-400 uppercase tracking-wider font-semibold block">Current (Actual)</span>
                            <p className="text-white/85 mt-0.5 leading-relaxed">{finding.afterState}</p>
                          </div>
                        </div>

                        {/* Measurable evidence */}
                        <div className="flex items-start pl-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-white/40 mt-0.5 mr-2 flex-shrink-0" />
                          <div>
                            <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">Measurable Evidence</span>
                            <p className="text-white/80 mt-0.5 font-mono bg-black/35 p-1 rounded border border-white/5">{finding.measurableEvidence}</p>
                          </div>
                        </div>

                        {/* Recommendation */}
                        <div className="flex items-start bg-primary-950/20 p-3 rounded-lg border border-primary-500/15 mt-3">
                          <CheckCircle className="w-4 h-4 text-primary-400 mt-0.5 mr-2 flex-shrink-0" />
                          <div>
                            <span className="text-[10px] text-primary-400/80 uppercase tracking-wider font-semibold block">Watchdog Recommendation</span>
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
        </div>

        {/* Right Column: Visual Regression Previews */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white/90 uppercase tracking-wider">Visual Regression Previews</h3>
            
            {/* View Selector Tab */}
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

          {/* Screenshot Container */}
          <div className="glass rounded-2xl overflow-hidden border border-white/10 p-3 sticky top-4 bg-black/20">
            {imageTab === "side" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block text-center">Approved Baseline</span>
                  {baselineImage ? (
                    <img 
                      src={baselineImage} 
                      alt="Baseline" 
                      className="w-full h-auto rounded-lg max-h-[600px] object-contain bg-black/40 border border-white/5"
                    />
                  ) : (
                    <div className="bg-white/5 aspect-[4/3] rounded-lg border border-dashed border-white/15 flex items-center justify-center text-xs text-white/30">
                      No baseline screenshot
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block text-center">Current Run</span>
                  {currentImage ? (
                    <img 
                      src={currentImage} 
                      alt="Current Implementation" 
                      className="w-full h-auto rounded-lg max-h-[600px] object-contain bg-black/40 border border-white/5"
                    />
                  ) : (
                    <div className="bg-white/5 aspect-[4/3] rounded-lg border border-dashed border-white/15 flex items-center justify-center text-xs text-white/30">
                      No current screenshot
                    </div>
                  )}
                </div>
              </div>
            ) : imageTab === "baseline" ? (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Approved Baseline View</span>
                {baselineImage ? (
                  <img 
                    src={baselineImage} 
                    alt="Baseline full view" 
                    className="w-full h-auto rounded-lg max-h-[750px] object-contain bg-black/40 border border-white/5"
                  />
                ) : (
                  <div className="bg-white/5 aspect-[16/10] rounded-lg border border-dashed border-white/15 flex items-center justify-center text-xs text-white/30">
                    No approved baseline loaded.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">Current Crawled Run View</span>
                {currentImage ? (
                  <img 
                    src={currentImage} 
                    alt="Current full view" 
                    className="w-full h-auto rounded-lg max-h-[750px] object-contain bg-black/40 border border-white/5"
                  />
                ) : (
                  <div className="bg-white/5 aspect-[16/10] rounded-lg border border-dashed border-white/15 flex items-center justify-center text-xs text-white/30">
                    No current active run screenshot.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

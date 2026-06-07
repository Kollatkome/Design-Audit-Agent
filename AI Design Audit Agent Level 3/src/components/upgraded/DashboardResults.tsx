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
    const matchesChange = activeTab === "all" || f.changeType === activeTab;
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
      case 'critical': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'high': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'medium': return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
      case 'low': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getImpactBadgeColor = (impact: string) => {
    switch(impact?.toLowerCase()) {
      case 'accessibility-critical': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'conversion-risk': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      case 'usability': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'cosmetic': return 'bg-slate-800 text-slate-400 border-slate-700';
      default: return 'bg-slate-900/40 text-slate-500 border-slate-850';
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
        tailwind: "text-white/90 bg-cyan-600 hover:bg-cyan-500",
        css: ".accessible-element {\n  color: rgba(255, 255, 255, 0.9);\n  background-color: #0891b2; /* 4.5:1 min contrast ratio */\n}\n.accessible-element:hover {\n  background-color: #06b6d4;\n}"
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
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">QA Regression Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyzing page: <span className="text-cyan-400 font-mono font-bold">/{results.pageSlug}</span>
          </p>
        </div>
        <button 
          onClick={downloadJSON}
          className="flex items-center px-3.5 py-1.5 bg-slate-900 hover:bg-slate-855 text-slate-200 rounded-lg border border-slate-800 hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-md"
        >
          <FileJson className="w-4 h-4 mr-2 text-cyan-400" />
          Export JSON Report
        </button>
      </div>

      {/* Release Gate Alert Banner */}
      <div className={cn(
        "glass border p-5 rounded-2xl flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-5 transition-all duration-550 relative overflow-hidden bg-slate-950/45",
        summary.verdict === "FAIL" 
          ? "border-rose-500/30 bg-rose-955/10 shadow-[0_0_20px_rgba(244,63,94,0.08)]" 
          : "border-emerald-500/30 bg-emerald-955/10 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
      )}>
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5",
          summary.verdict === "FAIL" ? "bg-rose-500" : "bg-emerald-500"
        )} />

        <div className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center border flex-shrink-0 animate-pulse",
          summary.verdict === "FAIL" ? "bg-rose-500/20 border-rose-500/40 text-rose-450" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-450"
        )}>
          {summary.verdict === "FAIL" ? <ShieldAlert className="w-5.5 h-5.5" /> : <ShieldCheck className="w-5.5 h-5.5" />}
        </div>
        <div className="flex-1 space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Release Gate</span>
            <span className={cn(
              "px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider",
              summary.verdict === "FAIL" ? "bg-rose-500/20 text-rose-450 border-rose-500/30" : "bg-emerald-500/20 text-emerald-450 border-emerald-500/30"
            )}>
              {summary.verdict === "FAIL" ? "Blocked" : "Passed"}
            </span>
          </div>
          <h3 className="text-base font-bold text-white tracking-wide">
            {summary.verdict === "FAIL" 
              ? "Release Blocked: Significant visual regressions detected" 
              : "Release Approved: No critical layout discrepancies"}
          </h3>
          <p className="text-xs text-slate-350 leading-relaxed max-w-3xl">
            {summary.reasoning}
          </p>
        </div>
      </div>

      {/* Telemetry Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Design Health */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-slate-800/80 bg-slate-950/40 border-b-2 border-b-cyan-500 h-28">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Design Health</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{summary.designHealth}%</span>
            <span className="text-[10px] text-slate-500">quality</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-900">
            <div 
              className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${summary.designHealth}%` }}
            />
          </div>
        </div>

        {/* Layout Stability */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-slate-800/80 bg-slate-950/40 border-b-2 border-b-purple-500 h-28">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Stability Index</span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{summary.layoutStabilityScore}%</span>
            <span className="text-[10px] text-slate-500">drift score</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-900">
            <div 
              className="bg-purple-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${summary.layoutStabilityScore}%` }}
            />
          </div>
        </div>

        {/* Regressions count */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-slate-800/80 bg-slate-950/40 border-b-2 border-b-rose-500 h-28">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Regressions</span>
            <TrendingDown className="w-4 h-4 text-rose-450" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-405">{summary.totalRegressions}</span>
            <span className="text-[10px] text-slate-500">issues found</span>
          </div>
          <p className="text-[9px] text-slate-500 font-semibold uppercase truncate mt-1">
            {summary.severityBreakdown.critical} Critical / {summary.severityBreakdown.high} High
          </p>
        </div>

        {/* Improvements count */}
        <div className="glass p-4 rounded-xl flex flex-col justify-between border-slate-800/80 bg-slate-950/40 border-b-2 border-b-emerald-500 h-28">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Improvements</span>
            <TrendingUp className="w-4 h-4 text-emerald-450" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-405">{summary.totalImprovements}</span>
            <span className="text-[10px] text-slate-500">positive shifts</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center font-mono">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center font-mono">
                <BookOpen className="w-4 h-4 mr-2 text-cyan-400" /> Watchdog Audit Log
              </h3>
              
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 text-xs">
                <button 
                  onClick={() => setActiveTab("all")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors font-semibold", activeTab === 'all' ? "bg-slate-900 text-cyan-400 border border-slate-805" : "text-slate-400 hover:text-slate-200")}
                >
                  All
                </button>
                <button 
                  onClick={() => setActiveTab("regression")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors font-semibold", activeTab === 'regression' ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "text-slate-400 hover:text-slate-250")}
                >
                  Regressions
                </button>
                <button 
                  onClick={() => setActiveTab("improvement")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors font-semibold", activeTab === 'improvement' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:text-slate-250")}
                >
                  Improvements
                </button>
                <button 
                  onClick={() => setActiveTab("neutral")}
                  className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors font-semibold", activeTab === 'neutral' ? "bg-slate-900 text-slate-200 border border-slate-805" : "text-slate-400 hover:text-slate-200")}
                >
                  Neutral
                </button>
              </div>
            </div>

            {/* Severity filter block */}
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
              <span>Filter by Severity:</span>
              <div className="flex bg-slate-950 p-0.5 rounded-md border border-slate-850">
                {(["all", "critical", "high", "medium", "low"] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={cn(
                      "px-2 py-0.5 rounded capitalize cursor-pointer",
                      severityFilter === sev ? "bg-slate-900 text-cyan-400 border border-slate-800" : "hover:text-slate-200"
                    )}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Findings List */}
            <div className="space-y-3.5 max-h-[800px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredFindings.length === 0 ? (
                <div className="glass p-8 rounded-xl text-center text-slate-500 italic text-xs border border-slate-850">
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
                        "glass p-4 rounded-xl border border-slate-800/80 bg-slate-950/45 hover:border-cyan-500/35 transition-colors text-left",
                        finding.severity === 'critical' && "hover:border-rose-500/20",
                        finding.severity === 'high' && "hover:border-amber-500/20"
                      )}
                    >
                      {/* Top badges */}
                      <div className="flex items-start justify-between mb-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[9px] uppercase tracking-wider">
                            {finding.category}
                          </span>
                          <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider", getSeverityColor(finding.severity))}>
                            {finding.severity}
                          </span>
                          <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider", getImpactBadgeColor(finding.impact))}>
                            {finding.impact}
                          </span>
                        </div>
                        <div className="flex items-center bg-slate-900/60 px-2 py-0.5 rounded border border-white/5 font-mono text-[9px]">
                          <Target className="w-3.5 h-3.5 text-cyan-400 mr-1" />
                          <span className="text-slate-300">{finding.confidenceScore}% certainty</span>
                        </div>
                      </div>

                      {/* Title Location */}
                      <h4 className="text-xs font-bold text-white mb-2">{finding.location}</h4>

                      {/* Content details */}
                      <div className="space-y-3.5 text-xs mt-3">
                        {/* Comparison before/after */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-850">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block">Baseline (Expected)</span>
                            <p className="text-slate-300 mt-0.5 leading-relaxed font-mono">{finding.beforeState}</p>
                          </div>
                          <div className="border-l border-slate-850 pl-3">
                            <span className="text-[9px] text-cyan-400 uppercase tracking-wider font-semibold block">Current (Actual)</span>
                            <p className="text-cyan-200 mt-0.5 leading-relaxed font-mono">{finding.afterState}</p>
                          </div>
                        </div>

                        {/* Measurable evidence */}
                        <div className="flex items-start pl-1">
                          <AlertTriangle className="w-4 h-4 text-slate-400 mt-0.5 mr-2 flex-shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Measurable Evidence</span>
                            <p className="text-slate-200 mt-0.5 font-mono bg-slate-950/60 p-2 rounded border border-white/5">{finding.measurableEvidence}</p>
                          </div>
                        </div>

                        {/* Recommendation */}
                        <div className="flex items-start bg-slate-900/40 p-3 rounded-lg border border-slate-800/80 mt-3">
                          <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5 mr-2 flex-shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block font-mono">Watchdog Recommendation</span>
                            <p className="text-slate-205 mt-0.5">{finding.recommendation}</p>
                          </div>
                        </div>

                        {/* Smart Recommendations code box */}
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 mt-3 space-y-3">
                          <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold block flex items-center font-mono">
                            <Code className="w-3.5 h-3.5 mr-1.5" /> Actionable Fix Snippets ({codeRec.label})
                          </span>
                          <div className="space-y-2">
                            <div>
                              <span className="text-[9px] text-slate-500 block font-mono">{"// Tailwind CSS classes"}</span>
                              <code className="text-[10px] text-cyan-300 block bg-slate-900/80 p-2 rounded border border-white/5 font-mono break-all mt-1">{codeRec.tailwind}</code>
                            </div>
                            <div className="pt-1">
                              <span className="text-[9px] text-slate-500 block font-mono">{"// Vanilla CSS code"}</span>
                              <pre className="text-[10px] text-cyan-300 block bg-slate-900/80 p-2 rounded border border-white/5 font-mono whitespace-pre-wrap mt-1">{codeRec.css}</pre>
                            </div>
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
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">Visual Regression Previews</h3>
            
            {/* View Selector Tab */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 text-xs">
              <button 
                onClick={() => setImageTab("side")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors font-semibold", imageTab === 'side' ? "bg-slate-900 text-cyan-400 border border-slate-805" : "text-slate-400 hover:text-slate-255")}
              >
                Side-by-Side
              </button>
              <button 
                onClick={() => setImageTab("baseline")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors font-semibold", imageTab === 'baseline' ? "bg-slate-900 text-cyan-400 border border-slate-805" : "text-slate-400 hover:text-slate-255")}
              >
                Baseline
              </button>
              <button 
                onClick={() => setImageTab("current")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors font-semibold", imageTab === 'current' ? "bg-slate-900 text-cyan-400 border border-slate-805" : "text-slate-400 hover:text-slate-255")}
              >
                Current
              </button>
            </div>
          </div>

          {/* Screenshot Container */}
          <div className="glass rounded-2xl overflow-hidden border border-slate-800/80 p-3.5 sticky top-20 bg-slate-950/60">
            {imageTab === "side" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5 text-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Approved Baseline</span>
                  {baselineImage ? (
                    <img 
                      src={baselineImage} 
                      alt="Baseline" 
                      className="w-full h-auto rounded-lg max-h-[500px] object-contain bg-slate-900 border border-white/5"
                    />
                  ) : (
                    <div className="bg-slate-950 aspect-[4/3] rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                      No baseline screenshot
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 text-center">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Current Run</span>
                  {currentImage ? (
                    <img 
                      src={currentImage} 
                      alt="Current Implementation" 
                      className="w-full h-auto rounded-lg max-h-[500px] object-contain bg-slate-900 border border-white/5"
                    />
                  ) : (
                    <div className="bg-slate-950 aspect-[4/3] rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                      No current screenshot
                    </div>
                  )}
                </div>
              </div>
            ) : imageTab === "baseline" ? (
              <div className="space-y-2 text-center">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Approved Baseline View</span>
                {baselineImage ? (
                  <img 
                    src={baselineImage} 
                    alt="Baseline full view" 
                    className="w-full h-auto rounded-lg max-h-[650px] object-contain bg-slate-900 border border-white/5"
                  />
                ) : (
                  <div className="bg-slate-950 aspect-[16/10] rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    No approved baseline loaded.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-center">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Current Crawled Run View</span>
                {currentImage ? (
                  <img 
                    src={currentImage} 
                    alt="Current full view" 
                    className="w-full h-auto rounded-lg max-h-[650px] object-contain bg-slate-900 border border-white/5"
                  />
                ) : (
                  <div className="bg-slate-950 aspect-[16/10] rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
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

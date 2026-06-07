"use client";

import { useState } from "react";
import { AlertTriangle, Target, FileJson, Info, ChevronDown, ChevronUp, Code } from "lucide-react";
import { DetectionResult } from "@/lib/upgraded/detector-engine";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FindingsDashboardProps {
  results: {
    summary: {
      totalIssues: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    findings: DetectionResult[];
    timestamp: string;
  } | null;
  onHoverFinding: (id: string | null) => void;
  focusedFindingId: string | null;
  setFocusedFindingId: (id: string | null) => void;
}

export function FindingsDashboard({ results, onHoverFinding, focusedFindingId, setFocusedFindingId }: FindingsDashboardProps) {
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!results) return null;

  const { summary, findings } = results;

  const filteredFindings = findings.filter(f => {
    if (severityFilter === "all") return true;
    return f.severity === severityFilter;
  });

  const getSeverityBadgeColor = (sev: string) => {
    switch (sev) {
      case "critical": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "high": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "medium": return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
      case "low": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      default: return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const getCodeSnippet = (category: string, location: string) => {
    const cat = category.toLowerCase();
    const loc = location.toLowerCase();

    if (cat.includes("contrast") || cat.includes("color")) {
      return {
        tailwind: "text-slate-900 bg-slate-50 border border-slate-200 dark:text-slate-100 dark:bg-slate-950",
        css: ".element {\n  color: #0f172a;\n  background-color: #f8fafc;\n  /* WCAG Contrast Passed (4.5:1 min) */\n}"
      };
    }
    if (cat.includes("spacing") || loc.includes("gap") || loc.includes("margin")) {
      return {
        tailwind: "space-y-4 md:space-y-6 p-4 md:p-6 gap-4",
        css: ".container {\n  padding: 1.5rem;\n  margin-top: 1rem;\n  gap: 1rem;\n  /* Mathematically aligned to 8px scale */\n}"
      };
    }
    if (cat.includes("alignment") || loc.includes("flex") || loc.includes("grid")) {
      return {
        tailwind: "flex items-center justify-between flex-wrap md:flex-nowrap",
        css: ".flex-container {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}"
      };
    }
    if (cat.includes("typography") || loc.includes("font") || loc.includes("text")) {
      return {
        tailwind: "text-base font-medium tracking-normal leading-relaxed text-slate-100",
        css: ".body-text {\n  font-size: 1rem;\n  line-height: 1.625;\n  font-weight: 500;\n}"
      };
    }
    return {
      tailwind: "focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg",
      css: ".interactive-element:focus-visible {\n  outline: 2px solid #06b6d4;\n  outline-offset: 2px;\n}"
    };
  };

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `audit_report_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="w-full space-y-6">
      {/* Header and Export JSON */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Design Critiques Log</h2>
          <span className="text-[10px] text-slate-400 font-mono">Timestamp: {new Date(results.timestamp).toLocaleString()}</span>
        </div>
        <button 
          onClick={downloadJSON}
          className="flex items-center px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 rounded-lg border border-slate-800 hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-md"
        >
          <FileJson className="w-4 h-4 mr-2 text-cyan-400" />
          Export JSON
        </button>
      </div>

      {/* Audit Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="glass p-3 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center">
          <span className="text-xl font-extrabold text-white">{summary.totalIssues}</span>
          <span className="text-[9px] text-slate-400 font-mono uppercase mt-1 tracking-wider">Total Issues</span>
        </div>
        <div className="glass p-3 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center border-b-2 border-b-rose-500">
          <span className="text-xl font-extrabold text-rose-400">{summary.critical}</span>
          <span className="text-[9px] text-slate-400 font-mono uppercase mt-1 tracking-wider">Critical</span>
        </div>
        <div className="glass p-3 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center border-b-2 border-b-amber-500">
          <span className="text-xl font-extrabold text-amber-400">{summary.high}</span>
          <span className="text-[9px] text-slate-400 font-mono uppercase mt-1 tracking-wider">High</span>
        </div>
        <div className="glass p-3 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center border-b-2 border-b-yellow-500">
          <span className="text-xl font-extrabold text-yellow-300">{summary.medium}</span>
          <span className="text-[9px] text-slate-400 font-mono uppercase mt-1 tracking-wider">Medium</span>
        </div>
        <div className="glass p-3 rounded-xl border border-slate-800/80 text-center flex flex-col justify-center border-b-2 border-b-cyan-500">
          <span className="text-xl font-extrabold text-cyan-400">{summary.low}</span>
          <span className="text-[9px] text-slate-400 font-mono uppercase mt-1 tracking-wider">Low</span>
        </div>
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/85 w-fit text-xs">
        {(["all", "critical", "high", "medium", "low"] as const).map(sev => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className={cn(
              "px-3.5 py-1 rounded-md capitalize transition-all font-semibold cursor-pointer",
              severityFilter === sev 
                ? "bg-slate-900 text-cyan-400 border border-slate-800" 
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Findings List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredFindings.length === 0 ? (
          <div className="glass p-8 rounded-xl text-center text-slate-500 italic text-xs">
            No design critiques match selected filter.
          </div>
        ) : (
          filteredFindings.map((finding, idx) => {
            const isExpanded = expandedId === finding.id;
            const code = getCodeSnippet(finding.category, finding.location);
            const isHovered = focusedFindingId === finding.id;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                key={finding.id}
                onMouseEnter={() => onHoverFinding(finding.id)}
                onMouseLeave={() => onHoverFinding(null)}
                onClick={() => {
                  setExpandedId(isExpanded ? null : finding.id);
                  setFocusedFindingId(finding.id);
                }}
                className={cn(
                  "glass p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left space-y-3 select-none",
                  isHovered ? "border-cyan-500/40 bg-slate-900/20" : "border-slate-800/80 hover:border-slate-700/80",
                  isExpanded && "border-cyan-500/40 bg-slate-900/10"
                )}
              >
                {/* Header elements row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[9px] uppercase tracking-wider">
                      {finding.category}
                    </span>
                    <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider", getSeverityBadgeColor(finding.severity))}>
                      {finding.severity}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                    <div className="flex items-center">
                      <Target className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                      <span>{finding.confidenceScore}% certainty</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                <h3 className="text-xs font-bold text-slate-100">{finding.location}</h3>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-4 pt-1 text-xs"
                      onClick={e => e.stopPropagation()} // Stop propagation from closing the card
                    >
                      {/* Bounding box coords */}
                      <span className="text-[9px] text-slate-500 block font-mono">
                        Canvas Coordinates: x:{finding.coordinates.x.toFixed(1)}%, y:{finding.coordinates.y.toFixed(1)}%, w:{finding.coordinates.width.toFixed(1)}%, h:{finding.coordinates.height.toFixed(1)}%
                      </span>

                      {/* Evidence */}
                      <div className="flex items-start space-x-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Measurable Evidence</span>
                          <p className="text-slate-200 mt-0.5 leading-relaxed font-mono">{finding.evidence}</p>
                        </div>
                      </div>

                      {/* User Impact */}
                      <div className="flex items-start pl-1 space-x-2">
                        <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">User Impact</span>
                          <p className="text-slate-300 mt-0.5 leading-relaxed">{finding.recommendation}</p>
                        </div>
                      </div>

                      {/* Code Recommendations tabs */}
                      <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-3.5">
                        <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold block flex items-center">
                          <Code className="w-3.5 h-3.5 mr-1.5" /> Actionable Fix Snippets
                        </span>
                        
                        <div className="space-y-2">
                          <div>
                            <span className="text-[9px] text-slate-500 block font-mono">{"// Tailwind Utility classes"}</span>
                            <code className="text-[10px] text-cyan-300 block bg-slate-900/80 p-2 rounded border border-white/5 font-mono break-all mt-1">
                              {code.tailwind}
                            </code>
                          </div>
                          <div className="pt-1">
                            <span className="text-[9px] text-slate-500 block font-mono">{"// CSS Styles rules"}</span>
                            <pre className="text-[10px] text-cyan-300 block bg-slate-900/80 p-2 rounded border border-white/5 font-mono whitespace-pre-wrap mt-1">
                              {code.css}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

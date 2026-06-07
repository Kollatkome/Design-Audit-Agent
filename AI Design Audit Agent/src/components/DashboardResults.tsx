"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { AuditResponse } from "@/types";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Target, FileJson, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardResultsProps {
  results: AuditResponse | null;
  image: string | null;
}

export function DashboardResults({ results, image }: DashboardResultsProps) {
  const [activeTab, setActiveTab] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  if (!results) return null;

  const findings = results.findings || [];
  const summary = results.summary || {
    totalIssues: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  const filteredFindings = findings.filter(f => {
    if (activeTab === "all") return true;
    return f.severity?.toLowerCase() === activeTab;
  });

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "design_audit_report.json");
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

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white tracking-wide">AI Design Audit Report</h2>
        <button 
          onClick={downloadJSON}
          className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors text-sm font-medium cursor-pointer"
        >
          <FileJson className="w-4 h-4 mr-2" />
          Export JSON
        </button>
      </div>

      {/* Metric Counts Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-primary-500">
          <span className="text-2xl font-bold text-white">{summary.totalIssues}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Total Issues</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-red-500">
          <span className="text-2xl font-bold text-red-400">{summary.critical}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Critical</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-orange-500">
          <span className="text-2xl font-bold text-orange-400">{summary.high}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">High</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-yellow-500">
          <span className="text-2xl font-bold text-yellow-400">{summary.medium}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Medium</span>
        </div>
        <div className="glass p-4 rounded-xl flex flex-col items-center justify-center text-center border-b-2 border-b-blue-500">
          <span className="text-2xl font-bold text-blue-400">{summary.low}</span>
          <span className="text-white/40 text-xs mt-1 uppercase tracking-wider font-semibold">Low</span>
        </div>
      </div>

      {/* Two Column Layout: Findings Log and Visual Preview */}
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
                onClick={() => setActiveTab("critical")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'critical' ? "bg-red-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                Critical
              </button>
              <button 
                onClick={() => setActiveTab("high")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'high' ? "bg-orange-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                High
              </button>
              <button 
                onClick={() => setActiveTab("medium")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'medium' ? "bg-yellow-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                Medium
              </button>
              <button 
                onClick={() => setActiveTab("low")}
                className={cn("px-2.5 py-1 rounded-md cursor-pointer transition-colors", activeTab === 'low' ? "bg-blue-600 text-white font-medium" : "text-white/60 hover:text-white")}
              >
                Low
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredFindings.length === 0 ? (
              <div className="glass p-8 rounded-xl text-center text-white/30 italic">
                No findings generated for this severity level.
              </div>
            ) : (
              filteredFindings.map((finding, idx) => (
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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-[10px] font-bold border border-primary-500/30 uppercase tracking-wider">
                        {finding.principle || "Spacing"}
                      </span>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider", getSeverityColor(finding.severity))}>
                        {finding.severity}
                      </span>
                    </div>
                    <div className="flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      <Target className="w-3 h-3 text-white/50 mr-1" />
                      <span className="text-[10px] font-semibold text-white/70">{finding.confidence}% Conf.</span>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white mb-2">{finding.location}</h4>

                  {/* Issue Details block */}
                  <div className="space-y-3 text-xs">
                    <div className="flex items-start bg-white/5 p-3 rounded-lg border border-white/5">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">Issue</span>
                        <p className="text-white/80 mt-0.5 font-medium">{finding.issue}</p>
                      </div>
                    </div>

                    <div className="flex items-start pl-1">
                      <Info className="w-3.5 h-3.5 text-white/40 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">User Impact</span>
                        <p className="text-white/80 mt-0.5">{finding.userImpact}</p>
                      </div>
                    </div>

                    <div className="flex items-start pl-1">
                      <span className="text-primary-400 font-bold w-3.5 text-center mt-0.5 mr-2 flex-shrink-0">E</span>
                      <div>
                        <span className="text-[10px] text-primary-400/80 uppercase tracking-wider font-semibold block">Visual Evidence</span>
                        <p className="text-white/80 mt-0.5 font-mono bg-black/20 p-1.5 rounded border border-white/5">{finding.evidence}</p>
                      </div>
                    </div>

                    <div className="flex items-start bg-primary-950/20 p-3 rounded-lg border border-primary-500/15 mt-3">
                      <CheckCircle className="w-4 h-4 text-primary-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-primary-400/80 uppercase tracking-wider font-semibold block">Recommendation</span>
                        <p className="text-primary-100 mt-0.5">{finding.recommendation}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Visual Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-lg font-bold text-white/90 uppercase tracking-wide">Screenshot Preview</h3>
          </div>

          <div className="glass rounded-2xl overflow-hidden border border-white/10 p-3 sticky top-4 bg-black/20">
            {image && (
              <img 
                src={image} 
                alt="UI Screenshot" 
                className="w-full h-auto rounded-lg max-h-[650px] object-contain bg-black/40 border border-white/5"
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

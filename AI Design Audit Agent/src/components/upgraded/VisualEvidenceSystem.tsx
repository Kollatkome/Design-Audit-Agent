"use client";
/* eslint-disable @next/next/no-img-element */

import { Target } from "lucide-react";
import { DetectionResult } from "@/lib/upgraded/detector-engine";
import { cn } from "@/lib/utils";

interface VisualEvidenceSystemProps {
  image: string | null;
  findings: DetectionResult[];
  hoveredFindingId: string | null;
  setHoveredFindingId: (id: string | null) => void;
  focusedFindingId: string | null;
  setFocusedFindingId: (id: string | null) => void;
}

export function VisualEvidenceSystem({ 
  image, 
  findings, 
  hoveredFindingId, 
  setHoveredFindingId,
  focusedFindingId,
  setFocusedFindingId
}: VisualEvidenceSystemProps) {

  if (!image) {
    return (
      <div className="w-full aspect-video rounded-2xl border border-slate-800/80 bg-slate-950/40 flex flex-col items-center justify-center text-center text-slate-500 p-6 min-h-[300px]">
        <Target className="w-10 h-10 text-slate-650 mb-3 animate-pulse" />
        <span className="text-sm font-semibold text-slate-400">Design Evidence Preview</span>
        <span className="text-xs text-slate-500 mt-1 max-w-[240px]">
          Highlights and WCAG bounding boxes will map onto the mockup preview here.
        </span>
      </div>
    );
  }

  const getSeverityBorderColor = (sev: string, isActive: boolean) => {
    if (isActive) {
      switch (sev) {
        case "critical": return "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] bg-rose-500/10";
        case "high": return "border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.6)] bg-amber-500/10";
        case "medium": return "border-yellow-400 shadow-[0_0_15px_rgba(253,224,71,0.6)] bg-yellow-400/5";
        default: return "border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] bg-cyan-400/5";
      }
    }
    
    switch (sev) {
      case "critical": return "border-rose-500/40 bg-rose-500/[0.02]";
      case "high": return "border-amber-500/40 bg-amber-500/[0.02]";
      case "medium": return "border-yellow-400/30 bg-yellow-400/[0.01]";
      default: return "border-cyan-400/30 bg-cyan-400/[0.01]";
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">Annotated Image Canvas</h3>
        <span className="text-[10px] text-slate-450 font-mono uppercase">Interactive highlights</span>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/60 p-2.5 flex items-center justify-center min-h-[350px]">
        <div className="relative max-w-full">
          {/* Main Screenshot Preview */}
          <img 
            src={image} 
            alt="Audited Frontend Page Layout" 
            className="w-full h-auto rounded-lg max-h-[700px] object-contain bg-slate-950/80 border border-slate-850"
          />

          {/* Absolute overlay elements */}
          {findings.map((finding) => {
            const isHovered = hoveredFindingId === finding.id;
            const isFocused = focusedFindingId === finding.id;
            const isActive = isHovered || isFocused;
            
            const { x, y, width, height } = finding.coordinates;

            return (
              <div
                key={finding.id}
                onMouseEnter={() => setHoveredFindingId(finding.id)}
                onMouseLeave={() => setHoveredFindingId(null)}
                onClick={() => setFocusedFindingId(finding.id)}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
                className={cn(
                  "absolute border rounded transition-all duration-200 cursor-pointer flex items-start justify-start overflow-visible",
                  getSeverityBorderColor(finding.severity, isActive),
                  isActive ? "z-30 scale-[1.01]" : "z-10"
                )}
              >
                {/* Visual Label tag on hover/focus */}
                {isActive && (
                  <div className={cn(
                    "absolute bottom-full mb-1.5 left-0 px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider whitespace-nowrap shadow-md z-40 border animate-in fade-in duration-200",
                    finding.severity === "critical" && "bg-rose-950/80 text-rose-300 border-rose-500/40",
                    finding.severity === "high" && "bg-amber-950/80 text-amber-300 border-amber-500/40",
                    finding.severity === "medium" && "bg-yellow-950/80 text-yellow-200 border-yellow-500/30",
                    finding.severity === "low" && "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
                  )}>
                    {finding.category} • {finding.severity}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

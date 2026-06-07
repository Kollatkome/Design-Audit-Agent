"use client";

import { useEffect, useRef } from "react";
import { Terminal, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLogPanelProps {
  logs: string[];
  isLoading: boolean;
}

export function AuditLogPanel({ logs, isLoading }: AuditLogPanelProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getLogStyle = (log: string) => {
    const text = log.toLowerCase();
    if (text.includes("error") || text.includes("fail") || text.includes("crash")) {
      return "text-rose-400";
    }
    if (text.includes("complete") || text.includes("success") || text.includes("passed")) {
      return "text-emerald-400";
    }
    if (text.includes("running") || text.includes("analyzing") || text.includes("extracting")) {
      return "text-cyan-400";
    }
    if (text.includes("warning") || text.includes("alert") || text.includes("discrepanc")) {
      return "text-amber-400";
    }
    return "text-slate-350";
  };

  return (
    <div className="glass rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-full min-h-[300px] bg-slate-950/40">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/40 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 font-mono tracking-wider uppercase">Observability Console</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[10px] text-slate-400 font-mono uppercase">Live Engine Trace</span>
        </div>
      </div>

      {/* Terminal logs list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] leading-relaxed custom-scrollbar bg-slate-950/80 min-h-[200px]">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic h-full flex items-center justify-center">
            Upload screenshot to initialize execution console trace...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={cn("flex items-start space-x-1.5", getLogStyle(log))}>
              <span className="text-slate-600 select-none">{String(index + 1).padStart(2, "0")}</span>
              <p className="flex-1 whitespace-pre-wrap">{log}</p>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-cyan-400 font-mono animate-pulse mt-3 pl-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>AI vision parser running...</span>
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}

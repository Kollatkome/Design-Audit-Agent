"use client";

import { useEffect, useRef } from "react";
import { LogEntry } from "@/types";
import { Terminal, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ObservabilityPanelProps {
  logs: LogEntry[];
}

export function ObservabilityPanel({ logs }: ObservabilityPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getIcon = (status: LogEntry["status"]) => {
    switch (status) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "error": return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "warning": return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case "loading": return <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d12] border border-white/10 rounded-xl overflow-hidden font-mono text-sm">
      <div className="flex items-center px-4 py-3 bg-white/5 border-b border-white/5">
        <Terminal className="w-4 h-4 text-white/50 mr-2" />
        <span className="text-white/70 font-medium text-xs tracking-wider uppercase">Agent Execution Log</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
      >
        {logs.length === 0 ? (
          <p className="text-white/30 italic text-center mt-4">Waiting for agent activity...</p>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className="flex items-start animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex-shrink-0 mt-0.5 mr-3">
                {getIcon(log.status)}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center">
                  <span className="text-white/40 text-xs mr-2">
                    {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    log.status === 'success' && "text-green-400",
                    log.status === 'error' && "text-red-400",
                    log.status === 'warning' && "text-yellow-400",
                    log.status === 'info' && "text-blue-400",
                    log.status === 'loading' && "text-primary-400",
                  )}>
                    [{log.status}]
                  </span>
                </div>
                <p className="text-white/80 mt-0.5 break-words">
                  {log.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { CommandCenter } from "@/components/upgraded/CommandCenter";
import { DashboardResults } from "@/components/upgraded/DashboardResults";
import { Level3AuditResponse } from "@/types";
import { Zap, ShieldCheck, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Level3UpgradedPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<Level3AuditResponse | null>(null);

  // Loaded page image views
  const [baselineImage, setBaselineImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  // Refs for scrolling and focus
  const resultsRef = useRef<HTMLDivElement>(null);
  const commandCenterRef = useRef<HTMLDivElement>(null);

  const handleSelectPage = (slug: string, baseline: string, current: string) => {
    setBaselineImage(baseline);
    setCurrentImage(current);
  };

  const handleAuditFinished = (data: Level3AuditResponse) => {
    setResults(data);
  };

  // Scroll to results when results are loaded
  useEffect(() => {
    if (results && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [results]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Premium Solid Navigation */}
      <nav className="border-b border-cyan-500/10 bg-[#090d16] shadow-lg shadow-black/35 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-900 cursor-pointer"
              title="Go back to original Level 3"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Zap className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
                VEYRA
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="flex items-center px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> VEYRA NEXUS
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-12 space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-extrabold text-white tracking-tight"
          >
            VEYRA NEXUS
          </motion.h1>
          <p className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block -mt-2">
            Autonomous UI Observability Platform
          </p>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-slate-400 leading-relaxed"
          >
            Schedule Playwright crawl automation, authenticate dynamically, clean pages of content noise, manage versioned snapshot baselines, and enforce visual release gates.
          </motion.p>
        </div>

        {/* CommandCenter Control Panel */}
        <div ref={commandCenterRef} className="scroll-mt-20">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CommandCenter 
              onSelectPage={handleSelectPage}
              onAuditFinished={handleAuditFinished}
              isAnalyzing={isAnalyzing}
              setIsAnalyzing={setIsAnalyzing}
            />
          </motion.div>
        </div>

        {/* Results Section */}
        <div 
          ref={resultsRef} 
          className="scroll-mt-20 text-white"
        >
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-8 border-t border-slate-800/80"
            >
              <DashboardResults 
                results={results} 
                baselineImage={baselineImage}
                currentImage={currentImage}
              />
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

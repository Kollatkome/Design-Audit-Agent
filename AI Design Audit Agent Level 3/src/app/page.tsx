"use client";

import { useState, useRef, useEffect } from "react";
import { CommandCenter } from "@/components/CommandCenter";
import { DashboardResults } from "@/components/DashboardResults";
import { Level3AuditResponse } from "@/types";
import { LayoutDashboard, Zap, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
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
        resultsRef.current?.focus();
      }, 300);
    }
  }, [results]);

  // Navbar CTA scrolls
  const handleNavScroll = (target: "results" | "command") => {
    if (target === "results" && results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      resultsRef.current.focus();
    } else {
      commandCenterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Top Navbar */}
      <nav className="border-b border-white/10 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleNavScroll("command")}>
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              AuditAgent QA
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm font-medium text-white/70">
            <button 
              onClick={() => handleNavScroll(results ? "results" : "command")}
              className="flex items-center hover:text-white transition-colors cursor-pointer bg-transparent border-0 outline-none"
            >
              <LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard
            </button>
            <span className="flex items-center text-purple-400 cursor-default font-semibold">
              <ShieldCheck className="w-4 h-4 mr-1.5" /> Level 3 Platform
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-12 space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-white tracking-tight"
          >
            Autonomous UI Regression Platform
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base text-white/60 max-w-2xl mx-auto"
          >
            Schedule or run Playwright crawl automation, authenticate dynamically, clean pages of content noise, manage versioned snapshot baselines, and enforce visual release gates.
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
          tabIndex={-1} 
          className="outline-none scroll-mt-20 text-white"
        >
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-8 border-t border-white/10"
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

"use client";

import { useState, useRef, useEffect } from "react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { DashboardResults } from "@/components/DashboardResults";
import { AuditResponse, LogEntry } from "@/types";
import { LayoutDashboard, Zap, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<AuditResponse | null>(null);

  // Single screenshot preview state
  const [preview, setPreview] = useState<string | null>(null);

  // Refs for scrolling and focus
  const resultsRef = useRef<HTMLDivElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const dashboardBtnRef = useRef<HTMLButtonElement>(null);

  const addLog = (message: string, status: LogEntry["status"] = "info") => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        status,
        message,
      },
    ]);
  };

  const handleUpload = (file: File, base64: string) => {
    setPreview(base64);
    setResults(null);
    addLog(`Uploaded UI screenshot: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, "success");
  };

  const handleClear = () => {
    setPreview(null);
    setResults(null);
    addLog("UI screenshot cleared.", "warning");
  };

  const handleAnalyze = async () => {
    if (!preview) return;

    setIsAnalyzing(true);
    setResults(null);
    setLogs([]);

    addLog("Initializing AI Design Auditor Engine...", "info");
    addLog("Analyzing screenshot resolution and aspect ratio...", "info");
    
    // Smooth scroll to loading logs panel
    setTimeout(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    try {
      addLog("Sending screenshot to Gemini Vision Model...", "loading");
      addLog("Evaluating Visual Hierarchy and element positioning...", "loading");
      addLog("Calculating contrast ratios and checking consistency...", "loading");

      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: preview,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      addLog("Design audit data received. Generating dashboard...", "info");

      const data: AuditResponse = await response.json();
      
      const totalIssues = data.summary?.totalIssues ?? 0;

      addLog(`Analysis complete. Identified ${totalIssues} potential design issues.`, "success");

      setResults(data);
      setIsAnalyzing(false);
    } catch (error: unknown) {
      const err = error as { message?: string };
      addLog(`AI Design Audit failed: ${err.message || "Unknown error"}`, "error");
      setIsAnalyzing(false);
    }
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
  const handleNavScroll = (target: "results" | "upload") => {
    if (target === "results" && results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      resultsRef.current.focus();
    } else {
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Top Navbar */}
      <nav className="border-b border-white/10 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleNavScroll("upload")}>
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              AuditAgent AI
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm font-medium text-white/70">
            <button 
              ref={dashboardBtnRef}
              onClick={() => handleNavScroll(results ? "results" : "upload")}
              className="flex items-center hover:text-white transition-colors cursor-pointer bg-transparent border-0 outline-none"
            >
              <LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard
            </button>
            <span className="flex items-center text-primary-400 cursor-default">
              <ShieldCheck className="w-4 h-4 mr-1.5" /> Level 1 Engine
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
            AI Design Audit Agent
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/60 max-w-2xl mx-auto"
          >
            Upload a developed UI screenshot to automatically analyze design execution, calculate contrast ratings, and list fixes under five core design principles.
          </motion.p>
        </div>

        {/* Main Content Grid */}
        <div ref={uploadSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="glass p-6 rounded-2xl border border-white/10 flex-1 flex flex-col justify-between"
            >
              <UploadDropzone 
                preview={preview}
                onUpload={handleUpload}
                onClear={handleClear}
                isLoading={isAnalyzing}
                onAnalyze={handleAnalyze}
              />
            </motion.div>
          </div>
          
          <div className="min-h-[300px] lg:h-auto">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="h-full"
            >
              <ObservabilityPanel logs={logs} />
            </motion.div>
          </div>
        </div>

        {/* Results Section */}
        <div 
          ref={resultsRef} 
          tabIndex={-1} 
          className="outline-none scroll-mt-20"
        >
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-8 border-t border-white/10"
            >
              <DashboardResults 
                results={results} 
                image={preview} 
              />
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

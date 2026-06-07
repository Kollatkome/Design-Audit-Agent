"use client";

import { useState, useRef, useEffect } from "react";
import { UploadDropzone } from "@/components/upgraded/UploadDropzone";
import { AuditLogPanel } from "@/components/upgraded/AuditLogPanel";
import { FindingsDashboard } from "@/components/upgraded/FindingsDashboard";
import { VisualEvidenceSystem } from "@/components/upgraded/VisualEvidenceSystem";
import { CopilotChat } from "@/components/upgraded/CopilotChat";
import { DetectionResult } from "@/lib/upgraded/detector-engine";
import { Zap, ShieldCheck, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface AuditSummary {
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface UpgradedAuditResponse {
  summary: AuditSummary;
  findings: DetectionResult[];
  logs: string[];
  timestamp: string;
}

export default function Level2UpgradedPage() {
  const [baselinePreview, setBaselinePreview] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<UpgradedAuditResponse | null>(null);

  // Hover and focus coordination states
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);
  const [focusedFindingId, setFocusedFindingId] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const handleUploadBaseline = (file: File, base64: string) => {
    setBaselinePreview(base64);
    setResults(null);
    setLogs((prev) => [
      ...prev,
      `[INFO] Baseline Design loaded: "${file.name}" (${(file.size / 1024).toFixed(1)} KB).`
    ]);
  };

  const handleUploadCurrent = (file: File, base64: string) => {
    setCurrentPreview(base64);
    setResults(null);
    setLogs((prev) => [
      ...prev,
      `[INFO] Developed UI screenshot loaded: "${file.name}" (${(file.size / 1024).toFixed(1)} KB).`
    ]);
  };

  const handleClearBaseline = () => {
    setBaselinePreview(null);
    setResults(null);
    setLogs((prev) => [...prev, "[WARNING] Baseline design screenshot cleared."]);
  };

  const handleClearCurrent = () => {
    setCurrentPreview(null);
    setResults(null);
    setLogs((prev) => [...prev, "[WARNING] Developed UI screenshot cleared."]);
  };

  const handleAnalyze = async () => {
    if (!baselinePreview || !currentPreview) return;

    setIsLoading(true);
    setResults(null);
    setLogs((prev) => [
      ...prev,
      "[SYSTEM] Initializing Level 2 Visual Regression Engine...",
      "[SYSTEM] Dispatching concurrent visual layout analysis requests..."
    ]);

    try {
      const response = await fetch("/api/upgraded-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baselineBase64: baselinePreview,
          currentBase64: currentPreview,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const data: UpgradedAuditResponse = await response.json();
      setResults(data);
      setLogs(data.logs || []);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setLogs((prev) => [
        ...prev,
        `[CRITICAL ERROR] Visual comparative engine failure: ${error.message || String(err)}`,
        `[CRITICAL ERROR] Audit execution aborted.`
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to results when they are loaded
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
              title="Go back to original Level 2"
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
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> VEYRA DIFF
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-12 space-y-12">
        {/* Header Introduction */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-extrabold text-white tracking-tight"
          >
            VEYRA DIFF
          </motion.h1>
          <p className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block -mt-2">
            Visual Regression Intelligence Engine
          </p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-slate-400 leading-relaxed"
          >
            Compare developed frontend UI implementations directly against design mockup screenshots. Detect positional shifts, WCAG accessibility drops, font sizing adjustments, missing layouts, or redundant elements.
          </motion.p>
        </div>

        {/* Upload Panel and Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Panel: Dual Upload drops */}
          <div className="lg:col-span-7 flex flex-col space-y-6 justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="glass p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 flex-1 flex flex-col justify-between"
            >
              <UploadDropzone
                baselinePreview={baselinePreview}
                currentPreview={currentPreview}
                onUploadBaseline={handleUploadBaseline}
                onUploadCurrent={handleUploadCurrent}
                onClearBaseline={handleClearBaseline}
                onClearCurrent={handleClearCurrent}
                isLoading={isLoading}
                onAnalyze={handleAnalyze}
              />
            </motion.div>
          </div>

          {/* Right Panel: Logs */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full"
            >
              <AuditLogPanel logs={logs} isLoading={isLoading} />
            </motion.div>
          </div>
        </div>

        {/* Visual annotation layout canvas overlay */}
        {(baselinePreview || currentPreview) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="w-full"
          >
            <VisualEvidenceSystem
              baselineImage={baselinePreview}
              currentImage={currentPreview}
              findings={results ? results.findings : []}
              hoveredFindingId={hoveredFindingId}
              setHoveredFindingId={setHoveredFindingId}
              focusedFindingId={focusedFindingId}
              setFocusedFindingId={setFocusedFindingId}
            />
          </motion.div>
        )}

        {/* Findings dashboard & Chatbot panel */}
        <div
          ref={resultsRef}
          className="scroll-mt-20 pt-4"
        >
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-slate-800/80 pt-8 grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 space-y-6">
                <FindingsDashboard
                  results={results}
                  onHoverFinding={setHoveredFindingId}
                  focusedFindingId={focusedFindingId}
                  setFocusedFindingId={setFocusedFindingId}
                />
              </div>
              <div className="lg:col-span-1">
                <div className="sticky top-20">
                  <CopilotChat key={results ? `${results.timestamp}-${results.findings.length}` : "empty"} results={results} />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

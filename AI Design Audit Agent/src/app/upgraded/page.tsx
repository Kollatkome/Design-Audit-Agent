"use client";

import { useState, useRef, useEffect } from "react";
import { UploadDropzone } from "@/components/upgraded/UploadDropzone";
import { AuditLogPanel } from "@/components/upgraded/AuditLogPanel";
import { FindingsDashboard } from "@/components/upgraded/FindingsDashboard";
import { VisualEvidenceSystem } from "@/components/upgraded/VisualEvidenceSystem";
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

export default function UpgradedHome() {
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<UpgradedAuditResponse | null>(null);

  // Hover and focus coordination states
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);
  const [focusedFindingId, setFocusedFindingId] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const handleImageSelected = (base64: string, name: string) => {
    setImage(base64);
    setResults(null);
    setLogs([`[INFO] File uploaded: "${name}". Image compression completed.`]);
  };

  const handleImageCleared = () => {
    setImage(null);
    setResults(null);
    setLogs([]);
  };

  const handleStartAudit = async () => {
    if (!image) return;

    setIsLoading(true);
    setResults(null);
    setLogs((prev) => [...prev, "[SYSTEM] Starting visual audit pipeline...", "[SYSTEM] Sending image to component layout analyzer..."]);

    try {
      const response = await fetch("/api/upgraded-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: image }),
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
        `[CRITICAL ERROR] Visual audit engine failed: ${error.message || String(err)}`,
        `[CRITICAL ERROR] Aborted.`
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to results when they are available
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
              title="Go back to original Level 1"
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
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> VEYRA AUDIT
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
            VEYRA AUDIT
          </motion.h1>
          <p className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block -mt-2">
            AI Design Validation Engine
          </p>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-slate-400 leading-relaxed"
          >
            Detect layout shifts, contrast errors, typography gaps, and spacing issues using modular visual detectors. Powered by a deterministic math engine and OCR layout processing.
          </motion.p>
        </div>

        {/* Main Content Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Panel: Upload and Terminal Observability */}
          <div className="lg:col-span-5 flex flex-col space-y-6 justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="glass p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 flex-1 flex flex-col justify-between"
            >
              <UploadDropzone 
                onImageSelected={handleImageSelected}
                onImageCleared={handleImageCleared}
                isLoading={isLoading}
                onStartAudit={handleStartAudit}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-1"
            >
              <AuditLogPanel logs={logs} isLoading={isLoading} />
            </motion.div>
          </div>

          {/* Right Panel: Bounding Annotation Canvas */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full"
            >
              <VisualEvidenceSystem 
                image={image}
                findings={results ? results.findings : []}
                hoveredFindingId={hoveredFindingId}
                setHoveredFindingId={setHoveredFindingId}
                focusedFindingId={focusedFindingId}
                setFocusedFindingId={setFocusedFindingId}
              />
            </motion.div>
          </div>
        </div>

        {/* Findings Dashboard logs */}
        <div 
          ref={resultsRef} 
          className="scroll-mt-20 pt-4"
        >
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-slate-800/80 pt-8"
            >
              <FindingsDashboard 
                results={results} 
                onHoverFinding={setHoveredFindingId}
                focusedFindingId={focusedFindingId}
                setFocusedFindingId={setFocusedFindingId}
              />
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

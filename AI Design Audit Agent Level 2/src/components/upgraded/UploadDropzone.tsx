"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X, ShieldAlert, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  baselinePreview: string | null;
  currentPreview: string | null;
  onUploadBaseline: (file: File, base64: string) => void;
  onUploadCurrent: (file: File, base64: string) => void;
  onClearBaseline: () => void;
  onClearCurrent: () => void;
  isLoading: boolean;
  onAnalyze: () => void;
}

export function UploadDropzone({
  baselinePreview,
  currentPreview,
  onUploadBaseline,
  onUploadCurrent,
  onClearBaseline,
  onClearCurrent,
  isLoading,
  onAnalyze,
}: UploadDropzoneProps) {
  const [dragActiveBaseline, setDragActiveBaseline] = useState(false);
  const [dragActiveCurrent, setDragActiveCurrent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const baselineInputRef = useRef<HTMLInputElement>(null);
  const currentInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File, type: "baseline" | "current") => {
    setErrorMsg(null);

    const validFormats = ["image/png", "image/jpeg", "image/webp"];
    if (!validFormats.includes(file.type)) {
      setErrorMsg("Invalid file format. Please upload PNG, JPG, or WEBP.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setErrorMsg("File size exceeds 6MB. Please upload a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDimension = 1400;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.82);
          if (type === "baseline") {
            onUploadBaseline(file, compressedBase64);
          } else {
            onUploadCurrent(file, compressedBase64);
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setErrorMsg("Corrupted file payload detected. Failed to read image.");
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: DragEvent, type: "baseline" | "current") => {
    e.preventDefault();
    e.stopPropagation();
    const isEnterOrOver = e.type === "dragenter" || e.type === "dragover";
    if (type === "baseline") {
      setDragActiveBaseline(isEnterOrOver);
    } else {
      setDragActiveCurrent(isEnterOrOver);
    }
  };

  const handleDrop = (e: DragEvent, type: "baseline" | "current") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "baseline") {
      setDragActiveBaseline(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0], "baseline");
      }
    } else {
      setDragActiveCurrent(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0], "current");
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>, type: "baseline" | "current") => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0], type);
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Baseline design dropzone */}
        <div
          onDragEnter={(e) => handleDrag(e, "baseline")}
          onDragOver={(e) => handleDrag(e, "baseline")}
          onDragLeave={(e) => handleDrag(e, "baseline")}
          onDrop={(e) => handleDrop(e, "baseline")}
          onClick={() => !baselinePreview && baselineInputRef.current?.click()}
          className={cn(
            "relative border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[200px]",
            baselinePreview
              ? "border-slate-800 bg-slate-900/10 cursor-default"
              : "border-slate-800 bg-slate-950/40 hover:border-cyan-500/50 hover:bg-slate-900/20 cursor-pointer",
            dragActiveBaseline && "border-cyan-500 bg-cyan-950/10 scale-[0.99] shadow-[0_0_20px_rgba(6,182,212,0.15)]"
          )}
        >
          <input
            ref={baselineInputRef}
            type="file"
            className="hidden"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={(e) => handleChange(e, "baseline")}
            disabled={isLoading || !!baselinePreview}
          />

          <AnimatePresence mode="wait">
            {!baselinePreview ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                  <Upload className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-100">1. Baseline Design Mockup</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Drag and drop design file here</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800/80"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img
                    src={baselinePreview}
                    alt="Baseline Mockup"
                    className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-white/5"
                  />
                  <div className="text-left overflow-hidden">
                    <span className="text-xs font-semibold text-slate-100 block truncate max-w-[150px]">Baseline Design</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Loaded successfully</span>
                  </div>
                </div>
                {!isLoading && (
                  <button
                    onClick={onClearBaseline}
                    className="p-1.5 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Current developed design dropzone */}
        <div
          onDragEnter={(e) => handleDrag(e, "current")}
          onDragOver={(e) => handleDrag(e, "current")}
          onDragLeave={(e) => handleDrag(e, "current")}
          onDrop={(e) => handleDrop(e, "current")}
          onClick={() => !currentPreview && currentInputRef.current?.click()}
          className={cn(
            "relative border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[200px]",
            currentPreview
              ? "border-slate-800 bg-slate-900/10 cursor-default"
              : "border-slate-800 bg-slate-950/40 hover:border-cyan-500/50 hover:bg-slate-900/20 cursor-pointer",
            dragActiveCurrent && "border-cyan-500 bg-cyan-950/10 scale-[0.99] shadow-[0_0_20px_rgba(6,182,212,0.15)]"
          )}
        >
          <input
            ref={currentInputRef}
            type="file"
            className="hidden"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={(e) => handleChange(e, "current")}
            disabled={isLoading || !!currentPreview}
          />

          <AnimatePresence mode="wait">
            {!currentPreview ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                  <Upload className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-100">2. Developed Implementation UI</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Drag and drop implementation screenshot</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800/80"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img
                    src={currentPreview}
                    alt="Current UI Implementation"
                    className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-white/5"
                  />
                  <div className="text-left overflow-hidden">
                    <span className="text-xs font-semibold text-slate-100 block truncate max-w-[150px]">Developed UI</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Loaded successfully</span>
                  </div>
                </div>
                {!isLoading && (
                  <button
                    onClick={onClearCurrent}
                    className="p-1.5 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs"
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {baselinePreview && currentPreview && !isLoading && (
        <motion.button
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onAnalyze}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] flex items-center justify-center space-x-1.5 cursor-pointer border-0"
        >
          <Sparkles className="w-4 h-4 text-cyan-200" />
          <span>Launch Comparative Audit</span>
        </motion.button>
      )}
    </div>
  );
}

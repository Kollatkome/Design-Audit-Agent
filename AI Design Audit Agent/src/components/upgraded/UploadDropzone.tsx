"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X, ShieldAlert, Sparkles, FileImage } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onImageSelected: (base64: string, name: string) => void;
  onImageCleared: () => void;
  isLoading: boolean;
  onStartAudit: () => void;
}

export function UploadDropzone({ onImageSelected, onImageCleared, isLoading, onStartAudit }: UploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    
    // Format validation
    const validFormats = ["image/png", "image/jpeg", "image/webp"];
    if (!validFormats.includes(file.type)) {
      setErrorMsg("Invalid file format. Please upload PNG, JPG, or WEBP.");
      return;
    }

    // Size validation (limit to 6MB)
    if (file.size > 6 * 1024 * 1024) {
      setErrorMsg("File size exceeds 6MB. Please upload a smaller image.");
      return;
    }

    setFileName(file.name);

    // Client-side image resizing and compression using HTML5 Canvas
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDimension = 1400;

        // Resize proportionately if larger than max dimension
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
          // Compress to JPEG with 0.82 quality to fit tokens footprint
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.82);
          setPreviewUrl(compressedBase64);
          onImageSelected(compressedBase64, file.name);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setErrorMsg("Corrupted file payload detected. Failed to read image.");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearUpload = () => {
    setFileName(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onImageCleared();
  };

  return (
    <div className="w-full space-y-4">
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !fileName && fileInputRef.current?.click()}
        className={cn(
          "relative border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[220px]",
          fileName ? "border-slate-800 bg-slate-900/10 cursor-default" : "border-slate-800 bg-slate-950/40 hover:border-cyan-500/50 hover:bg-slate-900/20 cursor-pointer",
          dragActive && "border-cyan-500 bg-cyan-950/10 scale-[0.99] shadow-[0_0_20px_rgba(6,182,212,0.15)]"
        )}
      >
        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={handleChange}
          disabled={isLoading || !!fileName}
        />

        <AnimatePresence mode="wait">
          {!fileName ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center space-y-3"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                <Upload className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-100">Upload UI Screenshot</span>
                <span className="text-xs text-slate-400 block mt-1">Drag and drop or click to select file</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">PNG, JPG, WEBP (Max 6MB)</span>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-slate-800/80"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Upload Preview" 
                    className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-white/5"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-center">
                    <FileImage className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="text-left overflow-hidden">
                  <span className="text-xs font-semibold text-slate-100 block truncate max-w-[240px]">{fileName}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Ready for design check</span>
                </div>
              </div>

              {!isLoading && (
                <button 
                  onClick={clearUpload}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {dragActive && (
          <div className="absolute inset-0 bg-cyan-500/[0.02] border-cyan-500/50 rounded-2xl pointer-events-none" />
        )}
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

      {fileName && !isLoading && (
        <motion.button
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onStartAudit}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-cyan-200" />
          <span>Launch Design Audit</span>
        </motion.button>
      )}
    </div>
  );
}

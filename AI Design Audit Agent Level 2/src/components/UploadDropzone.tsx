"use client";

import { useState, useCallback, useRef } from "react";
import { UploadCloud, X, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";

interface SingleZoneProps {
  label: string;
  preview: string | null;
  onUpload: (file: File, base64: string) => void;
  onClear: () => void;
  isLoading: boolean;
}

function SingleUploadZone({ label, preview, onUpload, onClear, isLoading }: SingleZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback((file: File) => {
    setError(null);
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);
          onUpload(file, compressedBase64);
        } else {
          onUpload(file, base64);
        }
      };
      img.onerror = () => {
        onUpload(file, base64);
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-[280px]">
      <span className="text-sm font-semibold text-white/75 mb-2 block uppercase tracking-wider">{label}</span>
      
      {!preview ? (
        <div
          className={cn(
            "relative flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all duration-300 min-h-[220px] cursor-pointer",
            dragActive
              ? "border-primary-500 bg-primary-500/10"
              : "border-white/20 hover:border-primary-500/50 glass hover:glass-hover"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isLoading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={handleChange}
            disabled={isLoading}
          />
          <UploadCloud className={cn("w-10 h-10 mb-3", dragActive ? "text-primary-500" : "text-white/40")} />
          <p className="text-white/80 font-medium text-center text-sm mb-1">
            Drag & Drop or Click
          </p>
          <p className="text-white/40 text-xs text-center">
            PNG, JPG, WebP (Max 5MB)
          </p>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-white/10 glass p-2 flex-1 min-h-[220px] flex items-center justify-center bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={preview} 
            alt={label} 
            className="max-w-full max-h-[200px] object-contain rounded-xl"
          />
          {!isLoading && (
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/95 text-white rounded-md backdrop-blur-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center text-red-400">
          <FileWarning className="w-4 h-4 mr-1.5 flex-shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}

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
  onAnalyze
}: UploadDropzoneProps) {
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <SingleUploadZone 
          label="Baseline UI (Original Design)"
          preview={baselinePreview}
          onUpload={onUploadBaseline}
          onClear={onClearBaseline}
          isLoading={isLoading}
        />
        
        <SingleUploadZone 
          label="Current UI (Implementation)"
          preview={currentPreview}
          onUpload={onUploadCurrent}
          onClear={onClearCurrent}
          isLoading={isLoading}
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={onAnalyze}
          disabled={isLoading || !baselinePreview || !currentPreview}
          className={cn(
            "px-8 py-3.5 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-500 hover:to-secondary-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-primary-500/20 transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider text-sm",
            isLoading && "animate-pulse"
          )}
        >
          {isLoading ? "Running Visual Regression..." : "Compare & Analyze"}
        </button>
      </div>
    </div>
  );
}

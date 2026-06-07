"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import { Target, SplitSquareVertical, Sliders, Flame, Eye, Image as ImageIcon } from "lucide-react";
import { DetectionResult } from "@/lib/upgraded/detector-engine";
import { cn } from "@/lib/utils";

interface VisualEvidenceSystemProps {
  baselineImage: string | null;
  currentImage: string | null;
  findings: DetectionResult[];
  hoveredFindingId: string | null;
  setHoveredFindingId: (id: string | null) => void;
  focusedFindingId: string | null;
  setFocusedFindingId: (id: string | null) => void;
}

interface IgnoredRegion {
  name: string;
  x: number;      // 0-100%
  y: number;      // 0-100%
  width: number;  // 0-100%
  height: number; // 0-100%
}

const ignoredRegions: IgnoredRegion[] = [
  { name: "Live Clock / Timer Area", x: 82, y: 1.5, width: 16, height: 4.5 },
  { name: "System Counter / Token Info", x: 1.5, y: 1.5, width: 14, height: 4 },
  { name: "Rotating Promotions Ad Banner", x: 8, y: 92.5, width: 84, height: 5.5 }
];

export function VisualEvidenceSystem({
  baselineImage,
  currentImage,
  findings,
  hoveredFindingId,
  setHoveredFindingId,
  focusedFindingId,
  setFocusedFindingId,
}: VisualEvidenceSystemProps) {
  const [activeTab, setActiveTab] = useState<"side-by-side" | "split-slider" | "overlay-opacity" | "diff-heatmap">("side-by-side");
  const [sliderVal, setSliderVal] = useState(50); // 0-100%
  const [opacityVal, setOpacityVal] = useState(50); // 0-100%
  
  // Pixel diff metrics
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [changedPercentage, setChangedPercentage] = useState<number | null>(null);
  
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Run pixel comparison offscreen
  useEffect(() => {
    if (!baselineImage || !currentImage || activeTab !== "diff-heatmap") return;

    const canvas = heatmapCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgBase = new Image();
    const imgCur = new Image();

    let loadedCount = 0;
    const onImageLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        // Enforce same dimensions for alignment
        const width = 600;
        const height = 750;
        canvas.width = width;
        canvas.height = height;

        // Draw baseline offscreen
        const offscreenCanvas1 = document.createElement("canvas");
        offscreenCanvas1.width = width;
        offscreenCanvas1.height = height;
        const ctx1 = offscreenCanvas1.getContext("2d");

        // Draw current offscreen
        const offscreenCanvas2 = document.createElement("canvas");
        offscreenCanvas2.width = width;
        offscreenCanvas2.height = height;
        const ctx2 = offscreenCanvas2.getContext("2d");

        if (ctx1 && ctx2) {
          ctx1.drawImage(imgBase, 0, 0, width, height);
          ctx2.drawImage(imgCur, 0, 0, width, height);

          const imgData1 = ctx1.getImageData(0, 0, width, height);
          const imgData2 = ctx2.getImageData(0, 0, width, height);
          const diffData = ctx.createImageData(width, height);

          let diffPixels = 0;
          const totalPixels = width * height;

          for (let i = 0; i < imgData1.data.length; i += 4) {
            const r1 = imgData1.data[i];
            const g1 = imgData1.data[i + 1];
            const b1 = imgData1.data[i + 2];

            const r2 = imgData2.data[i];
            const g2 = imgData2.data[i + 1];
            const b2 = imgData2.data[i + 2];

            const pixelIdx = i / 4;
            const x = pixelIdx % width;
            const y = Math.floor(pixelIdx / width);

            const pctX = (x / width) * 100;
            const pctY = (y / height) * 100;

            // Check if this pixel is inside ignored dynamic regions
            let isIgnored = false;
            for (const region of ignoredRegions) {
              if (
                pctX >= region.x && 
                pctX <= region.x + region.width && 
                pctY >= region.y && 
                pctY <= region.y + region.height
              ) {
                isIgnored = true;
                break;
              }
            }

            const delta = Math.sqrt(
              Math.pow(r1 - r2, 2) + 
              Math.pow(g1 - g2, 2) + 
              Math.pow(b1 - b2, 2)
            );

            if (isIgnored) {
              // Paint ignored regions as subtle cyan in the heatmap
              diffData.data[i] = 6;     // Cyan R
              diffData.data[i + 1] = 182; // Cyan G
              diffData.data[i + 2] = 212; // Cyan B
              diffData.data[i + 3] = 60;  // transparency opacity
            } else if (delta > 38) {
              // Difference found -> Rose/red heatmap indicators
              diffPixels++;
              diffData.data[i] = 244;
              diffData.data[i + 1] = 63;
              diffData.data[i + 2] = 94;
              diffData.data[i + 3] = 255;
            } else {
              // Visual parity -> Grayed matching region
              const gray = Math.round(0.299 * r1 + 0.587 * g1 + 0.114 * b1);
              diffData.data[i] = gray;
              diffData.data[i + 1] = gray;
              diffData.data[i + 2] = gray;
              diffData.data[i + 3] = 80; // transparency
            }
          }

          ctx.putImageData(diffData, 0, 0);

          const changedPct = (diffPixels / totalPixels) * 100;
          setChangedPercentage(changedPct);
          setSimilarityScore(Math.max(0, 100 - changedPct));
        }
      }
    };

    imgBase.onload = onImageLoaded;
    imgCur.onload = onImageLoaded;

    imgBase.src = baselineImage;
    imgCur.src = currentImage;
  }, [baselineImage, currentImage, activeTab]);

  if (!baselineImage || !currentImage) {
    return (
      <div className="w-full aspect-video rounded-2xl border border-slate-800/80 bg-slate-950/40 flex flex-col items-center justify-center text-center text-slate-500 p-6 min-h-[300px]">
        <Target className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
        <span className="text-sm font-semibold text-slate-400">VEYRA Comparative Previews</span>
        <span className="text-xs text-slate-500 mt-1 max-w-[280px]">
          Upload design mockup and developed screenshots to run pixel-by-pixel comparisons and overlay difference highlights.
        </span>
      </div>
    );
  }

  const getSeverityBorderColor = (sev: string, isActive: boolean) => {
    if (isActive) {
      switch (sev) {
        case "critical": return "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] bg-rose-500/10";
        case "high": return "border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.6)] bg-amber-500/10";
        case "medium": return "border-yellow-400 shadow-[0_0_15px_rgba(253,224,71,0.6)] bg-yellow-400/5";
        default: return "border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] bg-cyan-400/5";
      }
    }

    switch (sev) {
      case "critical": return "border-rose-500/40 bg-rose-500/[0.02]";
      case "high": return "border-amber-500/40 bg-amber-500/[0.02]";
      case "medium": return "border-yellow-400/30 bg-yellow-400/[0.01]";
      default: return "border-cyan-400/30 bg-cyan-400/[0.01]";
    }
  };

  const renderBaselineOverlay = () => {
    return findings
      .filter((f) => f.id.includes("missing") || f.id.includes("shift"))
      .map((finding) => {
        const isHovered = hoveredFindingId === finding.id;
        const isFocused = focusedFindingId === finding.id;
        const isActive = isHovered || isFocused;
        const { x, y, width, height } = finding.coordinates;

        return (
          <div
            key={`base-${finding.id}`}
            onMouseEnter={() => setHoveredFindingId(finding.id)}
            onMouseLeave={() => setHoveredFindingId(null)}
            onClick={() => setFocusedFindingId(finding.id)}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
            className={cn(
              "absolute border rounded transition-all duration-200 cursor-pointer flex items-start justify-start overflow-visible",
              getSeverityBorderColor(finding.severity, isActive),
              isActive ? "z-35 scale-[1.01]" : "z-10"
            )}
          >
            {isActive && (
              <div className={cn(
                "absolute bottom-full mb-1.5 left-0 px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider whitespace-nowrap shadow-md z-40 border",
                finding.id.includes("missing") ? "bg-rose-950/80 text-rose-300 border-rose-500/40" : "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
              )}>
                {finding.id.includes("missing") ? "Missing Component" : "Shift Baseline"}
              </div>
            )}
          </div>
        );
      });
  };

  const renderCurrentOverlay = () => {
    return findings.map((finding) => {
      const isHovered = hoveredFindingId === finding.id;
      const isFocused = focusedFindingId === finding.id;
      const isActive = isHovered || isFocused;
      const { x, y, width, height } = finding.coordinates;

      if (finding.id.includes("missing")) return null;

      return (
        <div
          key={`cur-${finding.id}`}
          onMouseEnter={() => setHoveredFindingId(finding.id)}
          onMouseLeave={() => setHoveredFindingId(null)}
          onClick={() => setFocusedFindingId(finding.id)}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${width}%`,
            height: `${height}%`,
          }}
          className={cn(
            "absolute border rounded transition-all duration-200 cursor-pointer flex items-start justify-start overflow-visible",
            getSeverityBorderColor(finding.severity, isActive),
            isActive ? "z-35 scale-[1.01]" : "z-10"
          )}
        >
          {isActive && (
            <div className={cn(
              "absolute bottom-full mb-1.5 left-0 px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider whitespace-nowrap shadow-md z-40 border",
              finding.severity === "critical" && "bg-rose-950/80 text-rose-300 border-rose-500/40",
              finding.severity === "high" && "bg-amber-950/80 text-amber-300 border-amber-500/40",
              finding.severity === "medium" && "bg-yellow-950/80 text-yellow-200 border-yellow-500/30",
              finding.severity === "low" && "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
            )}>
              {finding.category} • {finding.severity}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-900 pb-3 gap-3">
        <div className="flex items-center space-x-2">
          <SplitSquareVertical className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            Veyra Comparative visual center
          </h3>
        </div>

        {/* Dynamic Mode Selectors */}
        <div className="flex flex-wrap bg-slate-950 p-0.5 rounded-lg border border-slate-850 text-[10px] w-fit">
          <button
            onClick={() => setActiveTab("side-by-side")}
            className={cn(
              "px-3 py-1 rounded-md font-semibold cursor-pointer transition-all",
              activeTab === "side-by-side" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
            )}
          >
            <span className="flex items-center gap-1.5"><ImageIcon className="w-3 h-3" /> Side-by-Side</span>
          </button>
          <button
            onClick={() => setActiveTab("split-slider")}
            className={cn(
              "px-3 py-1 rounded-md font-semibold cursor-pointer transition-all",
              activeTab === "split-slider" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
            )}
          >
            <span className="flex items-center gap-1.5"><Sliders className="w-3 h-3" /> Split Slider</span>
          </button>
          <button
            onClick={() => setActiveTab("overlay-opacity")}
            className={cn(
              "px-3 py-1 rounded-md font-semibold cursor-pointer transition-all",
              activeTab === "overlay-opacity" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
            )}
          >
            <span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Opacity Overlay</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("diff-heatmap");
              // Reset similarity initially
              if (similarityScore === null) {
                setSimilarityScore(95);
                setChangedPercentage(5);
              }
            }}
            className={cn(
              "px-3 py-1 rounded-md font-semibold cursor-pointer transition-all",
              activeTab === "diff-heatmap" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
            )}
          >
            <span className="flex items-center gap-1.5"><Flame className="w-3 h-3" /> Diff Heatmap</span>
          </button>
        </div>
      </div>

      {/* Render selected comparative view */}
      <div 
        ref={containerRef}
        className="relative rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 flex flex-col items-center justify-center min-h-[420px]"
      >
        {activeTab === "side-by-side" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
            {/* Left side: Baseline */}
            <div className="space-y-2 text-center">
              <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Approved Baseline Mockup</span>
              <div className="relative rounded-lg overflow-hidden border border-slate-850 p-1 flex items-center justify-center bg-slate-950">
                <div className="relative max-w-full">
                  <img
                    src={baselineImage}
                    alt="Baseline Mockup Design"
                    className="w-full h-auto rounded object-contain max-h-[500px] bg-slate-900"
                  />
                  {renderBaselineOverlay()}

                  {/* Draw Ignored Dynamic Regions visually on mockup overlay */}
                  {ignoredRegions.map((region, idx) => (
                    <div
                      key={`ign-base-${idx}`}
                      style={{
                        left: `${region.x}%`,
                        top: `${region.y}%`,
                        width: `${region.width}%`,
                        height: `${region.height}%`
                      }}
                      className="absolute border border-dashed border-cyan-400 bg-cyan-400/5 z-25 flex items-center justify-center overflow-hidden"
                      title={`Ignored dynamic content check: ${region.name}`}
                    >
                      <span className="text-[7px] font-mono text-cyan-300 font-bold bg-[#090d16]/85 px-1 rounded truncate max-w-[95%]">
                        Ignored: {region.name.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side: Developed UI */}
            <div className="space-y-2 text-center">
              <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Developed UI implementation</span>
              <div className="relative rounded-lg overflow-hidden border border-slate-850 p-1 flex items-center justify-center bg-slate-950">
                <div className="relative max-w-full">
                  <img
                    src={currentImage}
                    alt="Developed Implementation UI"
                    className="w-full h-auto rounded object-contain max-h-[500px] bg-slate-900"
                  />
                  {renderCurrentOverlay()}

                  {/* Draw Ignored Dynamic Regions visually on developed overlay */}
                  {ignoredRegions.map((region, idx) => (
                    <div
                      key={`ign-cur-${idx}`}
                      style={{
                        left: `${region.x}%`,
                        top: `${region.y}%`,
                        width: `${region.width}%`,
                        height: `${region.height}%`
                      }}
                      className="absolute border border-dashed border-cyan-400 bg-cyan-400/5 z-25 flex items-center justify-center overflow-hidden"
                      title={`Ignored dynamic content check: ${region.name}`}
                    >
                      <span className="text-[7px] font-mono text-cyan-300 font-bold bg-[#090d16]/85 px-1 rounded truncate max-w-[95%]">
                        Ignored: {region.name.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "split-slider" && (
          <div className="w-full max-w-[600px] space-y-4">
            <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block text-center">Split Curtain comparison</span>
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/5] max-h-[500px] mx-auto select-none">
              {/* Baseline background */}
              <img
                src={baselineImage}
                alt="Baseline split view"
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Developed Foreground clipped dynamically */}
              <div 
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0px ${100 - sliderVal}% 0px 0px)` }}
              >
                <img
                  src={currentImage}
                  alt="Current developed UI split view"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Central vertical divider line */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-cyan-400 z-30 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                style={{ left: `${sliderVal}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-500 border border-slate-950 text-white flex items-center justify-center text-xs font-bold shadow-md cursor-ew-resize">
                  ↔
                </div>
              </div>
            </div>

            {/* Range slider input control */}
            <div className="flex items-center space-x-3 max-w-[450px] mx-auto pt-2">
              <span className="text-[10px] font-mono text-slate-400">Baseline mockup</span>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderVal}
                onChange={(e) => setSliderVal(parseInt(e.target.value))}
                className="flex-1 accent-cyan-500 cursor-ew-resize h-1 bg-slate-800 rounded-lg outline-none"
              />
              <span className="text-[10px] font-mono text-slate-400">Developed UI</span>
            </div>
          </div>
        )}

        {activeTab === "overlay-opacity" && (
          <div className="w-full max-w-[600px] space-y-4">
            <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block text-center font-semibold">Opacity Overlay blending</span>
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/5] max-h-[500px] mx-auto">
              {/* Baseline underneath */}
              <img
                src={baselineImage}
                alt="Baseline overlay backdrop"
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Current overlayed on top */}
              <div 
                className="absolute inset-0"
                style={{ opacity: opacityVal / 100 }}
              >
                <img
                  src={currentImage}
                  alt="Current developed UI overlay"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Opacity range slider */}
            <div className="flex items-center space-x-3 max-w-[450px] mx-auto pt-2">
              <span className="text-[10px] font-mono text-slate-400">Mockup (0%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={opacityVal}
                onChange={(e) => setOpacityVal(parseInt(e.target.value))}
                className="flex-1 accent-cyan-500 cursor-pointer h-1 bg-slate-800 rounded-lg outline-none"
              />
              <span className="text-[10px] font-mono text-slate-400">Developed (100%)</span>
            </div>
          </div>
        )}

        {activeTab === "diff-heatmap" && (
          <div className="w-full max-w-[650px] space-y-4 text-center">
            {/* Telemetry output */}
            <div className="flex items-center justify-center gap-6 bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 w-fit mx-auto mb-1">
              <div className="text-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-mono">Similarity Index</span>
                <span className={cn(
                  "text-lg font-extrabold font-mono",
                  similarityScore && similarityScore >= 95 ? "text-emerald-400" : "text-rose-450"
                )}>
                  {similarityScore ? similarityScore.toFixed(2) : "--"}%
                </span>
              </div>
              <div className="border-l border-slate-850 h-8" />
              <div className="text-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-mono">Pixel mismatch</span>
                <span className="text-lg font-extrabold text-rose-450 font-mono">
                  {changedPercentage ? changedPercentage.toFixed(2) : "--"}%
                </span>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest block">Pixel difference heatmap overlay</span>
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/5] max-h-[500px] mx-auto flex items-center justify-center p-1">
              <canvas
                ref={heatmapCanvasRef}
                className="max-w-full max-h-[480px] rounded object-contain bg-slate-900 border border-slate-850"
              />

              {/* Draw Ignored Dynamic Regions visually on canvas heatmap overlay */}
              {ignoredRegions.map((region, idx) => (
                <div
                  key={`ign-heat-${idx}`}
                  style={{
                    left: `${region.x}%`,
                    top: `${region.y}%`,
                    width: `${region.width}%`,
                    height: `${region.height}%`
                  }}
                  className="absolute border border-dashed border-cyan-400 bg-cyan-400/5 z-25 flex items-center justify-center overflow-hidden"
                  title={`Ignored dynamic content check: ${region.name}`}
                >
                  <span className="text-[7px] font-mono text-cyan-300 font-bold bg-[#090d16]/90 px-1 rounded truncate max-w-[95%]">
                    Ignored Region
                  </span>
                </div>
              ))}
            </div>
            <span className="text-[9px] font-mono text-slate-500 max-w-[420px] mx-auto block leading-normal">
              Note: Bypassing comparison checks on highlighted dynamic layout areas (blue rectangles) representing rotating promotion banners and clock updates.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

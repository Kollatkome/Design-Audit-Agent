"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from "react";
import { PlaywrightCrawlConfig, LogEntry, Level3AuditResponse } from "@/types";
import { 
  Play, Settings, Layers, RefreshCw, 
  Terminal, ChevronRight, History
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CrawledPageMeta {
  url: string;
  slug: string;
  isFirstRun?: boolean;
  approvedVersion: string;
  baselineScreenshot: string;
  currentScreenshot: string;
}

interface VersionEntry {
  versionId: string;
  timestamp: string;
  screenshotPath: string;
  status: "approved" | "pending" | "rolled_back";
}

interface BaselineEntry {
  url: string;
  slug: string;
  approvedVersion: string;
  versions: VersionEntry[];
  current?: {
    timestamp: string;
    screenshotPath: string;
  };
}

interface BaselineMetadata {
  baselines: Record<string, BaselineEntry>;
}

interface CommandCenterProps {
  onSelectPage: (slug: string, baseline: string, current: string) => void;
  onAuditFinished: (results: Level3AuditResponse) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (val: boolean) => void;
}

export function CommandCenter({ onSelectPage, onAuditFinished, isAnalyzing, setIsAnalyzing }: CommandCenterProps) {
  // Config state
  const [targetUrl, setTargetUrl] = useState("https://example.com");
  const [maxPages, setMaxPages] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [noiseSelectors, setNoiseSelectors] = useState("");

  // Running states
  const [isCrawling, setIsCrawling] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagesList, setPagesList] = useState<CrawledPageMeta[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<BaselineMetadata | null>(null);

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch("/api/baseline");
      if (res.ok) {
        const data: BaselineMetadata = await res.json();
        setMetadata(data);
        
        // Populate pages list from metadata
        const list: CrawledPageMeta[] = Object.keys(data.baselines).map(slug => {
          const b = data.baselines[slug];
          return {
            url: b.url,
            slug: b.slug,
            approvedVersion: b.approvedVersion,
            baselineScreenshot: `/baseline-store/${slug}-${b.approvedVersion}.png`,
            currentScreenshot: b.current ? `/baseline-store/${slug}-current.png` : `/baseline-store/${slug}-${b.approvedVersion}.png`
          };
        });
        setPagesList(list);
        
        // Use functional state updater or local list parameter to avoid closure dependency issues
        setSelectedSlug(prev => {
          if (list.length > 0 && !prev) {
            return list[0].slug;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load metadata", err);
    }
  }, []);

  // Load existing baselines from metadata on mount
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

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

  const handleCrawl = async () => {
    if (!targetUrl) return;
    setIsCrawling(true);
    setLogs([]);
    addLog("Initializing Playwright automated runner...", "info");

    const crawlConfig: PlaywrightCrawlConfig = {
      targetUrl,
      maxPages,
      noiseSelectors: noiseSelectors ? noiseSelectors.split(",").map(s => s.trim()) : []
    };

    if (loginUrl && loginUsername && loginPassword) {
      crawlConfig.loginUrl = loginUrl;
      crawlConfig.loginUsername = loginUsername;
      crawlConfig.loginPassword = loginPassword;
      addLog("Injecting user credentials and setting up authentication handler...", "info");
    }

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(crawlConfig)
      });

      if (!res.ok) {
        throw new Error(`Crawl server returned ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        // Add all crawler logs
        if (Array.isArray(data.logs)) {
          data.logs.forEach((l: string) => addLog(l, "info"));
        }
        addLog("Playwright crawl complete! Syncing snapshot store.", "success");
        await fetchMetadata();
      } else {
        throw new Error(data.error || "Crawl failed");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      addLog(`Crawl failed: ${error.message || String(err)}`, "error");
    } finally {
      setIsCrawling(false);
    }
  };

  const handleAuditPage = async (slug: string) => {
    setIsAnalyzing(true);
    addLog(`Running Watchdog regression audit on: /${slug}...`, "loading");
    
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      });

      if (!res.ok) {
        throw new Error(`Audit API returned ${res.status}`);
      }

      const data = await res.json();
      onAuditFinished(data);
      
      const pageInfo = pagesList.find(p => p.slug === slug);
      if (pageInfo) {
        onSelectPage(slug, pageInfo.baselineScreenshot, pageInfo.currentScreenshot);
      }

      const verdict = data.summary?.verdict || "PASS";
      const health = data.summary?.designHealth ?? 100;
      
      if (verdict === "FAIL") {
        addLog(`Watchdog Audit: FAILED Release Gate (Design Health: ${health}%)`, "error");
      } else {
        addLog(`Watchdog Audit: PASSED Release Gate (Design Health: ${health}%)`, "success");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      addLog(`Watchdog Audit failed: ${error.message || String(err)}`, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = async (slug: string) => {
    addLog(`Approving current snapshot for /${slug} as new baseline...`, "info");
    try {
      const res = await fetch("/api/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", slug })
      });

      if (res.ok) {
        const data = await res.json();
        addLog(`Approved: baseline is now version ${data.approvedVersion}`, "success");
        await fetchMetadata();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      addLog(`Approve failed: ${error.message || String(err)}`, "error");
    }
  };

  const handleRollback = async (slug: string, versionId: string) => {
    addLog(`Rolling back /${slug} baseline version to: ${versionId}...`, "info");
    try {
      const res = await fetch("/api/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback", slug, versionId })
      });

      if (res.ok) {
        addLog(`Rollback complete. Baseline restored to version ${versionId}`, "success");
        await fetchMetadata();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Rollback failed");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      addLog(`Rollback failed: ${error.message || String(err)}`, "error");
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
      {/* Configuration & Trigger Column */}
      <div className="xl:col-span-1 space-y-6 flex flex-col justify-between glass p-6 rounded-2xl border border-white/10">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
              <Settings className="w-4.5 h-4.5 mr-2 text-primary-400" /> Crawler Settings
            </h3>
            <span className="text-[10px] text-primary-400 font-mono font-bold">Playwright Engine</span>
          </div>

          <div className="space-y-3">
            {/* Target URL */}
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider font-semibold block mb-1">Target Base URL</label>
              <input 
                type="text" 
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary-500/50"
              />
            </div>

            {/* Max Pages */}
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider font-semibold block mb-1">Max Crawl Pages</label>
              <select
                value={maxPages}
                onChange={e => setMaxPages(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary-500/50"
              >
                <option value={1} className="bg-slate-900">1 Page (Current URL only)</option>
                <option value={3} className="bg-slate-900">3 Pages (Expanded Crawl)</option>
                <option value={5} className="bg-slate-900">5 Pages (Deep Crawler)</option>
              </select>
            </div>

            {/* Advanced Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[10px] text-primary-400 font-bold flex items-center hover:text-primary-350 transition-colors bg-transparent border-0 cursor-pointer"
            >
              <ChevronRight className={cn("w-3.5 h-3.5 mr-1 transition-transform", showAdvanced && "rotate-90")} />
              {showAdvanced ? "Hide Advanced Config" : "Show Advanced Config (Auth & Noise)"}
            </button>

            {/* Advanced settings */}
            {showAdvanced && (
              <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-300">
                {/* Login URL */}
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block mb-1">Autonomous Login URL</label>
                  <input 
                    type="text" 
                    value={loginUrl}
                    onChange={e => setLoginUrl(e.target.value)}
                    placeholder="https://example.com/login"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block mb-1">Username / Email</label>
                    <input 
                      type="text" 
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder="admin@test.com"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block mb-1">Password</label>
                    <input 
                      type="password" 
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary-500/50"
                    />
                  </div>
                </div>

                {/* Noise Filters */}
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block mb-1">
                    Custom Noise Selectors (CSS, comma separated)
                  </label>
                  <input 
                    type="text" 
                    value={noiseSelectors}
                    onChange={e => setNoiseSelectors(e.target.value)}
                    placeholder=".rotating-ads, #realtime-clock"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary-500/50 font-mono"
                  />
                  <span className="text-[9px] text-white/30 block mt-1 leading-normal">
                    Note: spinners, ads, clocks, and rotating badges are filtered autonomously by default.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleCrawl}
          disabled={isCrawling || !targetUrl}
          className="w-full mt-6 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20"
        >
          {isCrawling ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Crawling with Playwright...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Trigger Autonomous Crawl
            </>
          )}
        </button>
      </div>

      {/* Version Store / Baseline Registry Column */}
      <div className="xl:col-span-1 glass p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
              <Layers className="w-4.5 h-4.5 mr-2 text-purple-400" /> Baseline Snapshot Registry
            </h3>
            <span className="text-[10px] text-purple-400 font-mono font-bold">Version Store</span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {pagesList.length === 0 ? (
              <div className="p-8 text-center text-white/30 italic text-xs leading-normal">
                No screenshot baselines registered yet.<br />Enter target URL and run first crawl to establish baseline snapshots.
              </div>
            ) : (
              pagesList.map((p) => {
                const isSelected = selectedSlug === p.slug;
                const baselineData = metadata?.baselines[p.slug];
                const lastApproved = p.approvedVersion;

                return (
                  <div 
                    key={p.slug}
                    onClick={() => setSelectedSlug(p.slug)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-2",
                      isSelected 
                        ? "bg-primary-950/20 border-primary-500/50 shadow-[0_0_10px_rgba(37,99,235,0.05)]" 
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">/{p.slug}</span>
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold border border-purple-500/30 uppercase">
                        Baseline: {lastApproved}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/50">
                      <span className="truncate max-w-[170px]">{p.url}</span>
                      <span className="text-green-400 font-bold block">
                        {baselineData?.current ? "Run Loaded" : "Baseline Only"}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 animate-in fade-in duration-300">
                        {/* Audit check button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAuditPage(p.slug);
                          }}
                          disabled={isAnalyzing || !baselineData?.current}
                          className="flex-1 py-1 px-2 bg-primary-600 hover:bg-primary-550 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold rounded-lg text-white transition-colors cursor-pointer text-center"
                        >
                          Audit Diff
                        </button>

                        {/* Approve Current button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(p.slug);
                          }}
                          disabled={!baselineData?.current}
                          className="py-1 px-2 bg-green-600 hover:bg-green-550 disabled:opacity-40 text-[10px] font-bold rounded-lg text-white transition-colors cursor-pointer text-center"
                        >
                          Approve ({`v${parseInt(lastApproved.replace('v','')) + 1 || 2}`})
                        </button>

                        {/* Rollback history toggle/dropdown */}
                        {baselineData && baselineData.versions && baselineData.versions.length > 1 && (
                          <select
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.value) {
                                handleRollback(p.slug, e.target.value);
                              }
                            }}
                            value={lastApproved}
                            className="py-1 px-1.5 bg-white/5 border border-white/10 text-[10px] text-white rounded-lg cursor-pointer focus:outline-none"
                          >
                            {baselineData.versions.map((v: VersionEntry) => (
                              <option key={v.versionId} value={v.versionId} className="bg-slate-900 text-[10px]">
                                Rollback: {v.versionId}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 text-[10px] text-white/40 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-primary-400" />
          <span>Active Baselines are versioned inside baseline-store directory.</span>
        </div>
      </div>

      {/* Live Logs / Console Output Column */}
      <div className="xl:col-span-1 glass p-6 rounded-2xl border border-white/10 flex flex-col h-[340px] xl:h-auto overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
            <Terminal className="w-4.5 h-4.5 mr-2 text-green-400 animate-pulse" /> Live Execution Logs
          </h3>
          <span className="text-[10px] text-green-400 font-mono font-bold bg-green-950/20 border border-green-500/20 px-2 py-0.5 rounded">
            Observability Panel
          </span>
        </div>

        {/* Console Box */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2 font-mono text-[10px] leading-relaxed custom-scrollbar bg-black/40 p-4 rounded-xl border border-white/5">
          {logs.length === 0 ? (
            <div className="text-white/20 italic">Console output idle. Trigger a crawl to start watching the automated process output...</div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id}
                className={cn(
                  "flex items-start gap-1.5",
                  log.status === "success" && "text-green-400",
                  log.status === "warning" && "text-yellow-400",
                  log.status === "error" && "text-red-400",
                  log.status === "loading" && "text-primary-400",
                  log.status === "info" && "text-white/70"
                )}
              >
                <span className="text-white/20">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
                {log.status === "loading" && <RefreshCw className="w-3 h-3 animate-spin mt-0.5 flex-shrink-0" />}
                <p className="flex-1 whitespace-pre-wrap">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

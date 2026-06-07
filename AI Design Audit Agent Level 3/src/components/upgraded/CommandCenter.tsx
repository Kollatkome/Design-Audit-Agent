"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from "react";
import { LogEntry, Level3AuditResponse } from "@/types";
import { 
  Play, Settings, Layers, RefreshCw, 
  Terminal, ChevronRight, History, Calendar, ListOrdered, ClipboardList, Ban
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

interface Job {
  id: string;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  timestamp: string;
  type: string;
}

interface AuditTrail {
  slug: string;
  action: string;
  timestamp: string;
  author: string;
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

  // Cron Scheduler configuration states
  const [enableScheduler, setEnableScheduler] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState("daily");
  const [customCron, setCustomCron] = useState("0 0 * * *");

  // Tabbed view coordinates
  const [col2Tab, setCol2Tab] = useState<"registry" | "history">("registry");
  const [col3Tab, setCol3Tab] = useState<"logs" | "jobs">("logs");

  // Simulated live job queue orchestration
  const [jobs, setJobs] = useState<Job[]>([
    { id: "J-101", url: "https://example.com/dashboard", status: "completed", timestamp: "16:15", type: "Manual Trigger" },
    { id: "J-102", url: "https://example.com/settings", status: "failed", timestamp: "16:02", type: "CI Commit Check" },
    { id: "J-103", url: "https://example.com/billing", status: "queued", timestamp: "Pending", type: "Cron Schedule" }
  ]);

  // Simulated version registry audit trail logs
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([
    { slug: "home", action: "Approved Baseline v2", timestamp: "2026-06-07 14:32", author: "Developer Lead" },
    { slug: "pricing", action: "Approved Baseline v1", timestamp: "2026-06-07 11:20", author: "Automated System" },
    { slug: "home", action: "Rolled back to v1", timestamp: "2026-06-07 09:15", author: "QA Watchdog" }
  ]);

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
    setCol3Tab("jobs"); // Transition to job orchestration queue view
    
    const jobId = `J-${Math.floor(100 + Math.random() * 900)}`;
    const newJob: Job = {
      id: jobId,
      url: targetUrl,
      status: "running",
      timestamp: "Active",
      type: "Manual Trigger"
    };
    
    setJobs(prev => [newJob, ...prev]);
    addLog(`Job ${jobId} initialized: Crawling ${targetUrl}`, "info");

    const crawlConfig = {
      targetUrl,
      maxPages,
      noiseSelectors: noiseSelectors ? noiseSelectors.split(",").map(s => s.trim()) : [],
      loginUrl: loginUrl || undefined,
      loginUsername: loginUsername || undefined,
      loginPassword: loginPassword || undefined
    };

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
        if (Array.isArray(data.logs)) {
          data.logs.forEach((l: string) => addLog(l, "info"));
        }
        addLog(`Job ${jobId} complete! Parity baseline screenshots synchronized successfully.`, "success");
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "completed" } : j));
        await fetchMetadata();
      } else {
        throw new Error(data.error || "Crawl failed");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      addLog(`Job ${jobId} crawler failure: ${error.message || String(err)}`, "error");
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "failed" } : j));
    } finally {
      setIsCrawling(false);
    }
  };

  const handleAuditPage = async (slug: string) => {
    setIsAnalyzing(true);
    addLog(`Running Watchdog regression audit on: /${slug}...`, "loading");
    
    try {
      const res = await fetch("/api/upgraded-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      });

      if (!res.ok) {
        throw new Error(`Audit API returned ${res.status}`);
      }

      const data: Level3AuditResponse = await res.json();
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
        const verStr = `v${data.approvedVersion}`;
        addLog(`Approved: baseline is now version ${data.approvedVersion}`, "success");
        
        // Add record to audit trail logs
        const newTrail: AuditTrail = {
          slug,
          action: `Approved Baseline ${verStr}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          author: "Developer (GUI)"
        };
        setAuditTrails(prev => [newTrail, ...prev]);
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
        
        // Add rollback trail
        const newTrail: AuditTrail = {
          slug,
          action: `Rolled back to ${versionId}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          author: "Developer (GUI)"
        };
        setAuditTrails(prev => [newTrail, ...prev]);
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

  const cancelJob = (id: string) => {
    addLog(`Job ${id} cancelled by operator command.`, "warning");
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "failed", timestamp: "Cancelled" } : j));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
      {/* Configuration & Trigger Column */}
      <div className="xl:col-span-1 space-y-6 flex flex-col justify-between glass p-6 rounded-2xl border border-slate-800/80 bg-slate-950/45">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center font-mono">
              <Settings className="w-4 h-4 mr-2 text-cyan-400" /> Crawler Settings
            </h3>
            <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wide">Playwright Engine</span>
          </div>

          <div className="space-y-3.5">
            {/* Target URL */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Target Base URL</label>
              <input 
                type="text" 
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-white placeholder-slate-550 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Max Pages */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Max Crawl Pages</label>
              <select
                value={maxPages}
                onChange={e => setMaxPages(parseInt(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value={1} className="bg-slate-955">1 Page (Current URL only)</option>
                <option value={3} className="bg-slate-955">3 Pages (Expanded Crawl)</option>
                <option value={5} className="bg-slate-955">5 Pages (Deep Crawler)</option>
              </select>
            </div>

            {/* Advanced Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[10px] text-cyan-400 font-bold flex items-center hover:text-cyan-300 transition-colors bg-transparent border-0 cursor-pointer p-0"
            >
              <ChevronRight className={cn("w-3.5 h-3.5 mr-1 transition-transform", showAdvanced && "rotate-90")} />
              {showAdvanced ? "Hide Advanced Config" : "Show Advanced Config (Auth & Noise)"}
            </button>

            {/* Advanced settings */}
            {showAdvanced && (
              <div className="space-y-3 pt-3.5 border-t border-slate-850 animate-in fade-in duration-200">
                {/* Login URL */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Autonomous Login URL</label>
                  <input 
                    type="text" 
                    value={loginUrl}
                    onChange={e => setLoginUrl(e.target.value)}
                    placeholder="https://example.com/login"
                    className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-white placeholder-slate-550 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Username / Email</label>
                    <input 
                      type="text" 
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      placeholder="admin@test.com"
                      className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-white placeholder-slate-550 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Password</label>
                    <input 
                      type="password" 
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-white placeholder-slate-550 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>

                {/* Noise Filters */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                    Custom Noise Selectors (CSS, comma separated)
                  </label>
                  <input 
                    type="text" 
                    value={noiseSelectors}
                    onChange={e => setNoiseSelectors(e.target.value)}
                    placeholder=".rotating-ads, #realtime-clock"
                    className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-white placeholder-slate-550 focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                  <span className="text-[9px] text-slate-500 block mt-1 leading-normal">
                    Note: spinners, ads, clocks, and rotating badges are filtered autonomously by default.
                  </span>
                </div>
              </div>
            )}

            {/* Scheduled Scans Configurations */}
            <div className="pt-4 border-t border-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-200 uppercase tracking-wider font-mono font-bold flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400 mr-1.5" /> Enable Scheduled Scans
                </label>
                <input 
                  type="checkbox" 
                  checked={enableScheduler} 
                  onChange={(e) => {
                    setEnableScheduler(e.target.checked);
                    if (e.target.checked) {
                      addLog("Watchdog Cron scheduler enabled.", "info");
                    } else {
                      addLog("Watchdog Cron scheduler disabled.", "warning");
                    }
                  }}
                  className="accent-cyan-500 w-4 h-4 cursor-pointer"
                />
              </div>

              {enableScheduler && (
                <div className="space-y-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-855 animate-in fade-in duration-200">
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Scan Interval</label>
                    <select
                      value={scheduleInterval}
                      onChange={(e) => setScheduleInterval(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-850 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="hourly">Every Hour (*/60 * * * *)</option>
                      <option value="daily">Daily at Midnight (0 0 * * *)</option>
                      <option value="weekly">Weekly on Sunday (0 0 * * 0)</option>
                      <option value="custom">Custom Cron Expression</option>
                    </select>
                  </div>

                  {scheduleInterval === "custom" && (
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Cron Expression</label>
                      <input
                        type="text"
                        value={customCron}
                        onChange={(e) => setCustomCron(e.target.value)}
                        placeholder="*/15 * * * *"
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-850 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                      />
                    </div>
                  )}

                  <span className="text-[9px] text-cyan-400 font-mono block">
                    Next run: {scheduleInterval === "hourly" ? "Today, 17:00" : "Tomorrow, 00:00"} (Simulated)
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>

        <button
          onClick={handleCrawl}
          disabled={isCrawling || !targetUrl}
          className="w-full mt-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)] border-0"
        >
          {isCrawling ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Crawling with Playwright...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-cyan-200" />
              Trigger Autonomous Crawl
            </>
          )}
        </button>
      </div>

      {/* Version Store / Baseline Registry Column */}
      <div className="xl:col-span-1 glass p-6 rounded-2xl border border-slate-800/80 bg-slate-950/45 flex flex-col justify-between">
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Section Header with Tabs */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 flex-shrink-0">
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 text-[10px]">
              <button
                onClick={() => setCol2Tab("registry")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1",
                  col2Tab === "registry" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
                )}
              >
                <Layers className="w-3 h-3" /> Baseline Registry
              </button>
              <button
                onClick={() => setCol2Tab("history")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1",
                  col2Tab === "history" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
                )}
              >
                <ClipboardList className="w-3 h-3" /> Audit Trail
              </button>
            </div>
            <span className="text-[10px] text-purple-400 font-mono font-bold uppercase tracking-wide">Version Store</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[350px] pr-1 custom-scrollbar mt-3 space-y-2">
            {col2Tab === "registry" ? (
              pagesList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 italic text-xs leading-normal">
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
                        "p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-2 select-none",
                        isSelected 
                          ? "bg-slate-900/40 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.05)]" 
                          : "bg-slate-950/40 border-slate-850 hover:border-slate-800"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white font-mono">/{p.slug}</span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-450 text-[9px] font-bold border border-purple-500/20 uppercase tracking-wide">
                          Baseline: {lastApproved}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="truncate max-w-[150px]">{p.url}</span>
                        <span className="text-emerald-400 font-bold block">
                          {baselineData?.current ? "Run Loaded" : "Baseline Only"}
                        </span>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-850 animate-in fade-in duration-200">
                          {/* Audit check button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAuditPage(p.slug);
                            }}
                            disabled={isAnalyzing || !baselineData?.current}
                            className="flex-1 py-1 px-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold rounded-lg text-white transition-colors cursor-pointer text-center border-0"
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
                            className="py-1 px-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] font-bold rounded-lg text-white transition-colors cursor-pointer text-center border-0"
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
                              className="py-1 px-1 bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded-lg cursor-pointer focus:outline-none"
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
              )
            ) : (
              /* Render Version History / Audit Trail list logs */
              <div className="space-y-2">
                {auditTrails.map((trail, index) => (
                  <div key={index} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl text-left text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-cyan-400">/{trail.slug}</span>
                      <span className="text-slate-500 text-[9px]">{trail.timestamp}</span>
                    </div>
                    <p className="text-slate-200 font-semibold">{trail.action}</p>
                    <span className="text-[9px] text-slate-500 block">Operator: {trail.author}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-850 text-[10px] text-slate-500 flex items-center gap-1.5 font-mono">
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span>Active Baselines versioned under public baseline storage.</span>
        </div>
      </div>

      {/* Live Logs / Console Output Column */}
      <div className="xl:col-span-1 glass p-6 rounded-2xl border border-slate-800/80 bg-slate-950/45 flex flex-col h-[360px] xl:h-auto overflow-hidden">
        {/* Tab switcher for Live Logs / Jobs queue */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-3 flex-shrink-0">
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 text-[10px]">
            <button
              onClick={() => setCol3Tab("logs")}
              className={cn(
                "px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1",
                col3Tab === "logs" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
              )}
            >
              <Terminal className="w-3 h-3 text-emerald-450" /> Live Logs
            </button>
            <button
              onClick={() => setCol3Tab("jobs")}
              className={cn(
                "px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1",
                col3Tab === "jobs" ? "bg-slate-900 text-cyan-400 border border-slate-800" : "text-slate-450 hover:text-slate-200"
              )}
            >
              <ListOrdered className="w-3 h-3" /> Job Queue
            </button>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/10 border border-emerald-550/20 px-2 py-0.5 rounded">
            Observability Panel
          </span>
        </div>

        {/* Tab contents */}
        <div className="flex-1 overflow-y-auto mt-4 custom-scrollbar">
          {col3Tab === "logs" ? (
            /* Console log trace */
            <div className="space-y-2 font-mono text-[10px] leading-relaxed bg-slate-950/80 p-4 rounded-xl border border-slate-850 min-h-[180px]">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Console output idle. Trigger a crawl to start watching the automated process output...</div>
              ) : (
                logs.map((log) => (
                  <div 
                    key={log.id}
                    className={cn(
                      "flex items-start gap-1.5",
                      log.status === "success" && "text-emerald-400",
                      log.status === "warning" && "text-amber-400",
                      log.status === "error" && "text-rose-400",
                      log.status === "loading" && "text-cyan-400",
                      log.status === "info" && "text-slate-350"
                    )}
                  >
                    <span className="text-slate-600 select-none">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
                    {log.status === "loading" && <RefreshCw className="w-3 h-3 animate-spin mt-0.5 flex-shrink-0" />}
                    <p className="flex-1 whitespace-pre-wrap">{log.message}</p>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Live Job queue board list */
            <div className="space-y-2.5">
              {jobs.map((job) => (
                <div key={job.id} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl text-left text-[11px] space-y-1.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white">{job.id} ({job.type})</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider font-mono",
                      job.status === "completed" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      job.status === "failed" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
                      job.status === "running" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse",
                      job.status === "queued" && "bg-slate-800/40 text-slate-400 border-slate-800"
                    )}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-slate-400 font-mono text-[10px] truncate max-w-[90%]">{job.url}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900/60 mt-2">
                    <span className="text-[9px] text-slate-500">Scheduled: {job.timestamp}</span>
                    {job.status === "running" && (
                      <button
                        onClick={() => cancelJob(job.id)}
                        className="py-0.5 px-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded text-[9px] text-rose-400 font-bold transition-all flex items-center gap-0.5 cursor-pointer"
                      >
                        <Ban className="w-2.5 h-2.5" /> Abort
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

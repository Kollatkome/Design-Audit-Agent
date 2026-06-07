"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface CopilotChatProps {
  results: {
    summary: {
      totalIssues: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    findings: {
      id: string;
      category: string;
      severity: string;
      location: string;
      coordinates: { x: number; y: number; width: number; height: number };
      evidence: string;
      recommendation: string;
      confidenceScore: number;
    }[];
    timestamp: string;
  } | null;
}

export function CopilotChat({ results }: CopilotChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (results) {
      return [
        {
          id: "welcome",
          role: "assistant",
          content: "Hi! I am your Design Copilot. I have analyzed your baseline mockup and current implementation screenshots. Ask me questions like:\n- \"Why is there an alignment shift regression?\"\n- \"What are the contrast ratios of the failing elements?\"\n- \"How can I fix the typography size discrepancies?\"",
          timestamp: new Date()
        }
      ];
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !results || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const chatHistory = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          results
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API returned ${response.status}`);
      }

      const data = await response.json();
      const botMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: data.reply,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || "Failed to connect to Design Copilot.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!results) {
    return (
      <div className="glass rounded-2xl border border-slate-800/80 p-6 flex flex-col items-center justify-center text-center h-[500px] bg-slate-950/40">
        <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
        <h3 className="text-slate-400 font-semibold text-sm">Design Copilot Offline</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-[200px]">
          Upload screenshots and run comparative analysis to activate chat.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-slate-800/80 flex flex-col h-[550px] overflow-hidden bg-slate-950/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-cyan-400" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Design Copilot</span>
            <span className="text-[10px] text-emerald-400 font-medium block">Active context loaded</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/60">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
              m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div
              className={cn(
                "p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line border",
                m.role === 'user'
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-500/20 text-white rounded-br-none"
                  : "bg-slate-900/80 border-slate-800 text-slate-100 rounded-bl-none"
              )}
            >
              {m.content}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 font-mono">
              {m.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl rounded-bl-none max-w-[85px] mr-auto">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800/80 bg-slate-900/40 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Ask Copilot about regressions..."
          className="flex-1 px-4 py-2 bg-slate-950/80 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50 placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center border-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";

const SUGGESTED = [
  "Why did Tesla receive $232M from Transport Canada in 2024?",
  "What is the lineage of the National Trade Corridors Fund in 2024?",
  "Show me the iZEV program signals for 2023.",
  "Which TC programs have a missing Throne link?",
];

type AnyPart = { type: string; text?: string; [k: string]: unknown };

function renderText(parts: AnyPart[] | undefined, fallback: string | undefined): string {
  if (parts && parts.length) {
    return parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
  }
  return fallback ?? "";
}

export function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, status, sendMessage, error } = useChat({
    onError: (e) => console.error("[useChat]", e),
  });
  const busy = status === "streaming" || status === "submitted";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  const onSuggested = (s: string) => {
    if (busy) return;
    sendMessage({ text: s });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
      >
        Ask the agent <span className="mono text-zinc-500 ml-1">⌘K</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 h-screen w-screen flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 h-screen w-screen bg-black/50 backdrop-blur-sm" />
          <aside
            className="relative w-full sm:w-[480px] h-screen bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-3.5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold">Policy Agent</div>
                <div className="text-[11px] text-zinc-500">Cited answers · Throne → Budget → Estimates → Disbursement</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
                aria-label="Close"
              >✕</button>
            </header>

            <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-3">
              {messages.length === 0 && (
                <div>
                  <div className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider">Try a canary</div>
                  <div className="space-y-1.5">
                    {SUGGESTED.map((s) => (
                      <button
                        key={s}
                        onClick={() => onSuggested(s)}
                        className="block w-full text-left text-sm px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                const parts = (m as unknown as { parts?: AnyPart[] }).parts ?? [];
                const fallbackContent = (m as unknown as { content?: string }).content;
                const text = renderText(parts, fallbackContent);
                const toolParts = parts.filter((p) =>
                  typeof p.type === "string" && (p.type.startsWith("tool-") || p.type === "dynamic-tool"),
                );
                return (
                  <div
                    key={m.id}
                    className={`rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap border ${m.role === "user" ? "bg-blue-500/10 border-blue-500/20" : "bg-zinc-900 border-zinc-800"}`}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      {m.role === "user" ? "You" : "Agent"}
                    </div>
                    {text || (
                      <span className="text-zinc-500 italic">
                        (no text — {parts.length} part{parts.length === 1 ? "" : "s"}: {parts.map((p) => p.type).join(", ") || "—"})
                      </span>
                    )}
                    {toolParts.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-zinc-500 cursor-pointer">
                          Tool calls ({toolParts.length})
                        </summary>
                        <pre className="text-[10px] text-zinc-500 overflow-x-auto mt-1.5 mono">
                          {toolParts
                            .map((p) => `${p.type}\n${JSON.stringify(p, null, 2).slice(0, 600)}…`)
                            .join("\n\n")}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}

              {busy && <div className="text-xs text-zinc-500">thinking… ({status})</div>}
              {error && (
                <div className="rounded-lg p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
                  <strong>Stream error:</strong> {error.message}
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="p-4 border-t border-zinc-800 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a TC program-year…"
                className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:border-blue-500/60 placeholder:text-zinc-600"
                autoFocus
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="px-3 py-2 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? "…" : "Send"}
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

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

export default function Page() {
  const [input, setInput] = useState("");
  const { messages, status, sendMessage, error } = useChat({
    onError: (e) => {
      // surface in console too
      console.error("[useChat]", e);
    },
  });
  const busy = status === "streaming" || status === "submitted";

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
    <main
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 20px 120px",
        color: "#1a1a1a",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Policy Misalignment Agent — Transport Canada
        </h1>
        <p style={{ marginTop: 6, color: "#555", fontSize: 14 }}>
          Throne Speech → Budget → Estimates → Disbursement. Every numeric claim cites a tool
          result by [id].
        </p>
      </header>

      {messages.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
            Try a canary question:
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggested(s)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: "#fafafa",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: m.role === "user" ? "#f4f7ff" : "#fff",
                fontSize: 14,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#888",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {m.role === "user" ? "You" : "Agent"}
              </div>
              {text || (
                <span style={{ color: "#aaa", fontStyle: "italic" }}>
                  (no text part — {parts.length} part{parts.length === 1 ? "" : "s"}: {parts.map((p) => p.type).join(", ") || "—"})
                </span>
              )}
              {toolParts.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 11, color: "#888", cursor: "pointer" }}>
                    Tool calls ({toolParts.length})
                  </summary>
                  <pre style={{ fontSize: 11, color: "#666", overflow: "auto", marginTop: 6 }}>
                    {toolParts
                      .map((p) => `${p.type}\n${JSON.stringify(p, null, 2).slice(0, 800)}…`)
                      .join("\n\n")}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
        {busy && (
          <div style={{ fontSize: 12, color: "#888", padding: "8px 14px" }}>
            thinking… (status: {status})
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #f4a8a8",
              background: "#fff5f5",
              color: "#8a1f1f",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            <strong>Stream error:</strong> {error.message}
          </div>
        )}
        {messages.length > 0 && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 11, color: "#aaa", cursor: "pointer" }}>
              debug · raw messages ({messages.length})
            </summary>
            <pre style={{ fontSize: 10, color: "#666", overflow: "auto", maxHeight: 320 }}>
              {JSON.stringify(messages, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          background: "linear-gradient(to top, #fff 70%, transparent)",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a TC program-year…"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #2d3a8c",
              background: "#2d3a8c",
              color: "#fff",
              fontSize: 14,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </form>
    </main>
  );
}

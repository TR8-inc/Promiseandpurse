"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TransactionRow } from "../../pipelines/07_agent/data";
import { formatCAD } from "../lib/format";

const PROGRAMS = [
  "izev", "ntcf", "ferry", "rstpp", "acip",
  "rprp", "acap", "rsip", "ppccw", "cpfp",
];
const FYS = [2022, 2023, 2024];
const PAGE = 50;

export function TransactionTable() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const initialProgram = params.get("program") ?? "";
  const initialFy = params.get("fy") ?? "";
  const selectedDisbId = params.get("disb_id");

  const [q, setQ] = useState(initialQ);
  const [program, setProgram] = useState(initialProgram);
  const [fy, setFy] = useState(initialFy);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        if (q) sp.set("q", q);
        if (program) sp.set("program", program);
        if (fy) sp.set("fy", fy);
        sp.set("limit", String(PAGE));
        sp.set("offset", String(offset));
        const res = await fetch(`/api/transactions?${sp.toString()}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, program, fy, offset]);

  const selectRow = (r: TransactionRow) => {
    if (!r.program_id) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("disb_id", r.id);
    sp.set("program", r.program_id);
    sp.set("fy", String(r.fy));
    sp.set("tab", "transactions");
    if (q) sp.set("q", q); else sp.delete("q");
    router.push(`/?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }}
          placeholder="Search recipient name…"
          className="flex-1 min-w-[220px] px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:border-blue-500/60 placeholder:text-zinc-600"
        />
        <select
          value={program}
          onChange={(e) => { setProgram(e.target.value); setOffset(0); }}
          className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:border-blue-500/60"
        >
          <option value="">All programs</option>
          {PROGRAMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
        </select>
        <select
          value={fy}
          onChange={(e) => { setFy(e.target.value); setOffset(0); }}
          className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:border-blue-500/60"
        >
          <option value="">All years</option>
          {FYS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[1.6fr_60px_60px_100px_120px] gap-3 px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-500 bg-zinc-900/80 border-b border-zinc-800">
          <span>Recipient</span>
          <span>Prog</span>
          <span>FY</span>
          <span className="text-right">Amount</span>
          <span>Started</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto scroll-thin">
          {loading && rows.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">Loading…</div>
          )}
          {error && (
            <div className="px-3 py-4 text-sm text-rose-400">Error: {error}</div>
          )}
          {!loading && rows.length === 0 && !error && (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">No transactions match.</div>
          )}
          {rows.map((r) => {
            const isSelected = r.id === selectedDisbId;
            return (
              <button
                key={r.id}
                onClick={() => selectRow(r)}
                className={`w-full grid grid-cols-[1.6fr_60px_60px_100px_120px] gap-3 px-3 py-2 text-sm text-left border-b border-zinc-900 hover:bg-zinc-800/50 transition-colors ${isSelected ? "bg-blue-500/10 border-blue-500/30" : ""}`}
              >
                <span className="text-zinc-200 truncate" title={r.recipient}>{r.recipient}</span>
                <span className="text-zinc-400 mono text-xs uppercase">{r.program_short ?? "—"}</span>
                <span className="text-zinc-500 mono text-xs">{r.fy}</span>
                <span className="text-zinc-300 mono text-right">{formatCAD(r.amount_cad)}</span>
                <span className="text-zinc-500 mono text-xs">{r.start_date ?? "—"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-zinc-500">
        <span>
          {total === 0 ? "0 results" : `${offset + 1}–${Math.min(offset + rows.length, total)} of ${total.toLocaleString()}`}
          {loading && rows.length > 0 && <span className="ml-2 text-zinc-600">refreshing…</span>}
        </span>
        <div className="flex gap-1">
          <button
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← prev
          </button>
          <button
            disabled={offset + rows.length >= total || loading}
            onClick={() => setOffset(offset + PAGE)}
            className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            next →
          </button>
        </div>
      </div>
    </div>
  );
}

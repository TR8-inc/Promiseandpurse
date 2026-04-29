import type { CompanyTrace } from "../../pipelines/07_agent/data";
import { TraceCard } from "./TraceCard";
import { formatCAD, formatCADExact } from "../lib/format";

export function CompanyTraceCard({ trace }: { trace: CompanyTrace }) {
  if (!trace.found) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400">
        No disbursements found for <span className="mono">{trace.recipient}</span>.
      </div>
    );
  }

  const distinctPrograms = new Set(trace.programs.map((p) => p.program_id));
  const yearLabel =
    trace.fy_min === trace.fy_max
      ? `FY ${trace.fy_min}`
      : `FY ${trace.fy_min}–${trace.fy_max}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Company trace</div>
        <h2 className="text-2xl font-semibold text-zinc-100 break-words leading-tight">
          {trace.recipient}
        </h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Total received" value={formatCADExact(trace.total_cad)} mono />
          <Stat label="Agreements" value={trace.agreement_count.toString()} />
          <Stat label="Programs" value={`${distinctPrograms.size}`} />
          <Stat label="Years" value={yearLabel} mono />
        </div>
        {trace.programs.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {trace.programs.map((p) => (
              <span key={`${p.program_id}-${p.fy}`} className="text-[11px] mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                {p.short_name} · {p.fy} · {formatCAD(p.total_cad)}
              </span>
            ))}
          </div>
        )}
      </div>

      {trace.programs.map((p) => (
        <TraceCard
          key={`${p.program_id}-${p.fy}`}
          lineage={p.lineage}
          topRow={{
            kind: "company",
            data: {
              recipient: trace.recipient,
              total: p.total_cad,
              count: p.agreement_count,
            },
          }}
        />
      ))}

      {trace.agreements.length > 0 && (
        <details className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <summary className="cursor-pointer px-5 py-3 text-sm text-zinc-300 hover:bg-zinc-800/40 select-none">
            All {trace.agreement_count} agreement{trace.agreement_count === 1 ? "" : "s"} for this company
          </summary>
          <div className="border-t border-zinc-800">
            <div className="grid grid-cols-[1fr_60px_60px_120px_140px] gap-3 px-5 py-2 text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
              <span>Ref</span>
              <span>Prog</span>
              <span>FY</span>
              <span className="text-right">Amount</span>
              <span>Started</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto scroll-thin">
              {trace.agreements.map((a) => (
                <div key={a.id} className="grid grid-cols-[1fr_60px_60px_120px_140px] gap-3 px-5 py-1.5 text-xs border-b border-zinc-900">
                  <span className="text-zinc-400 mono truncate" title={a.ref_number ?? a.id}>{a.ref_number ?? a.id}</span>
                  <span className="text-zinc-400 mono uppercase">{a.program_short ?? "—"}</span>
                  <span className="text-zinc-500 mono">{a.fy}</span>
                  <span className="text-zinc-200 mono text-right">{formatCAD(a.amount_cad)}</span>
                  <span className="text-zinc-500 mono">{a.start_date ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`text-lg font-medium text-zinc-100 mt-0.5 ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}

import type { SignalsResult } from "../../pipelines/07_agent/tools";
import { formatCAD, s2Color } from "../lib/format";

export function SignalsPanel({ signals }: { signals: SignalsResult | null }) {
  if (!signals || !signals.found) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Signals</div>
        <div className="text-sm text-zinc-500">No signals available.</div>
      </div>
    );
  }

  const s2 = signals.s2_magnitude_ratio;
  const disb = signals.disbursement_total_cad;
  const est = signals.estimates_total_cad;
  const max = Math.max(disb, est, 1);
  const disbPct = (disb / max) * 100;
  const estPct = (est / max) * 100;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Signals</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase text-zinc-500 tracking-wider">S1 · Lineage</div>
            <div className={`text-base font-medium mt-1 ${signals.s1_lineage_break ? "text-rose-400" : "text-emerald-400"}`}>
              {signals.s1_lineage_break ? "BREAK" : "FULL"}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{signals.lineage_status}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-zinc-500 tracking-wider">S2 · Magnitude</div>
            <div className={`text-base font-medium mono mt-1 ${s2Color(s2)}`}>
              {s2 == null ? "—" : `${s2.toFixed(2)}×`}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {s2 == null ? "no comparable est." : s2 > 1.15 ? "over plan" : s2 < 0.85 ? "under plan" : "near plan"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Disbursed vs Estimated</div>
        <div className="space-y-2">
          <Bar label="Disbursed" value={formatCAD(disb)} pct={disbPct} color="bg-yellow-500/70" />
          <Bar label="Estimated" value={formatCAD(est)} pct={estPct} color="bg-emerald-500/70" />
        </div>
        <div className="text-xs text-zinc-600 mt-3 mono">{signals.evidence_summary}</div>
      </div>
    </div>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300 mono">{value}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

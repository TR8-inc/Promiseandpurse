import Link from "next/link";
import type { DisbursementsResult } from "../../pipelines/07_agent/tools";
import { formatCAD } from "../lib/format";

export function RecipientsTable({
  disbursements,
  programId,
  fy,
}: {
  disbursements: DisbursementsResult;
  programId: string;
  fy: number;
}) {
  const max = Math.max(...disbursements.top_recipients.map((r) => r.total_cad), 1);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-800 flex justify-between items-center">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Top recipients</div>
          <div className="text-sm text-zinc-300 mt-0.5">{disbursements.agreement_count} agreements · {formatCAD(disbursements.calendar_year_total_cad)}</div>
        </div>
      </div>
      <div className="divide-y divide-zinc-800/70">
        {disbursements.top_recipients.length === 0 && (
          <div className="px-5 py-6 text-sm text-zinc-500">No disbursements for this program-year.</div>
        )}
        {disbursements.top_recipients.map((r) => {
          const pct = (r.total_cad / max) * 100;
          const url = `/?recipient=${encodeURIComponent(r.recipient)}`;
          return (
            <Link
              key={r.recipient}
              href={url}
              className="block px-5 py-3 hover:bg-zinc-800/40 transition-colors group"
            >
              <div className="flex justify-between items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-200 truncate group-hover:text-zinc-100">{r.recipient}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{r.n} agreement{r.n === 1 ? "" : "s"}</div>
                </div>
                <div className="text-sm mono text-zinc-300 shrink-0">{formatCAD(r.total_cad)}</div>
              </div>
              <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500/60 group-hover:bg-yellow-500/80 transition-colors" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

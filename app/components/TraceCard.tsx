import type { LineageResult } from "../../pipelines/07_agent/tools";
import { formatCADExact, formatCAD } from "../lib/format";

type TransactionFlavor = {
  id: string;
  ref_number: string | null;
  recipient: string;
  amount_cad: number;
  start_date: string | null;
  purpose: string | null;
};

type ProgramFlavor = {
  total: number;
  count: number;
  topRecipient?: { name: string; amount: number };
};

export function TraceCard({
  lineage,
  topRow,
}: {
  lineage: LineageResult | null;
  topRow:
    | { kind: "transaction"; data: TransactionFlavor; programLabel: string }
    | { kind: "program"; data: ProgramFlavor };
}) {
  if (!lineage || !lineage.found) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400">
        No lineage row available for this selection.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-6">
      <div className="mb-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
          {topRow.kind === "transaction" ? "Transaction trace" : "Program trace"}
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-2xl font-semibold text-zinc-100">
            {lineage.display_name}
          </h2>
          <span className="text-sm text-zinc-500 mono">
            {lineage.short_name} · FY {lineage.fy}–{(lineage.fy + 1).toString().slice(2)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {topRow.kind === "transaction" ? (
          <Rung
            color="amber"
            kind="DISBURSEMENT"
            primary={formatCADExact(topRow.data.amount_cad)}
            secondary={topRow.data.recipient}
            tertiary={[
              topRow.data.ref_number ? `Ref ${topRow.data.ref_number}` : null,
              topRow.data.start_date ? `Started ${topRow.data.start_date}` : null,
              topRow.data.purpose ? topRow.data.purpose.slice(0, 110) + (topRow.data.purpose.length > 110 ? "…" : "") : null,
            ].filter(Boolean).join(" · ")}
            id={topRow.data.id}
            note={`In ${topRow.programLabel}`}
          />
        ) : (
          <Rung
            color="amber"
            kind="DISBURSEMENTS"
            primary={formatCAD(topRow.data.total)}
            secondary={`${topRow.data.count} agreement${topRow.data.count === 1 ? "" : "s"}`}
            tertiary={topRow.data.topRecipient ? `Top recipient: ${topRow.data.topRecipient.name} (${formatCAD(topRow.data.topRecipient.amount)})` : undefined}
            id={`${lineage.program_id}_${lineage.fy}_disb`}
          />
        )}

        {lineage.estimates ? (
          <Rung
            color="emerald"
            kind="ESTIMATES"
            primary={passageRefLabel(lineage.estimates.ref, "estimates")}
            secondary={truncate(lineage.estimates.text, 220)}
            id={lineage.estimates.id}
          />
        ) : (
          <RungMissing kind="ESTIMATES" />
        )}

        {lineage.budget ? (
          <Rung
            color="orange"
            kind="BUDGET"
            primary={passageRefLabel(lineage.budget.ref, "budget")}
            secondary={truncate(lineage.budget.text, 220)}
            id={lineage.budget.id}
          />
        ) : (
          <RungMissing kind="BUDGET" />
        )}

        {lineage.throne ? (
          <Rung
            color="violet"
            kind="THRONE SPEECH"
            primary={passageRefLabel(lineage.throne.ref, "throne")}
            secondary={truncate(lineage.throne.text, 220)}
            id={lineage.throne.id}
          />
        ) : (
          <RungMissing kind="THRONE SPEECH" />
        )}
      </div>
    </div>
  );
}

const COLOR_MAP = {
  amber: { dot: "bg-yellow-400", ring: "ring-yellow-500/20", text: "text-yellow-300" },
  emerald: { dot: "bg-emerald-400", ring: "ring-emerald-500/20", text: "text-emerald-300" },
  orange: { dot: "bg-orange-400", ring: "ring-orange-500/20", text: "text-orange-300" },
  violet: { dot: "bg-violet-400", ring: "ring-violet-500/20", text: "text-violet-300" },
} as const;

function Rung({
  color,
  kind,
  primary,
  secondary,
  tertiary,
  id,
  note,
}: {
  color: keyof typeof COLOR_MAP;
  kind: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
  id: string;
  note?: string;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`relative pl-6 pr-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/80 ring-1 ${c.ring}`}>
      <span className={`absolute left-2 top-4 inline-block w-2.5 h-2.5 rounded-full ${c.dot}`} />
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] uppercase tracking-widest font-medium ${c.text} mb-1`}>{kind}</div>
          <div className="text-zinc-100 font-medium leading-snug">{primary}</div>
          {secondary && <div className="text-sm text-zinc-400 mt-1 leading-relaxed">{secondary}</div>}
          {tertiary && <div className="text-xs text-zinc-500 mt-1.5">{tertiary}</div>}
          {note && <div className="text-xs text-zinc-500 mt-1.5 italic">{note}</div>}
        </div>
        <span className="mono text-[10px] text-zinc-600 shrink-0 max-w-[200px] truncate" title={id}>
          {id}
        </span>
      </div>
    </div>
  );
}

function RungMissing({ kind }: { kind: string }) {
  return (
    <div className="relative pl-6 pr-4 py-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30">
      <span className="absolute left-2 top-4 inline-block w-2.5 h-2.5 rounded-full bg-zinc-700" />
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{kind}</div>
      <div className="text-sm text-zinc-500 italic">No matching passage in registry.</div>
    </div>
  );
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function passageRefLabel(
  ref: Record<string, unknown> | null,
  kind: "throne" | "budget" | "estimates"
): string {
  if (!ref) return kind === "estimates" ? "Estimates line" : kind === "budget" ? "Budget passage" : "Throne speech";
  if (kind === "estimates") {
    const vote = ref.vote ?? ref.vote_number;
    const fy = ref.fy_start;
    const amt = ref.amount;
    const dept = ref.department;
    const parts = [
      dept ? String(dept) : null,
      vote ? `Vote ${vote}` : null,
      fy ? `Estimates ${fy}–${(Number(fy) + 1).toString().slice(2)}` : null,
      amt ? `$${Number(amt).toLocaleString()}` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "Estimates line";
  }
  if (kind === "budget") {
    const year = ref.budget_year;
    const page = ref.page;
    return [year ? `Budget ${year}` : null, page ? `p. ${page}` : null].filter(Boolean).join(" · ") || "Budget passage";
  }
  // throne
  const parl = ref.parliament;
  const sess = ref.session;
  const date = ref.date;
  return [
    parl && sess ? `Speech ${parl}-${sess}` : parl ? `Parliament ${parl}` : null,
    date ? String(date) : null,
  ].filter(Boolean).join(" · ") || "Throne speech";
}

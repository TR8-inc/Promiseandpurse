"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { MatrixCell } from "../../pipelines/07_agent/data";
import { statusColor, s2Color } from "../lib/format";

const FYS = [2022, 2023, 2024];

export function MatrixGrid({ cells }: { cells: MatrixCell[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const selectedProgram = params.get("program") ?? "izev";
  const selectedFy = parseInt(params.get("fy") ?? "2024", 10);

  const programs = Array.from(new Map(cells.map((c) => [c.program_id, { id: c.program_id, short: c.short_name, display: c.display_name }])).values()).sort((a, b) => a.short.localeCompare(b.short));

  const cellMap = new Map<string, MatrixCell>();
  for (const c of cells) cellMap.set(`${c.program_id}|${c.fy}`, c);

  const select = (program: string, fy: number) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("program", program);
    sp.set("fy", String(fy));
    sp.delete("disb_id");
    sp.set("tab", "matrix");
    router.push(`/?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th className="text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium px-2 py-1.5">Program</th>
            {FYS.map((fy) => (
              <th key={fy} className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium px-2 py-1.5">
                FY {fy}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id}>
              <td className="text-sm text-zinc-300 px-2 mono whitespace-nowrap">{p.short}</td>
              {FYS.map((fy) => {
                const cell = cellMap.get(`${p.id}|${fy}`);
                const isSelected = p.id === selectedProgram && fy === selectedFy;
                if (!cell) {
                  return <td key={fy} className="px-1"><div className="rounded-md bg-zinc-900/40 border border-zinc-800 p-2 text-xs text-zinc-600 text-center">—</div></td>;
                }
                const status = statusColor(cell.status);
                return (
                  <td key={fy} className="px-1">
                    <button
                      onClick={() => select(p.id, fy)}
                      className={`w-full text-left rounded-md p-2 transition-all border ${isSelected ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30" : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700"}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${status.bg} ${status.fg}`}>{status.label}</span>
                        <span className={`text-xs mono ${s2Color(cell.s2_magnitude_ratio)}`}>
                          {cell.s2_magnitude_ratio == null ? "—" : `${cell.s2_magnitude_ratio.toFixed(2)}×`}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mono leading-tight">
                        {formatShort(cell.disb_total)}<span className="text-zinc-700"> / </span>{formatShort(cell.est_total)}
                      </div>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatShort(n: number): string {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

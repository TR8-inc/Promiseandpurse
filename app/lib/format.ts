export function formatCAD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatCADExact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

export function statusColor(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case "full":
      return { bg: "bg-emerald-500/15", fg: "text-emerald-400", label: "full" };
    case "missing_throne":
      return { bg: "bg-amber-500/15", fg: "text-amber-400", label: "no throne" };
    case "missing_budget":
      return { bg: "bg-amber-500/15", fg: "text-amber-400", label: "no budget" };
    case "missing_estimates":
      return { bg: "bg-amber-500/15", fg: "text-amber-400", label: "no estimates" };
    case "missing_all":
      return { bg: "bg-rose-500/15", fg: "text-rose-400", label: "missing all" };
    default:
      return { bg: "bg-zinc-500/15", fg: "text-zinc-400", label: status };
  }
}

export function s2Color(s2: number | null | undefined): string {
  if (s2 == null) return "text-zinc-500";
  if (s2 < 0.5) return "text-amber-400";
  if (s2 > 1.5) return "text-orange-400";
  if (s2 > 1.15) return "text-orange-300";
  return "text-emerald-400";
}

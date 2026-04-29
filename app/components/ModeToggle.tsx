"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ModeToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get("mode") ?? "trace") as "trace" | "graph";

  const setMode = (m: "trace" | "graph") => {
    const sp = new URLSearchParams(params.toString());
    sp.set("mode", m);
    router.push(`/?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg">
      <Pill active={mode === "trace"} onClick={() => setMode("trace")}>Trace</Pill>
      <Pill active={mode === "graph"} onClick={() => setMode("graph")}>Graph</Pill>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${active ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      {children}
    </button>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MatrixGrid } from "./MatrixGrid";
import { TransactionTable } from "./TransactionTable";
import type { MatrixCell } from "../../pipelines/07_agent/data";

export function Navigators({ cells }: { cells: MatrixCell[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") ?? "matrix") as "matrix" | "transactions";

  const setTab = (t: "matrix" | "transactions") => {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", t);
    router.push(`/?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-1 mb-4 p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg w-fit">
        <Tab active={tab === "matrix"} onClick={() => setTab("matrix")}>Program × Year</Tab>
        <Tab active={tab === "transactions"} onClick={() => setTab("transactions")}>Transactions</Tab>
      </div>
      {tab === "matrix" ? <MatrixGrid cells={cells} /> : <TransactionTable />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${active ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      {children}
    </button>
  );
}

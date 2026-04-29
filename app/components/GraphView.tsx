"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { GraphNode, GraphEdge } from "../../pipelines/07_agent/data";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
      Loading graph engine…
    </div>
  ),
});

const COLOR: Record<GraphNode["type"], string> = {
  throne: "#a78bfa",
  budget: "#fb923c",
  estimates: "#34d399",
  program: "#60a5fa",
  recipient: "#facc15",
};

const SIZE: Record<GraphNode["type"], number> = {
  throne: 5,
  budget: 5,
  estimates: 5,
  program: 9,
  recipient: 4,
};

const LABEL: Record<GraphNode["type"], string> = {
  throne: "Throne",
  budget: "Budget",
  estimates: "Estimates",
  program: "Programs",
  recipient: "Recipients",
};

export function GraphView() {
  const router = useRouter();
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Record<GraphNode["type"], boolean>>({
    throne: true,
    budget: true,
    estimates: true,
    program: true,
    recipient: true,
  });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return null;
    const allowed = new Set(data.nodes.filter((n) => filter[n.type]).map((n) => n.id));
    return {
      nodes: data.nodes.filter((n) => allowed.has(n.id)),
      links: data.edges.filter((e) => allowed.has(e.source as string) && allowed.has(e.target as string)),
    };
  }, [data, filter]);

  const onNodeClick = (n: GraphNode) => {
    if (n.type === "program") {
      const programId = n.program_id ?? n.id.split(":")[1];
      router.push(`/?mode=trace&program=${programId}&fy=2024`);
    } else if (n.type === "recipient") {
      const programId = n.program_id ?? n.id.split(":")[1];
      router.push(`/?mode=trace&program=${programId}&fy=2024&tab=transactions&q=${encodeURIComponent(n.label)}`);
    } else if (n.type === "throne" || n.type === "budget" || n.type === "estimates") {
      const link = data?.edges.find((e) => e.source === n.id);
      if (link) {
        const tgt = data?.nodes.find((x) => x.id === link.target);
        if (tgt && tgt.type === "program") {
          const programId = tgt.program_id ?? tgt.id.split(":")[1];
          router.push(`/?mode=trace&program=${programId}&fy=${link.fy ?? 2024}`);
        }
      }
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden" ref={wrapRef}>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-rose-400 text-sm">
          Error loading graph: {error}
        </div>
      )}
      {!data && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Querying graph…
        </div>
      )}
      {filtered && (
        <ForceGraph2D
          width={size.w}
          height={size.h}
          graphData={filtered}
          backgroundColor="#09090b"
          nodeLabel={(n) => `${(n as GraphNode).type.toUpperCase()} · ${(n as GraphNode).label}`}
          nodeRelSize={1}
          nodeVal={(n) => SIZE[(n as GraphNode).type]}
          nodeColor={(n) => COLOR[(n as GraphNode).type]}
          linkColor={() => "rgba(120,120,140,0.25)"}
          linkWidth={(l) => Math.max(0.5, Math.min(2, Math.log10(((l as GraphEdge).weight ?? 1) / 1e6 + 1)))}
          onNodeClick={(n) => onNodeClick(n as GraphNode)}
          cooldownTicks={120}
          enableNodeDrag={true}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as GraphNode & { x?: number; y?: number };
            const r = Math.sqrt(SIZE[n.type]) * 1.4;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = COLOR[n.type];
            ctx.fill();
            if (n.type === "program" && globalScale > 1) {
              ctx.font = `${Math.max(8, 10 / globalScale)}px sans-serif`;
              ctx.fillStyle = "#fafafa";
              ctx.textAlign = "center";
              ctx.fillText(n.label, n.x ?? 0, (n.y ?? 0) + r + 6);
            }
          }}
        />
      )}

      <div className="absolute top-3 left-3 rounded-lg bg-zinc-900/90 backdrop-blur border border-zinc-800 px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Legend</div>
        <div className="space-y-1">
          {(Object.keys(COLOR) as GraphNode["type"][]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filter[t]}
                onChange={(e) => setFilter({ ...filter, [t]: e.target.checked })}
                className="accent-blue-500"
              />
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOR[t] }} />
              <span className="text-zinc-300">{LABEL[t]}</span>
              <span className="text-zinc-600 mono">
                {data ? data.nodes.filter((n) => n.type === t).length : "…"}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="absolute top-3 right-3 rounded-lg bg-zinc-900/90 backdrop-blur border border-zinc-800 px-3 py-2 text-xs text-zinc-400 max-w-[260px]">
        Click any node to trace it.
        {data && (
          <span className="block mt-1 text-zinc-600 mono">
            {data.nodes.length} nodes · {data.edges.length} edges
          </span>
        )}
      </div>
    </div>
  );
}

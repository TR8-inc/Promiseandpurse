import { fetchDisbursements } from "../../../pipelines/07_agent/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const program = url.searchParams.get("program");
  const fyStr = url.searchParams.get("fy");
  const topNStr = url.searchParams.get("top_n");
  if (!program || !fyStr) {
    return new Response(JSON.stringify({ error: "program and fy required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const fy = parseInt(fyStr, 10);
  if (Number.isNaN(fy)) {
    return new Response(JSON.stringify({ error: "fy must be an integer" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const topN = topNStr ? Math.min(Math.max(parseInt(topNStr, 10), 1), 50) : 10;
  const result = await fetchDisbursements(program, fy, topN);
  return Response.json(result);
}

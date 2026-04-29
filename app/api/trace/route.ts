import { fetchTransactionTrace } from "../../../pipelines/07_agent/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const disb_id = url.searchParams.get("disb_id");
  if (!disb_id) {
    return new Response(JSON.stringify({ error: "disb_id required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const result = await fetchTransactionTrace(disb_id);
  return Response.json(result);
}

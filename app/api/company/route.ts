import { fetchCompanyTrace } from "../../../pipelines/07_agent/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const recipient = url.searchParams.get("recipient");
  if (!recipient) {
    return new Response(JSON.stringify({ error: "recipient required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const result = await fetchCompanyTrace(recipient);
  return Response.json(result);
}

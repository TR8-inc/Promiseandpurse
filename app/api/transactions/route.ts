import { fetchTransactions } from "../../../pipelines/07_agent/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const program = url.searchParams.get("program") ?? undefined;
  const fyStr = url.searchParams.get("fy");
  const limitStr = url.searchParams.get("limit");
  const offsetStr = url.searchParams.get("offset");

  const fy = fyStr ? parseInt(fyStr, 10) : undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : 50;
  const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

  const result = await fetchTransactions({ q, program, fy, limit, offset });
  return Response.json(result);
}

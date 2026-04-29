import { fetchGraph } from "../../../pipelines/07_agent/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchGraph();
  return Response.json(data);
}

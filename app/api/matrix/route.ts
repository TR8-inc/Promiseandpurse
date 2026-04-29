import { fetchMatrix } from "../../../pipelines/07_agent/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cells = await fetchMatrix();
  return Response.json({ cells });
}

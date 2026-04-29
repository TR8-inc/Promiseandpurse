import { BigQuery } from "@google-cloud/bigquery";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "agency2026ot-tr8-0429";
const LOCATION = process.env.BQ_LOCATION || "northamerica-northeast1";
const DATASET = process.env.BQ_DATASET || "gc_policy";

let client: BigQuery | null = null;
export function bq(): BigQuery {
  if (!client) {
    client = new BigQuery({ projectId: PROJECT, location: LOCATION });
  }
  return client;
}

export const ds = (table: string) =>
  `\`${PROJECT}.${DATASET}.${table}\``;

export async function runQuery<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const [rows] = await bq().query({
    query: sql,
    location: LOCATION,
    params,
    parameterMode: params ? "named" : undefined,
  });
  return rows as T[];
}

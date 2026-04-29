import { tool } from "ai";
import { z } from "zod";
import { runQuery, ds } from "./bq";

function parseRef<T = Record<string, unknown>>(s: string | null | undefined): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

const programIdParam = z
  .string()
  .min(2)
  .describe(
    "Program identifier from the registry (lowercase short code), e.g. 'izev' for Incentives for Zero-Emission Vehicles, 'ntcf' for National Trade Corridors Fund, 'ferry', 'rstpp', 'acip', 'rprp', 'acap', 'rsip', 'ppccw', 'cpfp'."
  );

const fyParam = z
  .number()
  .int()
  .min(2022)
  .max(2024)
  .describe(
    "Year of interest. For Estimates this is the FY-start year (fy=2024 means Estimates 2024-25, Apr 2024–Mar 2025). For disbursements this is the calendar year of agreement_start_date — matches the public 'Tesla 2024' framing."
  );

export type LineageResult =
  | { found: false; program_id: string; fy: number; status: "missing_all"; message: string }
  | {
      found: true;
      program_id: string;
      fy: number;
      display_name: string;
      short_name: string;
      status: string;
      throne: { id: string; text: string | null; ref: Record<string, unknown> | null; cosine_distance: number | null } | null;
      budget: { id: string; text: string | null; ref: Record<string, unknown> | null; cosine_distance: number | null } | null;
      estimates: { id: string; text: string | null; ref: Record<string, unknown> | null; cosine_distance: number | null } | null;
    };

export async function fetchLineage(program_id: string, fy: number): Promise<LineageResult> {
  const sql = `
    SELECT program_id, fy, display_name, short_name, status,
           throne_id, throne_text, throne_ref, throne_dist,
           budget_id, budget_text, budget_ref, budget_dist,
           estimates_id, estimates_text, estimates_ref, estimates_dist
    FROM ${ds("tc_program_lineage")}
    WHERE program_id = @pid AND fy = @fy
    LIMIT 1
  `;
  const rows = await runQuery<{
    program_id: string; fy: number; display_name: string; short_name: string; status: string;
    throne_id: string | null; throne_text: string | null; throne_ref: string | null; throne_dist: number | null;
    budget_id: string | null; budget_text: string | null; budget_ref: string | null; budget_dist: number | null;
    estimates_id: string | null; estimates_text: string | null; estimates_ref: string | null; estimates_dist: number | null;
  }>(sql, { pid: program_id, fy });

  if (rows.length === 0) {
    return { found: false, program_id, fy, status: "missing_all" as const, message: "No lineage row." };
  }
  const r = rows[0];
  return {
    found: true,
    program_id: r.program_id,
    fy: r.fy,
    display_name: r.display_name,
    short_name: r.short_name,
    status: r.status,
    throne: r.throne_id ? {
      id: r.throne_id, text: r.throne_text,
      ref: parseRef(r.throne_ref),
      cosine_distance: r.throne_dist,
    } : null,
    budget: r.budget_id ? {
      id: r.budget_id, text: r.budget_text,
      ref: parseRef(r.budget_ref),
      cosine_distance: r.budget_dist,
    } : null,
    estimates: r.estimates_id ? {
      id: r.estimates_id, text: r.estimates_text,
      ref: parseRef(r.estimates_ref),
      cosine_distance: r.estimates_dist,
    } : null,
  };
}

export type SignalsResult =
  | { found: false; program_id: string; fy: number }
  | {
      found: true;
      program_id: string;
      fy: number;
      lineage_status: string;
      s1_lineage_break: boolean;
      s2_magnitude_ratio: number | null;
      disbursement_total_cad: number;
      disbursement_count: number;
      estimates_total_cad: number;
      estimates_count: number;
      evidence_summary: string;
    };

export async function fetchSignals(program_id: string, fy: number): Promise<SignalsResult> {
  const sql = `
    SELECT program_id, fy, status, disb_total, disb_n, est_total, est_n,
           s1_lineage_break, s2_magnitude_ratio, evidence
    FROM ${ds("tc_misalignment_signals")}
    WHERE program_id = @pid AND fy = @fy
    LIMIT 1
  `;
  const rows = await runQuery<{
    program_id: string; fy: number; status: string;
    disb_total: number; disb_n: number; est_total: number; est_n: number;
    s1_lineage_break: boolean; s2_magnitude_ratio: number | null; evidence: string;
  }>(sql, { pid: program_id, fy });
  if (rows.length === 0) {
    return { found: false, program_id, fy };
  }
  const r = rows[0];
  return {
    found: true,
    program_id: r.program_id,
    fy: r.fy,
    lineage_status: r.status,
    s1_lineage_break: r.s1_lineage_break,
    s2_magnitude_ratio: r.s2_magnitude_ratio,
    disbursement_total_cad: r.disb_total,
    disbursement_count: r.disb_n,
    estimates_total_cad: r.est_total,
    estimates_count: r.est_n,
    evidence_summary: r.evidence,
  };
}

export type DisbursementsResult = {
  program_id: string;
  fy: number;
  calendar_year_total_cad: number;
  agreement_count: number;
  top_recipients: { recipient: string; n: number; total_cad: number }[];
  top_agreements: {
    id: string;
    ref_number: string;
    recipient: string;
    amount_cad: number;
    start_date: string;
    purpose: string;
  }[];
};

export async function fetchDisbursements(
  program_id: string,
  fy: number,
  top_n: number = 10
): Promise<DisbursementsResult> {
  const aggSql = `
    SELECT
      d.recipient_legal_name AS recipient,
      COUNT(*) AS n,
      SUM(d.agreement_value) AS total_cad
    FROM ${ds("raw_disbursements")} d
    JOIN ${ds("program_registry")} pr
      ON d.prog_name_en IN UNNEST(pr.aliases)
    WHERE pr.program_id = @pid AND d.cal_year = @fy
    GROUP BY 1
    ORDER BY total_cad DESC
    LIMIT @n
  `;
  const recipients = await runQuery<{
    recipient: string; n: number; total_cad: number;
  }>(aggSql, { pid: program_id, fy, n: top_n });

  const totalSql = `
    SELECT COUNT(*) AS n, SUM(d.agreement_value) AS total_cad
    FROM ${ds("raw_disbursements")} d
    JOIN ${ds("program_registry")} pr
      ON d.prog_name_en IN UNNEST(pr.aliases)
    WHERE pr.program_id = @pid AND d.cal_year = @fy
  `;
  const totals = await runQuery<{ n: number; total_cad: number }>(totalSql, { pid: program_id, fy });

  const sampleSql = `
    SELECT
      d.disbursement_id AS id,
      d.ref_number,
      d.recipient_legal_name AS recipient,
      d.agreement_value AS amount_cad,
      d.agreement_start_date AS start_date,
      d.prog_purpose_en AS purpose
    FROM ${ds("raw_disbursements")} d
    JOIN ${ds("program_registry")} pr
      ON d.prog_name_en IN UNNEST(pr.aliases)
    WHERE pr.program_id = @pid AND d.cal_year = @fy
    ORDER BY d.agreement_value DESC
    LIMIT 10
  `;
  const top_agreements = await runQuery<{
    id: string; ref_number: string; recipient: string; amount_cad: number;
    start_date: { value: string } | string; purpose: string;
  }>(sampleSql, { pid: program_id, fy });

  return {
    program_id,
    fy,
    calendar_year_total_cad: totals[0]?.total_cad ?? 0,
    agreement_count: totals[0]?.n ?? 0,
    top_recipients: recipients,
    top_agreements: top_agreements.map((a) => ({
      ...a,
      start_date: typeof a.start_date === "object" ? a.start_date.value : a.start_date,
    })),
  };
}

export const get_lineage = tool({
  description:
    "Return the lineage row for one program in one year — the best-matching Throne speech passage, Budget passage, and Estimates line, with provenance ids for citation. Status reports which links are present.",
  inputSchema: z.object({ program_id: programIdParam, fy: fyParam }),
  execute: async ({ program_id, fy }) => fetchLineage(program_id, fy),
});

export const get_signals = tool({
  description:
    "Return S1 (lineage_break: any source link missing) and S2 (magnitude_ratio: disbursements / estimates) for one program-year, plus the underlying totals as evidence.",
  inputSchema: z.object({ program_id: programIdParam, fy: fyParam }),
  execute: async ({ program_id, fy }) => fetchSignals(program_id, fy),
});

export const vector_search = tool({
  description:
    "Free-text retrieval over Throne / Budget / Estimates / Program embeddings. Returns top-k passages by cosine distance, each with a citable id.",
  inputSchema: z.object({
    query: z.string().min(2).describe("Search text — passages most semantically similar will rank first."),
    source_kind: z.enum(["throne", "budget", "estimates", "program", "all"]).default("all"),
    k: z.number().int().min(1).max(20).default(5),
  }),
  execute: async ({ query, source_kind, k }) => {
    const kind = source_kind === "all" ? null : source_kind;
    const where = kind ? "AND e.source_kind = @kind" : "";
    const sql = `
      WITH scored AS (
        SELECT
          e.chunk_id AS id,
          e.source_kind,
          e.text,
          e.source_ref,
          (
            ARRAY_LENGTH(
              ARRAY(
                SELECT t FROM UNNEST(SPLIT(LOWER(@q), ' ')) t
                WHERE LENGTH(t) >= 3 AND POSITION(t IN LOWER(e.text)) > 0
              )
            ) +
            IF(LOWER(e.text) LIKE CONCAT('%', LOWER(@q), '%'), 5, 0)
          ) AS score
        FROM ${ds("embeddings")} e
        WHERE 1=1 ${where}
      )
      SELECT id, source_kind, text, source_ref, score
      FROM scored
      WHERE score > 0
      ORDER BY score DESC
      LIMIT @k
    `;
    const params: Record<string, unknown> = { q: query, k };
    if (kind) params.kind = kind;
    const rows = await runQuery<{
      id: string; source_kind: string; text: string; source_ref: string; score: number;
    }>(sql, params);
    return {
      query,
      source_kind,
      k,
      passages: rows.map((r) => ({
        id: r.id,
        source_kind: r.source_kind,
        text: r.text.length > 800 ? r.text.slice(0, 800) + "…" : r.text,
        ref: parseRef(r.source_ref),
        score: r.score,
      })),
    };
  },
});

export const get_disbursements = tool({
  description:
    "Return disbursements (G&C agreements) for one program in one calendar year, with top recipients aggregated. Each agreement row has an id for citation.",
  inputSchema: z.object({
    program_id: programIdParam,
    fy: fyParam,
    top_n: z.number().int().min(1).max(50).default(10),
  }),
  execute: async ({ program_id, fy, top_n }) => fetchDisbursements(program_id, fy, top_n),
});

export const tools = {
  get_lineage,
  get_signals,
  vector_search,
  get_disbursements,
};

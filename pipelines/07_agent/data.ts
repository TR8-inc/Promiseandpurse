import { runQuery, ds } from "./bq";
import { fetchLineage, fetchSignals, type LineageResult, type SignalsResult } from "./tools";

function parseRef<T = Record<string, unknown>>(s: string | null | undefined): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

function dateToString(d: { value: string } | string | null | undefined): string | null {
  if (!d) return null;
  return typeof d === "object" ? d.value : d;
}

export type MatrixCell = {
  program_id: string;
  short_name: string;
  display_name: string;
  fy: number;
  status: string;
  s1_lineage_break: boolean;
  s2_magnitude_ratio: number | null;
  disb_total: number;
  est_total: number;
};

export async function fetchMatrix(): Promise<MatrixCell[]> {
  const sql = `
    SELECT
      s.program_id,
      pr.short_name,
      pr.display_name,
      s.fy,
      s.status,
      s.s1_lineage_break,
      s.s2_magnitude_ratio,
      s.disb_total,
      s.est_total
    FROM ${ds("tc_misalignment_signals")} s
    JOIN ${ds("program_registry")} pr USING (program_id)
    ORDER BY pr.short_name, s.fy
  `;
  return await runQuery<MatrixCell>(sql);
}

export type TransactionRow = {
  id: string;
  ref_number: string | null;
  recipient: string;
  program_id: string | null;
  program_short: string | null;
  fy: number;
  amount_cad: number;
  start_date: string | null;
  purpose: string | null;
};

export async function fetchTransactions(opts: {
  q?: string;
  program?: string;
  fy?: number;
  limit?: number;
  offset?: number;
}): Promise<{ rows: TransactionRow[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const filters: string[] = [];
  const params: Record<string, unknown> = { limit, offset };
  if (opts.q && opts.q.trim().length > 0) {
    filters.push("LOWER(d.recipient_legal_name) LIKE CONCAT('%', LOWER(@q), '%')");
    params.q = opts.q.trim();
  }
  if (opts.program) {
    filters.push("pr.program_id = @program");
    params.program = opts.program;
  }
  if (opts.fy) {
    filters.push("d.cal_year = @fy");
    params.fy = opts.fy;
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const sql = `
    SELECT
      d.disbursement_id AS id,
      d.ref_number,
      d.recipient_legal_name AS recipient,
      pr.program_id,
      pr.short_name AS program_short,
      d.cal_year AS fy,
      d.agreement_value AS amount_cad,
      d.agreement_start_date AS start_date,
      d.prog_purpose_en AS purpose
    FROM ${ds("raw_disbursements")} d
    LEFT JOIN ${ds("program_registry")} pr
      ON d.prog_name_en IN UNNEST(pr.aliases)
    ${where}
    ORDER BY d.agreement_value DESC
    LIMIT @limit OFFSET @offset
  `;
  const rows = await runQuery<{
    id: string;
    ref_number: string | null;
    recipient: string;
    program_id: string | null;
    program_short: string | null;
    fy: number;
    amount_cad: number;
    start_date: { value: string } | string | null;
    purpose: string | null;
  }>(sql, params);

  const countSql = `
    SELECT COUNT(*) AS n
    FROM ${ds("raw_disbursements")} d
    LEFT JOIN ${ds("program_registry")} pr
      ON d.prog_name_en IN UNNEST(pr.aliases)
    ${where}
  `;
  const countParams = { ...params };
  delete countParams.limit;
  delete countParams.offset;
  const totalRows = await runQuery<{ n: number }>(countSql, countParams);

  return {
    rows: rows.map((r) => ({
      ...r,
      start_date: dateToString(r.start_date),
    })),
    total: totalRows[0]?.n ?? 0,
  };
}

export type TransactionTrace = {
  found: boolean;
  disbursement: {
    id: string;
    ref_number: string | null;
    recipient: string;
    amount_cad: number;
    start_date: string | null;
    purpose: string | null;
    prog_name_en: string | null;
  } | null;
  program_id: string | null;
  fy: number | null;
  lineage: LineageResult | null;
  signals: SignalsResult | null;
};

export async function fetchTransactionTrace(disb_id: string): Promise<TransactionTrace> {
  const sql = `
    SELECT
      d.disbursement_id AS id,
      d.ref_number,
      d.recipient_legal_name AS recipient,
      d.agreement_value AS amount_cad,
      d.agreement_start_date AS start_date,
      d.prog_purpose_en AS purpose,
      d.prog_name_en,
      d.cal_year AS fy,
      pr.program_id
    FROM ${ds("raw_disbursements")} d
    LEFT JOIN ${ds("program_registry")} pr
      ON d.prog_name_en IN UNNEST(pr.aliases)
    WHERE d.disbursement_id = @id
    LIMIT 1
  `;
  const rows = await runQuery<{
    id: string;
    ref_number: string | null;
    recipient: string;
    amount_cad: number;
    start_date: { value: string } | string | null;
    purpose: string | null;
    prog_name_en: string | null;
    fy: number;
    program_id: string | null;
  }>(sql, { id: disb_id });

  if (rows.length === 0) {
    return { found: false, disbursement: null, program_id: null, fy: null, lineage: null, signals: null };
  }
  const r = rows[0];
  const program_id = r.program_id;
  const fy = r.fy;
  const [lineage, signals] = program_id
    ? await Promise.all([fetchLineage(program_id, fy), fetchSignals(program_id, fy)])
    : [null, null];

  return {
    found: true,
    disbursement: {
      id: r.id,
      ref_number: r.ref_number,
      recipient: r.recipient,
      amount_cad: r.amount_cad,
      start_date: dateToString(r.start_date),
      purpose: r.purpose,
      prog_name_en: r.prog_name_en,
    },
    program_id,
    fy,
    lineage,
    signals,
  };
}

export type GraphNode = {
  id: string;
  type: "throne" | "budget" | "estimates" | "program" | "recipient";
  label: string;
  ref?: Record<string, unknown> | null;
  amount?: number;
  program_id?: string;
  fy?: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  weight?: number;
  fy?: number;
  kind: "lineage" | "disbursement";
};

export type GraphPayload = { nodes: GraphNode[]; edges: GraphEdge[] };

export async function fetchGraph(): Promise<GraphPayload> {
  const lineageSql = `
    SELECT
      l.program_id,
      pr.short_name,
      pr.display_name,
      l.fy,
      l.throne_id, l.throne_text, l.throne_ref,
      l.budget_id, l.budget_text, l.budget_ref,
      l.estimates_id, l.estimates_text, l.estimates_ref
    FROM ${ds("tc_program_lineage")} l
    JOIN ${ds("program_registry")} pr USING (program_id)
  `;
  const lineageRows = await runQuery<{
    program_id: string; short_name: string; display_name: string; fy: number;
    throne_id: string | null; throne_text: string | null; throne_ref: string | null;
    budget_id: string | null; budget_text: string | null; budget_ref: string | null;
    estimates_id: string | null; estimates_text: string | null; estimates_ref: string | null;
  }>(lineageSql);

  const recipientsSql = `
    WITH ranked AS (
      SELECT
        pr.program_id,
        pr.short_name,
        d.recipient_legal_name AS recipient,
        SUM(d.agreement_value) AS total_cad,
        COUNT(*) AS n,
        ROW_NUMBER() OVER (
          PARTITION BY pr.program_id
          ORDER BY SUM(d.agreement_value) DESC
        ) AS rn
      FROM ${ds("raw_disbursements")} d
      JOIN ${ds("program_registry")} pr
        ON d.prog_name_en IN UNNEST(pr.aliases)
      GROUP BY pr.program_id, pr.short_name, d.recipient_legal_name
    )
    SELECT program_id, short_name, recipient, total_cad, n
    FROM ranked
    WHERE rn <= 15
  `;
  const recipientRows = await runQuery<{
    program_id: string; short_name: string; recipient: string; total_cad: number; n: number;
  }>(recipientsSql);

  const programNodes = new Map<string, GraphNode>();
  const throneNodes = new Map<string, GraphNode>();
  const budgetNodes = new Map<string, GraphNode>();
  const estimatesNodes = new Map<string, GraphNode>();
  const recipientNodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const l of lineageRows) {
    const programNodeId = `program:${l.program_id}`;
    if (!programNodes.has(programNodeId)) {
      programNodes.set(programNodeId, {
        id: programNodeId,
        type: "program",
        label: l.short_name,
        program_id: l.program_id,
      });
    }
    if (l.throne_id) {
      const nid = `throne:${l.throne_id}`;
      if (!throneNodes.has(nid)) {
        const ref = parseRef(l.throne_ref);
        throneNodes.set(nid, {
          id: nid,
          type: "throne",
          label: (l.throne_text ?? "").slice(0, 64),
          ref,
        });
      }
      edges.push({ source: nid, target: programNodeId, kind: "lineage", fy: l.fy });
    }
    if (l.budget_id) {
      const nid = `budget:${l.budget_id}`;
      if (!budgetNodes.has(nid)) {
        const ref = parseRef(l.budget_ref);
        budgetNodes.set(nid, {
          id: nid,
          type: "budget",
          label: (l.budget_text ?? "").slice(0, 64),
          ref,
        });
      }
      edges.push({ source: nid, target: programNodeId, kind: "lineage", fy: l.fy });
    }
    if (l.estimates_id) {
      const nid = `estimates:${l.estimates_id}`;
      if (!estimatesNodes.has(nid)) {
        const ref = parseRef(l.estimates_ref);
        estimatesNodes.set(nid, {
          id: nid,
          type: "estimates",
          label: (l.estimates_text ?? "").slice(0, 64),
          ref,
        });
      }
      edges.push({ source: nid, target: programNodeId, kind: "lineage", fy: l.fy });
    }
  }

  for (const r of recipientRows) {
    const nid = `recipient:${r.program_id}:${r.recipient}`;
    if (!recipientNodes.has(nid)) {
      recipientNodes.set(nid, {
        id: nid,
        type: "recipient",
        label: r.recipient,
        amount: r.total_cad,
        program_id: r.program_id,
      });
    }
    edges.push({
      source: `program:${r.program_id}`,
      target: nid,
      kind: "disbursement",
      weight: r.total_cad,
    });
  }

  const nodes: GraphNode[] = [
    ...throneNodes.values(),
    ...budgetNodes.values(),
    ...estimatesNodes.values(),
    ...programNodes.values(),
    ...recipientNodes.values(),
  ];

  return { nodes, edges };
}

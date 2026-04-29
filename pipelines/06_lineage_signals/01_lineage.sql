-- tc_program_lineage: per (program_id, fy) → best Throne / Budget / Estimates match
-- via cosine distance over the embeddings table.
--
-- Status field reflects which links are present: full | missing_throne | missing_budget |
-- missing_estimates | missing_all. Throne is expected sparse (themes, not programs).

CREATE OR REPLACE TABLE `agency2026ot-tr8-0429.gc_policy.tc_program_lineage` AS

WITH program_emb AS (
  SELECT pr.program_id, pr.display_name, pr.short_name, e.embedding AS prog_emb
  FROM `agency2026ot-tr8-0429.gc_policy.program_registry` pr
  JOIN `agency2026ot-tr8-0429.gc_policy.embeddings` e
    ON e.chunk_id = CONCAT('prog_', pr.program_id)
),

fys AS (SELECT fy FROM UNNEST([2022, 2023, 2024]) AS fy),

cross_pf AS (
  SELECT pe.*, f.fy FROM program_emb pe CROSS JOIN fys f
),

throne_ranked AS (
  SELECT cp.program_id, cp.fy, e.chunk_id, e.text, e.source_ref,
         COSINE_DISTANCE(cp.prog_emb, e.embedding) AS dist,
         ROW_NUMBER() OVER (
           PARTITION BY cp.program_id, cp.fy
           ORDER BY COSINE_DISTANCE(cp.prog_emb, e.embedding)
         ) AS rn
  FROM cross_pf cp
  CROSS JOIN `agency2026ot-tr8-0429.gc_policy.embeddings` e
  WHERE e.source_kind = 'throne'
),

budget_ranked AS (
  SELECT cp.program_id, cp.fy, e.chunk_id, e.text, e.source_ref,
         COSINE_DISTANCE(cp.prog_emb, e.embedding) AS dist,
         ROW_NUMBER() OVER (
           PARTITION BY cp.program_id, cp.fy
           ORDER BY COSINE_DISTANCE(cp.prog_emb, e.embedding)
         ) AS rn
  FROM cross_pf cp
  CROSS JOIN `agency2026ot-tr8-0429.gc_policy.embeddings` e
  WHERE e.source_kind = 'budget'
    AND CAST(JSON_VALUE(e.source_ref, '$.budget_year') AS INT64) <= cp.fy
),

estimates_ranked AS (
  SELECT cp.program_id, cp.fy, e.chunk_id, e.text, e.source_ref,
         COSINE_DISTANCE(cp.prog_emb, e.embedding) AS dist,
         ROW_NUMBER() OVER (
           PARTITION BY cp.program_id, cp.fy
           ORDER BY COSINE_DISTANCE(cp.prog_emb, e.embedding)
         ) AS rn
  FROM cross_pf cp
  CROSS JOIN `agency2026ot-tr8-0429.gc_policy.embeddings` e
  WHERE e.source_kind = 'estimates'
    AND CAST(JSON_VALUE(e.source_ref, '$.fy_start') AS INT64) = cp.fy
)

SELECT
  cp.program_id, cp.fy, cp.display_name, cp.short_name,
  t.chunk_id AS throne_id, t.text AS throne_text, t.source_ref AS throne_ref, t.dist AS throne_dist,
  b.chunk_id AS budget_id, b.text AS budget_text, b.source_ref AS budget_ref, b.dist AS budget_dist,
  est.chunk_id AS estimates_id, est.text AS estimates_text, est.source_ref AS estimates_ref, est.dist AS estimates_dist,
  CASE
    WHEN t.chunk_id IS NULL AND b.chunk_id IS NULL AND est.chunk_id IS NULL THEN 'missing_all'
    WHEN t.chunk_id IS NULL THEN 'missing_throne'
    WHEN b.chunk_id IS NULL THEN 'missing_budget'
    WHEN est.chunk_id IS NULL THEN 'missing_estimates'
    ELSE 'full'
  END AS status
FROM cross_pf cp
LEFT JOIN (SELECT * FROM throne_ranked WHERE rn=1) t USING (program_id, fy)
LEFT JOIN (SELECT * FROM budget_ranked WHERE rn=1) b USING (program_id, fy)
LEFT JOIN (SELECT * FROM estimates_ranked WHERE rn=1) est USING (program_id, fy);

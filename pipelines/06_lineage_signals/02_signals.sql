-- tc_misalignment_signals: per (program_id, fy) S1 lineage_break + S2 magnitude_ratio
--
-- S1 = lineage_break (boolean): any source link missing → true
-- S2 = magnitude_ratio (float): disbursements / estimates for that (program, fy)
--      ~1.0 = aligned · « 1 = under-spent · » 1 = over-spent (relative to estimates)

CREATE OR REPLACE TABLE `agency2026ot-tr8-0429.gc_policy.tc_misalignment_signals` AS

WITH disb_totals AS (
  SELECT pr.program_id, d.cal_year AS fy,
         SUM(d.agreement_value) AS disb_total,
         COUNT(*) AS disb_n
  FROM `agency2026ot-tr8-0429.gc_policy.raw_disbursements` d
  JOIN `agency2026ot-tr8-0429.gc_policy.program_registry` pr
    ON d.prog_name_en IN UNNEST(pr.aliases)
  GROUP BY 1, 2
),

pr_alias_flat AS (
  SELECT pr.program_id, pr.display_name, pr.short_name, LOWER(a) AS alias_l
  FROM `agency2026ot-tr8-0429.gc_policy.program_registry` pr,
       UNNEST(pr.aliases) AS a
),

est_totals AS (
  SELECT pr.program_id, e.fy_start AS fy,
         SUM(e.amount) AS est_total,
         COUNT(*) AS est_n
  FROM `agency2026ot-tr8-0429.gc_policy.raw_estimates_lines` e
  JOIN (
    SELECT DISTINCT program_id, display_name, short_name FROM pr_alias_flat
  ) pr
    ON LOWER(e.program) = LOWER(pr.display_name)
       OR (pr.short_name IS NOT NULL
           AND LOWER(e.program) LIKE CONCAT('%', LOWER(pr.short_name), '%'))
  GROUP BY 1, 2
),

joined AS (
  SELECT
    COALESCE(d.program_id, e.program_id) AS program_id,
    COALESCE(d.fy, e.fy) AS fy,
    d.disb_total, d.disb_n, e.est_total, e.est_n
  FROM disb_totals d
  FULL OUTER JOIN est_totals e
    ON d.program_id = e.program_id AND d.fy = e.fy
)

SELECT
  l.program_id, l.fy, l.status,
  COALESCE(j.disb_total, 0) AS disb_total,
  COALESCE(j.disb_n, 0) AS disb_n,
  COALESCE(j.est_total, 0) AS est_total,
  COALESCE(j.est_n, 0) AS est_n,
  -- S1: lineage break — any link missing
  l.status != 'full' AS s1_lineage_break,
  -- S2: magnitude drift — disbursements / estimates
  SAFE_DIVIDE(j.disb_total, j.est_total) AS s2_magnitude_ratio,
  -- compact evidence string
  ARRAY_TO_STRING([
    CONCAT('disbursements=', CAST(ROUND(COALESCE(j.disb_total, 0)/1e6, 1) AS STRING), 'M'),
    CONCAT('estimates=', CAST(ROUND(COALESCE(j.est_total, 0)/1e6, 1) AS STRING), 'M'),
    CONCAT('lineage=', l.status)
  ], '; ') AS evidence
FROM `agency2026ot-tr8-0429.gc_policy.tc_program_lineage` l
LEFT JOIN joined j USING (program_id, fy);

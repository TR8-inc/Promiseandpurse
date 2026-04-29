-- iZEV / Tesla 2024 canary verification.
-- Expectation: status='full', $232.5M Tesla disbursements, $607M Estimates,
-- Throne 2021 climate passage, Budget 2022 iZEV $1.7B/5yr extension.

-- 1. Lineage row
SELECT 'lineage' AS check_kind, program_id, fy, status,
       SUBSTR(throne_text, 1, 140) AS throne_excerpt, throne_dist,
       SUBSTR(budget_text, 1, 140) AS budget_excerpt, budget_dist,
       SUBSTR(estimates_text, 1, 140) AS estimates_excerpt, estimates_dist
FROM `agency2026ot-tr8-0429.gc_policy.tc_program_lineage`
WHERE program_id='izev' AND fy=2024;

-- 2. Signals row
SELECT 'signals' AS check_kind, program_id, fy, status,
       ROUND(disb_total/1e6, 1) AS disb_m,
       ROUND(est_total/1e6, 1) AS est_m,
       s1_lineage_break, ROUND(s2_magnitude_ratio, 3) AS s2,
       evidence
FROM `agency2026ot-tr8-0429.gc_policy.tc_misalignment_signals`
WHERE program_id='izev' AND fy=2024;

-- 3. Tesla disbursement breakdown
SELECT 'tesla' AS check_kind, recipient_legal_name,
       COUNT(*) AS n,
       ROUND(SUM(agreement_value)/1e6, 1) AS total_m
FROM `agency2026ot-tr8-0429.gc_policy.raw_disbursements` d
JOIN `agency2026ot-tr8-0429.gc_policy.program_registry` pr
  ON d.prog_name_en IN UNNEST(pr.aliases)
WHERE pr.program_id='izev' AND d.cal_year=2024
  AND LOWER(d.recipient_legal_name) LIKE '%tesla%'
GROUP BY 1, 2
ORDER BY total_m DESC;

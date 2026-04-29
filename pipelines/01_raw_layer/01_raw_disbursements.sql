-- raw_disbursements: TC FY22-24 view over tr8.`Transport Canada`.
-- Adds derived `fy` (FY-start year, Apr 1 anchor) and `cal_year` (calendar year of start date).
-- Each row gets a stable disbursement_id for tool-result citation.

CREATE OR REPLACE VIEW `agency2026ot-tr8-0429.gc_policy.raw_disbursements` AS
SELECT
  CONCAT('disb_', _id) AS disbursement_id,
  _id,
  ref_number,
  agreement_number,
  agreement_type,
  agreement_start_date,
  agreement_end_date,
  amendment_number,
  amendment_date,
  SAFE_CAST(agreement_value AS FLOAT64) AS agreement_value,
  recipient_legal_name,
  recipient_operating_name,
  recipient_business_number,
  recipient_country,
  recipient_province,
  recipient_city,
  prog_name_en,
  prog_name_fr,
  prog_purpose_en,
  prog_purpose_fr,
  description_en,
  expected_results_en,
  EXTRACT(YEAR FROM agreement_start_date) AS cal_year,
  EXTRACT(YEAR FROM DATE_SUB(agreement_start_date, INTERVAL 3 MONTH)) AS fy,
  owner_org,
  owner_org_title
FROM `agency2026ot-tr8-0429.tr8.Transport Canada`
WHERE owner_org = 'tc'
  AND agreement_start_date IS NOT NULL
  AND EXTRACT(YEAR FROM agreement_start_date) BETWEEN 2022 AND 2024;

# PROGRESS — Policy Misalignment Pipeline (TC v1) — issue [#1](https://github.com/TR8-inc/Promiseandpurse/issues/1)

**Started:** 2026-04-29 (live build)
**Canary:** *"Why did Tesla receive $232M from Transport Canada in 2024?"* — must answer with cited Throne quote, Budget passage, Estimates line, and disbursement breakdown.

---

## Pre-flight ✅
- GCP project `agency2026ot-tr8-0429`, account `hoang@bloxtr8.com`, region us-central1
- `tr8.Transport Canada`: 46,158 rows · 2004–2025 · Tesla 2024 = $198.8M + $33.7M + $0.0M ≈ **$232.5M ✓**
- `gc_policy` dataset exists (empty — will populate `raw_*`, `analytics_*` here)
- SA key at `pipelines/00_bq_setup/sa-key.json` (gitignored)

## Time blocks

| #  | Time        | Block                                                       | Status | Notes |
|----|-------------|-------------------------------------------------------------|:------:|-------|
| 0  | 0:00–0:05   | GCP verify · PROGRESS.md · bootstrap.sh                     | ✅     | done · `gc_policy` had to be recreated in `northamerica-northeast1` to match `tr8` region |
| 1  | 0:05–0:15   | `raw_disbursements` view + `program_registry` seed (10 rows)| ✅     | iZEV alias join confirms Tesla 2024 = $232.5M ✓ |
| 2  | 0:15–0:50   | 3 loaders parallel — throne · budget · estimates            | ✅     | throne 57 (44-1 + 43-2; 43-1 URL 404'd) · budget 303 (84+104+114+1 fallback) · estimates 11 |
| 3  | 0:50–1:10   | Vertex `text-multilingual-embedding-002` → `gc_policy.embeddings` | ✅ | 381 chunks |
| 4  | 1:10–1:30   | lineage SQL + signals SQL + iZEV canary row                 | ✅     | iZEV 2024 status=full · disb=$1,011.8M · est=$607M · S1=false · S2=1.667 |
| 5  | 1:30–1:50   | Agent: 4 BQ tools + system prompt + CLI canary test         | ✅     | gemini-2.5-pro (3-flash/3-pro not allowlisted on this project — JSON 404). End-to-end canary green: $232.46M cited [Tesla disb_ids], Throne 43-2 [throne_43-2_029…], Budget 2022 [budget_2022_p0167…], Estimates 2024-25 Vote 10 [est_2024-25_vote10…], S2=1.67 (167% over plan) |
| 6  | 1:50–2:00   | Next.js `useChat` page + ship                               | ✅     | live at http://localhost:3030 — `convertToModelMessages` is async in v6 (must `await`); port 3000 was busy (OrbStack) so on 3030; full streaming canary verified end-to-end through `/api/chat` |

Legend: ⏳ todo · 🟡 in-progress · ✅ done · 🔴 blocked

---

## Canary checklist (the demo)

- [x] `get_disbursements('izev', 2024)` → 5 Tesla agreements = $232.46M ≈ canary $232M ✓
- [x] `get_lineage('izev', 2024)` → Throne 43-2 carbon-neutral quote · Budget 2022 "$1.7B/5yr" · Estimates 2024-25 Vote 10 ✓
- [x] `get_signals('izev', 2024)` → S1 = false (full chain) · S2 = 1.667 (167% over plan — *the* misalignment signal) ✓
- [x] Agent answers chat with ≥7 distinct `[id]` citations covering Throne + Budget + Estimates + 5 disbursements ✓

---

## Decisions / blockers

(append-only log)

- **2026-04-29** — Disbursements layer is a **view** over `tr8.Transport Canada`, not a `bq load`. Saves block 1 ~5 min; same downstream contract.
- **2026-04-29** — Program registry hand-seeded (10 rows) due to typo'd `prog_name_en` variants in source (e.g. `Incentives for Zero-emission vehicles program` vs `(iZEV)` vs `(IZEV)`). One `program_id` per logical program, `aliases ARRAY<STRING>` for variants.
- **2026-04-29** — `gc_policy` had to be recreated in `northamerica-northeast1` (cross-region BQ blocked from `tr8`).
- **2026-04-29** — SA `gc-policy-pipeline@…` lacks project-level IAM (couldn't grant `bigquery.jobUser`). Granted dataset-level WRITER+OWNER on `gc_policy` and READER on `tr8` — sufficient for table writes but **not** queries. Python loaders run with user ADC instead.
- **2026-04-29** — `gemini-3-pro` and `gemini-3-flash` return JSON 404 ("your project does not have access") — both gated by Vertex preview allowlist. Shipping with `gemini-2.5-pro`. To upgrade later: Vertex AI console > Model Garden > request preview access, then flip `GEMINI_MODEL` in `.env.local`.
- **2026-04-29** — ADC quota project had to be set explicitly: `gcloud auth application-default set-quota-project agency2026ot-tr8-0429`. Without it the AI SDK falls back to Google's default `gen-lang-client` quota project where Vertex isn't enabled, producing a misleading 403.
- **2026-04-29** — AI SDK v6 changes hit during the build: `convertToModelMessages` is async (must `await`), `maxSteps` → `stopWhen: stepCountIs(N)`, `toDataStreamResponse()` → `toUIMessageStreamResponse()`, `tool({ parameters })` → `tool({ inputSchema })`, `useChat` no longer surfaces `input` / `handleInputChange` / `handleSubmit` / `isLoading` (use local `useState` + `sendMessage({ text })` + `status`). Migrated all of the above before shipping.
- **2026-04-29** — UI rendered nothing (status went to "ready" with no assistant message). Root cause: package version skew. `@ai-sdk/react@^2.0.0` pulled `ai@5.0.180` as a nested dep while server route used top-level `ai@6.0.170` — the v5 `uiMessageChunkSchema` rejected `tool-input-start` chunks carrying `providerMetadata` (added in v6), so client validation threw on every chunk and `useChat` discarded the assistant message. Fix: bump `@ai-sdk/react` to `^3.0.0` (the v6-aligned major), nuke `node_modules`, reinstall. One single `ai@6.0.170` post-fix.

## Final state

- **Live demo URL:** http://localhost:3030 (run `npm run dev`)
- **CLI canary:** `npx tsx pipelines/07_agent/test-canary.ts`
- **Model:** `gemini-2.5-pro` (set in `.env.local`); flip to `gemini-3-pro` once Vertex preview access lands
- **BigQuery tables in `gc_policy`:** `program_registry` (10), `raw_disbursements` (view, 24,045 TC FY22-24 rows), `raw_throne_speeches` (57), `raw_budget_passages` (303), `raw_estimates_lines` (11), `embeddings` (381), `tc_program_lineage` (30 program×fy), `tc_misalignment_signals` (30)
- **Agent reply (canary, abridged):** "Tesla Motors Canada Inc. received $232.46M CAD in 2024 from the iZEV program. … Estimates 2024-25 Vote 10 [$607M], Budget 2022 [\"$1.7 billion over five years\"], Throne 2020 zero-emissions fund quote, S2 ratio 1.67 (167% of plan)."

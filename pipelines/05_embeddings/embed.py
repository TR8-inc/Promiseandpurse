"""Vertex embeddings — read all chunks + program registry, embed via
text-multilingual-embedding-002, write to gc_policy.embeddings.

Single table, one row per (chunk_id, source_kind). The program registry is
embedded too (source_kind='program') so lineage joins are pure BQ cosine.
"""
from __future__ import annotations

import json
import sys
import time

from google.cloud import bigquery
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel
import vertexai

PROJECT = "agency2026ot-tr8-0429"
DATASET = "gc_policy"
LOCATION = "northamerica-northeast1"   # BQ region
VERTEX_LOCATION = "us-central1"        # Vertex region for the embedding model
MODEL = "text-multilingual-embedding-002"
TABLE = f"{PROJECT}.{DATASET}.embeddings"
BATCH = 64  # Vertex multilingual limit is 250; 64 keeps requests small/safe


def collect_inputs(bq: bigquery.Client) -> list[dict]:
    rows: list[dict] = []

    # Throne
    sql = f"""
      SELECT chunk_id, 'throne' AS source_kind,
             chunk_text AS text,
             TO_JSON_STRING(STRUCT(session, session_date, heading, source_url, source_title)) AS source_ref
      FROM `{PROJECT}.{DATASET}.raw_throne_speeches`
    """
    for r in bq.query(sql).result():
        rows.append(dict(r))

    # Budget
    sql = f"""
      SELECT chunk_id, 'budget' AS source_kind,
             chunk_text AS text,
             TO_JSON_STRING(STRUCT(budget_year, page_num, matched_keywords, source_url, source_title)) AS source_ref
      FROM `{PROJECT}.{DATASET}.raw_budget_passages`
    """
    for r in bq.query(sql).result():
        rows.append(dict(r))

    # Estimates
    sql = f"""
      SELECT estimate_id AS chunk_id, 'estimates' AS source_kind,
             CONCAT(program, ' — ', vote, ' (', vote_label, '): ', description) AS text,
             TO_JSON_STRING(STRUCT(fy_start, fy_label, vote, vote_label, program, amount, source_url, source_title)) AS source_ref
      FROM `{PROJECT}.{DATASET}.raw_estimates_lines`
    """
    for r in bq.query(sql).result():
        rows.append(dict(r))

    # Program registry — embed as a dense query string per program
    sql = f"""
      SELECT
        CONCAT('prog_', program_id) AS chunk_id,
        'program' AS source_kind,
        CONCAT(display_name, '. Aliases: ', ARRAY_TO_STRING(aliases, '; '),
               '. Themes: ', ARRAY_TO_STRING(throne_themes, ', '),
               '. Budget keywords: ', ARRAY_TO_STRING(budget_keywords, ', '),
               '. Estimates keywords: ', ARRAY_TO_STRING(estimates_match_keywords, ', '),
               COALESCE(CONCAT('. Notes: ', notes), '')) AS text,
        TO_JSON_STRING(STRUCT(program_id, display_name, short_name)) AS source_ref
      FROM `{PROJECT}.{DATASET}.program_registry`
    """
    for r in bq.query(sql).result():
        rows.append(dict(r))

    return rows


def embed_batch(model: TextEmbeddingModel, texts: list[str]) -> list[list[float]]:
    inputs = [TextEmbeddingInput(text=t, task_type="RETRIEVAL_DOCUMENT") for t in texts]
    embeddings = model.get_embeddings(inputs)
    return [e.values for e in embeddings]


def main() -> int:
    bq = bigquery.Client(project=PROJECT, location=LOCATION)
    vertexai.init(project=PROJECT, location=VERTEX_LOCATION)
    model = TextEmbeddingModel.from_pretrained(MODEL)

    schema = [
        bigquery.SchemaField("chunk_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("source_kind", "STRING"),
        bigquery.SchemaField("text", "STRING"),
        bigquery.SchemaField("source_ref", "STRING"),  # JSON
        bigquery.SchemaField("embedding", "FLOAT64", mode="REPEATED"),
        bigquery.SchemaField("model_version", "STRING"),
        bigquery.SchemaField("embedded_at", "TIMESTAMP"),
    ]
    bq.delete_table(TABLE, not_found_ok=True)
    bq.create_table(bigquery.Table(TABLE, schema=schema))

    inputs = collect_inputs(bq)
    print(f"[embed] {len(inputs)} chunks to embed", flush=True)
    if not inputs:
        return 1

    out: list[dict] = []
    t0 = time.time()
    for i in range(0, len(inputs), BATCH):
        batch = inputs[i : i + BATCH]
        texts = [r["text"][:8000] for r in batch]   # token-safe cap
        try:
            vecs = embed_batch(model, texts)
        except Exception as e:
            print(f"[embed] batch {i} failed: {e}", flush=True)
            time.sleep(2)
            try:
                vecs = embed_batch(model, texts)
            except Exception as e2:
                print(f"[embed] batch {i} retry failed: {e2}", flush=True)
                continue
        for r, v in zip(batch, vecs):
            out.append({
                "chunk_id": r["chunk_id"],
                "source_kind": r["source_kind"],
                "text": r["text"][:8000],
                "source_ref": r["source_ref"],
                "embedding": v,
                "model_version": MODEL,
                "embedded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
        print(f"[embed] {i+len(batch)}/{len(inputs)} (+{time.time()-t0:.1f}s)", flush=True)

    if not out:
        return 2

    # Use load_table_from_json for ARRAY<FLOAT64> compatibility (insert_rows_json
    # struggles with large repeated floats).
    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
    )
    import io
    buf = io.BytesIO("\n".join(json.dumps(r) for r in out).encode())
    job = bq.load_table_from_file(buf, TABLE, job_config=job_config)
    job.result()
    print(f"[embed] OK — {len(out)} rows -> {TABLE}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

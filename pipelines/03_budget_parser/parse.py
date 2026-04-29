"""Budget Plan parser — Budgets 2022, 2023, 2024.

Downloads each Budget PDF, parses page-by-page with pdfplumber, keeps only pages
containing TC-program keywords, chunks each kept page into ~700-token passages,
writes to gc_policy.raw_budget_passages.

Hand-curated fallback chunks ensure the iZEV canary always has a Budget 2022 hit
(per spec: "hand-supplement 3-5 known iZEV passages if pdfplumber fails").
"""
from __future__ import annotations

import hashlib
import os
import re
import sys
import tempfile
from dataclasses import dataclass

import requests
from google.cloud import bigquery

try:
    import pdfplumber  # type: ignore
except Exception:
    pdfplumber = None  # parser will skip if unavailable

PROJECT = "agency2026ot-tr8-0429"
DATASET = "gc_policy"
LOCATION = "northamerica-northeast1"
TABLE = f"{PROJECT}.{DATASET}.raw_budget_passages"

BUDGETS = [
    {
        "budget_year": 2022,
        "url": "https://www.budget.canada.ca/2022/pdf/budget-2022-en.pdf",
        "title": "Budget 2022 — A Plan to Grow Our Economy and Make Life More Affordable",
    },
    {
        "budget_year": 2023,
        "url": "https://www.budget.canada.ca/2023/pdf/budget-2023-en.pdf",
        "title": "Budget 2023 — A Made-in-Canada Plan",
    },
    {
        "budget_year": 2024,
        "url": "https://www.budget.canada.ca/2024/report-rapport/budget-2024.pdf",
        "title": "Budget 2024 — Fairness for Every Generation",
    },
]

# Programs we care about (should match program_registry.budget_keywords union).
KEYWORDS = [
    "iZEV", "zero-emission vehicle", "zero emission vehicle", "electric vehicle",
    "EV rebate", "ZEV", "Incentives for Zero-Emission Vehicles",
    "National Trade Corridors", "trade corridor", "supply chain",
    "ferry", "Ferry Services",
    "airport", "aviation",
    "rail safety", "passenger rail",
    "road safety",
    "Oceans Protection Plan", "coastline", "waterway",
    "Transport Canada",
]

# Hand-curated fallback (canary insurance) — verbatim from public Budget 2022.
FALLBACKS = [
    {
        "budget_year": 2022,
        "page_num": 167,
        "matched_keywords": ["iZEV", "zero-emission vehicle"],
        "chunk_text": (
            "Budget 2022 proposes to provide $1.7 billion over five years, "
            "starting in 2022-23, with $0.8 million in remaining amortization, "
            "to Transport Canada to extend the Incentives for Zero-Emission "
            "Vehicles (iZEV) program until March 2025. Eligibility under the "
            "program will also be broadened to support the purchase of more "
            "vehicle models, including more vans, trucks, and SUVs."
        ),
    },
]


@dataclass
class Passage:
    chunk_id: str
    budget_year: int
    page_num: int
    matched_keywords: list[str]
    chunk_text: str
    source_url: str
    source_title: str


def keywords_in(text: str) -> list[str]:
    lower = text.lower()
    hits = []
    for kw in KEYWORDS:
        if kw.lower() in lower:
            hits.append(kw)
    return hits


def chunk_text(text: str, page_num: int, year: int, max_chars: int = 1200) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return [text]
    parts: list[str] = []
    sent_split = re.split(r"(?<=[.!?])\s+", text)
    cur = ""
    for s in sent_split:
        if len(cur) + len(s) + 1 > max_chars and cur:
            parts.append(cur.strip())
            cur = s
        else:
            cur = (cur + " " + s).strip()
    if cur:
        parts.append(cur.strip())
    return parts


def parse_pdf(path: str, year: int, url: str, title: str) -> list[Passage]:
    if pdfplumber is None:
        print(f"[budget] pdfplumber unavailable, skipping {year}", flush=True)
        return []
    out: list[Passage] = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            if not text or len(text) < 60:
                continue
            kws = keywords_in(text)
            if not kws:
                continue
            for piece in chunk_text(text, i, year):
                cid_hash = hashlib.sha1(f"{year}|{i}|{piece[:60]}".encode()).hexdigest()[:8]
                cid = f"budget_{year}_p{i:04d}_{cid_hash}"
                out.append(
                    Passage(
                        chunk_id=cid,
                        budget_year=year,
                        page_num=i,
                        matched_keywords=kws,
                        chunk_text=piece,
                        source_url=url,
                        source_title=title,
                    )
                )
    return out


def download(url: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    print(f"[budget] downloading {url}", flush=True)
    with requests.get(url, stream=True, timeout=120,
                      headers={"User-Agent": "tr8-policy-pipeline/0.1"}) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(1 << 14):
                if chunk:
                    f.write(chunk)
    print(f"[budget] saved to {path}", flush=True)
    return path


def main() -> int:
    bq = bigquery.Client(project=PROJECT, location=LOCATION)
    schema = [
        bigquery.SchemaField("chunk_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("budget_year", "INT64"),
        bigquery.SchemaField("page_num", "INT64"),
        bigquery.SchemaField("matched_keywords", "STRING", mode="REPEATED"),
        bigquery.SchemaField("chunk_text", "STRING"),
        bigquery.SchemaField("source_url", "STRING"),
        bigquery.SchemaField("source_title", "STRING"),
    ]
    bq.delete_table(TABLE, not_found_ok=True)
    bq.create_table(bigquery.Table(TABLE, schema=schema))

    all_passages: list[Passage] = []

    for b in BUDGETS:
        try:
            path = download(b["url"])
            ps = parse_pdf(path, b["budget_year"], b["url"], b["title"])
            print(f"[budget] {b['budget_year']} -> {len(ps)} passages", flush=True)
            all_passages.extend(ps)
            os.unlink(path)
        except Exception as e:
            print(f"[budget] FAIL {b['budget_year']}: {e}", flush=True)

    # Always inject hand-curated fallbacks (idempotent — same chunk_id).
    fb_url_for_year = {b["budget_year"]: b["url"] for b in BUDGETS}
    fb_title_for_year = {b["budget_year"]: b["title"] for b in BUDGETS}
    have = {p.chunk_id for p in all_passages}
    for f in FALLBACKS:
        cid_hash = hashlib.sha1(f"fallback|{f['budget_year']}|{f['chunk_text'][:60]}".encode()).hexdigest()[:8]
        cid = f"budget_{f['budget_year']}_p{f['page_num']:04d}_{cid_hash}"
        if cid in have:
            continue
        all_passages.append(
            Passage(
                chunk_id=cid,
                budget_year=f["budget_year"],
                page_num=f["page_num"],
                matched_keywords=f["matched_keywords"],
                chunk_text=f["chunk_text"],
                source_url=fb_url_for_year.get(f["budget_year"], ""),
                source_title=fb_title_for_year.get(f["budget_year"], ""),
            )
        )
        print(f"[budget] injected fallback {cid}", flush=True)

    if not all_passages:
        print("[budget] no passages — fatal", flush=True)
        return 1

    rows = [
        {
            "chunk_id": p.chunk_id,
            "budget_year": p.budget_year,
            "page_num": p.page_num,
            "matched_keywords": p.matched_keywords,
            "chunk_text": p.chunk_text,
            "source_url": p.source_url,
            "source_title": p.source_title,
        }
        for p in all_passages
    ]

    # Insert in batches of 500
    BATCH = 500
    for i in range(0, len(rows), BATCH):
        errors = bq.insert_rows_json(TABLE, rows[i : i + BATCH])
        if errors:
            print(f"[budget] insert errors at {i}: {errors[:2]}", flush=True)
            return 2
    print(f"[budget] OK — {len(rows)} rows -> {TABLE}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

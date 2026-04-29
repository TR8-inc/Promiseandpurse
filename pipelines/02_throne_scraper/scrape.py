"""Throne speech scraper — last 3 Canadian sessions.

Fetches each session's HTML, extracts main content via BeautifulSoup,
chunks by section heading, writes to gc_policy.raw_throne_speeches.

Each chunk gets a stable chunk_id ('throne_44-1_001') for tool-result citation.
"""
from __future__ import annotations

import hashlib
import os
import re
import sys
import time
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup
from google.cloud import bigquery

PROJECT = "agency2026ot-tr8-0429"
DATASET = "gc_policy"
LOCATION = "northamerica-northeast1"
TABLE = f"{PROJECT}.{DATASET}.raw_throne_speeches"

SESSIONS = [
    {
        "session": "44-1",
        "session_date": "2021-11-23",
        "url": "https://www.canada.ca/en/privy-council/campaigns/speech-throne/2021/building-resilient-economy.html",
        "title": "Building a Resilient Economy",
    },
    {
        "session": "43-2",
        "session_date": "2020-09-23",
        "url": "https://www.canada.ca/en/privy-council/campaigns/speech-throne/2020/stronger-resilient-canada.html",
        "title": "A Stronger and More Resilient Canada",
    },
    {
        "session": "43-1",
        "session_date": "2019-12-05",
        "url": "https://www.canada.ca/en/privy-council/campaigns/speech-throne/2019/moving-forward.html",
        "title": "Moving Forward Together",
    },
]


@dataclass
class Chunk:
    chunk_id: str
    session: str
    session_date: str
    heading: str
    chunk_text: str
    char_offset: int
    source_url: str
    source_title: str


def fetch(url: str) -> str:
    r = requests.get(url, timeout=30, headers={"User-Agent": "tr8-policy-pipeline/0.1"})
    r.raise_for_status()
    return r.text


def parse(html: str, session: str, session_date: str, url: str, title: str) -> list[Chunk]:
    soup = BeautifulSoup(html, "lxml")
    main = soup.find("main") or soup.find("div", id="wb-main") or soup
    # Strip nav, scripts, asides
    for tag in main.select("script, style, nav, aside, .pagedetails, .gc-prtts, footer, header"):
        tag.decompose()

    chunks: list[Chunk] = []
    current_heading = title
    buf: list[str] = []
    char_offset = 0

    def flush() -> None:
        nonlocal buf, char_offset
        text = " ".join(s.strip() for s in buf if s.strip())
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < 80:
            buf = []
            return
        cid_seed = f"{session}|{current_heading}|{char_offset}|{text[:60]}"
        cid_hash = hashlib.sha1(cid_seed.encode()).hexdigest()[:8]
        cid = f"throne_{session}_{len(chunks)+1:03d}_{cid_hash}"
        chunks.append(
            Chunk(
                chunk_id=cid,
                session=session,
                session_date=session_date,
                heading=current_heading[:300],
                chunk_text=text,
                char_offset=char_offset,
                source_url=url,
                source_title=title,
            )
        )
        char_offset += len(text)
        buf = []

    for el in main.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
        name = el.name
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        if name in ("h1", "h2", "h3", "h4"):
            flush()
            current_heading = text
        else:
            buf.append(text)
            # Soft-break long sections
            joined_len = sum(len(s) for s in buf)
            if joined_len > 1200:
                flush()

    flush()
    return chunks


def main() -> int:
    bq = bigquery.Client(project=PROJECT, location=LOCATION)
    schema = [
        bigquery.SchemaField("chunk_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("session", "STRING"),
        bigquery.SchemaField("session_date", "DATE"),
        bigquery.SchemaField("heading", "STRING"),
        bigquery.SchemaField("chunk_text", "STRING"),
        bigquery.SchemaField("char_offset", "INT64"),
        bigquery.SchemaField("source_url", "STRING"),
        bigquery.SchemaField("source_title", "STRING"),
    ]
    table = bigquery.Table(TABLE, schema=schema)
    bq.delete_table(TABLE, not_found_ok=True)
    bq.create_table(table)

    all_chunks: list[Chunk] = []
    for s in SESSIONS:
        try:
            html = fetch(s["url"])
            chunks = parse(html, s["session"], s["session_date"], s["url"], s["title"])
            print(f"[throne] {s['session']} {s['url']} -> {len(chunks)} chunks", flush=True)
            all_chunks.extend(chunks)
        except Exception as e:
            print(f"[throne] FAIL {s['session']}: {e}", flush=True)
        time.sleep(0.3)

    if not all_chunks:
        print("[throne] no chunks; aborting", flush=True)
        return 1

    rows = [
        {
            "chunk_id": c.chunk_id,
            "session": c.session,
            "session_date": c.session_date,
            "heading": c.heading,
            "chunk_text": c.chunk_text,
            "char_offset": c.char_offset,
            "source_url": c.source_url,
            "source_title": c.source_title,
        }
        for c in all_chunks
    ]
    errors = bq.insert_rows_json(TABLE, rows)
    if errors:
        print(f"[throne] insert errors: {errors[:3]}", flush=True)
        return 2
    print(f"[throne] OK — {len(rows)} rows -> {TABLE}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

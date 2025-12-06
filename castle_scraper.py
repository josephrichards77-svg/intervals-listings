import os
import re
import csv
import json
import sqlite3
import requests
import unicodedata
from datetime import datetime
import dateparser

from playwright.sync_api import sync_playwright

# ============================================================
# IMPORT CLEANER + MERGER + EXPORTER
# ============================================================

from intervals_cleaning import (
    clean,
    normalise_row,
    merge_rows,
    export_rows
)

# ============================================================
# CONFIG
# ============================================================

CINEMA_NAME = "The Castle Cinema"
BASE_URL = "https://thecastlecinema.com"
LISTINGS_URL = f"{BASE_URL}/listings/film/"

TMDB_API_KEY = "63ca1bc21617054972b7bc2c64db096b"
TMDB_DB_FILENAME = "tmdb_cache.db"

OUTFILE = "castle_out.txt"

# ============================================================
# HELPERS
# ============================================================

RATING_RE = re.compile(r"\b(U|PG|12A|12|15|18)\b$", re.IGNORECASE)

def strip_rating(title: str) -> str:
    return RATING_RE.sub("", title).strip()

def normalise_title_for_cache(title: str) -> str:
    return (
        unicodedata.normalize("NFKD", title or "")
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .strip()
    )

# ============================================================
# TMDB CACHE
# ============================================================

_tmdb_conn = None

def get_tmdb_conn():
    global _tmdb_conn
    db_path = os.path.join(os.path.dirname(__file__), TMDB_DB_FILENAME)
    if not os.path.exists(db_path):
        return None
    if _tmdb_conn is None:
        _tmdb_conn = sqlite3.connect(db_path)
        _tmdb_conn.row_factory = sqlite3.Row
    return _tmdb_conn

def tmdb_cache_lookup(title):
    conn = get_tmdb_conn()
    if not conn:
        return {}

    cur = conn.cursor()
    cur.execute("SELECT * FROM tmdb_cache WHERE LOWER(title)=LOWER(?)", (title,))
    row = cur.fetchone()
    return dict(row) if row else {}

def tmdb_cache_upsert(title, tmdb_id, runtime, director, final_year):
    conn = get_tmdb_conn()
    if not conn:
        return
    ts = datetime.now().isoformat(timespec="seconds")
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tmdb_cache (title, tmdb_id, runtime_min, director, final_year, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(title) DO UPDATE SET
            tmdb_id=excluded.tmdb_id,
            runtime_min=excluded.runtime_min,
            director=excluded.director,
            final_year=excluded.final_year,
            last_updated=excluded.last_updated
    """, (title, tmdb_id, runtime, director, final_year, ts))
    conn.commit()

# ============================================================
# TMDB API LOOKUP
# ============================================================

def tmdb_fetch(title):
    if not TMDB_API_KEY:
        return {}

    try:
        r = requests.get(
            "https://api.themoviedb.org/3/search/movie",
            params={"api_key": TMDB_API_KEY, "query": title},
            timeout=10
        ).json()
    except:
        return {}

    results = r.get("results") or []
    if not results:
        return {}

    best = results[0]
    tmdb_id = best["id"]

    # Details
    det = requests.get(
        f"https://api.themoviedb.org/3/movie/{tmdb_id}",
        params={"api_key": TMDB_API_KEY}
    ).json()

    runtime = det.get("runtime")
    release = det.get("release_date") or ""
    year = int(release[:4]) if len(release) >= 4 else ""

    # Director
    try:
        credits = requests.get(
            f"https://api.themoviedb.org/3/movie/{tmdb_id}/credits",
            params={"api_key": TMDB_API_KEY}
        ).json()

        director = ""
        for c in credits.get("crew", []):
            if c.get("job") == "Director":
                director = c.get("name")
                break
    except:
        director = ""

    return {
        "tmdb_id": tmdb_id,
        "runtime": runtime,
        "director": director,
        "year": year
    }

def lookup_tmdb(title):
    clean_title = strip_rating(title)

    cached = tmdb_cache_lookup(clean_title)
    director = cached.get("director") or ""
    runtime = cached.get("runtime_min") or ""
    year = cached.get("final_year") or ""

    if not (director and runtime and year):
        fetched = tmdb_fetch(clean_title)
        if fetched:
            director = fetched.get("director") or director
            runtime = fetched.get("runtime") or runtime
            year = fetched.get("year") or year
            tmdb_cache_upsert(clean_title, fetched.get("tmdb_id"), runtime, director, year)

    return {
        "director": clean(director),
        "runtime_min": str(runtime or ""),
        "year": str(year or ""),
        "format": "DCP",
    }

# ============================================================
# SCRAPER
# ============================================================

def scrape():
    rows = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(LISTINGS_URL)

        films = page.locator("div.programme-tile")

        for i in range(films.count()):
            f = films.nth(i)

            # Title
            title = clean(f.locator("div.tile-details h1").inner_text())

            # Link
            href = f.locator("div.tile-details a").get_attribute("href")
            link = href if href.startswith("http") else f"{BASE_URL}{href}"

            # Open the film page
            fp = browser.new_page()
            fp.goto(link)

            # JSON-LD screenings
            blocks = fp.locator('script[type="application/ld+json"]')
            times = []

            for j in range(blocks.count()):
                try:
                    data = json.loads(blocks.nth(j).inner_text())
                except:
                    continue

                if isinstance(data, dict) and data.get("@type") == "ScreeningEvent":
                    dt = datetime.fromisoformat(data["startDate"])
                    times.append(dt)
            
            fp.close()

            # Metadata
            tmdb = lookup_tmdb(title)

            # Build clean rows
            for dt in times:
                rows.append(normalise_row({
                    "venue": CINEMA_NAME,
                    "date": dt.strftime("%Y-%m-%d"),
                    "title": f"<a href='{link}'>{title}</a>",
                    "director": tmdb["director"],
                    "runtime_min": tmdb["runtime_min"],
                    "format": tmdb["format"],
                    "times": [dt.strftime("%H:%M")],
                    "year": tmdb["year"],
                    "extra": "",
                    "url": link,
                }))

        browser.close()

    return rows

# ============================================================
# MAIN EXPORT
# ============================================================

def main():
    scraped = scrape()
    merged = []

    for row in scraped:
        merge_rows(merged, row)

    output = export_rows(merged)

    with open(OUTFILE, "w", encoding="utf-8") as f:
        f.write(output)

    print(f"✔ Castle scraper exported {len(merged)} rows → {OUTFILE}")

# ============================================================

if __name__ == "__main__":
    main()

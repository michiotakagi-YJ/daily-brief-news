#!/usr/bin/env python3
"""Validate ChatGPT curated editions and publish machine-readable freshness.

No API credentials or OpenAI API usage. Called by GitHub Actions after RSS collection.
"""
import datetime as dt
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "editorial"
JST = ZoneInfo("Asia/Tokyo")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}\.json$")
CATEGORIES = set(("politics", "economy", "finance", "companies", "realestate",
                  "international", "technology", "medicine", "environment",
                  "society", "education", "culture", "other"))

def validate(data, day):
    if data.get("schema_version") != 1:
        return "schema_version != 1"
    if data.get("edition_date") != day:
        return "edition_date mismatch"
    if not isinstance(data.get("sections"), list) or not data["sections"]:
        return "missing sections"
    total = 0
    ids = set()
    for sec in data["sections"]:
        if not isinstance(sec, dict) or not isinstance(sec.get("items"), list):
            return "invalid section"
        score = sec.get("importance")
        if not isinstance(score, int) or not 1 <= score <= 5:
            return "invalid section importance"
        for item in sec["items"]:
            total += 1
            if not isinstance(item, dict) or not all(item.get(k) for k in ("title","summary","id")):
                return "missing article fields"
            if not isinstance(item.get("importance"), int) or not 1 <= item["importance"] <= 5:
                return "invalid article importance"
            if item["id"] in ids:
                return "duplicate item id"
            ids.add(item["id"])
            sources = item.get("sources")
            if not isinstance(sources, list) or not sources:
                return "missing sources"
            if not any(isinstance(s,dict) and isinstance(s.get("url"),str)
                       and s["url"].startswith(("https://","http://")) for s in sources):
                return "missing valid source URL"
    if not total:
        return "no articles"
    return None

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    today = dt.datetime.now(JST).date()
    published = []
    invalid = []
    for path in sorted(DEST.glob("*.json")):
        if not DAY.fullmatch(path.name):
            continue
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
            reason = validate(d, path.stem)
        except Exception as e:
            reason = "read/parse failure: " + str(e)[:80]
            d = {}
        if reason:
            invalid.append({"date":path.stem,"reason":reason})
        else:
            published.append({"date":path.stem,"count":sum(len(s["items"]) for s in d["sections"])})
    latest = max(published,key=lambda d:d["date"]) if published else None
    expected = today.isoformat()
    status = {
        "schema_version":1,
        "checked_at":dt.datetime.now(JST).isoformat(timespec="seconds"),
        "expected_date":expected,
        "last_published":latest,
        "current_day_present":any(x["date"]==expected for x in published),
        "invalid_editions":invalid[-12:],
        "status":"ready" if any(x["date"]==expected for x in published) else "awaiting_edition"
    }
    (DEST/"health.json").write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(status,ensure_ascii=False))
    # An unpublished AI edition is a reportable condition, not a failure for RSS deployment.
if __name__=="__main__":
    main()

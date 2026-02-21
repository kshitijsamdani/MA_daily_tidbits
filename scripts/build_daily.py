import json
import re
from datetime import datetime, timezone
from urllib.parse import quote

import requests
import feedparser


SCIENCEDAILY_FEED = "https://www.sciencedaily.com/rss/top/science.xml"

WIKI_OPENSEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"


def clean_html(text: str) -> str:
    if not text:
        return ""
    # remove tags + collapse whitespace
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def wiki_best_image_and_url(query: str):
    """
    1) Wikipedia opensearch -> pick first page title
    2) Wikipedia REST summary -> thumbnail if available
    """
    try:
        params = {
            "action": "opensearch",
            "search": query,
            "limit": 1,
            "namespace": 0,
            "format": "json",
        }
        r = requests.get(WIKI_OPENSEARCH, params=params, timeout=12)
        r.raise_for_status()
        data = r.json()
        titles = data[1] if len(data) > 1 else []
        urls = data[3] if len(data) > 3 else []
        if not titles:
            return "", ""

        title = titles[0]
        wiki_url = urls[0] if urls else f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"

        s = requests.get(WIKI_SUMMARY + quote(title), timeout=12, headers={"accept": "application/json"})
        if s.status_code != 200:
            return "", wiki_url

        summary = s.json()
        thumb = summary.get("thumbnail", {}).get("source", "")
        return thumb, wiki_url
    except Exception:
        return "", ""


def main():
    feed = feedparser.parse(SCIENCEDAILY_FEED)
    entries = feed.entries[:5]

    items = []
    for e in entries:
        title = (e.get("title") or "").strip()
        link = (e.get("link") or "").strip()
        summary = clean_html(e.get("summary") or e.get("description") or "")

        # try to find a representative Wikipedia image for the title
        image, wiki_url = wiki_best_image_and_url(title)

        items.append(
            {
                "title": title,
                "summary": summary,
                "link": link,
                "image": image,
                "wiki_url": wiki_url,
            }
        )

    out = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "items": items,
    }

    with open("data/daily.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("Wrote data/daily.json with", len(items), "items")


if __name__ == "__main__":
    main()

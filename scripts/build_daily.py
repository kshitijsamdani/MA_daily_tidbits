import json
import re
from datetime import datetime, timezone
from urllib.parse import quote

import requests
import feedparser

SCIENCEDAILY_FEED = "https://www.sciencedaily.com/rss/top/science.xml"

WIKI_OPENSEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"

CUSTOM_FACTS_PATH = "data/custom_facts.json"


def clean_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_unsplash_fallback(keywords: str) -> str:
    # Always returns an image; no API key needed
    return f"https://source.unsplash.com/1600x900/?{quote(keywords or 'science')}"


def categorize(title: str, summary: str) -> str:
    t = (title + " " + summary).lower()

    # simple keyword rules (you can expand these anytime)
    if any(k in t for k in ["artificial intelligence", "ai", "machine learning", "neural", "deep learning", "llm"]):
        return "AI"
    if any(k in t for k in ["quantum", "particle", "physics", "relativity", "thermodynamics", "gravity"]):
        return "Physics"
    if any(k in t for k in ["startup", "entrepreneur", "business", "founder", "market", "innovation"]):
        return "Entrepreneurship"
    if any(k in t for k in ["space", "nasa", "planet", "galaxy", "astronomy", "mars", "moon", "exoplanet"]):
        return "Space"
    if any(k in t for k in ["cell", "genome", "biology", "species", "evolution", "microbe", "protein"]):
        return "Biology"
    if any(k in t for k in ["health", "disease", "cancer", "medicine", "clinical", "brain", "heart"]):
        return "Health"
    if any(k in t for k in ["climate", "environment", "carbon", "ocean", "pollution", "ecosystem"]):
        return "Environment"

    return "Science"


def wiki_best_image_and_url(query: str):
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


def load_custom_facts():
    try:
        with open(CUSTOM_FACTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        items = data.get("items", [])
        # normalize
        out = []
        for x in items:
            out.append(
                {
                    "title": x.get("title", "").strip(),
                    "summary": x.get("summary", "").strip(),
                    "link": x.get("link", "").strip(),
                    "image": x.get("image", "").strip(),
                    "wiki_url": x.get("wiki_url", "").strip(),
                    "category": x.get("category", "For you specially").strip() or "For you specially",
                }
            )
        return out
    except FileNotFoundError:
        return []
    except Exception:
        return []


def main():
    feed = feedparser.parse(SCIENCEDAILY_FEED)
    entries = feed.entries[:5]

    items = []
    for e in entries:
        title = (e.get("title") or "").strip()
        link = (e.get("link") or "").strip()
        summary = clean_html(e.get("summary") or e.get("description") or "")

        category = categorize(title, summary)

        image, wiki_url = wiki_best_image_and_url(title)

        # Guarantee an image by adding a fallback if Wikipedia has none
        if not image:
            image = build_unsplash_fallback(f"{category},{title}")

        items.append(
            {
                "title": title,
                "summary": summary,
                "link": link,
                "image": image,
                "wiki_url": wiki_url,
                "category": category,
            }
        )

    # Merge in your custom facts (not overwritten)
    custom_items = load_custom_facts()

    out = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "items": items + custom_items,
    }

    with open("data/daily.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("Wrote data/daily.json with", len(out["items"]), "items")


if __name__ == "__main__":
    main()

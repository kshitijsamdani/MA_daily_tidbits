import json
import re
from datetime import datetime, timezone
from urllib.parse import quote
import random

import requests
import feedparser

FEEDS = [
    "https://www.sciencedaily.com/rss/top/science.xml",
    "https://www.sciencedaily.com/rss/top/technology.xml",
    "https://www.sciencedaily.com/rss/top/health.xml",
    "https://www.sciencedaily.com/rss/top/environment.xml",
    "https://www.sciencedaily.com/rss/top/society.xml",
]

WIKI_OPENSEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
CUSTOM_FACTS_PATH = "data/custom_facts.json"

TARGET_CATEGORIES = [
    "AI",
    "Physics",
    "Entrepreneurship",
    "Space",
    "Biology",
    "Health",
    "Environment",
    "Science",
]

def clean_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def first_two_sentences(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(parts[:2]).strip()

def build_unsplash_fallback(keywords: str) -> str:
    return f"https://source.unsplash.com/1600x900/?{quote(keywords or 'science')}"

def categorize(title: str, summary: str) -> str:
    t = (title + " " + summary).lower()

    if any(k in t for k in ["artificial intelligence", " ai ", "machine learning", "neural", "deep learning", "llm", "model", "generative ai"]):
        return "AI"
    if any(k in t for k in ["quantum", "particle", "physics", "relativity", "thermodynamics", "gravity", "neutrino", "fusion", "plasma"]):
        return "Physics"
    if any(k in t for k in ["startup", "entrepreneur", "founder", "business", "market", "industry", "productivity", "economy"]):
        return "Entrepreneurship"
    if any(k in t for k in ["space", "nasa", "planet", "galaxy", "astronomy", "mars", "moon", "exoplanet", "hubble", "telescope"]):
        return "Space"
    if any(k in t for k in ["cell", "genome", "biology", "species", "evolution", "microbe", "protein", "dna", "rna"]):
        return "Biology"
    if any(k in t for k in ["health", "disease", "cancer", "medicine", "clinical", "brain", "heart", "diabetes", "alzheimer"]):
        return "Health"
    if any(k in t for k in ["climate", "environment", "carbon", "ocean", "pollution", "ecosystem", "warming", "wildlife"]):
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

        s = requests.get(
            WIKI_SUMMARY + quote(title),
            timeout=12,
            headers={"accept": "application/json"},
        )
        if s.status_code != 200:
            return "", wiki_url

        summary = s.json()
        thumb = summary.get("thumbnail", {}).get("source", "")
        return thumb, wiki_url
    except Exception:
        return "", ""

def make_hook(category: str) -> str:
    starters = {
        "AI": [
            "FYI: AI stands for Artificial Intelligence, not Another Idli",
        ],
        "Physics": [
            "FYI: Physics is the most complex, difficult and interesting subject... second only to you",
        ],
        "Entrepreneurship": [
            "FYI: Brainpowerzzz has the potential to become a successful startup",
        ],
        "Space": [
            "FYI: No one bends space more than you do",
        ],
        "Biology": [
            "FYI: You have 86 billion neurons. Activate atleast one now and then",
        ],
        "Health": [
            "FYI: Eating junk tasty food alone is injurious to mental health of others. #ShareFoodShareHunger",
        ],
        "Environment": [
            "FYI: Don't pluck flowers",
        ],
        "Science": [
            "FYI: You are in my conScience all the time :)",
        ],
    }
    pool = starters.get(category, starters["Science"])
    return random.choice(pool)

def make_question(category: str) -> str:
    questions = {
        "AI": "Can you now summarize your conference recordings using AI?",
        "Physics": "How's my rizz game?",
        "Entrepreneurship": "Am I correct?",
        "Space": "Are you the brightest object in the sky?",
        "Biology": "What does XNA stand for again?",
        "Health": "How many flights of stairs today?",
        "Environment": "Is it okay for immigrants to litter?",
        "Science":  "You didn't answer. How's my rizz game?",
    }
    return questions.get(category, questions["Science"])

def load_custom_facts():
    try:
        with open(CUSTOM_FACTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data.get("items", [])
        out = []

        for x in items:
            category = (x.get("category", "For you specially") or "").strip() or "For you specially"

            # NEW: allow either image (string) or images (array)
            image = (x.get("image", "") or "").strip()
            images = x.get("images", [])
            if not isinstance(images, list):
                images = []
            images = [str(p).strip() for p in images if str(p).strip()]

            # If user only gave image, convert to images[0] for convenience
            if (not images) and image:
                images = [image]

            # NEW: audio object
            audio = x.get("audio", None)
            if not isinstance(audio, dict):
                audio = None
            else:
                src = (audio.get("src", "") or "").strip()
                title = (audio.get("title", "") or "").strip()
                audio = {"src": src, "title": title} if src else None

            out.append(
                {
                    "title": (x.get("title", "") or "").strip(),
                    "summary": (x.get("summary", "") or "").strip(),
                    "link": (x.get("link", "") or "").strip(),
                    "wiki_url": (x.get("wiki_url", "") or "").strip(),
                    "category": category,
                    "hook": (x.get("hook", "") or "").strip(),
                    "question": (x.get("question", "") or "").strip(),

                    # keep both for backward compatibility
                    "image": image,
                    "images": images,
                    "audio": audio,
                }
            )

        return out
    except FileNotFoundError:
        return []
    except Exception:
        return []

def parse_candidates():
    seen_links = set()
    candidates = []

    for feed_url in FEEDS:
        feed = feedparser.parse(feed_url)
        for e in feed.entries[:40]:
            title = (e.get("title") or "").strip()
            link = (e.get("link") or "").strip()
            if not title or not link or link in seen_links:
                continue
            seen_links.add(link)

            summary = clean_html(e.get("summary") or e.get("description") or "")
            summary = first_two_sentences(summary)

            category = categorize(title, summary)

            image, wiki_url = wiki_best_image_and_url(title)
            image = ""  # you intentionally disabled wiki image

            candidates.append(
                {
                    "title": title,
                    "summary": summary,
                    "link": link,
                    "image": image,
                    "wiki_url": wiki_url,
                    "category": category,
                    "hook": make_hook(category),
                    "question": make_question(category),

                    # keep keys consistent
                    "images": [],
                    "audio": None,
                }
            )

    return candidates

def pick_one_per_category(candidates):
    picked = []
    used_links = set()

    for cat in TARGET_CATEGORIES:
        match = next((x for x in candidates if x["category"] == cat and x["link"] not in used_links), None)
        if match:
            picked.append(match)
            used_links.add(match["link"])

    missing = [c for c in TARGET_CATEGORIES if c not in {x["category"] for x in picked}]
    if missing:
        leftovers = [x for x in candidates if x["link"] not in used_links]
        for cat in missing:
            if leftovers:
                x = leftovers.pop(0)
                x["category"] = cat
                x["hook"] = make_hook(cat)
                x["question"] = make_question(cat)
                picked.append(x)

    return picked

def main():
    candidates = parse_candidates()
    items = pick_one_per_category(candidates)

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

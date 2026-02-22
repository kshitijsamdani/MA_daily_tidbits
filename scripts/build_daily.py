import json
import re
from datetime import datetime, timezone
from urllib.parse import quote
import random

import requests
import feedparser

# -----------------------------
# SOURCES
# -----------------------------
# Keep your existing ScienceDaily top feeds, but ALSO add:
# - ScienceDaily "Strange & Offbeat" (more "fun")
# - Phys.org category pages (more variety)
# - MIT News RSS (good for AI/tech + business-ish stories)
#
# Note: We will pick PER CATEGORY from CATEGORY_FEEDS (below),
# and we will use Wikipedia "quick fact" fallback if a category has no match.

GENERAL_FEEDS = [
    "https://www.sciencedaily.com/rss/top/science.xml",
    "https://www.sciencedaily.com/rss/top/technology.xml",
    "https://www.sciencedaily.com/rss/top/health.xml",
    "https://www.sciencedaily.com/rss/top/environment.xml",
    "https://www.sciencedaily.com/rss/top/society.xml",
    "https://www.sciencedaily.com/rss/strange_offbeat.xml",
    "https://news.mit.edu/rss",
]

# Per-category feeds (try these first to keep categories consistent)
CATEGORY_FEEDS = {
    "AI": [
        # ScienceDaily AI section page is reliable; RSS is linked from their RSS directory.
        # If it ever fails, we'll still have GENERAL_FEEDS + Wikipedia fallback.
        "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml",
        "https://www.sciencedaily.com/rss/computers_math/machine_learning.xml",
        "https://www.sciencedaily.com/rss/computers_math/robotics.xml",
        "https://news.mit.edu/rss",
        "https://phys.org/rss-feed/technology-news/",
    ],
    "Physics": [
        "https://www.sciencedaily.com/rss/matter_energy.xml",
        "https://www.sciencedaily.com/rss/space_time.xml",
        "https://phys.org/rss-feed/physics-news/",
        "https://phys.org/rss-feed/materials-news/",
    ],
    "Entrepreneurship": [
        # Entrepreneurship is hard to source in pure "science" RSS.
        # We'll treat this as "science/tech innovation + business/industry angle".
        "https://www.sciencedaily.com/rss/business_industry.xml",
        "https://www.sciencedaily.com/rss/computers_math/technology.xml",
        "https://news.mit.edu/rss",
        "https://phys.org/rss-feed/business-news/",
        "https://phys.org/rss-feed/technology-news/",
    ],
    "Space": [
        "https://www.sciencedaily.com/rss/space_time.xml",
        "https://www.sciencedaily.com/rss/space_time/astronomy.xml",
        "https://phys.org/rss-feed/space-news/",
        # NASA feeds are great, but sometimes rate-limit. Keeping them optional:
        "https://www.nasa.gov/feed/",
    ],
    "Biology": [
        "https://www.sciencedaily.com/rss/plants_animals.xml",
        "https://www.sciencedaily.com/rss/plants_animals/biology.xml",
        "https://phys.org/rss-feed/biology-news/",
        "https://phys.org/rss-feed/plants-news/",
    ],
    "Health": [
        "https://www.sciencedaily.com/rss/health.xml",
        "https://www.sciencedaily.com/rss/health_medicine.xml",
        "https://phys.org/rss-feed/medicine-news/",
    ],
    "Environment": [
        "https://www.sciencedaily.com/rss/environment.xml",
        "https://www.sciencedaily.com/rss/earth_climate.xml",
        "https://phys.org/rss-feed/earth-news/",
        "https://phys.org/rss-feed/environment-news/",
    ],
    "Science": [
        "https://www.sciencedaily.com/rss/top/science.xml",
        "https://www.sciencedaily.com/rss/most_popular.xml",
        "https://phys.org/rss-feed/science-news/",
        "https://www.sciencedaily.com/rss/strange_offbeat.xml",
    ],
}

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

# Wikipedia “quick fact” seeds: simple + fun + stable.
# (These are just page titles; we’ll fetch a short summary daily.)
WIKI_SEEDS = {
    "AI": [
        "Transformer (machine learning)",
        "Backpropagation",
        "Convolutional neural network",
        "Large language model",
        "AlphaFold",
    ],
    "Physics": [
        "Double-slit experiment",
        "Quantum entanglement",
        "Higgs boson",
        "Superconductivity",
        "Time dilation",
    ],
    "Entrepreneurship": [
        "Lean startup",
        "Network effect",
        "Venture capital",
        "Product–market fit",
        "Business model",
    ],
    "Space": [
        "James Webb Space Telescope",
        "Voyager program",
        "Exoplanet",
        "Black hole",
        "Aurora",
    ],
    "Biology": [
        "CRISPR",
        "Mitochondrion",
        "Gut microbiota",
        "DNA",
        "Octopus",
    ],
    "Health": [
        "Placebo",
        "Vaccine",
        "Circadian rhythm",
        "Insulin",
        "MRI",
    ],
    "Environment": [
        "Carbon cycle",
        "Coral bleaching",
        "Renewable energy",
        "Ozone layer",
        "Greenhouse effect",
    ],
    "Science": [
        "Periodic table",
        "DNA",
        "Tardigrade",
        "Photosynthesis",
        "Penicillin",
    ],
}

# -----------------------------
# Helpers
# -----------------------------
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

def wiki_best_image_and_url(query: str):
    # You currently disable images intentionally; keep behavior.
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
        return "", wiki_url
    except Exception:
        return "", ""

# -----------------------------
# KEEP THESE AS-IS (your custom tone)
# -----------------------------
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

# -----------------------------
# Custom facts loader (unchanged behavior)
# -----------------------------
def load_custom_facts():
    try:
        with open(CUSTOM_FACTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data.get("items", [])
        out = []

        for x in items:
            category = (x.get("category", "For you specially") or "").strip() or "For you specially"

            image = (x.get("image", "") or "").strip()
            images = x.get("images", [])
            if not isinstance(images, list):
                images = []
            images = [str(p).strip() for p in images if str(p).strip()]

            if (not images) and image:
                images = [image]

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

# -----------------------------
# New: pick per-category from per-category feeds
# -----------------------------
def entry_to_item(e, forced_category: str):
    title = (e.get("title") or "").strip()
    link = (e.get("link") or "").strip()

    summary = clean_html(e.get("summary") or e.get("description") or "")
    summary = first_two_sentences(summary)

    # If summary is empty, skip
    if not title or not link or not summary:
        return None

    _, wiki_url = wiki_best_image_and_url(title)

    return {
        "title": title,
        "summary": summary,
        "link": link,
        "image": "",  # you intentionally disabled wiki image
        "wiki_url": wiki_url,
        "category": forced_category,
        "hook": make_hook(forced_category),
        "question": make_question(forced_category),
        "images": [],
        "audio": None,
    }

def parse_feed(url: str, limit: int = 30):
    try:
        feed = feedparser.parse(url)
        return feed.entries[:limit]
    except Exception:
        return []

def pick_from_feeds_for_category(category: str, used_links: set):
    # 1) Try category-specific feeds
    for url in CATEGORY_FEEDS.get(category, []):
        for e in parse_feed(url, limit=35):
            item = entry_to_item(e, forced_category=category)
            if not item:
                continue
            if item["link"] in used_links:
                continue
            return item

    # 2) Fallback: try general feeds but still forced category
    for url in GENERAL_FEEDS:
        for e in parse_feed(url, limit=35):
            item = entry_to_item(e, forced_category=category)
            if not item:
                continue
            if item["link"] in used_links:
                continue
            return item

    return None

def wiki_quick_fact(category: str):
    # Pick a random seed page, fetch a short summary.
    seeds = WIKI_SEEDS.get(category, WIKI_SEEDS["Science"])
    page = random.choice(seeds)

    try:
        r = requests.get(WIKI_SUMMARY + quote(page), timeout=12, headers={"accept": "application/json"})
        if r.status_code != 200:
            raise RuntimeError("bad wiki status")

        data = r.json()
        title = (data.get("title") or page).strip()
        extract = (data.get("extract") or "").strip()
        summary = first_two_sentences(extract) or extract

        # Page link
        wiki_url = ""
        content_urls = data.get("content_urls", {})
        if isinstance(content_urls, dict):
            desktop = content_urls.get("desktop", {})
            if isinstance(desktop, dict):
                wiki_url = (desktop.get("page") or "").strip()
        if not wiki_url:
            wiki_url = f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"

        return {
            "title": f"Quick fact: {title}",
            "summary": summary if summary else f"Fun fact about {title}.",
            "link": wiki_url,      # treat wiki as “Read article”
            "image": "",           # UI uses category image anyway
            "wiki_url": wiki_url,  # “Learn more”
            "category": category,
            "hook": make_hook(category),
            "question": make_question(category),
            "images": [],
            "audio": None,
        }
    except Exception:
        # absolute last resort
        return {
            "title": f"Quick fact ({category})",
            "summary": "No fresh feed today, so here’s a tiny reminder: science is happening everywhere — check back tomorrow.",
            "link": "",
            "image": "",
            "wiki_url": "",
            "category": category,
            "hook": make_hook(category),
            "question": make_question(category),
            "images": [],
            "audio": None,
        }

def main():
    items = []
    used_links = set()

    # IMPORTANT CHANGE:
    # - We do NOT relabel leftovers anymore.
    # - We always produce one item per category:
    #   (a) from category feeds, else (b) Wikipedia quick fact.
    for cat in TARGET_CATEGORIES:
        picked = pick_from_feeds_for_category(cat, used_links)
        if not picked:
            picked = wiki_quick_fact(cat)

        if picked.get("link"):
            used_links.add(picked["link"])
        items.append(picked)

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

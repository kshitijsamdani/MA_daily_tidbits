import json
import re
from datetime import datetime, timezone
from urllib.parse import quote
import random
import time

import requests
import feedparser

# -----------------------------
# Feeds (science-y + variety)
# -----------------------------
FEEDS = [
    "https://www.sciencedaily.com/rss/top/science.xml",
    "https://www.sciencedaily.com/rss/top/technology.xml",
    "https://www.sciencedaily.com/rss/top/health.xml",
    "https://www.sciencedaily.com/rss/top/environment.xml",
    "https://www.sciencedaily.com/rss/top/society.xml",
    "https://www.sciencedaily.com/rss/strange_offbeat.xml",
    "https://phys.org/rss-feed/",
    "https://news.mit.edu/rss",
]

WIKI_OPENSEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
CUSTOM_FACTS_PATH = "data/custom_facts.json"

# IMPORTANT: Wikipedia REST often expects a descriptive User-Agent.
# This is critical for GitHub Actions reliability.
HTTP_HEADERS = {
    "accept": "application/json",
    "user-agent": "MA_daily_tidbits/1.0 (https://github.com/kshitijsamdani/MA_daily_tidbits; contact: kshitijsamdani)",
}

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

# -----------------------------
# Text helpers
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

def safe_lower(s: str) -> str:
    return (s or "").lower()

# -----------------------------
# Your existing category heuristic (kept)
# -----------------------------
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

# -----------------------------
# KEEP AS-IS: your custom hook/question (unchanged)
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
# Custom facts loader (kept)
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
# NEW: relevance scoring (better category pick)
# -----------------------------
CATEGORY_KEYWORDS = {
    "AI": [
        "artificial intelligence", "machine learning", "neural", "deep learning", "llm",
        "transformer", "generative", "diffusion", "reinforcement learning", "computer vision", "nlp"
    ],
    "Physics": [
        "quantum", "particle", "relativity", "thermodynamics", "gravity", "neutrino", "fusion",
        "plasma", "superconduct", "boson", "accelerator"
    ],
    "Entrepreneurship": [
        "startup", "entrepreneur", "founder", "venture", "funding", "business", "company",
        "product–market fit", "product-market fit", "innovation", "commercial", "industry"
    ],
    "Space": [
        "space", "nasa", "planet", "galaxy", "astronomy", "mars", "moon", "exoplanet",
        "telescope", "asteroid", "comet", "jupiter", "saturn"
    ],
    "Biology": [
        "cell", "genome", "biology", "species", "evolution", "microbe", "protein", "dna", "rna",
        "enzyme", "bacteria", "virus", "microbiome"
    ],
    "Health": [
        "health", "disease", "cancer", "medicine", "clinical", "brain", "heart", "diabetes",
        "alzheimer", "vaccine", "drug", "therapy"
    ],
    "Environment": [
        "climate", "environment", "carbon", "ocean", "pollution", "ecosystem", "warming",
        "wildlife", "emissions", "biodiversity"
    ],
    "Science": [
        "research", "scientists", "study", "experiment", "discovery"
    ],
}

def relevance_score(category: str, title: str, summary: str) -> int:
    text = safe_lower(title) + " " + safe_lower(summary)
    score = 0
    for k in CATEGORY_KEYWORDS.get(category, []):
        if k in text:
            score += 2
    if categorize(title, summary) == category:
        score += 1
    return score

# -----------------------------
# Wikipedia fun-fact seeds + final fallback facts (guaranteed)
# -----------------------------
WIKI_SEEDS = {
    "AI": ["Transformer (machine learning)", "Backpropagation", "Convolutional neural network", "AlphaFold", "Large language model"],
    "Physics": ["Quantum entanglement", "Double-slit experiment", "Superconductivity", "Time dilation", "Higgs boson"],
    "Entrepreneurship": ["Lean startup", "Network effect", "Venture capital", "Product–market fit", "Business model"],
    "Space": ["James Webb Space Telescope", "Exoplanet", "Voyager program", "Black hole", "Aurora"],
    "Biology": ["CRISPR", "Mitochondrion", "DNA", "Gut microbiota", "Octopus"],
    "Health": ["Vaccine", "Placebo", "Circadian rhythm", "MRI", "Insulin"],
    "Environment": ["Carbon cycle", "Coral bleaching", "Ozone layer", "Greenhouse effect", "Renewable energy"],
    "Science": ["Tardigrade", "Periodic table", "Penicillin", "Photosynthesis", "DNA"],
}

# Absolute last-resort facts (no network needed)
FALLBACK_FUN_FACTS = {
    "AI": [
        "Did you know? A neural network ‘learns’ by adjusting millions of tiny numbers called weights.",
        "Did you know? The same transformer idea powers many chatbots and translation systems.",
    ],
    "Physics": [
        "Did you know? If the Sun suddenly vanished, Earth would keep orbiting for about 8 minutes before ‘noticing’.",
        "Did you know? Absolute zero is the coldest possible temperature — but it’s practically unreachable.",
    ],
    "Entrepreneurship": [
        "Did you know? Many startups fail not due to tech, but because they build something nobody wants.",
        "Did you know? A ‘network effect’ means a product gets more valuable as more people use it.",
    ],
    "Space": [
        "Did you know? Venus rotates so slowly that a day on Venus is longer than its year.",
        "Did you know? You can fit over 1 million Earths inside the Sun by volume (roughly).",
    ],
    "Biology": [
        "Did you know? Your body has roughly as many bacterial cells as human cells (order-of-magnitude).",
        "Did you know? Octopuses have blue blood because it uses copper-based hemocyanin.",
    ],
    "Health": [
        "Did you know? Your circadian rhythm affects alertness, digestion, and even body temperature.",
        "Did you know? Placebos can cause real effects — especially on symptoms like pain and nausea.",
    ],
    "Environment": [
        "Did you know? A single mature tree can host hundreds of species of insects, fungi, and microbes.",
        "Did you know? Most of Earth’s oxygen is produced by ocean phytoplankton, not forests.",
    ],
    "Science": [
        "Did you know? Tardigrades can survive extreme cold, radiation, and even the vacuum of space (for a while).",
        "Did you know? Penicillin was discovered after mold accidentally contaminated a petri dish.",
    ],
}

def wiki_page_url_from_title(title: str) -> str:
    return f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"

def fetch_wiki_summary(title: str) -> dict | None:
    # retry a bit (handles transient 429/5xx)
    for attempt in range(3):
        try:
            r = requests.get(WIKI_SUMMARY + quote(title), timeout=15, headers=HTTP_HEADERS)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(1.25 * (attempt + 1))
                continue
            if r.status_code != 200:
                return None
            data = r.json()
            return data if isinstance(data, dict) else None
        except Exception:
            time.sleep(1.25 * (attempt + 1))
    return None

def wiki_fun_fact(category: str):
    page = random.choice(WIKI_SEEDS.get(category, WIKI_SEEDS["Science"]))

    data = fetch_wiki_summary(page)
    if not data:
        return fun_fact_offline(category)

    # handle disambiguation / missing extract
    extract = (data.get("extract") or "").strip()
    if not extract or data.get("type") == "disambiguation":
        # try another seed once
        page2 = random.choice(WIKI_SEEDS.get(category, WIKI_SEEDS["Science"]))
        data2 = fetch_wiki_summary(page2)
        if data2 and (data2.get("extract") or "").strip() and data2.get("type") != "disambiguation":
            data = data2
            extract = (data.get("extract") or "").strip()
        else:
            return fun_fact_offline(category)

    title = (data.get("title") or page).strip()
    fun = first_two_sentences(extract) or extract
    fun = fun.strip()

    summary = f"Did you know? {fun}" if fun else random.choice(FALLBACK_FUN_FACTS.get(category, FALLBACK_FUN_FACTS["Science"]))

    # best link
    wiki_url = ""
    content_urls = data.get("content_urls", {})
    if isinstance(content_urls, dict):
        desktop = content_urls.get("desktop", {})
        if isinstance(desktop, dict):
            wiki_url = (desktop.get("page") or "").strip()
    if not wiki_url:
        wiki_url = wiki_page_url_from_title(title)

    return {
        "title": f"Quick fact: {title}",
        "summary": summary,
        "link": wiki_url,
        "image": "",  # keep wiki image disabled
        "wiki_url": wiki_url,
        "category": category,
        "hook": make_hook(category),
        "question": make_question(category),
        "images": [],
        "audio": None,
    }

def fun_fact_offline(category: str):
    text = random.choice(FALLBACK_FUN_FACTS.get(category, FALLBACK_FUN_FACTS["Science"]))
    return {
        "title": f"Quick fact: {category}",
        "summary": text,
        "link": "",
        "image": "",
        "wiki_url": "",
        "category": category,
        "hook": make_hook(category),
        "question": make_question(category),
        "images": [],
        "audio": None,
    }

# -----------------------------
# RSS parsing -> candidates
# -----------------------------
def parse_candidates():
    seen_links = set()
    candidates = []

    for feed_url in FEEDS:
        feed = feedparser.parse(feed_url)
        for e in feed.entries[:60]:
            title = (e.get("title") or "").strip()
            link = (e.get("link") or "").strip()
            if not title or not link or link in seen_links:
                continue
            seen_links.add(link)

            summary = clean_html(e.get("summary") or e.get("description") or "")
            summary = first_two_sentences(summary)
            if not summary:
                continue

            category = categorize(title, summary)

            candidates.append(
                {
                    "title": title,
                    "summary": summary,
                    "link": link,
                    "image": "",
                    "wiki_url": "",
                    "category": category,
                    "hook": make_hook(category),
                    "question": make_question(category),
                    "images": [],
                    "audio": None,
                }
            )

    return candidates

# -----------------------------
# Pick best per category + fun fact fallback
# -----------------------------
def pick_one_per_category(candidates):
    picked = []
    used_links = set()

    # strict threshold -> forces fun facts unless RSS is very relevant
    MIN_SCORE = 4

    for cat in TARGET_CATEGORIES:
        best = None
        best_score = -1

        for x in candidates:
            if x["link"] in used_links:
                continue
            s = relevance_score(cat, x["title"], x["summary"])
            if s > best_score:
                best_score = s
                best = x

        if best and best_score >= MIN_SCORE:
            best["category"] = cat
            best["hook"] = make_hook(cat)
            best["question"] = make_question(cat)
            picked.append(best)
            used_links.add(best["link"])
        else:
            picked.append(wiki_fun_fact(cat))

    return picked

# -----------------------------
# Main
# -----------------------------
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

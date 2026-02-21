let allItems = [];
let filteredItems = [];
let currentIndex = 0;

function buildUnsplashUrl(keywords) {
  const q = encodeURIComponent(keywords || "science");
  // Always returns a random relevant image
  return `https://source.unsplash.com/1600x900/?${q}`;
}

function pickBackgroundImage(item) {
  // Priority:
  // 1) item.image from generator (wiki thumb or fallback)
  // 2) unsplash using category + title keywords (always works)
  if (item.image && item.image.trim()) return item.image;

  const k = `${item.category || "science"},${item.title || "science"}`;
  return buildUnsplashUrl(k);
}

function renderCurrent() {
  const viewer = document.getElementById("viewer");
  viewer.innerHTML = "";

  if (!filteredItems.length) {
    viewer.innerHTML = `
      <div class="hero-card">
        <p class="muted">No facts found for this category today. Try "All" or add a custom fact.</p>
      </div>`;
    return;
  }

  // keep index in range
  currentIndex = ((currentIndex % filteredItems.length) + filteredItems.length) % filteredItems.length;

  const item = filteredItems[currentIndex];

  const card = document.createElement("article");
  card.className = "card";

  const bg = document.createElement("div");
  bg.className = "card-bg";
  bg.style.backgroundImage = `url("${pickBackgroundImage(item)}")`;

  const overlay = document.createElement("div");
  overlay.className = "card-overlay";

  const content = document.createElement("div");
  content.className = "card-content";

  const meta = document.createElement("div");
  meta.className = "muted";
  meta.style.fontSize = "13px";
  meta.textContent = `${item.category || "Science"} • ${currentIndex + 1}/${filteredItems.length}`;

  const h3 = document.createElement("h3");
  h3.textContent = item.title || "Science tidbit";

  const p = document.createElement("p");
  p.className = "summary";
  p.textContent = item.summary || "";

  const actions = document.createElement("div");
  actions.className = "actions";

  const a1 = document.createElement("a");
  a1.className = "link";
  a1.href = item.link || "#";
  a1.target = "_blank";
  a1.rel = "noopener noreferrer";
  a1.textContent = "Read article";

  actions.appendChild(a1);

  if (item.wiki_url) {
    const a2 = document.createElement("a");
    a2.className = "link";
    a2.href = item.wiki_url;
    a2.target = "_blank";
    a2.rel = "noopener noreferrer";
    a2.textContent = "Learn more (Wikipedia)";
    actions.appendChild(a2);
  }

  content.appendChild(meta);
  content.appendChild(h3);
  content.appendChild(p);
  content.appendChild(actions);

  card.appendChild(bg);
  card.appendChild(overlay);
  card.appendChild(content);

  viewer.appendChild(card);
}

function applyCategoryFilter() {
  const sel = document.getElementById("categorySelect");
  const chosen = sel.value;

  if (chosen === "All") {
    filteredItems = [...allItems];
  } else {
    filteredItems = allItems.filter(x => (x.category || "Science") === chosen);
  }

  currentIndex = 0;
  renderCurrent();
}

async function loadDaily() {
  const dateText = document.getElementById("dateText");

  try {
    const res = await fetch("data/daily.json", { cache: "no-store" });
    const data = await res.json();

    dateText.textContent = data.date ? `Updated: ${data.date}` : "";
    allItems = (data.items || []).map(x => ({
      ...x,
      category: x.category || "Science"
    }));

    applyCategoryFilter();
  } catch (e) {
    document.getElementById("viewer").innerHTML =
      `<div class="hero-card"><p class="muted">Could not load daily data. Try again later.</p></div>`;
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadDaily);

document.getElementById("nextBtn").addEventListener("click", () => {
  if (!filteredItems.length) return;
  currentIndex = (currentIndex + 1) % filteredItems.length;
  renderCurrent();
});

document.getElementById("categorySelect").addEventListener("change", applyCategoryFilter);

loadDaily();

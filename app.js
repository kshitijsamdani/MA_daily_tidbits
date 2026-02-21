let allItems = [];
let filteredItems = [];
let currentIndex = 0;
let currentCategory = "All";

// These are *guaranteed* image URLs per category (no keys, always returns an image).
// We also add a cache-buster so GitHub Pages caching doesn't make it look “stuck”.
function categoryImage(category) {
  const c = (category || "Science").trim();
  const map = {
    "AI": "https://source.unsplash.com/1920x1080/?artificial-intelligence,robot,technology",
    "Physics": "https://source.unsplash.com/1920x1080/?physics,quantum,particle",
    "Entrepreneurship": "https://source.unsplash.com/1920x1080/?startup,business,founder",
    "Space": "https://source.unsplash.com/1920x1080/?space,galaxy,nebula",
    "Biology": "https://source.unsplash.com/1920x1080/?biology,cells,microscope",
    "Health": "https://source.unsplash.com/1920x1080/?medicine,health,doctor",
    "Environment": "https://source.unsplash.com/1920x1080/?nature,climate,forest",
    "For you specially": "https://source.unsplash.com/1920x1080/?colorful,abstract,neon",
    "Science": "https://source.unsplash.com/1920x1080/?science,laboratory,research",
    "All": "https://source.unsplash.com/1920x1080/?colorful,gradient,abstract"
  };

  const base = map[c] || map["Science"];
  return `${base}&v=${Date.now()}`; // cache buster
}

function setPageBackground(category) {
  // sets the big background image layer
  document.body.style.setProperty("--pageBg", `url("${categoryImage(category)}")`);
  // apply it to body::before
  const styleId = "dynamic-bg-style";
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = `body::before{ background-image: var(--pageBg); }`;
}

function renderCurrent() {
  const viewer = document.getElementById("viewer");
  viewer.innerHTML = "";

  if (!filteredItems.length) {
    viewer.innerHTML = `
      <div class="hero-card">
        <p class="muted">No facts found for this category today. Try “All” or add a custom fact.</p>
      </div>`;
    return;
  }

  currentIndex = ((currentIndex % filteredItems.length) + filteredItems.length) % filteredItems.length;
  const item = filteredItems[currentIndex];

  // Mandatory: category background image is always used for the card
  const bgUrl = categoryImage(item.category || currentCategory || "Science");

  const card = document.createElement("article");
  card.className = "card";

  const bg = document.createElement("div");
  bg.className = "card-bg";
  bg.style.backgroundImage = `url("${bgUrl}")`;

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

  // Also set the whole page background to current category (must)
  setPageBackground(item.category || "Science");
}

function applyCategoryFilter(categoryValue) {
  const chosen = categoryValue || document.getElementById("categorySelect").value;
  currentCategory = chosen;

  if (chosen === "All") {
    filteredItems = [...allItems];
  } else {
    filteredItems = allItems.filter(x => (x.category || "Science") === chosen);
  }

  currentIndex = 0;
  document.getElementById("heroTitle").textContent =
    chosen === "All" ? "All categories" : `${chosen} facts`;

  // when switching, immediately change background
  setPageBackground(chosen === "All" ? "All" : chosen);
  renderCurrent();
}

async function loadDaily() {
  const dateText = document.getElementById("dateText");
  try {
    const res = await fetch("data/daily.json", { cache: "no-store" });
    const data = await res.json();

    dateText.textContent = data.date ? `Updated: ${data.date}` : "";
    allItems = (data.items || []).map(x => ({ ...x, category: x.category || "Science" }));
  } catch (e) {
    allItems = [];
  }
}

// Landing -> Reader transitions
function showReader() {
  document.getElementById("landing").classList.add("hidden");
  document.getElementById("reader").classList.remove("hidden");
}

function showLanding() {
  document.getElementById("reader").classList.add("hidden");
  document.getElementById("landing").classList.remove("hidden");
  setPageBackground("All");
}

document.getElementById("startAllBtn").addEventListener("click", async () => {
  await loadDaily();
  showReader();
  document.getElementById("categorySelect").value = "All";
  applyCategoryFilter("All");
});

document.getElementById("startCategoryBtn").addEventListener("click", async () => {
  const cat = document.getElementById("landingCategory").value;
  await loadDaily();
  showReader();
  document.getElementById("categorySelect").value = cat;
  applyCategoryFilter(cat);
});

document.getElementById("backBtn").addEventListener("click", () => {
  showLanding();
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  await loadDaily();
  applyCategoryFilter(currentCategory);
});

document.getElementById("nextBtn").addEventListener("click", () => {
  if (!filteredItems.length) return;
  currentIndex = (currentIndex + 1) % filteredItems.length;
  renderCurrent();
});

document.getElementById("categorySelect").addEventListener("change", (e) => {
  applyCategoryFilter(e.target.value);
});

// Initial landing background
showLanding();

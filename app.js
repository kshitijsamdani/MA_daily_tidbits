window.addEventListener("DOMContentLoaded", () => {
  let allItems = [];
  let filteredItems = [];
  let currentIndex = 0;
  let currentCategory = "All";

  // Category fallback images (only if item.image is missing)
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
      "For you specially": "https://source.unsplash.com/1920x1080/?birthday,celebration,stars",
      "Science": "https://source.unsplash.com/1920x1080/?science,laboratory,research",
      "All": "https://source.unsplash.com/1920x1080/?colorful,gradient,abstract"
    };

    const base = map[c] || map["Science"];
    return `${base}&v=${Date.now()}`; // cache buster
  }

  function preload(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(false);
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function setPageBackground(urlOrCategory) {
    const val = (urlOrCategory || "").trim();
    const isUrl = val.startsWith("http") || val.startsWith("assets/");
    const url = isUrl ? val : categoryImage(val);

    const ok = await preload(url);
    if (!ok) return;

    document.documentElement.style.setProperty("--pageBg", `url("${url}")`);
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

    // Use item's image if provided; else category fallback
    const bgUrl = (item.image && item.image.trim())
      ? item.image.trim()
      : categoryImage(item.category || currentCategory || "Science");

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

    if (item.link && item.link.trim() && item.link !== "#") {
      const a1 = document.createElement("a");
      a1.className = "link";
      a1.href = item.link;
      a1.target = "_blank";
      a1.rel = "noopener noreferrer";
      a1.textContent = "Read article";
      actions.appendChild(a1);
    }

    if (item.wiki_url && item.wiki_url.trim()) {
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

    // Page background follows current fact image
    setPageBackground(bgUrl);
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
      dateText.textContent = "";
    }
  }

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

  document.getElementById("backBtn").addEventListener("click", () => showLanding());

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
});

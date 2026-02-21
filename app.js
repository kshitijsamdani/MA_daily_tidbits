window.addEventListener("DOMContentLoaded", () => {
  let allItems = [];
  let filteredItems = [];
  let currentIndex = 0;
  let currentCategory = "All";
  let revealed = false;

  // Category background images (you already keep these in /assets/category/)
  function categoryImage(category) {
    const c = (category || "Science").trim();
    const map = {
      "All": "assets/category/all.jpg",
      "AI": "assets/category/ai.jpg",
      "Physics": "assets/category/physics.jpg",
      "Entrepreneurship": "assets/category/entrepreneurship.jpg",
      "Space": "assets/category/space.jpg",
      "Biology": "assets/category/biology.jpg",
      "Health": "assets/category/health.jpg",
      "Environment": "assets/category/environment.jpg",
      "Science": "assets/category/science.jpg",
      "For you specially": "assets/category/foryou.jpg",
    };
    return map[c] || map["Science"];
  }

  function setCategoryBackground(category) {
    const bg = categoryImage(category);
    document.body.style.setProperty("--bgimg", `url(${bg}?v=${Date.now()})`);
  }

  function normalizeItem(x) {
    const category = (x.category || "Science").trim() || "Science";

    // ✅ Use real fact image when available; fallback to category background
    const img = (x.image && x.image.trim()) ? x.image.trim() : categoryImage(category);

    return {
      ...x,
      category,
      image: img,
      hook: (x.hook || "").trim(),
      question: (x.question || "").trim(),
    };
  }

  async function loadDaily() {
    const dateText = document.getElementById("dateText");
    try {
      const res = await fetch("data/daily.json", { cache: "no-store" });
      const data = await res.json();
      dateText.textContent = data.date ? `Updated: ${data.date}` : "";
      allItems = (data.items || []).map(normalizeItem);
    } catch (e) {
      allItems = [];
      dateText.textContent = "";
    }
  }

  function applyCategoryFilter(categoryValue) {
    const chosen = categoryValue || document.getElementById("categorySelect").value;
    currentCategory = chosen;

    filteredItems = (chosen === "All")
      ? [...allItems]
      : allItems.filter(x => x.category === chosen);

    currentIndex = 0;
    revealed = false;

    document.getElementById("heroTitle").textContent =
      chosen === "All" ? "All categories" : `${chosen} facts`;

    renderCurrent();
  }

  function renderEmpty(viewer) {
    viewer.innerHTML = `
      <div class="empty">
        <h3>No facts found for this category today.</h3>
        <p class="muted">Try “All” or hit Refresh.</p>
      </div>
    `;
  }

  function renderCurrent() {
    const viewer = document.getElementById("viewer");
    viewer.innerHTML = "";

    if (!filteredItems.length) {
      setCategoryBackground("All");
      renderEmpty(viewer);
      return;
    }

    currentIndex = ((currentIndex % filteredItems.length) + filteredItems.length) % filteredItems.length;
    const item = filteredItems[currentIndex];

    // Set category background image for the page
    setCategoryBackground(item.category);

    const card = document.createElement("article");
    card.className = "fact-card";

    // Media
    const media = document.createElement("div");
    media.className = "fact-media";

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.title || "Fact image";

    img.addEventListener("load", () => {
      if (img.naturalHeight > img.naturalWidth) img.classList.add("portrait");
    });

    media.appendChild(img);

    // Body
    const body = document.createElement("div");
    body.className = "fact-body";

    const meta = document.createElement("div");
    meta.className = "fact-meta";
    meta.textContent = `${item.category} • ${currentIndex + 1}/${filteredItems.length}`;

    const title = document.createElement("h3");
    title.className = "fact-title";
    title.textContent = item.title || "Science tidbit";

    // Hook (shown always)
    const hook = document.createElement("p");
    hook.className = "fact-hook";
    hook.textContent = item.hook ? item.hook : "A curiosity-first science nugget. Tap Reveal.";

    // Reveal section
    const reveal = document.createElement("div");
    reveal.className = "reveal " + (revealed ? "open" : "closed");

    const summary = document.createElement("p");
    summary.className = "fact-summary";
    summary.textContent = item.summary || "";

    const question = document.createElement("p");
    question.className = "fact-question";
    question.textContent = item.question ? `Think about it: ${item.question}` : "";

    const actions = document.createElement("div");
    actions.className = "actions";

    const revealBtn = document.createElement("button");
    revealBtn.className = "btn";
    revealBtn.textContent = revealed ? "Hide" : "Reveal";
    revealBtn.addEventListener("click", () => {
      revealed = !revealed;
      renderCurrent();
    });
    actions.appendChild(revealBtn);

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

    reveal.appendChild(summary);
    if (item.question) reveal.appendChild(question);

    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(hook);
    if (revealed) body.appendChild(reveal);
    body.appendChild(actions);

    card.appendChild(media);
    card.appendChild(body);
    viewer.appendChild(card);
  }

  function showReader() {
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("reader").classList.remove("hidden");
  }

  function showLanding() {
    document.getElementById("reader").classList.add("hidden");
    document.getElementById("landing").classList.remove("hidden");
  }

  // Buttons
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
    revealed = false;
    renderCurrent();
  });

  document.getElementById("categorySelect").addEventListener("change", (e) => {
    applyCategoryFilter(e.target.value);
  });

  // Default background on first load
  setCategoryBackground("All");
});

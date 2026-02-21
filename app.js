window.addEventListener("DOMContentLoaded", () => {
  let allItems = [];
  let filteredItems = [];
  let currentIndex = 0;
  let currentCategory = "All";
  let revealed = false;

  // ---------- FUN: streak tracking ----------
  const STREAK_KEY = "ma_tidbits_streak";
  const LAST_DATE_KEY = "ma_tidbits_last_date";

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function updateStreakUI() {
    const el = document.getElementById("streakPill");
    if (!el) return;
    const streak = Number(localStorage.getItem(STREAK_KEY) || "0");
    el.textContent = `🔥 Streak: ${streak} day${streak === 1 ? "" : "s"}`;
  }

  function bumpStreakOncePerDay() {
    const last = localStorage.getItem(LAST_DATE_KEY) || "";
    const t = todayISO();
    if (last === t) return;

    // If last date was exactly yesterday, streak++ else reset to 1
    const lastDate = last ? new Date(last + "T00:00:00") : null;
    const today = new Date(t + "T00:00:00");

    let streak = Number(localStorage.getItem(STREAK_KEY) || "0");

    if (!lastDate) {
      streak = 1;
    } else {
      const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) streak += 1;
      else streak = 1;
    }

    localStorage.setItem(STREAK_KEY, String(streak));
    localStorage.setItem(LAST_DATE_KEY, t);
    updateStreakUI();
  }

  // ---------- FUN: confetti ----------
  const confettiCanvas = document.getElementById("confetti");
  const ctx = confettiCanvas?.getContext("2d");

  function resizeConfetti() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeConfetti);

  function fireConfetti() {
    if (!confettiCanvas || !ctx) return;
    confettiCanvas.classList.remove("hidden");
    resizeConfetti();

    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * confettiCanvas.height * 0.2,
      vx: (Math.random() - 0.5) * 5,
      vy: 2 + Math.random() * 4,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      life: 60 + Math.random() * 40,
      hue: 200 + Math.random() * 120,
    }));

    let frame = 0;
    function tick() {
      frame++;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.03; // gravity
        p.life -= 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, 0.9)`;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      const alive = pieces.some(p => p.life > 0 && p.y < confettiCanvas.height + 40);
      if (frame < 140 && alive) {
        requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiCanvas.classList.add("hidden");
      }
    }
    tick();
  }

  // ---------- Optional: category image fallback map ----------
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

  function normalizeItem(x) {
    const category = (x.category || "Science").trim() || "Science";
  
    // Always use category image for RSS facts
    // Only allow custom image for "For you specially"
    const hasCustom = (x.image && x.image.trim());
  
    const image =
      (category === "For you specially" && hasCustom)
        ? x.image.trim()
        : categoryImage(category);
  
    return {
      ...x,
      category,
      image,
      hook: (x.hook || "").trim(),
      question: (x.question || "").trim(),
      summary: (x.summary || "").trim(),
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

  // ---------- Fun micro-copy (no repeated title) ----------
  function funTeaser(item) {
    // If build_daily already provides hook, use it.
    if (item.hook) return item.hook;

    const cat = item.category || "Science";
    const starters = {
      "AI": "A model just did something that feels… unfairly fast.",
      "Physics": "Reality might have a new footnote.",
      "Entrepreneurship": "This smells like a startup thesis.",
      "Space": "The universe left a clue. We found it.",
      "Biology": "Your body has hidden modes. Here’s one.",
      "Health": "This could change how we detect disease.",
      "Environment": "Nature is shifting, and the data shows it.",
      "Science": "A small result with big implications.",
      "For you specially": "A tiny note, just for you 💜",
    };
    return starters[cat] || starters["Science"];
  }

  function setProgress() {
    const bar = document.getElementById("progressBar");
    if (!bar || !filteredItems.length) return;
    const percent = ((currentIndex + 1) / filteredItems.length) * 100;
    bar.style.width = `${percent}%`;
  }

  function renderCurrent() {
    const viewer = document.getElementById("viewer");
    viewer.innerHTML = "";

    if (!filteredItems.length) {
      renderEmpty(viewer);
      return;
    }

    currentIndex = ((currentIndex % filteredItems.length) + filteredItems.length) % filteredItems.length;
    const item = filteredItems[currentIndex];

    // Update progress
    setProgress();

    const card = document.createElement("article");
    card.className = "fact-card";

    // Media
    const media = document.createElement("div");
    media.className = "fact-media";

    const img = document.createElement("img");
    img.src = item.image + "?v=" + Date.now();
    img.alt = item.title || "Fact image";
    
    // Detect portrait orientation to avoid cropping
    img.addEventListener("load", () => {
      if (img.naturalHeight > img.naturalWidth) {
        img.classList.add("portrait");
      }
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

    // Teaser (clean, no title repeat)
    const hook = document.createElement("p");
    hook.className = "fact-hook";
    hook.textContent = funTeaser(item);

    // Reveal section
    const reveal = document.createElement("div");
    reveal.className = "reveal";

    const summary = document.createElement("p");
    summary.className = "fact-summary";
    summary.textContent = item.summary || "No details available for this one.";

    const question = document.createElement("p");
    question.className = "fact-question";
    question.textContent = item.question ? `Alright, answer this smarty pants: ${item.question}` : "";

    const actions = document.createElement("div");
    actions.className = "actions";

    const revealBtn = document.createElement("button");
    revealBtn.className = "btn";
    revealBtn.textContent = revealed ? "Hide" : "Reveal";
    revealBtn.addEventListener("click", () => {
      revealed = !revealed;

      // Fun: confetti when user reveals the last fact in a category (or daily complete)
      const isLast = (currentIndex === filteredItems.length - 1);
      if (!revealed) return;

      // Fire confetti only sometimes to keep it special
      if (isLast || Math.random() < 0.18) fireConfetti();

      renderCurrent();
    });
    actions.appendChild(revealBtn);

    if (item.link && item.link !== "#") {
      const a1 = document.createElement("a");
      a1.className = "link";
      a1.href = item.link;
      a1.target = "_blank";
      a1.rel = "noopener noreferrer";
      a1.textContent = "Read article";
      actions.appendChild(a1);
    }

    if (item.wiki_url) {
      const a2 = document.createElement("a");
      a2.className = "link";
      a2.href = item.wiki_url;
      a2.target = "_blank";
      a2.rel = "noopener noreferrer";
      a2.textContent = "Learn more";
      actions.appendChild(a2);
    }

    // Build DOM
    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(hook);

    if (revealed) {
      reveal.appendChild(summary);
      if (item.question) reveal.appendChild(question);
      body.appendChild(reveal);
    }

    body.appendChild(actions);

    card.appendChild(media);
    card.appendChild(body);
    viewer.appendChild(card);

    // Update streak pill
    updateStreakUI();
  }

  function showReader() {
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("reader").classList.remove("hidden");
    bumpStreakOncePerDay();
  }

  function showLanding() {
    document.getElementById("reader").classList.add("hidden");
    document.getElementById("landing").classList.remove("hidden");
  }

  // Inject KPI pills + progress bar into hero
  function injectHeroFunUI() {
    const hero = document.querySelector(".hero-card");
    if (!hero) return;

    // Add KPI row
    const metaRow = hero.querySelector(".hero-meta");
    if (metaRow && !document.getElementById("streakPill")) {
      const right = document.createElement("div");
      right.className = "kpi";

      const streak = document.createElement("div");
      streak.className = "pill";
      streak.id = "streakPill";
      streak.textContent = "🔥 Streak: 0 days";

      const vibe = document.createElement("div");
      vibe.className = "pill";
      vibe.id = "vibePill";
      vibe.textContent = "✨ Curiosity mode";

      right.appendChild(vibe);
      right.appendChild(streak);
      metaRow.appendChild(right);
    }

    // Add progress bar (only once)
    if (!document.getElementById("progressBar")) {
      const progress = document.createElement("div");
      progress.className = "progress";
      progress.innerHTML = `<div id="progressBar" class="progress-bar"></div>`;
      hero.appendChild(progress);
    }
  }

  // Buttons / events
  document.getElementById("startAllBtn").addEventListener("click", async () => {
    await loadDaily();
    showReader();
    injectHeroFunUI();
    document.getElementById("categorySelect").value = "All";
    applyCategoryFilter("All");
  });

  document.getElementById("startCategoryBtn").addEventListener("click", async () => {
    const cat = document.getElementById("landingCategory").value;
    await loadDaily();
    showReader();
    injectHeroFunUI();
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
});

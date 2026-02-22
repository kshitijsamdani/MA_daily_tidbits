window.addEventListener("DOMContentLoaded", () => {
  let allItems = [];
  let filteredItems = [];
  let currentIndex = 0;
  let currentCategory = "All";
  let revealed = false;

  // Cleanup handles for slideshow/audio on rerender
  let mediaCleanup = null;

  // ---------- FUN: streak tracking ----------
  const STREAK_KEY = "ma_tidbits_streak";
  const LAST_DATE_KEY = "ma_tidbits_last_date";

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
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
        p.vy += 0.03;
        p.life -= 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, 0.9)`;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      const alive = pieces.some((p) => p.life > 0 && p.y < confettiCanvas.height + 40);
      if (frame < 140 && alive) requestAnimationFrame(tick);
      else {
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
      All: "assets/category/all.jpg",
      AI: "assets/category/ai.jpg",
      Physics: "assets/category/physics.jpg",
      Entrepreneurship: "assets/category/entrepreneurship.jpg",
      Space: "assets/category/space.jpg",
      Biology: "assets/category/biology.jpg",
      Health: "assets/category/health.jpg",
      Environment: "assets/category/environment.jpg",
      Science: "assets/category/science.jpg",
      "For you specially": "assets/category/foryou.jpg",
    };
    return map[c] || map["Science"];
  }

  function normalizeItem(x) {
    const category = (x.category || "Science").trim() || "Science";

    // Allow custom slideshow/audio ONLY for "For you specially"
    const isForYou = category === "For you specially";

    const rawImages = Array.isArray(x.images) ? x.images : [];
    const images = rawImages.map((p) => String(p || "").trim()).filter(Boolean);

    const hasCustomSingle = x.image && String(x.image).trim();
    const fallbackSingle = categoryImage(category);

    // what we store:
    // - image: single image used by normal categories
    // - images: array used only by For you
    const image =
      isForYou && hasCustomSingle ? String(x.image).trim() : fallbackSingle;

    const audio =
      isForYou && x.audio && typeof x.audio === "object"
        ? {
            src: String(x.audio.src || "").trim(),
            title: String(x.audio.title || "").trim(),
          }
        : null;

    return {
      ...x,
      category,
      image,
      images: isForYou ? images : [],
      audio: audio && audio.src ? audio : null,
      hook: (x.hook || "").trim(),
      question: (x.question || "").trim(),
      summary: (x.summary || "").trim(),
      title: (x.title || "").trim(),
      link: (x.link || "").trim(),
      wiki_url: (x.wiki_url || "").trim(),
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

    filteredItems = chosen === "All" ? [...allItems] : allItems.filter((x) => x.category === chosen);

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

  function funTeaser(item) {
    if (item.hook) return item.hook;

    const cat = item.category || "Science";
    const starters = {
      AI: "A model just did something that feels… unfairly fast.",
      Physics: "Reality might have a new footnote.",
      Entrepreneurship: "This smells like a startup thesis.",
      Space: "The universe left a clue. We found it.",
      Biology: "Your body has hidden modes. Here’s one.",
      Health: "This could change how we detect disease.",
      Environment: "Nature is shifting, and the data shows it.",
      Science: "A small result with big implications.",
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

  // ---------- For You: slideshow ----------
  function mountSlideshow(mediaEl, images, fallbackImage) {
    const pics = (images && images.length ? images : [fallbackImage]).slice();
    if (!pics.length) return () => {};

    const wrap = document.createElement("div");
    wrap.className = "slideshow";

    const imgA = document.createElement("img");
    const imgB = document.createElement("img");
    imgA.className = "slide is-on";
    imgB.className = "slide";

    imgA.src = pics[0] + "?v=" + Date.now();
    imgA.alt = "For you image";

    imgB.alt = "For you image";

    // portrait detection helper
    function markPortrait(img) {
      img.addEventListener("load", () => {
        img.classList.toggle("portrait", img.naturalHeight > img.naturalWidth);
      });
    }
    markPortrait(imgA);
    markPortrait(imgB);

    wrap.appendChild(imgA);
    wrap.appendChild(imgB);
    mediaEl.appendChild(wrap);

    let idx = 0;
    let showingA = true;
    let timer = null;

    function tick() {
      if (pics.length <= 1) return;

      const nextIdx = (idx + 1) % pics.length;
      const incoming = showingA ? imgB : imgA;
      const outgoing = showingA ? imgA : imgB;

      incoming.src = pics[nextIdx] + "?v=" + Date.now();

      // crossfade
      outgoing.classList.remove("is-on");
      incoming.classList.add("is-on");

      idx = nextIdx;
      showingA = !showingA;
    }

    // start rotation
    timer = window.setInterval(tick, 2600);

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }

  // ---------- For You: audio player ----------
  function mountAudioPlayer(parentEl, audioObj) {
    if (!audioObj || !audioObj.src) return () => {};

    const wrap = document.createElement("div");
    wrap.className = "audio-player";

    const label = document.createElement("div");
    label.className = "audio-title";
    label.textContent = audioObj.title ? audioObj.title : "A lil song 🎶";

    const row = document.createElement("div");
    row.className = "audio-controls";

    const btn = document.createElement("button");
    btn.className = "btn audio-btn";
    btn.type = "button";
    btn.textContent = "▶ Play";

    const volWrap = document.createElement("div");
    volWrap.className = "vol-wrap";

    const volIcon = document.createElement("span");
    volIcon.className = "vol-icon";
    volIcon.textContent = "🔊";

    const vol = document.createElement("input");
    vol.type = "range";
    vol.min = "0";
    vol.max = "1";
    vol.step = "0.01";
    vol.value = "0.65";
    vol.className = "vol";

    volWrap.appendChild(volIcon);
    volWrap.appendChild(vol);

    const audio = document.createElement("audio");
    audio.src = audioObj.src;
    audio.preload = "metadata";
    audio.volume = Number(vol.value);

    btn.addEventListener("click", async () => {
      try {
        if (audio.paused) {
          await audio.play();
          btn.textContent = "⏸ Pause";
        } else {
          audio.pause();
          btn.textContent = "▶ Play";
        }
      } catch (e) {
        // autoplay restrictions etc.
        btn.textContent = "▶ Play";
      }
    });

    vol.addEventListener("input", () => {
      audio.volume = Number(vol.value);
      if (audio.volume === 0) volIcon.textContent = "🔇";
      else if (audio.volume < 0.5) volIcon.textContent = "🔉";
      else volIcon.textContent = "🔊";
    });

    audio.addEventListener("ended", () => {
      btn.textContent = "▶ Play";
    });

    row.appendChild(btn);
    row.appendChild(volWrap);

    wrap.appendChild(label);
    wrap.appendChild(row);

    parentEl.appendChild(wrap);
    parentEl.appendChild(audio);

    return () => {
      try {
        audio.pause();
        audio.src = "";
      } catch {}
    };
  }

  function renderCurrent() {
    // cleanup previous slideshow/audio if any
    if (typeof mediaCleanup === "function") mediaCleanup();
    mediaCleanup = null;

    const viewer = document.getElementById("viewer");
    viewer.innerHTML = "";

    if (!filteredItems.length) {
      renderEmpty(viewer);
      return;
    }

    currentIndex = ((currentIndex % filteredItems.length) + filteredItems.length) % filteredItems.length;
    const item = filteredItems[currentIndex];

    setProgress();

    const card = document.createElement("article");
    card.className = "fact-card";

    const media = document.createElement("div");
    media.className = "fact-media";

    const isForYou = item.category === "For you specially";

    if (isForYou) {
      // slideshow for For You
      const cleanupSlide = mountSlideshow(media, item.images, item.image);

      // optional audio player
      const cleanupAudio = mountAudioPlayer(media, item.audio);

      mediaCleanup = () => {
        cleanupSlide && cleanupSlide();
        cleanupAudio && cleanupAudio();
      };
    } else {
      // normal single image for all other categories
      const img = document.createElement("img");
      img.src = item.image + "?v=" + Date.now();
      img.alt = item.title || "Fact image";

      img.addEventListener("load", () => {
        if (img.naturalHeight > img.naturalWidth) img.classList.add("portrait");
      });

      media.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "fact-body";

    const meta = document.createElement("div");
    meta.className = "fact-meta";
    meta.textContent = `${item.category} • ${currentIndex + 1}/${filteredItems.length}`;

    const title = document.createElement("h3");
    title.className = "fact-title";
    title.textContent = item.title || "Science tidbit";

    const hook = document.createElement("p");
    hook.className = "fact-hook";
    hook.textContent = funTeaser(item);

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

      const isLast = currentIndex === filteredItems.length - 1;
      if (!revealed) return;

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

    updateStreakUI();
  }

  function showReader() {
    document.getElementById("landing").classList.add("hidden");
    document.getElementById("reader").classList.remove("hidden");
    bumpStreakOncePerDay();
  }

  function showLanding() {
    // stop slideshow/audio when leaving reader
    if (typeof mediaCleanup === "function") mediaCleanup();
    mediaCleanup = null;

    document.getElementById("reader").classList.add("hidden");
    document.getElementById("landing").classList.remove("hidden");
  }

  function injectHeroFunUI() {
    const hero = document.querySelector(".hero-card");
    if (!hero) return;

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

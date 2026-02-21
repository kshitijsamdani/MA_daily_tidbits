async function loadDaily() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  let data;
  try {
    const res = await fetch("data/daily.json", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    grid.innerHTML = `<div class="hero-card"><p class="muted">Could not load daily data. Try again later.</p></div>`;
    return;
  }

  const dateText = document.getElementById("dateText");
  dateText.textContent = data.date ? `Updated: ${data.date}` : "";

  for (const item of data.items || []) {
    const card = document.createElement("article");
    card.className = "card";

    const bg = document.createElement("div");
    bg.className = "card-bg";
    if (item.image) {
      bg.style.backgroundImage = `url("${item.image}")`;
    } else {
      // fallback if no image
      bg.style.backgroundImage = `radial-gradient(800px 350px at 30% 20%, #2b5aa8 0%, transparent 55%),
                                 radial-gradient(700px 300px at 80% 30%, #7b2aa8 0%, transparent 55%)`;
    }

    const overlay = document.createElement("div");
    overlay.className = "card-overlay";

    const content = document.createElement("div");
    content.className = "card-content";

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

    content.appendChild(h3);
    content.appendChild(p);
    content.appendChild(actions);

    card.appendChild(bg);
    card.appendChild(overlay);
    card.appendChild(content);

    grid.appendChild(card);
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadDaily);
loadDaily();

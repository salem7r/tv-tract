// public/show.js
// منطق صفحة تفاصيل المسلسل: عرض المواسم والحلقات، وتعليم المشاهدة

const params = new URLSearchParams(window.location.search);
const showId = params.get("id");
const showName = params.get("name") || "المسلسل";

document.getElementById("showTitle").textContent = showName;

async function loadShow() {
  const container = document.getElementById("seasonsContainer");
  container.innerHTML = `<div class="search-loading">جاري تحميل المواسم...</div>`;

  // 1) تفاصيل المسلسل عشان نعرف عدد المواسم
  const showRes = await fetch(`/api/shows/${showId}`);
  const show = await showRes.json();

  // 2) تقدم المشاهدة الحالي
  const progressRes = await fetch(`/api/shows/${showId}/progress`);
  const progressList = await progressRes.json();

  const watchedSet = new Set(
    progressList
      .filter(p => p.watched)
      .map(p => `${p.seasonNumber}-${p.episodeNumber}`)
  );

  container.innerHTML = "";

  const seasons = (show.seasons || []).filter(s => s.season_number > 0);

  if (seasons.length === 0) {
    container.innerHTML = "<p>مفيش بيانات مواسم متاحة لهذا المسلسل</p>";
    return;
  }

  let isFirst = true;

  for (const season of seasons) {
    const seasonRes = await fetch(`/api/shows/${showId}/season/${season.season_number}`);
    const seasonData = await seasonRes.json();
    const episodes = seasonData.episodes || [];

    const watchedCount = episodes.filter(ep =>
      watchedSet.has(`${season.season_number}-${ep.episode_number}`)
    ).length;

    const block = document.createElement("div");
    block.className = "season-block";

    const episodesHtml = episodes.map(ep => {
      const key = `${season.season_number}-${ep.episode_number}`;
      const isWatched = watchedSet.has(key);
      return `
        <div class="episode-row">
          <input type="checkbox"
            data-season="${season.season_number}"
            data-episode="${ep.episode_number}"
            ${isWatched ? "checked" : ""}
            onchange="toggleWatched(this)">
          <span>ح${ep.episode_number}: ${ep.name}</span>
        </div>
      `;
    }).join("");

    // أول موسم يبقى مفتوح افتراضيًا، والباقي مقفول
    const isOpen = isFirst;
    isFirst = false;

    block.innerHTML = `
      <div class="season-header" onclick="toggleSeason(this)">
        <div class="season-header-title">
          <span class="season-chevron">${isOpen ? "▾" : "▸"}</span>
          <h3>موسم ${season.season_number}</h3>
          <span class="season-count">${watchedCount}/${episodes.length}</span>
        </div>
        <button class="btn-mark-season" onclick="event.stopPropagation(); markSeasonWatched(${season.season_number}, ${episodes.length}, this)">
          علّم الموسم كله
        </button>
      </div>
      <div class="season-episodes" style="display: ${isOpen ? "block" : "none"};">
        ${episodesHtml || "<p>لا توجد حلقات</p>"}
      </div>
    `;
    container.appendChild(block);
  }
}

function toggleSeason(headerEl) {
  const block = headerEl.parentElement;
  const episodesDiv = block.querySelector(".season-episodes");
  const chevron = block.querySelector(".season-chevron");
  const isOpen = episodesDiv.style.display !== "none";

  episodesDiv.style.display = isOpen ? "none" : "block";
  chevron.textContent = isOpen ? "▸" : "▾";
}

async function toggleWatched(checkbox) {
  const seasonNumber = parseInt(checkbox.dataset.season);
  const episodeNumber = parseInt(checkbox.dataset.episode);
  const watched = checkbox.checked;

  await fetch("/api/shows/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber, episodeNumber, watched })
  });

  updateSeasonCount(checkbox);
}

function updateSeasonCount(checkbox) {
  const block = checkbox.closest(".season-block");
  const countEl = block.querySelector(".season-count");
  const total = block.querySelectorAll(".episode-row input[type=checkbox]").length;
  const watched = block.querySelectorAll(".episode-row input[type=checkbox]:checked").length;
  countEl.textContent = `${watched}/${total}`;
}

async function markSeasonWatched(seasonNumber, episodeCount, btn) {
  const confirmed = confirmAction(`تعليم كل حلقات الموسم ${seasonNumber} (${episodeCount} حلقة) كمشاهَدة؟`);
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = "جاري التحديث...";

  const block = btn.closest(".season-block");
  const checkboxes = block.querySelectorAll(".episode-row input[type=checkbox]");

  for (const checkbox of checkboxes) {
    if (!checkbox.checked) {
      checkbox.checked = true;
      const episodeNumber = parseInt(checkbox.dataset.episode);
      await fetch("/api/shows/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, seasonNumber, episodeNumber, watched: true })
      });
    }
  }

  updateSeasonCount(checkboxes[0]);
  btn.disabled = false;
  btn.textContent = "علّم الموسم كله";
  showToast(`تم تعليم موسم ${seasonNumber} كمشاهَد بالكامل`);
}

loadShow();

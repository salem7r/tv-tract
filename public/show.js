// public/show.js
// منطق صفحة تفاصيل المسلسل: عرض المواسم والحلقات، وتعليم المشاهدة

const params = new URLSearchParams(window.location.search);
const showId = params.get("id");
const showName = params.get("name") || "المسلسل";

document.getElementById("showTitle").textContent = showName;

async function loadShow() {
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

  const container = document.getElementById("seasonsContainer");
  container.innerHTML = "";

  const seasons = (show.seasons || []).filter(s => s.season_number > 0);

  for (const season of seasons) {
    const seasonRes = await fetch(`/api/shows/${showId}/season/${season.season_number}`);
    const seasonData = await seasonRes.json();

    const block = document.createElement("div");
    block.className = "season-block";

    const episodesHtml = (seasonData.episodes || []).map(ep => {
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

    block.innerHTML = `
      <h3>موسم ${season.season_number}</h3>
      ${episodesHtml || "<p>لا توجد حلقات</p>"}
    `;
    container.appendChild(block);
  }
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
}

loadShow();

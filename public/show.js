// public/show.js
// منطق صفحة تفاصيل المسلسل: عرض المواسم والحلقات، التقدم، والتقييمات (مسلسل/موسم/حلقة)

const params = new URLSearchParams(window.location.search);
const showId = params.get("id");
const showName = params.get("name") || "المسلسل";

document.getElementById("showTitle").textContent = showName;

async function loadShow() {
  const container = document.getElementById("seasonsContainer");
  container.innerHTML = skeletonSeasons();

  // 1) تفاصيل المسلسل عشان نعرف عدد المواسم ومعلومات إضافية
  const showRes = await fetch(`/api/shows/${showId}`);
  const show = await showRes.json();

  populateHero(show);

  // 2) تقدم المشاهدة وتقييماتي الحالية (مسلسل/موسم/حلقة كلهم مع بعض)
  const [progressRes, ratingsRes] = await Promise.all([
    fetch(`/api/shows/${showId}/progress`),
    fetch(`/api/shows/${showId}/ratings`)
  ]);
  const progressList = await progressRes.json();
  const ratingsList = await ratingsRes.json();

  const watchedSet = new Set(
    progressList
      .filter(p => p.watched)
      .map(p => `${p.seasonNumber}-${p.episodeNumber}`)
  );

  // تقييم المسلسل ككل: seasonNumber و episodeNumber الاتنين null
  const showRatingEntry = ratingsList.find(r => r.seasonNumber === null && r.episodeNumber === null);
  renderShowRating(showRatingEntry ? showRatingEntry.rating : null);
  loadCommunityRating(null, null, "communityRatingShow");

  // تقييم كل موسم لوحده: seasonNumber محدد و episodeNumber null
  const seasonRatingMap = {};
  ratingsList.forEach(r => {
    if (r.seasonNumber !== null && r.episodeNumber === null) {
      seasonRatingMap[r.seasonNumber] = r.rating;
    }
  });

  // تقييم كل حلقة لوحدها
  const episodeRatingMap = {};
  ratingsList.forEach(r => {
    if (r.seasonNumber !== null && r.episodeNumber !== null) {
      episodeRatingMap[`${r.seasonNumber}-${r.episodeNumber}`] = r.rating;
    }
  });

  container.innerHTML = "";

  const seasons = (show.seasons || []).filter(s => s.season_number > 0);

  if (seasons.length === 0) {
    container.innerHTML = "<p>مفيش بيانات مواسم متاحة لهذا المسلسل</p>";
    return;
  }

  let isFirst = true;

  // بنجيب كل المواسم مع بعض بالتوازي بدل ما ننتظر كل موسم لوحده،
  // ده بيسرّع فتح الصفحة بشكل كبير للمسلسلات اللي فيها مواسم كتير
  const seasonDataList = await Promise.all(
    seasons.map(season =>
      fetch(`/api/shows/${showId}/season/${season.season_number}`).then(r => r.json())
    )
  );

  seasons.forEach((season, index) => {
    const seasonData = seasonDataList[index];
    const episodes = seasonData.episodes || [];

    const watchedCount = episodes.filter(ep =>
      watchedSet.has(`${season.season_number}-${ep.episode_number}`)
    ).length;

    const block = document.createElement("div");
    block.className = "season-block";

    const episodesHtml = episodes.map(ep => {
      const key = `${season.season_number}-${ep.episode_number}`;
      const isWatched = watchedSet.has(key);
      const episodeRatingValue = episodeRatingMap[key] || null;

      return `
        <div class="episode-item">
          <label class="episode-row">
            <input type="checkbox"
              data-season="${season.season_number}"
              data-episode="${ep.episode_number}"
              ${isWatched ? "checked" : ""}
              onchange="toggleWatched(this)">
            <span>ح${ep.episode_number}: ${escapeHtml(ep.name)}</span>
            <div class="episode-rating-wrap">
              ${starRatingHtml(
                episodeRatingValue,
                v => `event.stopPropagation(); rateEpisode(${season.season_number}, ${ep.episode_number}, ${v}, this)`,
                "sm"
              )}
            </div>
            <button type="button" class="btn-episode-reviews" title="مراجعات الحلقة"
              onclick="event.stopPropagation(); toggleEpisodeReviews(${season.season_number}, ${ep.episode_number}, this)">💬</button>
          </label>
          <div class="episode-reviews-panel hidden" id="epReviewsPanel-${key}"></div>
        </div>
      `;
    }).join("");

    // أول موسم يبقى مفتوح افتراضيًا، والباقي مقفول
    const isOpen = isFirst;
    isFirst = false;

    const seasonRatingValue = seasonRatingMap[season.season_number] || null;

    block.innerHTML = `
      <div class="season-header">
        <div class="season-header-top" onclick="toggleSeason(this)">
          <span class="season-chevron">${isOpen ? "▾" : "▸"}</span>
          <h3>موسم ${season.season_number}</h3>
          <span class="season-count">${watchedCount}/${episodes.length}</span>
        </div>
        <div class="season-header-actions">
          <div class="season-rating-wrap">
            ${starRatingHtml(
              seasonRatingValue,
              v => `rateSeason(${season.season_number}, ${v}, this)`,
              "sm"
            )}
            <span class="community-rating" id="communityRating-s${season.season_number}"></span>
          </div>
          <button class="btn-mark-season" onclick="markSeasonWatched(${season.season_number}, ${episodes.length}, this)">
            علّم الموسم كله
          </button>
        </div>
      </div>
      <div class="season-episodes" style="display: ${isOpen ? "block" : "none"};">
        ${episodesHtml || "<p>لا توجد حلقات</p>"}
      </div>
    `;
    container.appendChild(block);

    loadCommunityRating(season.season_number, null, `communityRating-s${season.season_number}`);
  });
}

function populateHero(show) {
  const heroEl = document.getElementById("showHero");
  const imgEl = document.getElementById("heroBackdrop");

  const backdropPath = show.backdrop_path || show.poster_path;
  if (backdropPath) {
    imgEl.onload = () => heroEl.classList.add("hero-loaded");
    imgEl.src = `https://image.tmdb.org/t/p/w780${backdropPath}`;
  } else {
    heroEl.classList.add("hero-loaded", "no-backdrop");
  }

  if (show.name) {
    document.getElementById("showTitle").textContent = show.name;
  }

  const year = show.first_air_date ? show.first_air_date.split("-")[0] : null;
  const rating = show.vote_average ? show.vote_average.toFixed(1) : null;
  const genres = (show.genres || []).map(g => g.name).join("، ");

  const metaParts = [];
  if (year) metaParts.push(year);
  if (rating && rating !== "0.0") metaParts.push(`⭐ ${rating}`);
  if (genres) metaParts.push(genres);

  document.getElementById("showMeta").textContent = metaParts.join(" • ");
}

// ===== التقييمات =====

function renderShowRating(value) {
  const container = document.getElementById("showRating");
  container.innerHTML = `
    ${starRatingHtml(value, v => `rateShow(${v})`)}
    <span class="community-rating" id="communityRatingShow">...</span>
  `;
}

async function loadCommunityRating(seasonNumber, episodeNumber, targetId) {
  let url = `/api/shows/${showId}/community-rating`;
  const qs = [];
  if (seasonNumber !== null && seasonNumber !== undefined) qs.push(`season=${seasonNumber}`);
  if (episodeNumber !== null && episodeNumber !== undefined) qs.push(`episode=${episodeNumber}`);
  if (qs.length) url += `?${qs.join("&")}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const el = document.getElementById(targetId);
    if (!el) return;
    el.textContent = data.count > 0
      ? `متوسط المستخدمين: ${data.average} (${data.count})`
      : "لسه محدش قيّم ده";
  } catch (err) {
    console.error("خطأ في جلب متوسط التقييم:", err);
  }
}

async function rateShow(value) {
  await fetch("/api/shows/rating", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber: null, episodeNumber: null, rating: value })
  });
  showToast(`قيّمت المسلسل ${value}/10`);
  renderShowRating(value);
  loadCommunityRating(null, null, "communityRatingShow");
}

async function rateSeason(seasonNumber, value, btn) {
  await fetch("/api/shows/rating", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber, episodeNumber: null, rating: value })
  });
  showToast(`قيّمت موسم ${seasonNumber}: ${value}/10`);

  const wrap = btn.closest(".season-rating-wrap");
  wrap.querySelector(".star-rating").outerHTML = starRatingHtml(
    value,
    v => `rateSeason(${seasonNumber}, ${v}, this)`,
    "sm"
  );
  loadCommunityRating(seasonNumber, null, `communityRating-s${seasonNumber}`);
}

async function rateEpisode(seasonNumber, episodeNumber, value, btn) {
  await fetch("/api/shows/rating", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber, episodeNumber, rating: value })
  });
  showToast(`قيّمت الحلقة ${value}/10`);

  const wrap = btn.closest(".episode-rating-wrap");
  wrap.querySelector(".star-rating").outerHTML = starRatingHtml(
    value,
    v => `event.stopPropagation(); rateEpisode(${seasonNumber}, ${episodeNumber}, ${v}, this)`,
    "sm"
  );
}

// ===== المواسم والحلقات =====

function toggleSeason(topEl) {
  const block = topEl.closest(".season-block");
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
renderBottomNav("shows");

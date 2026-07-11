// public/show.js
// منطق صفحة تفاصيل المسلسل: عرض المواسم والحلقات، التقدم، والتقييمات (مسلسل/موسم/حلقة)

const params = new URLSearchParams(window.location.search);
const showId = params.get("id");
const showName = params.get("name") || "المسلسل";
let showPosterPath = null; // بيتحدد لما تفاصيل المسلسل توصل، ومستخدم في watch-status.js

document.getElementById("showTitle").textContent = showName;

async function loadShow() {
  const container = document.getElementById("seasonsContainer");
  container.innerHTML = skeletonSeasons();

  // 1) تفاصيل المسلسل عشان نعرف عدد المواسم ومعلومات إضافية
  const showRes = await fetch(`/api/shows/${showId}`);
  const show = await showRes.json();

  populateHero(show);
  renderOverview(show);
  renderTrailer(show);
  renderDetailsGrid(show);
  renderCastAndCrew(show);
  renderCompanies(show);
  renderProviders(show);
  renderAwards(show);

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
  const posterWrap = document.getElementById("heroPosterWrap");
  const posterImg = document.getElementById("heroPoster");

  showPosterPath = show.poster_path || null;

  const backdropPath = show.backdrop_path || show.poster_path;
  if (backdropPath) {
    imgEl.onload = () => heroEl.classList.add("hero-loaded");
    imgEl.src = `https://image.tmdb.org/t/p/w1280${backdropPath}`;
  } else {
    heroEl.classList.add("hero-loaded", "no-backdrop");
  }

  if (show.poster_path) {
    posterImg.src = `https://image.tmdb.org/t/p/w300${show.poster_path}`;
    posterImg.alt = show.name || "";
    posterWrap.classList.remove("hidden");
  } else {
    posterWrap.classList.add("hidden");
  }

  if (show.name) {
    document.getElementById("showTitle").textContent = show.name;
  }

  const year = show.first_air_date ? show.first_air_date.split("-")[0] : null;
  const rating = show.vote_average ? show.vote_average.toFixed(1) : null;
  const genres = (show.genres || []).map(g => g.name).join("، ");

  const chips = [];
  if (year) chips.push(`<span class="chip">${year}</span>`);
  if (rating && rating !== "0.0") chips.push(`<span class="chip chip-gold">⭐ ${rating}</span>`);
  if (genres) chips.push(`<span class="chip">${escapeHtml(genres)}</span>`);
  const statusLabel = translateStatus(show.status);
  if (statusLabel) chips.push(`<span class="chip">${statusLabel}</span>`);

  document.getElementById("showMeta").innerHTML = chips.join("");
}

function translateStatus(status) {
  const map = {
    "Returning Series": "🟢 مستمر",
    "Ended": "⚪ انتهى",
    "Canceled": "🔴 اتلغى",
    "In Production": "🟡 قيد الإنتاج",
    "Planned": "🟡 مخطط له",
    "Pilot": "🟡 حلقة تجريبية"
  };
  return map[status] || null;
}

// ===== القصة =====

function renderOverview(show) {
  const section = document.getElementById("showOverviewSection");
  if (!show.overview) { section.innerHTML = ""; return; }
  section.innerHTML = `
    <h2>📖 القصة</h2>
    <p class="overview-text">${escapeHtml(show.overview)}</p>
  `;
}

// ===== التريلر =====

function renderTrailer(show) {
  const section = document.getElementById("showTrailerSection");
  const videos = (show.videos && show.videos.results) || [];

  const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer" && v.official)
    || videos.find(v => v.site === "YouTube" && v.type === "Trailer")
    || videos.find(v => v.site === "YouTube" && v.type === "Teaser");

  if (!trailer) { section.innerHTML = ""; return; }

  section.innerHTML = `
    <h2>🎬 التريلر</h2>
    <div class="trailer-wrap">
      <iframe src="https://www.youtube.com/embed/${trailer.key}" title="التريلر" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>
  `;
}

// ===== تفاصيل (عدد المواسم/الحلقات/المدة/اللغة/بلد الإنتاج...) =====

function renderDetailsGrid(show) {
  const section = document.getElementById("showDetailsSection");
  const items = [];

  items.push({ label: "عدد المواسم", value: show.number_of_seasons ?? "—" });
  items.push({ label: "عدد الحلقات", value: show.number_of_episodes ?? "—" });

  const runtime = (show.episode_run_time && show.episode_run_time[0])
    || (show.last_episode_to_air && show.last_episode_to_air.runtime)
    || null;
  items.push({ label: "مدة الحلقة", value: runtime ? `${runtime} دقيقة` : "غير محدد" });

  const year = show.first_air_date ? show.first_air_date.split("-")[0] : "غير محدد";
  items.push({ label: "سنة الإنتاج", value: year });

  const lang = (show.spoken_languages && show.spoken_languages[0])
    ? (show.spoken_languages[0].name || show.spoken_languages[0].english_name)
    : "غير محدد";
  items.push({ label: "اللغة", value: lang });

  const countries = (show.production_countries || []).map(c => c.name).join("، ");
  items.push({ label: "بلد الإنتاج", value: countries || "غير محدد" });

  const genres = (show.genres || []).map(g => g.name).join("، ");
  items.push({ label: "التصنيف", value: genres || "غير محدد" });

  section.innerHTML = `
    <h2>ℹ️ تفاصيل</h2>
    <div class="spec-grid">
      ${items.map(i => `
        <div class="spec-item">
          <div class="spec-label">${i.label}</div>
          <div class="spec-value">${escapeHtml(String(i.value))}</div>
        </div>
      `).join("")}
    </div>
  `;
}

// ===== طاقم التمثيل + الإخراج والكتابة =====

function renderCastAndCrew(show) {
  const castSection = document.getElementById("showCastSection");
  const crewSection = document.getElementById("showCrewSection");

  const credits = show.aggregate_credits || { cast: [], crew: [] };
  const cast = credits.cast || [];
  const crew = credits.crew || [];

  if (cast.length > 0) {
    const topCast = cast.slice(0, 12);
    castSection.innerHTML = `
      <h2>🎭 طاقم التمثيل</h2>
      <div class="cast-scroll">
        ${topCast.map(actor => {
          const photo = actor.profile_path
            ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
            : "https://via.placeholder.com/100x150?text=%20";
          const character = (actor.roles && actor.roles[0]) ? actor.roles[0].character : "";
          return `
            <div class="cast-card">
              <img src="${photo}" alt="${escapeHtml(actor.name)}" loading="lazy">
              <div class="cast-name">${escapeHtml(actor.name)}</div>
              ${character ? `<div class="cast-character">${escapeHtml(character)}</div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else {
    castSection.innerHTML = "";
  }

  const directors = [...new Map(
    crew.filter(c => (c.jobs || []).some(j => j.job === "Director")).map(c => [c.id, c.name])
  ).values()];

  const creators = (show.created_by || []).map(c => c.name);

  if (directors.length > 0 || creators.length > 0) {
    crewSection.innerHTML = `
      <h2>🎥 الإخراج والكتابة</h2>
      <div class="crew-rows">
        ${creators.length ? `
          <div class="crew-row">
            <span class="crew-role">الفكرة والكتابة</span>
            <span class="crew-names">${creators.map(escapeHtml).join("، ")}</span>
          </div>` : ""}
        ${directors.length ? `
          <div class="crew-row">
            <span class="crew-role">الإخراج</span>
            <span class="crew-names">${directors.slice(0, 6).map(escapeHtml).join("، ")}</span>
          </div>` : ""}
      </div>
    `;
  } else {
    crewSection.innerHTML = "";
  }
}

// ===== شركة الإنتاج =====

function renderCompanies(show) {
  const section = document.getElementById("showCompaniesSection");
  const companies = show.production_companies || [];
  if (companies.length === 0) { section.innerHTML = ""; return; }

  section.innerHTML = `
    <h2>🏢 شركة الإنتاج</h2>
    <div class="card-meta">
      ${companies.map(c => `<span class="chip">${escapeHtml(c.name)}</span>`).join("")}
    </div>
  `;
}

// ===== المنصات المتوفر عليها =====

function renderProviders(show) {
  const section = document.getElementById("showProvidersSection");
  const providersData = show["watch/providers"] && show["watch/providers"].results;

  const region = providersData && (providersData.EG || providersData.SA || providersData.AE || providersData.US);

  if (!region) {
    section.innerHTML = `
      <h2>📡 متاح على</h2>
      <p class="section-empty-note">مفيش بيانات منصات متاحة لهذا المسلسل في منطقتك حاليًا (البيانات من TMDb ومش مكتملة لكل المناطق)</p>
    `;
    return;
  }

  const all = [...(region.flatrate || []), ...(region.ads || [])];
  const unique = [...new Map(all.map(p => [p.provider_id, p])).values()];

  if (unique.length === 0) { section.innerHTML = ""; return; }

  section.innerHTML = `
    <h2>📡 متاح على</h2>
    <div class="providers-row">
      ${unique.map(p => `
        <div class="provider-badge" title="${escapeHtml(p.provider_name)}">
          <img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${escapeHtml(p.provider_name)}" loading="lazy">
          <span>${escapeHtml(p.provider_name)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

// ===== الجوائز =====
// TMDb مش بيوفر بيانات جوائز، فبنوجّه المستخدم لصفحة الجوائز على IMDb لو الـ ID متاح

function renderAwards(show) {
  const section = document.getElementById("showAwardsSection");
  const imdbId = show.external_ids && show.external_ids.imdb_id;

  if (imdbId) {
    section.innerHTML = `
      <h2>🏆 الجوائز</h2>
      <p class="section-empty-note">مصدر بيانات التطبيق (TMDb) مش بيوفر تفاصيل الجوائز، بس تقدر تشوفها مباشرة على IMDb:</p>
      <a class="btn-imdb-link" href="https://www.imdb.com/title/${imdbId}/awards" target="_blank" rel="noopener noreferrer">
        شوف الجوائز على IMDb ↗
      </a>
    `;
  } else {
    section.innerHTML = `
      <h2>🏆 الجوائز</h2>
      <p class="section-empty-note">بيانات الجوائز مش متاحة لهذا المسلسل حاليًا</p>
    `;
  }
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

// public/episode.js
// صفحة تفاصيل حلقة معينة: معلوماتها، صورها، تقييمها، والتعليقات عليها
// التعليقات والتقييم بيعاد استخدام نفس نظام مراجعات/تقييم الحلقة الموجود أصلًا (reviews.js)،
// عشان منعملش نظام مواز مكرر

const params = new URLSearchParams(window.location.search);
const showId = params.get("showId");
const showName = params.get("showName") || "المسلسل";
const seasonNumber = parseInt(params.get("season"), 10);
const episodeNumber = parseInt(params.get("episode"), 10);

document.getElementById("backToShowLink").href = `/show.html?id=${showId}&name=${encodeURIComponent(showName)}`;

async function checkAuth() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = "/login.html";
  }
}

async function loadEpisode() {
  const res = await fetch(`/api/shows/${showId}/season/${seasonNumber}/episode/${episodeNumber}`);
  const episode = await res.json();

  populateEpisodeHero(episode);
  renderEpisodeOverview(episode);
  renderEpisodeCrew(episode);
  renderEpisodeGallery(episode);
  renderEpisodeRating();
  initComments();
}

function populateEpisodeHero(episode) {
  const heroEl = document.getElementById("episodeHero");
  const imgEl = document.getElementById("episodeStillImg");

  if (episode.still_path) {
    imgEl.onload = () => heroEl.classList.add("hero-loaded");
    imgEl.src = `https://image.tmdb.org/t/p/w780${episode.still_path}`;
  } else {
    heroEl.classList.add("hero-loaded", "no-backdrop");
  }

  document.getElementById("episodeTitle").textContent = episode.name || `الحلقة ${episodeNumber}`;

  document.getElementById("episodeShowLink").innerHTML = `
    <a class="episode-show-link" href="/show.html?id=${showId}&name=${encodeURIComponent(showName)}">📺 ${escapeHtml(showName)}</a>
  `;

  const chips = [`<span class="chip">موسم ${seasonNumber} • حلقة ${episodeNumber}</span>`];
  if (episode.air_date) chips.push(`<span class="chip">${episode.air_date}</span>`);
  if (episode.runtime) chips.push(`<span class="chip">${episode.runtime} دقيقة</span>`);
  if (episode.vote_average && episode.vote_average > 0) {
    chips.push(`<span class="chip chip-gold">⭐ ${episode.vote_average.toFixed(1)} (TMDb)</span>`);
  }

  document.getElementById("episodeMeta").innerHTML = chips.join("");
}

// ===== القصة =====

function renderEpisodeOverview(episode) {
  const section = document.getElementById("episodeOverviewSection");
  if (!episode.overview) { section.innerHTML = ""; return; }
  section.innerHTML = `
    <h2>📖 القصة</h2>
    <p class="overview-text">${escapeHtml(episode.overview)}</p>
  `;
}

// ===== ضيوف الحلقة + الإخراج والكتابة =====

function renderEpisodeCrew(episode) {
  const castSection = document.getElementById("episodeCastSection");
  const guestStars = episode.guest_stars || [];

  if (guestStars.length > 0) {
    castSection.innerHTML = `
      <h2>🎭 ضيوف الحلقة</h2>
      <div class="cast-scroll">
        ${guestStars.slice(0, 12).map(actor => {
          const photo = actor.profile_path
            ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
            : "https://via.placeholder.com/100x150?text=%20";
          return `
            <div class="cast-card">
              <img src="${photo}" alt="${escapeHtml(actor.name)}" loading="lazy">
              <div class="cast-name">${escapeHtml(actor.name)}</div>
              ${actor.character ? `<div class="cast-character">${escapeHtml(actor.character)}</div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else {
    castSection.innerHTML = "";
  }

  const crewSection = document.getElementById("episodeCrewSection");
  const crew = episode.crew || [];
  const directors = crew.filter(c => c.job === "Director").map(c => c.name);
  const writers = crew.filter(c => c.job === "Writer" || c.department === "Writing").map(c => c.name);

  const rows = [];
  if (directors.length) {
    rows.push(`<div class="crew-row"><span class="crew-role">الإخراج</span><span class="crew-names">${directors.map(escapeHtml).join("، ")}</span></div>`);
  }
  if (writers.length) {
    rows.push(`<div class="crew-row"><span class="crew-role">الكتابة</span><span class="crew-names">${writers.map(escapeHtml).join("، ")}</span></div>`);
  }

  crewSection.innerHTML = rows.length ? `<h2>🎥 الإخراج والكتابة</h2><div class="crew-rows">${rows.join("")}</div>` : "";
}

// ===== صور الحلقة =====

function renderEpisodeGallery(episode) {
  const section = document.getElementById("episodeGallerySection");
  const stills = (episode.images && episode.images.stills) || [];

  if (stills.length === 0) {
    section.innerHTML = `
      <h2>🖼️ صور</h2>
      <p class="section-empty-note">مفيش صور إضافية متاحة لهذه الحلقة</p>
    `;
    return;
  }

  section.innerHTML = `
    <h2>🖼️ صور</h2>
    <div class="gallery-grid">
      ${stills.slice(0, 12).map(img => `
        <a class="gallery-item" href="https://image.tmdb.org/t/p/original${img.file_path}" target="_blank" rel="noopener noreferrer">
          <img src="https://image.tmdb.org/t/p/w300${img.file_path}" alt="صورة من الحلقة" loading="lazy">
        </a>
      `).join("")}
    </div>
  `;
}

// ===== تقييم الحلقة (نفس نظام النجوم المستخدم في صفحة المسلسل) =====

async function renderEpisodeRating() {
  const section = document.getElementById("episodeRatingSection");
  section.innerHTML = skeletonRows(1);

  const res = await fetch(`/api/shows/${showId}/ratings`);
  const ratingsList = await res.json();
  const mine = ratingsList.find(r => r.seasonNumber === seasonNumber && r.episodeNumber === episodeNumber);

  section.innerHTML = `
    <h2>⭐ تقييمك للحلقة</h2>
    <div class="rating-row">
      ${starRatingHtml(mine ? mine.rating : null, v => `rateThisEpisode(${v}, this)`)}
      <span class="community-rating" id="episodeCommunityRating">...</span>
    </div>
  `;

  loadEpisodeCommunityRating();
}

async function rateThisEpisode(value, btn) {
  await fetch("/api/shows/rating", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber, episodeNumber, rating: value })
  });
  showToast(`قيّمت الحلقة ${value}/10`);

  const wrap = btn.closest(".rating-row");
  wrap.querySelector(".star-rating").outerHTML = starRatingHtml(value, v => `rateThisEpisode(${v}, this)`);
  loadEpisodeCommunityRating();
}

async function loadEpisodeCommunityRating() {
  const res = await fetch(`/api/shows/${showId}/community-rating?season=${seasonNumber}&episode=${episodeNumber}`);
  const data = await res.json();
  const el = document.getElementById("episodeCommunityRating");
  if (!el) return;
  el.textContent = data.count > 0
    ? `متوسط المستخدمين: ${data.average} (${data.count})`
    : "لسه محدش قيّم الحلقة دي";
}

// ===== التعليقات (بإعادة استخدام دوال مراجعات الحلقة من reviews.js) =====

function initComments() {
  const container = document.getElementById("episodeCommentsPanel");
  container.id = `epReviewsPanel-${seasonNumber}-${episodeNumber}`;
  container.dataset.sort = "newest";
  container.innerHTML = episodeReviewPanelHtml(seasonNumber, episodeNumber);
  loadEpisodeReviews(seasonNumber, episodeNumber);
}

async function init() {
  await checkAuth();
  await loadEpisode();
  renderBottomNav("shows");
}

init();

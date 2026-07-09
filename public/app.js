// public/app.js
// منطق تبويب "مسلسلاتي": قائمة المشاهدة، وإدارة كل مسلسلاتي

async function checkAuth() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = "/login.html";
  }
}

async function loadMyShows() {
  const res = await fetch("/api/shows/my/list");
  const shows = await res.json();
  const container = document.getElementById("myShows");

  if (shows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📺</div>
        <p>لسه معندكش مسلسلات مضافة</p>
        <p class="empty-state-hint">روح لتبويب "استكشف" تحت ودور على مسلسل وضيفه</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shows.map(show => {
    const poster = show.posterPath
      ? `https://image.tmdb.org/t/p/w200${show.posterPath}`
      : "https://via.placeholder.com/150x220?text=No+Image";
    return `
      <div class="card">
        <a href="/show.html?id=${show.showId}&name=${encodeURIComponent(show.showName)}">
          <img src="${poster}" alt="${escapeHtml(show.showName)}">
          <h3>${escapeHtml(show.showName)}</h3>
        </a>
        <button class="btn-danger" onclick="removeShow('${show.id}', ${JSON.stringify(show.showName)})">حذف من قائمتي</button>
      </div>
    `;
  }).join("");
}

async function removeShow(id, showName) {
  const confirmed = confirmAction(`متأكد إنك عايز تحذف "${showName}" من قائمتك؟ هيتمسح تقدمك فيه.`);
  if (!confirmed) return;

  await fetch(`/api/shows/my-shows/${id}`, { method: "DELETE" });
  showToast("تم الحذف");
  loadMyShows();
  loadUpNext();
}

async function loadUpNext() {
  const container = document.getElementById("upNextList");
  container.innerHTML = `<div class="search-loading">جاري تحميل قائمة المشاهدة...</div>`;

  const res = await fetch("/api/shows/my/next-episodes");
  const shows = await res.json();

  if (shows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">▶️</div>
        <p>لسه معندكش مسلسلات في قائمة المشاهدة</p>
        <p class="empty-state-hint">روح لتبويب "استكشف" وضيف مسلسل هيظهر هنا</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shows.map(show => {
    const poster = show.posterPath
      ? `https://image.tmdb.org/t/p/w200${show.posterPath}`
      : "https://via.placeholder.com/100x150?text=No+Image";

    if (show.completed) {
      return `
        <div class="up-next-row" data-show-id="${show.showId}">
          <div class="up-next-check up-next-check-done">🎉</div>
          <div class="up-next-info">
            <div class="up-next-showname">${escapeHtml(show.showName)}</div>
            <div class="up-next-episode">خلصت كل الحلقات المتاحة</div>
          </div>
          <img class="up-next-poster" src="${poster}" alt="${escapeHtml(show.showName)}">
        </div>
      `;
    }

    return `
      <div class="up-next-row" data-show-id="${show.showId}">
        <button class="up-next-check" title="علّم كمشاهَدة"
          onclick="markNextWatched('${show.showId}', ${show.nextSeason}, ${show.nextEpisode}, this)">✓</button>
        <div class="up-next-info">
          <div class="up-next-showname">${escapeHtml(show.showName)}</div>
          <div class="up-next-episode">موسم ${show.nextSeason} • حلقة ${show.nextEpisode}</div>
          ${show.episodeName ? `<div class="up-next-title">${escapeHtml(show.episodeName)}</div>` : ""}
        </div>
        <img class="up-next-poster" src="${poster}" alt="${escapeHtml(show.showName)}">
      </div>
    `;
  }).join("");
}

async function markNextWatched(showId, seasonNumber, episodeNumber, btn) {
  btn.disabled = true;
  btn.textContent = "…";

  await fetch("/api/shows/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber, episodeNumber, watched: true })
  });

  showToast(`تم تعليم موسم ${seasonNumber} حلقة ${episodeNumber} كمشاهَدة`);
  loadUpNext();
}

async function init() {
  await checkAuth();
  loadMyShows();
  loadUpNext();
  renderBottomNav("shows");
}

init();

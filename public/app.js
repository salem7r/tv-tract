// public/app.js
// منطق تبويب "مسلسلاتي": قائمة المشاهدة، وإدارة كل مسلسلاتي

// بنخزن هنا نسبة تقدم كل مسلسل (بتتجمع من loadUpNext) عشان نعرضها كشريط تقدم
// في كروت "كل مسلسلاتي" من غير ما نحتاج نطلب البيانات مرتين
let showProgressMap = {};

async function checkAuth() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = "/login.html";
  }
}

async function loadMyShows() {
  const container = document.getElementById("myShows");
  container.innerHTML = skeletonGrid(4);

  const res = await fetch("/api/shows/my/list");
  const shows = await res.json();

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

    const progress = showProgressMap[show.showId];
    let progressHtml = "";
    if (progress && progress.total > 0) {
      const percent = Math.min(100, Math.round((progress.watched / progress.total) * 100));
      progressHtml = `
        <div class="card-progress-label">${progress.watched}/${progress.total}</div>
        <div class="card-progress"><div class="card-progress-fill" style="width:${percent}%"></div></div>
      `;
    }

    return `
      <div class="card">
        <a href="/show.html?id=${show.showId}&name=${encodeURIComponent(show.showName)}">
          <img src="${poster}" alt="${escapeHtml(show.showName)}" loading="lazy">
          <h3>${escapeHtml(show.showName)}</h3>
        </a>
        ${progressHtml}
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
  container.innerHTML = skeletonRows(3);

  const res = await fetch("/api/shows/my/next-episodes");
  const shows = await res.json();

  showProgressMap = {};
  shows.forEach(show => {
    showProgressMap[show.showId] = {
      total: show.totalEpisodes || 0,
      watched: show.watchedEpisodes || 0
    };
  });

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
          <img class="up-next-poster" src="${poster}" alt="${escapeHtml(show.showName)}" loading="lazy">
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
        <img class="up-next-poster" src="${poster}" alt="${escapeHtml(show.showName)}" loading="lazy">
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
  await loadUpNext();
  loadMyShows();
}

let upcomingLoaded = false;

function switchUpNextView(view, btn) {
  document.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");

  if (view === "upnext") {
    document.getElementById("upNextList").classList.remove("hidden");
    document.getElementById("upcomingList").classList.add("hidden");
  } else {
    document.getElementById("upNextList").classList.add("hidden");
    document.getElementById("upcomingList").classList.remove("hidden");
    if (!upcomingLoaded) {
      upcomingLoaded = true;
      loadUpcoming();
    }
  }
}

function formatAirDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "النهاردة";
  if (diffDays === 1) return "بكرة";
  if (diffDays > 1 && diffDays <= 7) {
    return date.toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long" });
  }
  return date.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long" });
}

async function loadUpcoming() {
  const container = document.getElementById("upcomingList");
  container.innerHTML = skeletonRows(3);

  const res = await fetch("/api/shows/my/upcoming");
  const items = await res.json();

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>مفيش حلقات جديدة متوقع نزولها قريب</p>
        <p class="empty-state-hint">أي حلقة جاية لمسلسلاتك هتظهر هنا أول ما تتحدد</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const poster = item.posterPath
      ? `https://image.tmdb.org/t/p/w200${item.posterPath}`
      : "https://via.placeholder.com/100x150?text=No+Image";

    return `
      <div class="up-next-row">
        <div class="upcoming-date-badge">${formatAirDate(item.airDate)}</div>
        <div class="up-next-info">
          <div class="up-next-showname">${escapeHtml(item.showName)}</div>
          <div class="up-next-episode">موسم ${item.seasonNumber} • حلقة ${item.episodeNumber}</div>
          ${item.episodeName ? `<div class="up-next-title">${escapeHtml(item.episodeName)}</div>` : ""}
        </div>
        <img class="up-next-poster" src="${poster}" alt="${escapeHtml(item.showName)}" loading="lazy">
      </div>
    `;
  }).join("");
}

async function init() {
  await checkAuth();
  await loadUpNext(); // لازم تخلص الأول عشان تجهز خريطة التقدم لكروت "كل مسلسلاتي"
  loadMyShows();
  renderBottomNav("shows");
}

init();

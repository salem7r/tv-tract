// public/profile.js
// منطق صفحة الحساب: بيانات اليوزر، الإحصائيات، تسجيل الخروج

async function loadProfile() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();

  if (!data.loggedIn) {
    window.location.href = "/login.html";
    return;
  }

  const card = document.getElementById("profileCard");
  card.innerHTML = `
    <div class="profile-avatar">${escapeHtml(data.username.charAt(0).toUpperCase())}</div>
    <div class="profile-username">${escapeHtml(data.username)}</div>
    <button id="logoutBtn" class="btn-danger profile-logout">تسجيل الخروج</button>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
}

async function loadStats() {
  const res = await fetch("/api/shows/stats/summary");
  const stats = await res.json();
  const box = document.getElementById("statsBox");

  const cardsHtml = `
    <div class="stat-card">
      <div class="number">${stats.totalShows}</div>
      <div class="label">مسلسل بتتابعه</div>
    </div>
    <div class="stat-card">
      <div class="number">${stats.totalEpisodes}</div>
      <div class="label">حلقة اتفرجت عليها</div>
    </div>
    <div class="stat-card">
      <div class="number">${stats.totalHours}</div>
      <div class="label">ساعة مشاهدة (تقريبًا)</div>
    </div>
    <div class="stat-card">
      <div class="number">${stats.avgRating !== null ? stats.avgRating : "—"}</div>
      <div class="label">متوسط تقييماتك</div>
    </div>
  `;

  let tableHtml = "";
  if (stats.perShow.length > 0) {
    const rows = stats.perShow.map(s => `
      <tr>
        <td>${escapeHtml(s.showName)}</td>
        <td>${s.episodesWatched}</td>
      </tr>
    `).join("");

    tableHtml = `
      <table class="stats-table">
        <thead>
          <tr><th>المسلسل</th><th>عدد الحلقات المتفرج عليها</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  box.innerHTML = cardsHtml;
  document.getElementById("statsTable").innerHTML = tableHtml;
}

// بنخزن هنا نسبة تقدم كل مسلسل (من راوت الحلقة الجاية) عشان نعرضها كشريط تقدم في الكروت
let showProgressMap = {};

async function loadShowProgress() {
  const res = await fetch("/api/shows/my/next-episodes");
  const shows = await res.json();
  showProgressMap = {};
  shows.forEach(show => {
    showProgressMap[show.showId] = {
      total: show.totalEpisodes || 0,
      watched: show.watchedEpisodes || 0
    };
  });
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
        <p class="empty-state-hint">روح لتبويب "استكشف" ودور على مسلسل وضيفه</p>
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
          <div class="card-poster">
            <img src="${poster}" alt="${escapeHtml(show.showName)}" loading="lazy">
            <div class="card-poster-overlay">
              <h3>${escapeHtml(show.showName)}</h3>
            </div>
          </div>
        </a>
        <div class="card-actions">
          ${progressHtml}
          <button class="btn-danger" onclick="removeShow('${show.id}', ${JSON.stringify(show.showName)})">حذف من قائمتي</button>
        </div>
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
}

async function init() {
  await loadProfile();
  loadStats();
  await loadShowProgress();
  loadMyShows();
  renderBottomNav("profile");
}

init();

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

async function init() {
  await loadProfile();
  loadStats();
  renderBottomNav("profile");
}

init();

// public/app.js
// منطق الصفحة الرئيسية: التحقق من تسجيل الدخول، البحث، عرض مسلسلاتي

// بنحتفظ بمجموعة showId بتاعة المسلسلات المضافة بالفعل، عشان نقدر نوريها في نتايج البحث
let myShowIds = new Set();

async function checkAuth() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();

  if (!data.loggedIn) {
    window.location.href = "/login.html";
    return;
  }

  document.getElementById("userInfo").innerHTML = `
    <span>👋 ${data.username}</span>
    <button id="logoutBtn">تسجيل الخروج</button>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
}

async function loadMyShows() {
  const res = await fetch("/api/shows/my/list");
  const shows = await res.json();
  const container = document.getElementById("myShows");

  myShowIds = new Set(shows.map(s => String(s.showId)));

  if (shows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📺</div>
        <p>لسه معندكش مسلسلات مضافة</p>
        <p class="empty-state-hint">دور على مسلسل في خانة البحث فوق وضيفه هنا</p>
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
          <img src="${poster}" alt="${show.showName}">
          <h3>${show.showName}</h3>
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
  loadStats();
}

async function searchShows(query) {
  const container = document.getElementById("searchResults");
  container.innerHTML = `<div class="search-loading">جاري البحث...</div>`;

  const res = await fetch(`/api/shows/search?query=${encodeURIComponent(query)}`);
  const results = await res.json();

  if (!results.length) {
    container.innerHTML = "<p>مفيش نتايج</p>";
    return;
  }

  container.innerHTML = results.map(show => {
    const poster = show.poster_path
      ? `https://image.tmdb.org/t/p/w200${show.poster_path}`
      : "https://via.placeholder.com/150x220?text=No+Image";

    const alreadyAdded = myShowIds.has(String(show.id));
    const buttonHtml = alreadyAdded
      ? `<button class="btn-added" disabled>✓ مضاف بالفعل</button>`
      : `<button onclick='addToMyShows(${show.id}, ${JSON.stringify(show.name)}, ${JSON.stringify(show.poster_path)}, this)'>إضافة لقائمتي</button>`;

    return `
      <div class="card">
        <img src="${poster}" alt="${show.name}">
        <h3>${show.name}</h3>
        ${buttonHtml}
      </div>
    `;
  }).join("");
}

async function addToMyShows(showId, showName, posterPath, btn) {
  btn.disabled = true;
  btn.textContent = "جاري الإضافة...";

  const res = await fetch("/api/shows/my-shows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, showName, posterPath })
  });
  const data = await res.json();

  if (res.ok) {
    showToast(`تمت إضافة "${showName}" لقائمتك`);
    btn.textContent = "✓ مضاف بالفعل";
    btn.classList.add("btn-added");
    myShowIds.add(String(showId));
    loadMyShows();
    loadStats();
  } else {
    showToast(data.error, "error");
    btn.disabled = false;
    btn.textContent = "إضافة لقائمتي";
  }
}

let searchTimer;
document.getElementById("searchBox").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const query = e.target.value.trim();
  if (query.length < 2) {
    document.getElementById("searchResults").innerHTML = "";
    return;
  }
  searchTimer = setTimeout(() => searchShows(query), 400);
});

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
        <td>${s.showName}</td>
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
  await checkAuth();
  await loadMyShows(); // لازم تخلص الأول عشان نعرف myShowIds قبل أي بحث
  loadStats();
}

init();

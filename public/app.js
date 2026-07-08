// public/app.js
// منطق الصفحة الرئيسية: التحقق من تسجيل الدخول، البحث، عرض مسلسلاتي

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

  if (shows.length === 0) {
    container.innerHTML = "<p>لسه معندكش مسلسلات مضافة</p>";
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
        <button onclick="removeShow('${show.id}')">حذف من قائمتي</button>
      </div>
    `;
  }).join("");
}

async function removeShow(id) {
  await fetch(`/api/shows/my-shows/${id}`, { method: "DELETE" });
  loadMyShows();
}

async function searchShows(query) {
  const container = document.getElementById("searchResults");
  container.innerHTML = "جاري البحث...";

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
    return `
      <div class="card">
        <img src="${poster}" alt="${show.name}">
        <h3>${show.name}</h3>
        <button onclick='addToMyShows(${show.id}, ${JSON.stringify(show.name)}, ${JSON.stringify(show.poster_path)})'>
          إضافة لقائمتي
        </button>
      </div>
    `;
  }).join("");
}

async function addToMyShows(showId, showName, posterPath) {
  const res = await fetch("/api/shows/my-shows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, showName, posterPath })
  });
  const data = await res.json();

  if (res.ok) {
    alert("تمت الإضافة لقائمتك");
    loadMyShows();
  } else {
    alert(data.error);
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

checkAuth();
loadMyShows();
loadStats();

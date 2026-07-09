// public/explore.js
// منطق صفحة الاستكشاف: البحث عن مسلسلات وإضافتها لقائمتي

let myShowIds = new Set();

async function checkAuth() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = "/login.html";
  }
}

async function loadMyShowIds() {
  const res = await fetch("/api/shows/my/list");
  const shows = await res.json();
  myShowIds = new Set(shows.map(s => String(s.showId)));
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
        <img src="${poster}" alt="${escapeHtml(show.name)}">
        <h3>${escapeHtml(show.name)}</h3>
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

async function init() {
  await checkAuth();
  await loadMyShowIds();
  renderBottomNav("explore");
}

init();

// public/explore.js
// منطق صفحة الاستكشاف: عرض الرائج، البحث عن مسلسلات، وإضافتها لقائمتي

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

function renderShowCards(results, container) {
  if (!results.length) {
    container.innerHTML = "<p>مفيش نتايج</p>";
    return;
  }

  container.innerHTML = results.map(show => {
    const poster = show.poster_path
      ? `https://image.tmdb.org/t/p/w200${show.poster_path}`
      : "https://via.placeholder.com/150x220?text=No+Image";

    const year = show.first_air_date ? show.first_air_date.split("-")[0] : null;
    const rating = show.vote_average ? show.vote_average.toFixed(1) : null;
    const metaParts = [];
    if (year) metaParts.push(year);
    if (rating && rating !== "0.0") metaParts.push(`⭐ ${rating}`);
    const metaHtml = metaParts.length
      ? `<div class="card-meta">${metaParts.join(" • ")}</div>`
      : "";

    const alreadyAdded = myShowIds.has(String(show.id));
    const buttonHtml = alreadyAdded
      ? `<button class="btn-added" disabled>✓ مضاف بالفعل</button>`
      : `<button onclick='addToMyShows(${show.id}, ${JSON.stringify(show.name)}, ${JSON.stringify(show.poster_path)}, this)'>إضافة لقائمتي</button>`;

    return `
      <div class="card">
        <img src="${poster}" alt="${escapeHtml(show.name)}" loading="lazy">
        <h3>${escapeHtml(show.name)}</h3>
        ${metaHtml}
        ${buttonHtml}
      </div>
    `;
  }).join("");
}

async function loadTrending() {
  const container = document.getElementById("searchResults");
  container.innerHTML = skeletonGrid(6);

  const res = await fetch("/api/shows/trending");
  const results = await res.json();
  renderShowCards(results, container);
}

async function searchShows(query) {
  const container = document.getElementById("searchResults");
  container.innerHTML = skeletonGrid(6);

  const res = await fetch(`/api/shows/search?query=${encodeURIComponent(query)}`);
  const results = await res.json();
  renderShowCards(results, container);
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
  const label = document.getElementById("resultsLabel");

  if (query.length < 2) {
    label.classList.remove("hidden");
    loadTrending();
    return;
  }

  label.classList.add("hidden");
  searchTimer = setTimeout(() => searchShows(query), 400);
});

async function init() {
  await checkAuth();
  await loadMyShowIds();
  loadTrending();
  renderBottomNav("explore");
}

init();

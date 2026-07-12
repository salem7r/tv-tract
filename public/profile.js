// public/profile.js
// منطق صفحة الحساب: بيانات اليوزر، الإحصائيات، تسجيل الخروج، وقسم "قوائمي" (زي Letterboxd)

async function loadProfile() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();

  if (!data.loggedIn) {
    window.location.href = "/login.html";
    return;
  }

  renderProfileCard(data.username, data.avatarPath);
  loadBadges(data.username);
}

function renderProfileCard(username, avatarPath) {
  const card = document.getElementById("profileCard");
  const avatarHtml = avatarPath
    ? `<img class="profile-avatar profile-avatar-img" src="${avatarPath}" alt="${escapeHtml(username)}">`
    : `<div class="profile-avatar">${escapeHtml(username.charAt(0).toUpperCase())}</div>`;

  card.innerHTML = `
    <label class="avatar-upload-wrap" title="اضغط لتغيير صورتك">
      ${avatarHtml}
      <div class="avatar-upload-overlay">✏️</div>
      <input type="file" accept="image/*" class="hidden" onchange="uploadAvatar(this, '${escapeHtml(username)}')">
    </label>
    <div class="profile-username">${escapeHtml(username)}</div>
    <a class="public-profile-link" href="/user.html?username=${encodeURIComponent(username)}">👁️ شوف بروفايلك العام</a>
    <button id="logoutBtn" class="btn-danger profile-logout">تسجيل الخروج</button>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
}

async function uploadAvatar(input, username) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("avatar", file);

  const res = await fetch("/api/auth/avatar", { method: "POST", body: formData });
  const data = await res.json();

  if (res.ok) {
    showToast("تم تحديث صورتك");
    renderProfileCard(username, data.avatarPath);
  } else {
    showToast(data.error, "error");
  }
}

async function loadBadges(username) {
  const box = document.getElementById("badgesBox");
  const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
  if (!res.ok) return;

  const data = await res.json();

  if (data.badges.length === 0) {
    box.innerHTML = `<p class="section-empty-note">لسه معملش حاجة تستاهل وسام 👀 كتب مراجعة أو قيّم مسلسل أو خلّص مسلسل وهتكسب أوسمة</p>`;
    return;
  }

  box.innerHTML = data.badges.map(b => `
    <div class="badge-item">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-label">${escapeHtml(b.label)}</div>
    </div>
  `).join("");
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

// ===== قوائمي: تابات الحالة (المفضلة/سأشاهد لاحقاً/أشاهد الآن/أنهيت/توقفت) + القوائم الخاصة =====

const STATUS_TABS = [
  { key: "favorite", label: "❤️ المفضلة" },
  { key: "planning", label: "سأشاهد لاحقًا" },
  { key: "watching", label: "أشاهد الآن" },
  { key: "completed", label: "أنهيت" },
  { key: "dropped", label: "توقفت" }
];

let activeListTab = "planning";

async function loadListsTabs() {
  const [overview, customLists] = await Promise.all([
    fetch("/api/shows/my/lists-overview").then(r => r.json()),
    fetch("/api/lists").then(r => r.json())
  ]);

  const container = document.getElementById("listsTabs");

  const statusTabsHtml = STATUS_TABS.map(tab => {
    const count = overview[tab.key] || 0;
    return `
      <button class="sub-tab ${activeListTab === tab.key ? "active" : ""}" onclick="switchListTab('${tab.key}', this)">
        ${tab.label} <span class="list-tab-count">${count}</span>
      </button>
    `;
  }).join("");

  const customTabsHtml = customLists.map(l => `
    <button class="sub-tab ${activeListTab === "custom:" + l.id ? "active" : ""}" onclick="switchListTab('custom:${l.id}', this)">
      🗂️ ${escapeHtml(l.name)} <span class="list-tab-count">${l.itemsCount}</span>
    </button>
  `).join("");

  container.innerHTML = `
    ${statusTabsHtml}${customTabsHtml}
    <button class="sub-tab list-tab-new" onclick="promptNewList()">＋ قائمة جديدة</button>
  `;

  loadListContent();
}

function switchListTab(key, btn) {
  activeListTab = key;
  document.querySelectorAll("#listsTabs .sub-tab").forEach(t => t.classList.remove("active"));
  if (btn) btn.classList.add("active");
  loadListContent();
}

async function promptNewList() {
  const name = window.prompt("اسم القائمة الجديدة:");
  if (!name || !name.trim()) return;

  const res = await fetch("/api/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() })
  });
  const data = await res.json();

  if (res.ok) {
    showToast(`تم إنشاء "${data.name}"`);
    activeListTab = `custom:${data.id}`;
    loadListsTabs();
  } else {
    showToast(data.error, "error");
  }
}

async function loadListContent() {
  const container = document.getElementById("listsContent");
  container.innerHTML = skeletonGrid(4);

  let items = [];
  let isCustomList = false;
  let customListId = null;

  if (activeListTab.startsWith("custom:")) {
    isCustomList = true;
    customListId = activeListTab.split(":")[1];
    const res = await fetch(`/api/lists/${customListId}`);
    const data = await res.json();
    items = data.items || [];
  } else {
    const qs = activeListTab === "favorite" ? "favorite=true" : `status=${activeListTab}`;
    const res = await fetch(`/api/shows/my/list?${qs}`);
    items = await res.json();
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎬</div>
        <p>مفيش مسلسلات في القائمة دي لسه</p>
        <p class="empty-state-hint">تقدر تضيف مسلسلات من صفحة المسلسل نفسه</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(show => {
    const poster = show.posterPath
      ? `https://image.tmdb.org/t/p/w200${show.posterPath}`
      : "https://via.placeholder.com/150x220?text=No+Image";

    const removeAction = isCustomList
      ? `removeFromCustomList('${customListId}', '${show.showId}')`
      : `removeShow('${show.id}', ${JSON.stringify(show.showName)})`;

    const favoriteChip = !isCustomList && show.isFavorite ? `<span class="chip chip-gold">❤️ مفضل</span>` : "";

    return `
      <div class="card">
        <a href="/show.html?id=${show.showId}&name=${encodeURIComponent(show.showName)}">
          <div class="card-poster">
            <img src="${poster}" alt="${escapeHtml(show.showName)}" loading="lazy">
            <div class="card-poster-overlay">
              <h3>${escapeHtml(show.showName)}</h3>
              ${favoriteChip ? `<div class="card-meta">${favoriteChip}</div>` : ""}
            </div>
          </div>
        </a>
        <div class="card-actions">
          <button class="btn-danger" onclick="${removeAction}">${isCustomList ? "حذف من القائمة" : "حذف من قائمتي"}</button>
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
  loadListsTabs();
}

async function removeFromCustomList(listId, showId) {
  const confirmed = confirmAction("متأكد إنك عايز تحذف المسلسل من القائمة دي؟");
  if (!confirmed) return;

  await fetch(`/api/lists/${listId}/items/${showId}`, { method: "DELETE" });
  showToast("تم الحذف من القائمة");
  loadListsTabs();
}

async function init() {
  await loadProfile();
  loadStats();
  loadListsTabs();
  renderBottomNav("profile");
}

init();

// public/user.js
// صفحة الملف الشخصي العام لأي مستخدم (بيوزرنيمه): الصورة، الإحصائيات، الأوسمة

const params = new URLSearchParams(window.location.search);
const profileUsername = params.get("username");

async function loadPublicProfile() {
  const card = document.getElementById("publicProfileCard");

  if (!profileUsername) {
    card.innerHTML = `<p>مفيش يوزرنيم متحدد في الرابط</p>`;
    return;
  }

  const res = await fetch(`/api/users/${encodeURIComponent(profileUsername)}`);

  if (!res.ok) {
    card.innerHTML = `<p>المستخدم "${escapeHtml(profileUsername)}" مش موجود</p>`;
    document.getElementById("badgesGrid").innerHTML = "";
    return;
  }

  const data = await res.json();

  const avatarHtml = data.avatarPath
    ? `<img class="profile-avatar profile-avatar-img" src="${data.avatarPath}" alt="${escapeHtml(data.username)}">`
    : `<div class="profile-avatar">${escapeHtml(data.username.charAt(0).toUpperCase())}</div>`;

  card.innerHTML = `
    ${avatarHtml}
    <div class="profile-username">${escapeHtml(data.username)}</div>
    <div class="profile-stats-row">
      <div class="profile-stat">
        <div class="number">${data.stats.reviewsCount}</div>
        <div class="label">مراجعة</div>
      </div>
      <div class="profile-stat">
        <div class="number">${data.stats.ratingsCount}</div>
        <div class="label">تقييم</div>
      </div>
      <div class="profile-stat">
        <div class="number">${data.stats.completedShowsCount}</div>
        <div class="label">مسلسل خلّصه</div>
      </div>
    </div>
  `;

  renderBadges(data.badges);
}

function renderBadges(badges) {
  const grid = document.getElementById("badgesGrid");

  if (badges.length === 0) {
    grid.innerHTML = `<p class="section-empty-note">لسه معملش حاجة تستاهل وسام 👀</p>`;
    return;
  }

  grid.innerHTML = badges.map(b => `
    <div class="badge-item">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-label">${escapeHtml(b.label)}</div>
    </div>
  `).join("");
}

loadPublicProfile();

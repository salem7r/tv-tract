// public/reviews.js
// نظام المراجعات: شغال على مستوى المسلسل ككل (قسم تحت الصفحة) وكمان على مستوى كل حلقة لوحدها
// (زرار 💬 جنب كل حلقة بيفتح فانل مراجعات خاص بيها)
// ملاحظة: showId متاح هنا لأنه معرّف كـ const في show.js، والسكريبتين بيشتركوا في نفس الـ scope العام للصفحة

let currentReviewSort = "newest"; // ترتيب مراجعات المسلسل ككل

// ===== أدوات مشتركة =====

// بنعمل escape للنص الأول عشان الأمان، وبعدين بنحول وسوم [سبويلر]...[/سبويلر]
// لعنصر متخفي تقدر تدوس عليه تشوفه
function renderReviewText(rawText) {
  const escaped = escapeHtml(rawText);
  const spoilerPattern = /\[سبويلر\]([\s\S]*?)\[\/سبويلر\]/g;
  return escaped.replace(spoilerPattern, (match, inner) => {
    return `<span class="spoiler-text" onclick="this.classList.toggle('revealed')" title="اضغط للإظهار">${inner}</span>`;
  });
}

function formatReviewDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric" });
}

// بتاخد الجزء المحدد من أي تكست إريا (بمعرفها) وتحيطه بوسوم السبويلر
function markSelectionAsSpoiler(textareaId = "reviewText") {
  const textarea = document.getElementById(textareaId);
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (start === end) {
    showToast("حدد جزء من النص الأول", "error");
    return;
  }

  const value = textarea.value;
  const selected = value.slice(start, end);
  const newValue = value.slice(0, start) + `[سبويلر]${selected}[/سبويلر]` + value.slice(end);

  textarea.value = newValue;
  textarea.focus();
}

// كارت مراجعة واحد، بنمرره أونكليك اللايك والحذف عشان يستخدم نفس الكارت للمسلسل والحلقات
function reviewCardHtml(r, likeOnClick, deleteOnClick) {
  return `
    <div class="review-card">
      <div class="review-card-header">
        <span class="review-username">${escapeHtml(r.username)}</span>
        <span class="review-date">${formatReviewDate(r.createdAt)}</span>
      </div>
      <p class="review-text">${renderReviewText(r.text)}</p>
      <div class="review-card-actions">
        <button class="btn-like ${r.likedByMe ? "liked" : ""}" onclick="${likeOnClick}">
          ❤️ <span class="like-count">${r.likesCount}</span>
        </button>
        ${r.isMine ? `<button class="btn-delete-review" onclick="${deleteOnClick}">حذف</button>` : ""}
      </div>
    </div>
  `;
}

// ===== مراجعات المسلسل ككل =====

async function submitReview() {
  const textarea = document.getElementById("reviewText");
  const text = textarea.value.trim();

  if (!text) {
    showToast("اكتب مراجعة الأول", "error");
    return;
  }

  const res = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber: null, episodeNumber: null, text })
  });
  const data = await res.json();

  if (res.ok) {
    textarea.value = "";
    showToast("تم نشر مراجعتك");
    loadReviews();
  } else {
    showToast(data.error, "error");
  }
}

function switchReviewSort(sort, btn) {
  currentReviewSort = sort;
  document.querySelectorAll(".reviews-sort .sub-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  loadReviews();
}

async function loadReviews() {
  const container = document.getElementById("reviewsList");
  container.innerHTML = skeletonRows(2);

  const res = await fetch(`/api/reviews/${showId}?sort=${currentReviewSort}`);
  const reviews = await res.json();

  if (reviews.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <p>لسه مفيش مراجعات لهذا المسلسل</p>
        <p class="empty-state-hint">كن أول واحد يكتب رأيه</p>
      </div>
    `;
    return;
  }

  container.innerHTML = reviews.map(r => reviewCardHtml(
    r,
    `toggleLike('${r.id}', this)`,
    `deleteReview('${r.id}')`
  )).join("");
}

async function toggleLike(id, btn) {
  const res = await fetch(`/api/reviews/${id}/like`, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    showToast(data.error, "error");
    return;
  }

  btn.classList.toggle("liked", data.likedByMe);
  btn.querySelector(".like-count").textContent = data.likesCount;
}

async function deleteReview(id) {
  const confirmed = confirmAction("متأكد إنك عايز تحذف مراجعتك؟");
  if (!confirmed) return;

  await fetch(`/api/reviews/${id}`, { method: "DELETE" });
  showToast("تم حذف المراجعة");
  loadReviews();
}

// ===== مراجعات كل حلقة لوحدها =====

function episodeKey(season, episode) {
  return `${season}-${episode}`;
}

function episodeReviewPanelHtml(season, episode) {
  const key = episodeKey(season, episode);
  return `
    <div class="review-form">
      <textarea id="epReviewText-${key}" placeholder="اكتب رأيك في الحلقة دي..." maxlength="2000"></textarea>
      <div class="review-form-actions">
        <button type="button" class="btn-spoiler" onclick="markSelectionAsSpoiler('epReviewText-${key}')">🙈 علّم كسبويلر</button>
        <button type="button" class="btn-submit-review" onclick="submitEpisodeReview(${season}, ${episode})">نشر المراجعة</button>
      </div>
    </div>
    <div class="reviews-sort reviews-sort-sm">
      <button class="sub-tab active" onclick="switchEpisodeReviewSort(${season}, ${episode}, 'newest', this)">الأحدث</button>
      <button class="sub-tab" onclick="switchEpisodeReviewSort(${season}, ${episode}, 'top', this)">الأعلى لايكات</button>
    </div>
    <div class="reviews-list" id="epReviewsList-${key}">${skeletonRows(1)}</div>
  `;
}

// بيفتح/يقفل فانل مراجعات الحلقة، وبيبنيه أول مرة بس (وبعد كده بيعيد تحميل المراجعات بس)
function toggleEpisodeReviews(season, episode, btn) {
  const key = episodeKey(season, episode);
  const panel = document.getElementById(`epReviewsPanel-${key}`);
  if (!panel) return;

  const isHidden = panel.classList.contains("hidden");

  if (isHidden) {
    panel.classList.remove("hidden");
    btn.classList.add("active");

    if (!panel.dataset.initialized) {
      panel.dataset.initialized = "1";
      panel.dataset.sort = "newest";
      panel.innerHTML = episodeReviewPanelHtml(season, episode);
    }
    loadEpisodeReviews(season, episode);
  } else {
    panel.classList.add("hidden");
    btn.classList.remove("active");
  }
}

async function loadEpisodeReviews(season, episode) {
  const key = episodeKey(season, episode);
  const panel = document.getElementById(`epReviewsPanel-${key}`);
  const listEl = document.getElementById(`epReviewsList-${key}`);
  if (!panel || !listEl) return;

  const sort = panel.dataset.sort || "newest";
  listEl.innerHTML = skeletonRows(1);

  const res = await fetch(`/api/reviews/${showId}?season=${season}&episode=${episode}&sort=${sort}`);
  const reviews = await res.json();

  if (reviews.length === 0) {
    listEl.innerHTML = `<div class="empty-state-sm">لسه مفيش مراجعات على الحلقة دي</div>`;
    return;
  }

  listEl.innerHTML = reviews.map(r => reviewCardHtml(
    r,
    `toggleEpisodeLike('${r.id}', ${season}, ${episode}, this)`,
    `deleteEpisodeReview('${r.id}', ${season}, ${episode})`
  )).join("");
}

function switchEpisodeReviewSort(season, episode, sort, btn) {
  const key = episodeKey(season, episode);
  const panel = document.getElementById(`epReviewsPanel-${key}`);
  panel.dataset.sort = sort;
  panel.querySelectorAll(".reviews-sort-sm .sub-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  loadEpisodeReviews(season, episode);
}

async function submitEpisodeReview(season, episode) {
  const key = episodeKey(season, episode);
  const textarea = document.getElementById(`epReviewText-${key}`);
  const text = textarea.value.trim();

  if (!text) {
    showToast("اكتب مراجعة الأول", "error");
    return;
  }

  const res = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, seasonNumber: season, episodeNumber: episode, text })
  });
  const data = await res.json();

  if (res.ok) {
    textarea.value = "";
    showToast("تم نشر مراجعتك على الحلقة");
    loadEpisodeReviews(season, episode);
  } else {
    showToast(data.error, "error");
  }
}

async function toggleEpisodeLike(id, season, episode, btn) {
  const res = await fetch(`/api/reviews/${id}/like`, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    showToast(data.error, "error");
    return;
  }

  btn.classList.toggle("liked", data.likedByMe);
  btn.querySelector(".like-count").textContent = data.likesCount;
}

async function deleteEpisodeReview(id, season, episode) {
  const confirmed = confirmAction("متأكد إنك عايز تحذف مراجعتك؟");
  if (!confirmed) return;

  await fetch(`/api/reviews/${id}`, { method: "DELETE" });
  showToast("تم حذف المراجعة");
  loadEpisodeReviews(season, episode);
}

loadReviews();

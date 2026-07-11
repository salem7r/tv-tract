// public/watch-status.js
// شريط حالة المشاهدة (سأشاهد لاحقاً/أشاهد الآن/أنهيت/توقفت) + المفضلة + إضافة لقائمة خاصة
// في صفحة تفاصيل المسلسل. showId/showName/showPosterPath متاحين من show.js لأنهم بيشتركوا نفس الـ scope العام

const STATUS_META = {
  planning: { label: "سأشاهد لاحقًا", cls: "st-planning" },
  watching: { label: "أشاهد الآن", cls: "st-watching" },
  completed: { label: "أنهيت", cls: "st-completed" },
  dropped: { label: "توقفت عن المشاهدة", cls: "st-dropped" }
};

let currentUserShowId = null; // الـ id بتاع سجل UserShow لو المسلسل مضاف بالفعل لقائمتي
let currentShowStatus = null;
let currentShowFavorite = false;

async function loadWatchStatus() {
  const res = await fetch(`/api/shows/my-shows/for/${showId}`);
  const data = await res.json();

  if (!data.inList) {
    currentUserShowId = null;
    renderNotAdded();
    return;
  }

  currentUserShowId = data.id;
  currentShowStatus = data.status;
  currentShowFavorite = data.isFavorite;
  renderWatchStatusBar();
}

function renderNotAdded() {
  const bar = document.getElementById("watchStatusBar");
  bar.innerHTML = `
    <div class="watch-status-row">
      <button class="btn-add-to-list" onclick="quickAddToMyShows()">➕ إضافة لقائمتي</button>
    </div>
  `;
}

async function quickAddToMyShows() {
  const res = await fetch("/api/shows/my-shows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, showName, posterPath: showPosterPath })
  });
  const data = await res.json();

  if (res.ok) {
    showToast("تمت إضافة المسلسل لقائمتك");
    loadWatchStatus();
  } else {
    showToast(data.error, "error");
  }
}

function renderWatchStatusBar() {
  const bar = document.getElementById("watchStatusBar");

  const statusButtonsHtml = Object.entries(STATUS_META).map(([key, meta]) => `
    <button class="status-btn ${meta.cls} ${currentShowStatus === key ? "active" : ""}" onclick="setWatchStatus('${key}')">
      ${meta.label}
    </button>
  `).join("");

  bar.innerHTML = `
    <div class="watch-status-row">
      <div class="status-btn-group">${statusButtonsHtml}</div>
      <div class="watch-status-actions">
        <button class="btn-favorite ${currentShowFavorite ? "active" : ""}" onclick="toggleFavorite()" title="المفضلة">
          ${currentShowFavorite ? "❤️" : "🤍"}
        </button>
        <button class="btn-add-to-list" onclick="openListsPopover()">🗂️ قوائمي</button>
      </div>
      <div id="listsPopover" class="lists-popover hidden"></div>
    </div>
  `;
}

async function setWatchStatus(status) {
  if (!currentUserShowId) return;

  const res = await fetch(`/api/shows/my-shows/${currentUserShowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await res.json();

  if (res.ok) {
    currentShowStatus = status;
    showToast(`الحالة: ${STATUS_META[status].label}`);
    renderWatchStatusBar();
  } else {
    showToast(data.error, "error");
  }
}

async function toggleFavorite() {
  if (!currentUserShowId) return;
  const newValue = !currentShowFavorite;

  const res = await fetch(`/api/shows/my-shows/${currentUserShowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isFavorite: newValue })
  });
  const data = await res.json();

  if (res.ok) {
    currentShowFavorite = newValue;
    showToast(newValue ? "تمت الإضافة للمفضلة ❤️" : "اتشالت من المفضلة");
    renderWatchStatusBar();
  } else {
    showToast(data.error, "error");
  }
}

// ===== بوب أب "أضف لقائمة" =====

async function openListsPopover() {
  const popover = document.getElementById("listsPopover");
  if (!popover) return;

  const isHidden = popover.classList.contains("hidden");

  if (!isHidden) {
    popover.classList.add("hidden");
    return;
  }

  popover.classList.remove("hidden");
  await renderListsPopoverContent();
}

async function renderListsPopoverContent() {
  const popover = document.getElementById("listsPopover");
  if (!popover) return;

  popover.innerHTML = skeletonRows(1);

  const res = await fetch(`/api/lists/for-show/${showId}`);
  const lists = await res.json();

  const listsHtml = lists.map(l => `
    <label class="list-check-row">
      <input type="checkbox" ${l.hasShow ? "checked" : ""} onchange="toggleListItem('${l.id}', this.checked)">
      <span>${escapeHtml(l.name)}</span>
    </label>
  `).join("");

  popover.innerHTML = `
    ${lists.length ? listsHtml : `<p class="lists-popover-empty">لسه معملتش أي قائمة خاصة</p>`}
    <div class="new-list-row">
      <input type="text" id="newListName" placeholder="اسم قائمة جديدة...">
      <button type="button" onclick="createListAndAdd()">إنشاء</button>
    </div>
  `;
}

async function toggleListItem(listId, checked) {
  if (checked) {
    const res = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId, showName, posterPath: showPosterPath })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error, "error");
      return;
    }
    showToast("تمت الإضافة للقائمة");
  } else {
    await fetch(`/api/lists/${listId}/items/${showId}`, { method: "DELETE" });
    showToast("تم الحذف من القائمة");
  }
}

async function createListAndAdd() {
  const input = document.getElementById("newListName");
  const name = input.value.trim();

  if (!name) {
    showToast("اكتب اسم للقائمة", "error");
    return;
  }

  const res = await fetch("/api/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  const data = await res.json();

  if (!res.ok) {
    showToast(data.error, "error");
    return;
  }

  await fetch(`/api/lists/${data.id}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showId, showName, posterPath: showPosterPath })
  });

  showToast(`تم إنشاء "${name}" وإضافة المسلسل ليها`);
  renderListsPopoverContent();
}

loadWatchStatus();

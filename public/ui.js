// public/ui.js
// أدوات واجهة مشتركة بين الصفحات (إشعارات، تأكيد الحذف، حماية من XSS)

// بنحول أي نص المستخدم بيتحكم فيه (زي اسم المستخدم) لنص آمن قبل ما نحطه في الصفحة
// عشان محدش يقدر يحقن كود HTML/JavaScript ضار عن طريق اسم مستخدم أو أي مدخل تاني
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function showToast(message, type = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // شوية تأخير بسيط عشان الـ transition يشتغل صح
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// تأكيد بسيط قبل عملية حذف
function confirmAction(message) {
  return window.confirm(message);
}

// ===== Skeleton loading placeholders =====
// بنستخدمهم بدل نص "جاري التحميل..." العادي، عشان الصفحة تحس إنها بتحمّل أسرع

function skeletonGrid(count = 6) {
  return Array.from({ length: count }).map(() => `
    <div class="card skeleton-card">
      <div class="skeleton-shimmer skeleton-poster"></div>
      <div class="skeleton-shimmer skeleton-line"></div>
      <div class="skeleton-shimmer skeleton-line-short"></div>
    </div>
  `).join("");
}

function skeletonRows(count = 3) {
  return Array.from({ length: count }).map(() => `
    <div class="up-next-row skeleton-card">
      <div class="skeleton-shimmer skeleton-circle"></div>
      <div class="up-next-info">
        <div class="skeleton-shimmer skeleton-line"></div>
        <div class="skeleton-shimmer skeleton-line-short"></div>
      </div>
      <div class="skeleton-shimmer skeleton-thumb"></div>
    </div>
  `).join("");
}

function skeletonSeasons(count = 2) {
  return Array.from({ length: count }).map(() => `
    <div class="season-block skeleton-card">
      <div class="skeleton-shimmer skeleton-line" style="width:110px;height:16px;"></div>
      <div class="skeleton-shimmer skeleton-line" style="margin-top:16px;"></div>
      <div class="skeleton-shimmer skeleton-line"></div>
      <div class="skeleton-shimmer skeleton-line-short"></div>
    </div>
  `).join("");
}

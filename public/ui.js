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

// ===== Star rating widget =====
// مقياس 1-10 بس معروض كـ 5 نجوم بدقة نص نجمة (كل نجمة = نقطتين)
// currentValue: رقم من 1 لـ 10 أو null لو لسه معندكش تقييم
// onClickValue: دالة بتاخد رقم (1-10) وترجع الـ onclick attribute كنص، زي: v => `rateShow(${v})`
function starRatingHtml(currentValue, onClickValue, size = "md") {
  const sizeClass = size === "sm" ? "star-rating-sm" : "";
  let stars = "";

  for (let i = 0; i < 5; i++) {
    const leftVal = i * 2 + 1;
    const rightVal = i * 2 + 2;
    const fillPercent = currentValue == null
      ? 0
      : Math.max(0, Math.min(100, (currentValue - i * 2) * 50));

    stars += `
      <span class="star-slot">
        <span class="star-bg">★</span>
        <span class="star-fill" style="width:${fillPercent}%">★</span>
        <button type="button" class="star-half star-half-left" onclick="${onClickValue(leftVal)}" aria-label="${leftVal} من 10"></button>
        <button type="button" class="star-half star-half-right" onclick="${onClickValue(rightVal)}" aria-label="${rightVal} من 10"></button>
      </span>
    `;
  }

  return `<div class="star-rating ${sizeClass}">${stars}</div>`;
}

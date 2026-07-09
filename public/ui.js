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

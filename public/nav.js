// public/nav.js
// شريط التنقل السفلي المشترك بين كل صفحات التطبيق

function renderBottomNav(activeTab) {
  const icons = {
    explore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    shows: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
    profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
  };

  const items = [
    { key: "explore", label: "استكشف", href: "/explore.html" },
    { key: "shows", label: "مسلسلاتي", href: "/index.html" },
    { key: "profile", label: "حسابي", href: "/profile.html" }
  ];

  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.innerHTML = items.map(item => {
    const isActive = item.key === activeTab;
    return `
      <a href="${item.href}" class="bottom-nav-item ${isActive ? "active" : ""}">
        ${isActive ? '<span class="bottom-nav-indicator"></span>' : ""}
        <span class="bottom-nav-icon">${icons[item.key]}</span>
        <span class="bottom-nav-label">${item.label}</span>
      </a>
    `;
  }).join("");

  document.body.classList.add("has-bottom-nav");
  document.body.appendChild(nav);
}

import { state } from './state.js';

// ─── TOAST NOTIFICATIONS ───────────────────────────────────
export function showToast(title, msg, icon = "🔔") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div>
      <div class="toast-title">${title}</div>
      <div style="font-size:12px;opacity:.8;">${msg}</div>
    </div>
  `;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add("fade-out");
    setTimeout(() => t.remove(), 300);
  }, 5000);
}

// ─── SCREEN MANAGEMENT ─────────────────────────────────────
export function showScreen(name) {
  const screens = ["screen-loader", "screen-auth", "screen-app", "screen-onboarding"];
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = "none";
  });

  const target = document.getElementById(`screen-${name}`);
  if (target) {
    target.style.display = (name === "app") ? "block" : "flex";
  }
}

// ─── VIEW MANAGEMENT (TABS) ───────────────────────────────
export function showView(name) {
  const views = { 
    dashboard: "view-dashboard", 
    meals: "view-meals", 
    workouts: "view-workouts", 
    shopping: "view-shopping", 
    profile: "view-profile", 
    history: "view-history" 
  };

  Object.keys(views).forEach(k => {
    const el = document.getElementById(views[k]);
    if (el) {
      el.classList.remove("active");
      el.classList.add("hidden");
    }
  });

  const target = document.getElementById(views[name]);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }

  // Update tabs
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  const nb = document.querySelector(`.nav-btn[data-view="${name}"]`);
  if (nb) nb.classList.add("active");

  const fab = document.getElementById("btn-fab");
  if (fab) fab.style.display = (name === "dashboard") ? "flex" : "none";
}

// ─── DATE HELPERS ──────────────────────────────────────────
export function getDateKey() {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Expose to window for HTML onclick calls
window.showView = showView;
window.showScreen = showScreen;
window.showToast = showToast;

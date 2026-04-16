import { auth, db } from './js/firebase-config.js';
import { state, updateState } from './js/state.js';
import { showView, showScreen, showToast, getDateKey } from './js/ui-controller.js';
import { initAuth } from './js/auth-module.js';
import { updateCaloriesUI, renderWaterDots } from './js/diary-module.js';
import { loadDashboard } from './js/dashboard.js';

// ─── INITIALIZATION ───────────────────────────────────────
initAuth();

// ─── FASTING TIMER LOOP ───────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }

window.updateTimerUI = function() {
  const btn = document.getElementById("btn-toggle-fast");
  const display = document.getElementById("time-display");
  const label = document.getElementById("phase-label");
  const ring = document.getElementById("ring-progress");
  const circ = 2 * Math.PI * 96;

  clearInterval(state.timerInterval);

  if (state.isFasting) {
    if (btn) { btn.textContent = "⏹ Quebrar Jejum"; btn.classList.add("active"); }
    if (label) label.textContent = "Em Jejum";

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - (state.fastStartTime ? state.fastStartTime.getTime() : now);
      const goalMs = state.fastingGoal * 3600000;
      const remainingMs = goalMs - diff;

      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      if (display) display.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);

      const progress = Math.min(diff / goalMs, 1);
      if (ring) ring.style.strokeDashoffset = circ - progress * circ;

      if (remainingMs <= 0) {
        if (display) display.textContent = "🎯 Meta Atingida!";
      }
    }, 1000);
    updateState({ timerInterval: interval });
  } else {
    if (btn) { btn.textContent = `▶ Iniciar Jejum (${state.fastingGoal}h)`; btn.classList.remove("active"); }
    if (label) label.textContent = "Janela Alimentar";
    if (ring) ring.style.strokeDashoffset = circ;
    
    const interval = setInterval(() => {
      const diff = Date.now() - (state.eatingStartTime ? state.eatingStartTime.getTime() : Date.now());
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      if (display) display.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
    }, 1000);
    updateState({ timerInterval: interval });
  }
};

// ─── WATER LOGIC ──────────────────────────────────────────
window.startWaterReminders = function() {
  if (state.waterTimer) clearInterval(state.waterTimer);
  if (state.waterInterval <= 0) return;
  const timer = setInterval(() => {
    if (state.waterCount < state.waterGoal) {
      showToast("Hora de tomar água! 💧", "Mantenha-se hidratado.", "💧");
    }
  }, state.waterInterval * 60000);
  updateState({ waterTimer: timer });
};

// ─── EVENT BINDING ────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

document.getElementById("btn-toggle-fast")?.addEventListener("click", () => {
  if (!state.currentUid) return;
  const isFasting = !state.isFasting;
  const fastStartTime = isFasting ? new Date() : null;
  const eatingStartTime = !isFasting ? new Date() : null;

  updateState({ isFasting, fastStartTime, eatingStartTime });
  
  db.collection("users").doc(state.currentUid).set({ 
    isFasting, fastStartTime, eatingStartTime 
  }, { merge: true });
  
  window.updateTimerUI();
});

document.getElementById("select-fast-goal")?.addEventListener("change", (e) => {
  const goal = parseInt(e.target.value);
  updateState({ fastingGoal: goal });
  if (state.currentUid) db.collection("users").doc(state.currentUid).set({ fastingGoal: goal }, { merge: true });
  window.updateTimerUI();
});

// Fallback loader removal
setTimeout(() => {
  const loader = document.getElementById("screen-loader");
  if (loader && loader.style.display !== "none" && !state.currentUid) {
    showScreen("auth");
  }
}, 5000);

console.log("🚀 Habyto Wellness Modularizado iniciado com sucesso.");

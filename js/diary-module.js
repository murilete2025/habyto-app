import { db } from './firebase-config.js';
import { state, updateState } from './state.js';
import { showToast, getDateKey } from './ui-controller.js';

export function renderWaterDots() {
  const wrap = document.getElementById("water-dots");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (let i = 0; i < state.waterGoal; i++) {
    const d = document.createElement("div");
    d.className = "water-dot" + (i < state.waterCount ? " filled" : "");
    d.textContent = i < state.waterCount ? "💧" : "○";
    d.onclick = () => updateWater(i);
    wrap.appendChild(d);
  }
}

async function updateWater(idx) {
  if (!state.currentUid) return;
  const newCount = (idx < state.waterCount) ? idx : idx + 1;
  updateState({ waterCount: newCount });
  
  const dateKey = getDateKey();
  await db.collection("users").doc(state.currentUid).collection("dailyLogs").doc(dateKey).set({ water: state.waterCount }, { merge: true });
  
  renderWaterDots();
  const lbl = document.getElementById("water-label");
  if (lbl) lbl.textContent = state.waterCount + " / " + state.waterGoal + " copos";
  
  if (state.waterCount >= state.waterGoal) {
    showToast("Meta Batida! 🏆", "Você atingiu sua meta de hidratação hoje!", "✨");
  }
}

export function updateCaloriesUI() {
  const maintenance = Math.round(state.dailyLimit + 500); 
  const deficit = Math.max(0, maintenance - state.dailyCalories);
  const targetDeficit = 500;

  const pct = Math.min((state.dailyCalories / state.dailyLimit) * 100, 100);
  const ring = document.getElementById("calorie-progress-ring");
  const txt = document.getElementById("calories-text");
  const pctDisplay = document.getElementById("calorie-pct-display");
  
  if (ring) { 
    const circ = 603; 
    ring.style.strokeDashoffset = circ - (pct / 100) * circ;
    ring.style.stroke = pct > 100 ? "#ef4444" : pct > 85 ? "#f59e0b" : "var(--green)"; 
  }
  if (txt) txt.textContent = state.dailyCalories + " / " + state.dailyLimit + " kcal";
  if (pctDisplay) pctDisplay.textContent = Math.round(pct) + "%";

  const maintEl = document.getElementById("val-maintenance");
  const defNowEl = document.getElementById("val-deficit-now");
  if (maintEl) maintEl.textContent = maintenance + " kcal";
  if (defNowEl) {
    defNowEl.textContent = deficit + " kcal";
    defNowEl.style.color = deficit >= targetDeficit ? "var(--green)" : "var(--accent)";
  }

  if (state.dailyCalories >= state.dailyLimit && state.dailyCalories < maintenance) {
    showToast("Atenção", "Você atingiu sua meta diária!", "⚠️");
  } else if (state.dailyCalories >= maintenance) {
    showToast("Limite Excedido", "Você ultrapassou seu nível de manutenção.", "🔴");
  }

  // Macros calculation
  const pT = Math.round(state.dailyLimit * 0.3 / 4);
  const cT = Math.round(state.dailyLimit * 0.5 / 4);
  const fT = Math.round(state.dailyLimit * 0.2 / 9);
  const pN = Math.round(state.dailyCalories * 0.3 / 4);
  const cN = Math.round(state.dailyCalories * 0.5 / 4);
  const fN = Math.round(state.dailyCalories * 0.2 / 9);

  setMacro("val-prot", "bar-prot", pN, pT);
  setMacro("val-carb", "bar-carb", cN, cT);
  setMacro("val-fat", "bar-fat", fN, fT);
}

function setMacro(valId, barId, val, target) {
  const v = document.getElementById(valId); if (v) v.textContent = val + "g";
  const b = document.getElementById(barId); if (b) b.style.width = Math.min((val/target)*100, 100) + "%";
}

export function openWeightModal() {
  const el = document.getElementById("modal-weight-update");
  if (el) el.classList.remove("hidden");
}

export function closeWeightModal() {
  const el = document.getElementById("modal-weight-update");
  if (el) el.classList.add("hidden");
}

export async function saveNewWeight() {
  const val = document.getElementById("inp-new-weight").value;
  const weight = parseFloat(val);
  if (!weight || weight <= 0) return showToast("Atenção", "Digite um peso válido.", "⚖️");

  const snap = await db.collection("users").doc(state.currentUid).get();
  const d = snap.data();
  let history = d.weightHistory || [];
  let startWeight = d.startWeight || d.weight || weight;

  history.push({ weight, date: new Date() });

  await db.collection("users").doc(state.currentUid).update({
    weight,
    startWeight,
    weightHistory: history
  });

  const last = history.length > 1 ? history[history.length - 2].weight : startWeight;
  if (weight < last) {
    const diff = Math.round((last - weight) * 10) / 10;
    showToast("Incrível! 🎉", `Você eliminou mais ${diff}kg!`, "🔥");
  } else {
    showToast("Peso atualizado!", "Consistência é a chave.", "✅");
  }

  closeWeightModal();
  window.loadDashboard();
}

// Global exports for HTML
window.openWeightModal = openWeightModal;
window.closeWeightModal = closeWeightModal;
window.saveNewWeight = saveNewWeight;
window.renderWaterDots = renderWaterDots;

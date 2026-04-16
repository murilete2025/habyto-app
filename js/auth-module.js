import { auth, db } from './firebase-config.js';
import { state, updateState } from './state.js';
import { showScreen, showToast } from './ui-controller.js';

export function initAuth() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      updateState({ currentUid: user.uid });
      
      const snap = await db.collection("users").doc(user.uid).get();
      const d = snap.data() || {};
      updateState({ userProfile: d });

      if (!d.name) {
        showScreen("onboarding");
      } else {
        const nameEl = document.getElementById("user-name");
        if (nameEl) nameEl.textContent = d.name;
        showScreen("app");
        
        if (d.lastGeneratedPlan) {
          updateState({ weeklyPlan: d.lastGeneratedPlan.weekly_plan });
        }
        
        // This will be defined in the main orchestrator or shared
        window.loadDashboard();
      }
    } else {
      updateState({ currentUid: null });
      showScreen("auth");
    }
  });
}

export function nextObStep(step) {
  if (step === 2) {
    const name = document.getElementById("ob-name").value.trim();
    if (!name) { 
      showToast("Atenção", "Por favor, digite seu nome.", "👤"); 
      return; 
    }
  }
  document.querySelectorAll(".ob-step").forEach(s => s.classList.add("hidden"));
  const target = document.getElementById(`ob-step-${step}`);
  if (target) target.classList.remove("hidden");
}

export async function finishOnboarding() {
  const name = document.getElementById("ob-name").value.trim();
  const gender = document.getElementById("ob-gender").value;
  const height = document.getElementById("ob-height").value;
  const weight = document.getElementById("ob-weight").value;
  const goal = document.getElementById("ob-goal").value;
  const goalType = document.getElementById("ob-goal-type").value;

  if (!height || !weight || !goal) {
    showToast("Atenção", "Preencha suas medidas para continuar.", "⚖️");
    return;
  }

  const initialWeightData = { weight: parseFloat(weight), date: new Date() };

  await db.collection("users").doc(state.currentUid).update({
    name, gender, height, weight,
    startWeight: weight,
    goalWeight: goal,
    goalType: goalType,
    age: "30",
    onboardingComplete: true,
    weightHistory: [initialWeightData]
  });

  const nameEl = document.getElementById("user-name");
  if (nameEl) nameEl.textContent = name;
  showScreen("app");
  window.loadDashboard();
}

export function renderProfileStats(d) {
  const cur = parseFloat(d.weight) || 0;
  let start = parseFloat(d.startWeight);
  
  if (!start && d.weightHistory && d.weightHistory.length > 0) {
    start = d.weightHistory[0].weight;
  }
  start = start || cur;

  const goal = parseFloat(d.goalWeight) || 0;
  const diff = Math.round((cur - start) * 10) / 10;
  const toGo = Math.abs(Math.round((cur - goal) * 10) / 10);

  const elDiff = document.getElementById("stat-weight-diff");
  const elCur = document.getElementById("stat-current-weight");
  const elGoal = document.getElementById("stat-goal");
  const elToGo = document.getElementById("stat-to-go");
  const elHeight = document.getElementById("stat-height");

  if (elDiff) elDiff.textContent = (diff <= 0 ? "" : "+") + diff + " kg";
  if (elCur) elCur.textContent = cur + "kg";
  if (elGoal) elGoal.textContent = goal;
  if (elHeight) elHeight.textContent = d.height + "cm";
  if (elToGo) elToGo.textContent = toGo + "kg";
}

// Global Exports
window.nextObStep = nextObStep;
window.finishOnboarding = finishOnboarding;
window.logout = () => auth.signOut();

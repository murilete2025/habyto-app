import { db } from './firebase-config.js';
import { state } from './state.js';
import { showToast } from './ui-controller.js';

export async function generateAIWorkout() {
  if (!state.currentUid) return;
  const days = document.getElementById("wo-days").value;
  const level = document.getElementById("wo-level").value;
  
  const loading = document.getElementById("workouts-loading");
  const empty = document.getElementById("workouts-empty-state");
  if (loading) loading.classList.remove("hidden");
  if (empty) empty.classList.add("hidden");

  try {
    const snap = await db.collection("users").doc(state.currentUid).get();
    const userData = snap.data() || {};
    
    const response = await fetch("/api/generate-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gender: userData.gender || 'não informado',
        goal: userData.goalType || 'perda_peso',
        weight: userData.weight || 70,
        height: userData.height || 170,
        days: days,
        level: level
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro no servidor');
    }

    const data = await response.json();
    if (data.workout_plan) {
      await db.collection("users").doc(state.currentUid).update({
        lastGeneratedWorkout: data.workout_plan
      });
      renderWorkoutPlan(data.workout_plan);
      showToast("Treino Gerado! 🏋️‍♀️", "Seu cronograma está pronto.", "✨");
    } else {
      throw new Error("Resposta da IA inválida");
    }
  } catch (err) {
    console.error("Workout Fetch Error:", err);
    showToast("Erro", `Não foi possível gerar: ${err.message}`, "❌");
    if (empty) empty.classList.remove("hidden");
  } finally {
    if (loading) loading.classList.add("hidden");
  }
}

export function renderWorkoutPlan(plan) {
  const container = document.getElementById("workouts-container");
  const empty = document.getElementById("workouts-empty-state");
  if (!container) return;
  
  if (!plan || plan.length === 0) {
    if (empty) empty.classList.remove("hidden");
    container.innerHTML = "";
    return;
  }

  if (empty) empty.classList.add("hidden");
  container.innerHTML = plan.map((item, idx) => `
    <div class="card" style="margin-bottom:12px; border-left:4px solid var(--accent);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4 style="font-weight:800; color:var(--accent);">${item.day}</h4>
        <span style="font-size:11px; background:var(--bg); padding:2px 8px; border-radius:10px;">${item.focus}</span>
      </div>
      <p style="font-size:14px; font-weight:700; margin-bottom:4px;">${item.title}</p>
      <p style="font-size:13px; color:var(--muted); line-height:1.4; margin-bottom:12px;">${item.description}</p>
      <button class="btn-start-workout" onclick="recordWorkoutFromBtn(this, '${item.title.replace(/'/g, "\\'")}')" style="padding: 8px 16px; font-size: 13px;">▶ Gravar Treino</button>
    </div>
  `).join("") + `
    <button onclick="generateAIWorkout()" class="btn-ghost" style="width:100%; margin:20px 0; border:1px dashed var(--border);">
      ✨ Gerar Novo Cronograma com IA
    </button>
  `;
}

export async function recordWorkout(title) {
  if (!state.currentUid) return;
  const dateKey = window.getDateKey(); // Assumi que getDateKey será global ou importada
  const logRef = db.collection("users").doc(state.currentUid).collection("dailyLogs").doc(dateKey);
  
  const snap = await logRef.get();
  const d = snap.data() || {};
  let workouts = d.workouts || [];
  workouts.push({ title, time: new Date() });
  
  await logRef.set({ workouts }, { merge: true });
}

window.generateAIWorkout = generateAIWorkout;
window.recordWorkoutFromBtn = async function(btn, title) {
  if (btn.classList.contains("done")) return;
  const oldText = btn.textContent;
  btn.textContent = "Salvando..."; btn.disabled = true;

  try {
    await recordWorkout(title);
    btn.textContent = "✅ Gravado!"; 
    btn.classList.add("done"); 
    btn.disabled = true;
    showToast("Treino gravado!", title, "🔥");
  } catch (err) {
    btn.textContent = oldText; 
    btn.disabled = false;
    showToast("Erro", "Falha ao gravar.", "❌");
  }
};

import { db } from './firebase-config.js';
import { state, updateState } from './state.js';
import { showToast, getDateKey, showScreen } from './ui-controller.js';
import { renderProfileStats } from './auth-module.js';
import { renderWaterDots, updateCaloriesUI } from './diary-module.js';
import { renderWorkoutPlan } from './workout-module.js';
import { renderMeals, renderShoppingList } from './diet-module.js';

export function calcLimit(d) {
  const age = parseInt(d.age) || 30;
  const height = parseInt(d.height) || 165;
  const weight = parseFloat(d.weight) || 70;
  const gender = d.gender || "feminino";
  const act = parseFloat(d.activityLevel) || 1.2;
  const bmr = gender === "masculino"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  return Math.max(1200, Math.round(bmr * act - 500));
}

export async function loadDashboard() {
  if (!state.currentUid) return;
  
  loadBlogPosts();
  
  try {
    const snap = await db.collection("users").doc(state.currentUid).get();
    if (snap.exists) {
      const d = snap.data();
      updateState({ userProfile: d });
      
      const nameEl = document.getElementById("user-name");
      if (nameEl && d.name) nameEl.textContent = d.name;

      renderProfileStats(d);
      renderSubscriptionStatus(d);

      updateState({
        isFasting: d.isFasting || false,
        fastStartTime: d.fastStartTime ? d.fastStartTime.toDate() : null,
        eatingStartTime: d.eatingStartTime ? d.eatingStartTime.toDate() : null,
        fastingGoal: parseInt(d.fastingGoal) || 16,
        waterGoal: parseInt(d.waterGoal) || 8,
        waterInterval: parseInt(d.waterInterval) || 60,
        dailyLimit: calcLimit(d)
      });
      
      if (!state.isFasting && !state.eatingStartTime) {
        const now = new Date();
        updateState({ eatingStartTime: now });
        db.collection("users").doc(state.currentUid).set({ eatingStartTime: now }, { merge: true });
      }
      
      // Start reminders (implement in main app)
      window.startWaterReminders();

      const selGoal = document.getElementById("select-fast-goal");
      if (selGoal) selGoal.value = state.fastingGoal;

      const dateKey = getDateKey();
      const logSnap = await db.collection("users").doc(state.currentUid).collection("dailyLogs").doc(dateKey).get();
      const logData = logSnap.exists ? logSnap.data() : { calories: 0, water: 0 };
      
      updateState({
        dailyCalories: logData.calories || 0,
        waterCount: logData.water || 0
      });

      updateCaloriesUI();
      renderWaterDots();
      
      const wlbl = document.getElementById("water-label");
      if (wlbl) wlbl.textContent = state.waterCount + " / " + state.waterGoal + " copos";

      // Streak Logic
      handleStreak(d);

      // Subscription check
      checkSubscriptionStatus(d);

      if (d.lastGeneratedWorkout) renderWorkoutPlan(d.lastGeneratedWorkout);
      if (d.lastGeneratedPlan && d.lastGeneratedPlan.weekly_plan) {
        updateState({ weeklyPlan: d.lastGeneratedPlan.weekly_plan });
        renderMeals(state.currentDayIndex);
        renderShoppingList(d.lastGeneratedPlan.shopping_list || []);
      }
    }
    updateCaloriesUI();
    window.updateTimerUI(); // Defined in main app or ui-controller
  } catch (e) {
    console.warn("loadDashboard error:", e);
  }
}

function handleStreak(d) {
  const today = new Date();
  const todayStr = today.toDateString();
  const lastCheckInDate = d.lastCheckIn ? d.lastCheckIn.toDate() : null;
  let streakCount = d.streakCount || 0;

  if (!lastCheckInDate || lastCheckInDate.toDateString() !== todayStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastCheckInDate && lastCheckInDate.toDateString() === yesterday.toDateString()) {
      streakCount++;
    } else {
      streakCount = 1;
    }
    db.collection("users").doc(state.currentUid).set({ 
      lastCheckIn: today, 
      streakCount: streakCount 
    }, { merge: true });
  }

  const streakEl = document.getElementById("streak-count");
  if (streakEl) streakEl.textContent = streakCount;
}

function checkSubscriptionStatus(d) {
  const status = d.subscriptionStatus || 'free';
  if (status === 'expired' || status === 'canceled') {
    const blurDiv = document.createElement('div');
    blurDiv.id = "blocking-overlay";
    blurDiv.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px';
    blurDiv.innerHTML = `
      <div style="background:var(--surface);padding:30px;border-radius:24px;max-width:350px;color:var(--text);box-shadow:0 24px 60px rgba(0,0,0,0.2);">
        <div style="font-size:40px;margin-bottom:10px">⚠️</div>
        <h2 style="font-size:22px;margin-bottom:10px;font-weight:800;">Acesso Suspenso</h2>
        <p style="color:var(--muted);margin-bottom:24px;line-height:1.5;font-size:15px;font-weight:500;">
          Sua assinatura consta como <strong>${status === 'expired' ? 'Vencida' : 'Cancelada'}</strong>. 
        </p>
        <button onclick="auth.signOut();location.reload()" style="background:var(--green);color:#fff;border:none;padding:14px 20px;border-radius:12px;font-weight:700;font-size:16px;cursor:pointer;width:100%">Sair</button>
      </div>
    `;
    document.body.appendChild(blurDiv);
  }
}

export function renderSubscriptionStatus(d) {
  const statusEl = document.getElementById("sub-status");
  const planEl = document.getElementById("sub-plan-name");
  const daysEl = document.getElementById("sub-days-left");
  if (!statusEl || !planEl || !daysEl) return;

  const status = d.subscriptionStatus || 'free';
  const expires = d.subscriptionExpires ? d.subscriptionExpires.toDate() : null;

  if (status === 'active') {
    statusEl.textContent = "Ativo";
    statusEl.style.color = "var(--green)";
    planEl.textContent = d.planName || "Habyto Premium";
    if (expires) {
      const diffDays = Math.ceil((expires - new Date()) / (1000 * 60 * 60 * 24));
      daysEl.textContent = diffDays > 0 ? `Em ${diffDays} dias` : "Hoje";
    } else {
      daysEl.textContent = "Plano Vitalício";
    }
  } else {
    statusEl.textContent = status === 'expired' ? "Expirado" : "Pendente";
    statusEl.style.color = "#ff4444";
    daysEl.textContent = "Renove agora";
  }
}

export function loadBlogPosts() {
  db.collection("posts").orderBy("createdAt", "desc").limit(5).get().then(snap => {
    const section = document.getElementById("blog-section");
    const feed = document.getElementById("blog-feed");
    if (!feed || !section) return;
    if (snap.empty) { section.style.display = "none"; return; }

    section.style.display = "block";
    feed.innerHTML = snap.docs.map(doc => {
      const p = doc.data();
      return `
        <div class="card" style="margin-bottom:12px; cursor:pointer;" onclick="showPostDetail(\`${p.title}\`, \`${p.category}\`, \`${p.text.replace(/\n/g,'<br>')}\`)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <strong style="font-size:14px;">${p.title}</strong>
            <span class="tag">${p.category || 'Dica'}</span>
          </div>
          <p class="clamp-2">${p.text}</p>
        </div>
      `;
    }).join('');
  });
}

window.loadDashboard = loadDashboard;
window.showPostDetail = (title, cat, text) => alert(title + "\n\n" + text.replace(/<br>/g, '\n'));

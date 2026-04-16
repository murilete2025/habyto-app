import { db } from './firebase-config.js';
import { state, updateState } from './state.js';
import { showToast } from './ui-controller.js';

export async function generateAIDiet() {
  if (!state.currentUid) return;
  const count = document.getElementById("diet-meals-count").value;
  const excl = document.getElementById("diet-exclusions").value;
  const rout = document.getElementById("diet-routine").value;
  
  const loading = document.getElementById("meals-loading");
  const empty = document.getElementById("meals-empty-state");
  const container = document.getElementById("meals-container");

  if (loading) loading.classList.remove("hidden");
  if (empty) empty.classList.add("hidden");
  if (container) container.classList.add("hidden");

  try {
    const snap = await db.collection("users").doc(state.currentUid).get();
    const userData = snap.exists ? snap.data() : {};
    const context = {
      meals: count,
      foods: excl.split(",").map(t => t.trim()).filter(t => t),
      routine: rout
    };

    const res = await fetch("/api/generate", { 
      method: "POST", 
      headers: { "Content-Type":"application/json" }, 
      body: JSON.stringify({ ...userData, context }) 
    });

    if (!res.ok) throw new Error("Erro da IA");
    const data = await res.json();
    
    const weeklyPlan = data.weekly_plan || data.plan;
    const shopList = data.shopping_list || [];
    if (!weeklyPlan) throw new Error("Plano inválido");
    
    updateState({ weeklyPlan });
    
    await db.collection("users").doc(state.currentUid).update({ 
      lastGeneratedPlan: { weekly_plan: weeklyPlan, shopping_list: shopList, generatedAt: new Date() } 
    });
    
    renderMeals(state.currentDayIndex);
    renderShoppingList(shopList);
    showToast("Plano Gerado!", "Sua semana personalizada está pronta.", "✨");
    if (container) container.classList.remove("hidden");
  } catch (err) {
    showToast("Erro", "Falha ao gerar plano. Tente novamente.", "❌");
    if (empty) empty.classList.remove("hidden");
  } finally {
    if (loading) loading.classList.add("hidden");
  }
}

export function renderMeals(dayIdx) {
  const c = document.getElementById("meals-container");
  const empty = document.getElementById("meals-empty-state");
  if (!c || !state.weeklyPlan || !state.weeklyPlan[dayIdx]) return;
  
  if (empty) empty.classList.add("hidden");
  c.classList.remove("hidden");
  
  const day = state.weeklyPlan[dayIdx];
  const imgs = [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1494859802809-d069c3b71a8a?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&h=300&fit=crop",
  ];
  
  window._meals = day.meals; // Keep global for switchOpt fallback
  c.innerHTML = (day.meals || []).map((m, mi) => {
    const opt = (m.options && m.options[0]) || { title: m.name || "", description: m.description || "" };
    const optBtns = (m.options || []).map((o, oi) => `
      <button class="opt-btn ${oi===0?"active":""}" onclick="switchOpt(${mi}, ${oi})">Opção ${oi+1}</button>
    `).join("");

    return `
      <div class="meal-card">
        <img class="meal-card-img" src="${imgs[mi % imgs.length]}" alt="refeição" loading="lazy" />
        <div class="meal-card-body">
          <span class="meal-type-tag">${m.type||"Refeição"}</span>
          <div id="meal-opts-${mi}" class="meal-options-tabs">${optBtns}</div>
          <div id="meal-content-${mi}">
            <h3 class="meal-title">${opt.title}</h3>
            <p class="meal-desc">${opt.description}</p>
          </div>
          <button class="btn-primary" style="width:100%; margin-top:15px; font-size:13px;" onclick="logMeal(${mi})">✅ Consumir esta refeição</button>
        </div>
      </div>
    `;
  }).join("");
}

export function renderShoppingList(list) {
  const c = document.getElementById("shopping-container");
  if (!c || !list || !list.length) return;
  window._shopList = list;
  c.innerHTML = list.map((cat, ci) => `
    <div>
      <p class="shop-category-title">${cat.category}</p>
      ${(cat.items||[]).map((item, ii) => `
        <div class="shop-item" id="si-${ci}-${ii}">
          <span onclick="this.closest('.shop-item').classList.toggle('checked')">${item}</span>
          <button class="btn-del" onclick="deleteShopItem(${ci},${ii})">🗑</button>
        </div>
      `).join("")}
    </div>
  `).join("");
}

// Global exposure
window.generateAIDiet = generateAIDiet;
window.renderMeals = renderMeals;
window.renderShoppingList = renderShoppingList;

// Diet Actions
window.switchOpt = function(mealIdx, optIdx) {
  if (!state.weeklyPlan || !state.weeklyPlan[state.currentDayIndex]) return;
  const meal = state.weeklyPlan[state.currentDayIndex].meals[mealIdx];
  const opt = meal.options[optIdx];
  
  const content = document.getElementById(`meal-content-${mealIdx}`);
  if (content) {
    content.innerHTML = `
      <h3 class="meal-title">${opt.title}</h3>
      <p class="meal-desc">${opt.description}</p>
    `;
  }
  
  const optsDiv = document.getElementById(`meal-opts-${mealIdx}`);
  if (optsDiv) {
    optsDiv.querySelectorAll(".opt-btn").forEach((b, i) => {
      b.classList.toggle("active", i === optIdx);
    });
  }
};

window.logMeal = async function(idx) {
  if (!state.currentUid) return;
  const day = state.weeklyPlan[state.currentDayIndex];
  const meal = day.meals[idx];
  const activeOptBtn = document.querySelector(`#meal-opts-${idx} .opt-btn.active`);
  const optIdx = activeOptBtn ? parseInt(activeOptBtn.textContent.split(" ")[1]) - 1 : 0;
  const opt = meal.options[optIdx];

  const dateKey = getDateKey();
  const logRef = db.collection("users").doc(state.currentUid).collection("dailyLogs").doc(dateKey);
  
  const snap = await logRef.get();
  const d = snap.data() || { calories: 0, meals: [] };
  const meals = d.meals || [];
  
  // Calcular calorias aproximadas se não houver (ex: 350-500)
  const cals = parseInt(opt.calories) || (idx === 0 ? 450 : 350); 
  
  meals.push({ name: opt.title, calories: cals, time: new Date(), type: meal.type });
  
  await logRef.set({ 
    meals, 
    calories: (d.calories || 0) + cals 
  }, { merge: true });

  updateState({ dailyCalories: state.dailyCalories + cals });
  window.updateCaloriesUI();
  showToast("Refeição registrada! 🥗", `${opt.title} adicionado.`, "✅");
};

window.openMealSelection = function(cals, name) {
  updateState({ pendingMealData: { cals, name } });
  const modal = document.getElementById("modal-meal-confirm");
  if (modal) {
    modal.classList.remove("hidden");
    document.getElementById("confirm-meal-name").textContent = name;
    document.getElementById("confirm-meal-cals").textContent = cals + " kcal";
  }
};

window.confirmMealLog = async function(type) {
  if (!state.pendingMealData || !state.currentUid) return;
  const { cals, name } = state.pendingMealData;
  const dateKey = getDateKey();
  const logRef = db.collection("users").doc(state.currentUid).collection("dailyLogs").doc(dateKey);
  
  const snap = await logRef.get();
  const d = snap.data() || { calories: 0, meals: [] };
  const meals = d.meals || [];
  
  meals.push({ name, calories: cals, time: new Date(), type });
  
  await logRef.set({ 
    meals, 
    calories: (d.calories || 0) + cals 
  }, { merge: true });

  updateState({ dailyCalories: state.dailyCalories + cals, pendingMealData: null });
  window.updateCaloriesUI();
  
  const modal = document.getElementById("modal-meal-confirm");
  if (modal) modal.classList.add("hidden");
  
  showToast("Refeição Registrada!", `${name} salvo como ${type}.`, "📸");
};

// Diet vision logic
document.getElementById("camera-input")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  showToast("Analisando...", "A IA está identificando seu prato.", "📸");
  
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const base64 = ev.target.result.split(',')[1];
    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.openMealSelection(parseInt(data.calories) || 0, data.name || "Refeição");
    } catch (err) {
      showToast("Atenção", "Configure OPENAI_API_KEY no Vercel.", "⚠️");
    }
  };
  reader.readAsDataURL(file);
});

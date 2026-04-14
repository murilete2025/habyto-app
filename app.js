// ─── FIREBASE COMPAT ────────────────────────────────────
// Não usa "import" — depende dos <script> compat no HTML
const firebaseConfig = {
  apiKey: "AIzaSyCSbf0N5vYjqTTcLHAzHVja-VdPjKxvP_4",
  authDomain: "app-jejum-emagrecimento.firebaseapp.com",
  projectId: "app-jejum-emagrecimento",
  storageBucket: "app-jejum-emagrecimento.firebasestorage.app",
  messagingSenderId: "279209135099",
  appId: "1:279209135099:web:675c01b0f6e680acc3195e",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ─── GLOBALS ─────────────────────────────────────────────
let currentUid      = null;
let isFasting       = false;
let timerInterval   = null;
let weeklyPlan      = null;
let currentDayIndex = 0;
let waterCount      = 0;
let dailyCalories   = 0;
let dailyLimit      = 1500;
let fastingGoal     = 16;
let fastStartTime   = null;
let eatingStartTime = null;
let notifiedFastEnd = false;
let notified30m = false;
let notified5m  = false;

// ─── NOTIFICATIONS (API REAL) ──────────────────────────
async function requestNotifyPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    await Notification.requestPermission();
  }
}

function sendNotification(title, body, icon) {
  if (Notification.permission === "granted") {
    new Notification(title, { body: body, icon: icon || "/icon.png" });
  }
  showToast(title, body, "🔔"); // Fallback toast
}

// ─── TOAST ──────────────────────────────────────────────
function showToast(title, msg, icon) {
  icon = icon || "🔔";
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = '<span class="toast-icon">' + icon + '</span><div><div class="toast-title">' + title + '</div><div style="font-size:12px;opacity:.8;">' + msg + '</div></div>';
  c.appendChild(t);
  setTimeout(function() { t.classList.add("fade-out"); setTimeout(function() { t.remove(); }, 300); }, 5000);
}

// ─── SCREENS ─────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("screen-loader").style.display = "none";
  document.getElementById("screen-auth").style.display  = "none";
  document.getElementById("screen-app").style.display   = "none";
  if (name === "loader") { document.getElementById("screen-loader").style.display = "flex"; }
  if (name === "auth")   { document.getElementById("screen-auth").style.display   = "flex"; }
  if (name === "app")    { document.getElementById("screen-app").style.display    = "block"; }
}

// ─── FALLBACK: se em 8s o Firebase não responder, mostra login ──
setTimeout(function() {
  var loader = document.getElementById("screen-loader");
  if (loader && loader.style.display !== "none") {
    console.warn("Firebase demorou — exibindo tela de login.");
    showScreen("auth");
  }
}, 8000);

// ─── AUTH STATE ───────────────────────────────────────────
auth.onAuthStateChanged(function(user) {
  if (user) {
    currentUid = user.uid;
    requestNotifyPermission(); // Pedir permissão ao logar
    var name = user.email.split("@")[0];
    var nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    showScreen("app");
    loadDashboard();
  } else {
    currentUid = null;
    showScreen("auth");
  }
});

// ─── AUTH FORM ────────────────────────────────────────────
var isLogin = true;

document.getElementById("btn-toggle-auth").addEventListener("click", function() {
  isLogin = !isLogin;
  document.getElementById("auth-title").textContent    = isLogin ? "Bem-vinda de volta" : "Criar conta";
  document.getElementById("auth-subtitle").textContent = isLogin ? "Entre para acessar seu plano" : "Comece sua jornada hoje";
  document.getElementById("btn-auth").textContent      = isLogin ? "Entrar" : "Criar conta";
  document.getElementById("auth-error").classList.add("hidden");
  var sw = document.querySelector(".auth-switch");
  if (sw) sw.innerHTML = isLogin
    ? 'Não tem conta? <button id="btn-toggle-auth" class="link-btn">Criar agora</button>'
    : 'Já tem conta? <button id="btn-toggle-auth" class="link-btn">Entrar</button>';
  // Re-attach listener
  var newBtn = document.getElementById("btn-toggle-auth");
  if (newBtn) newBtn.addEventListener("click", arguments.callee.bind(this));
});

document.getElementById("auth-form").addEventListener("submit", function(e) {
  e.preventDefault();
  var email   = document.getElementById("inp-email").value.trim();
  var pass    = document.getElementById("inp-password").value;
  var errEl   = document.getElementById("auth-error");
  var btnAuth = document.getElementById("btn-auth");

  errEl.classList.add("hidden");
  btnAuth.textContent = "Carregando…"; btnAuth.disabled = true;

  var promise = isLogin
    ? auth.signInWithEmailAndPassword(email, pass)
    : auth.createUserWithEmailAndPassword(email, pass).then(function(cred) {
        // Verifica se o lead já foi marcado como PAGO pelo webhook
        return db.collection("leads").where("email", "==", email.toLowerCase()).where("status", "==", "pago").get().then(function(snap) {
          var initialStatus = snap.empty ? "expired" : "active";
          var quiz = null;
          try { quiz = JSON.parse(localStorage.getItem("quiz_results") || "null"); } catch(e) {}
          var params = new URLSearchParams(window.location.search);
          
          return db.collection("users").doc(cred.user.uid).set({
            email: email,
            createdAt: new Date(),
            subscriptionStatus: initialStatus,
            isFasting: false, fastStartTime: null, waterGlasses: 0,
            age:        params.get("age")        || (quiz && quiz.age2)           || "30",
            height:     params.get("height")     || (quiz && quiz.heightCm)       || "165",
            weight:     params.get("weight")     || (quiz && quiz.currentWeight)  || "70",
            goalWeight: params.get("goalWeight") || (quiz && quiz.goalWeight)     || "60",
            gender:     params.get("gender")     || (quiz && quiz.gender)         || "feminino",
            body:       params.get("body")       || (quiz && quiz.startPoint)     || "",
            quizResults: quiz,
          }).then(function() { localStorage.removeItem("quiz_results"); });
        });
      });

  promise.catch(function(err) {
    var msgs = {
      "auth/user-not-found":        "E-mail não encontrado.",
      "auth/wrong-password":        "Senha incorreta.",
      "auth/email-already-in-use":  "E-mail já cadastrado.",
      "auth/invalid-email":         "E-mail inválido.",
      "auth/weak-password":         "Senha muito fraca (mín. 6 caracteres).",
      "auth/invalid-credential":    "E-mail ou senha incorretos.",
      "auth/too-many-requests":     "Muitas tentativas. Aguarde.",
    };
    errEl.textContent = msgs[err.code] || err.message;
    errEl.classList.remove("hidden");
  }).finally(function() {
    btnAuth.textContent = isLogin ? "Entrar" : "Criar conta";
    btnAuth.disabled = false;
  });
});

// ─── LOGOUT ──────────────────────────────────────────────
var btnLogout = document.getElementById("btn-logout");
if (btnLogout) btnLogout.addEventListener("click", function() { auth.signOut(); });

// ─── NAVIGATION ──────────────────────────────────────────
var views = { dashboard:"view-dashboard", meals:"view-meals", workouts:"view-workouts", shopping:"view-shopping", profile:"view-profile" };

function showView(name) {
  Object.keys(views).forEach(function(k) {
    var el = document.getElementById(views[k]);
    if (el) { el.classList.remove("active"); el.classList.add("hidden"); }
  });
  var target = document.getElementById(views[name]);
  if (target) { target.classList.remove("hidden"); target.classList.add("active"); }
  document.querySelectorAll(".nav-btn").forEach(function(b) { b.classList.remove("active"); });
  var nb = document.querySelector('.nav-btn[data-view="' + name + '"]');
  if (nb) nb.classList.add("active");
  var fab = document.getElementById("btn-fab");
  if (fab) fab.style.display = (name === "dashboard") ? "flex" : "none";
}
window.showView = showView;

document.querySelectorAll(".nav-btn").forEach(function(btn) {
  btn.addEventListener("click", function() { showView(btn.dataset.view); });
});

// ─── WATER DOTS ──────────────────────────────────────────
function renderWaterDots() {
  var wrap = document.getElementById("water-dots");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (var i = 0; i < 8; i++) {
    (function(idx) {
      var d = document.createElement("div");
      d.className = "water-dot" + (idx < waterCount ? " filled" : "");
      d.textContent = idx < waterCount ? "💧" : "○";
      d.addEventListener("click", function() {
        if (!currentUid) return;
        waterCount = (idx < waterCount) ? idx : idx + 1;
        db.collection("users").doc(currentUid).set({ waterGlasses: waterCount }, { merge: true });
        renderWaterDots();
        var lbl = document.getElementById("water-label");
        if (lbl) lbl.textContent = waterCount + " / 8 copos";
      });
      wrap.appendChild(d);
    })(i);
  }
}

// ─── CALORIES + MACROS ───────────────────────────────────
function updateCaloriesUI() {
  var pct = Math.min((dailyCalories / dailyLimit) * 100, 100);
  var bar = document.getElementById("calories-bar");
  var txt = document.getElementById("calories-text");
  if (bar) { bar.style.width = pct + "%"; bar.style.background = pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "var(--green)"; }
  if (txt) txt.textContent = dailyCalories + " / " + dailyLimit + " kcal";

  var pT = Math.round(dailyLimit * 0.3 / 4), cT = Math.round(dailyLimit * 0.5 / 4), fT = Math.round(dailyLimit * 0.2 / 9);
  var pN = Math.round(dailyCalories * 0.3 / 4), cN = Math.round(dailyCalories * 0.5 / 4), fN = Math.round(dailyCalories * 0.2 / 9);

  function setMacro(valId, barId, val, target) {
    var v = document.getElementById(valId); if (v) v.textContent = val + "g";
    var b = document.getElementById(barId);  if (b) b.style.width = Math.min((val/target)*100,100) + "%";
  }
  setMacro("val-prot","bar-prot", pN, pT);
  setMacro("val-carb","bar-carb", cN, cT);
  setMacro("val-fat", "bar-fat",  fN, fT);
}

// ─── FASTING TIMER ───────────────────────────────────────
function updateTimerUI() {
  var btn     = document.getElementById("btn-toggle-fast");
  var display = document.getElementById("time-display");
  var status  = document.getElementById("timer-status");
  var label   = document.getElementById("phase-label");
  var ring    = document.getElementById("ring-progress");
  var circ    = 2 * Math.PI * 96;

  clearInterval(timerInterval);

  if (isFasting) {
    if (btn)   { btn.textContent = "⏹ Quebrar Jejum"; btn.classList.add("active"); }
    if (label) label.textContent = "Em Jejum";

    timerInterval = setInterval(function() {
      var now = Date.now();
      var diff = now - (fastStartTime ? fastStartTime.getTime() : now);
      var goalMs = fastingGoal * 3600000;
      var remainingMs = goalMs - diff;

      // Formatação do tempo decorrido
      var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      if (display) display.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
      
      var progress = Math.min(diff / goalMs, 1);
      if (ring) ring.style.strokeDashoffset = circ - progress * circ;

      // Lógica de Notificações Antecipadas
      var minutesLeft = Math.floor(remainingMs / 60000);

      if (remainingMs > 0) {
        if (status) status.textContent = "Faltam " + pad(Math.floor(remainingMs/3600000)) + ":" + pad(Math.floor((remainingMs%3600000)/60000)) + " para a meta";
        
        // Alerta 30 min
        if (minutesLeft <= 30 && minutesLeft > 25 && !notified30m) {
          sendNotification("Preparar Refeição! 🥗", "Faltam 30 minutos para encerrar seu jejum. Hora de organizar sua comida!", "🥗");
          notified30m = true;
          db.collection("users").doc(currentUid).set({ lastNotified30m: new Date().toDateString() }, { merge: true });
        }
        // Alerta 5 min
        if (minutesLeft <= 5 && minutesLeft > 0 && !notified5m) {
          sendNotification("Quase lá! ⏳", "Faltam apenas 5 minutos. Prepare-se para quebrar o jejum!", "⏳");
          notified5m = true;
          db.collection("users").doc(currentUid).set({ lastNotified5m: new Date().toDateString() }, { merge: true });
        }
      } else {
        if (status) status.textContent = "🎯 Meta de " + fastingGoal + "h atingida!";
        if (!notifiedFastEnd) {
          sendNotification("Jejum Completo! 🎉", "Parabéns! Você completou suas " + fastingGoal + "h. Pode realizar sua refeição agora.", "🍱");
          notifiedFastEnd = true;
          db.collection("users").doc(currentUid).set({ lastNotifiedFast: new Date().toDateString() }, { merge: true });
        }
      }
    }, 1000);
  } else {
    if (btn)   { btn.textContent = "▶ Iniciar Jejum (" + fastingGoal + "h)"; btn.classList.remove("active"); }
    if (label) label.textContent = "Janela Alimentar";
    if (ring)  ring.style.strokeDashoffset = circ;
    timerInterval = setInterval(function() {
      var windowMs = 8 * 3600000;
      var diff = Date.now() - (eatingStartTime ? eatingStartTime.getTime() : Date.now());
      var rem = Math.max(0, windowMs - diff);
      var h = Math.floor(rem / 3600000), m = Math.floor((rem % 3600000) / 60000), s = Math.floor((rem % 60000) / 1000);
      if (display) display.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
      if (status)  status.textContent = "Tempo da janela alimentar";
    }, 1000);
  }
}
function pad(n) { return String(n).padStart(2, "0"); }

var btnFast = document.getElementById("btn-toggle-fast");
var selGoal = document.getElementById("select-fast-goal");

if (selGoal) {
  selGoal.addEventListener("change", function() {
    fastingGoal = parseInt(this.value);
    if (currentUid) db.collection("users").doc(currentUid).set({ fastingGoal: fastingGoal }, { merge: true });
    updateTimerUI();
    // Atualiza o texto do botão se não estiver em jejum
    if (!isFasting && btnFast) btnFast.textContent = "▶ Iniciar Jejum (" + fastingGoal + "h)";
  });
}

if (btnFast) btnFast.addEventListener("click", function() {
  if (!currentUid) return;
  isFasting   = !isFasting;
  fastStartTime   = isFasting ? new Date() : null;
  eatingStartTime = !isFasting ? new Date() : null;
  notifiedFastEnd = false; notified30m = false; notified5m = false;
  
  db.collection("users").doc(currentUid).set({ 
    isFasting: isFasting, 
    fastStartTime: fastStartTime, 
    eatingStartTime: eatingStartTime,
    lastNotifiedFast: "", lastNotified30m: "", lastNotified5m: "" 
  }, { merge: true });
  
  updateTimerUI();
});

// ─── CALORIAS MANUAL ─────────────────────────────────────
var btnAddCal = document.getElementById("btn-add-calories");
if (btnAddCal) btnAddCal.addEventListener("click", function() {
  var form = document.getElementById("manual-entry-form");
  if (form) form.classList.toggle("hidden");
});

var btnSave = document.getElementById("btn-save-manual");
if (btnSave) btnSave.addEventListener("click", function() {
  if (!currentUid) return;
  var nameEl = document.getElementById("manual-food-name");
  var calEl  = document.getElementById("manual-calories");
  var added  = parseInt(calEl ? calEl.value : 0) || 0;
  if (added <= 0) { showToast("Atenção", "Digite um valor de calorias.", "ℹ️"); return; }
  dailyCalories += added;
  db.collection("users").doc(currentUid).set({ dailyCalories: dailyCalories }, { merge: true });
  updateCaloriesUI();
  showToast("Registrado!", (nameEl ? nameEl.value || "Alimento" : "Alimento") + ": +" + added + " kcal", "✅");
  if (nameEl) nameEl.value = "";
  if (calEl)  calEl.value  = "";
  var form = document.getElementById("manual-entry-form");
  if (form) form.classList.add("hidden");
});

// ─── CÂMERA FAB ───────────────────────────────────────────
var btnFab = document.getElementById("btn-fab");
if (btnFab) btnFab.addEventListener("click", function() {
  var inp = document.getElementById("photo-input");
  if (inp) inp.click();
});

var photoInput = document.getElementById("photo-input");
if (photoInput) photoInput.addEventListener("change", function(e) {
  var file = e.target.files && e.target.files[0];
  if (!file || !currentUid) return;
  showToast("OlhoIA", "Analisando refeição…", "🧠");

  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement("canvas");
      var MAX = 800, scale = img.width > MAX ? MAX / img.width : 1;
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      var base64 = canvas.toDataURL("image/jpeg", 0.6);
      fetch("/api/vision", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ uid: currentUid, image: base64 }) })
        .then(function(r) { if (!r.ok) throw new Error("fail"); return r.json(); })
        .then(function(data) {
          var cals = parseInt(data.calories) || 0;
          dailyCalories += cals;
          db.collection("users").doc(currentUid).set({ dailyCalories: dailyCalories }, { merge: true });
          updateCaloriesUI();
          showToast("Prato Avaliado!", (data.name || "Refeição") + ": +" + cals + " kcal", "🍽️");
        })
        .catch(function() { showToast("Atenção", "Configure OPENAI_API_KEY no Vercel.", "⚠️"); });
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
});

// ─── AI MEALS ────────────────────────────────────────────
var btnAI = document.getElementById("btn-generate-ai");
if (btnAI) btnAI.addEventListener("click", function() {
  if (!currentUid) return;
  var loading = document.getElementById("ai-loading");
  btnAI.classList.add("hidden");
  if (loading) loading.classList.remove("hidden");

  db.collection("users").doc(currentUid).get().then(function(snap) {
    var userData = snap.exists ? snap.data() : {};
    return fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(Object.assign({}, userData, { context: userData.quizResults || {} })) });
  }).then(function(res) {
    if (!res.ok) throw new Error("Erro da IA");
    return res.json();
  }).then(function(data) {
    weeklyPlan = data.weekly_plan || data.plan;
    var shopList = data.shopping_list || [];
    if (!weeklyPlan) throw new Error("Plano inválido");
    db.collection("users").doc(currentUid).set({ lastGeneratedPlan: { weekly_plan: weeklyPlan, shopping_list: shopList, generatedAt: new Date() } }, { merge: true });
    renderMeals(currentDayIndex);
    renderShoppingList(shopList);
    showToast("Plano Gerado!", "Sua semana personalizada está pronta.", "✨");
    showView("meals");
  }).catch(function(err) {
    showToast("Erro", err.message, "❌");
  }).finally(function() {
    if (loading) loading.classList.add("hidden");
    btnAI.classList.remove("hidden");
  });
});

// Day pills
var dayPills = document.getElementById("day-pills");
if (dayPills) dayPills.addEventListener("click", function(e) {
  var pill = e.target.closest(".day-pill");
  if (!pill) return;
  currentDayIndex = parseInt(pill.dataset.index);
  document.querySelectorAll(".day-pill").forEach(function(p) { p.classList.remove("active"); });
  pill.classList.add("active");
  if (weeklyPlan) renderMeals(currentDayIndex);
});

function renderMeals(dayIdx) {
  var c = document.getElementById("meals-container");
  if (!c || !weeklyPlan || !weeklyPlan[dayIdx]) return;
  var day = weeklyPlan[dayIdx];
  var imgs = [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1494859802809-d069c3b71a8a?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&h=300&fit=crop",
  ];
  window._meals = day.meals;
  c.innerHTML = (day.meals || []).map(function(m, mi) {
    var opt = (m.options && m.options[0]) || { title: m.name || "", description: m.description || "" };
    var optBtns = (m.options || []).map(function(o, oi) {
      return '<button class="opt-btn ' + (oi===0?"active":"") + '" onclick="switchOpt(' + mi + ',' + oi + ')">Opção ' + (oi+1) + '</button>';
    }).join("");
    return '<div class="meal-card">' +
      '<img class="meal-card-img" src="' + imgs[mi % imgs.length] + '" alt="refeição" loading="lazy" />' +
      '<div class="meal-card-body">' +
        '<span class="meal-type-tag">' + (m.type||"Refeição") + '</span>' +
        '<div id="meal-content-' + mi + '"><h3 class="meal-title">' + opt.title + '</h3><p class="meal-desc">' + opt.description + '</p></div>' +
        '<div class="meal-opts" id="meal-opts-' + mi + '">' + optBtns + '</div>' +
      '</div></div>';
  }).join("");

  // workout
  var wc = document.getElementById("workouts-container");
  if (wc && day.workout) {
    var wImgs = ["https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=300&fit=crop","https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=300&fit=crop"];
    wc.innerHTML = '<div class="workout-card">' +
      '<img class="workout-img" src="' + wImgs[dayIdx%2] + '" alt="Treino" loading="lazy"/>' +
      '<div class="workout-body"><h3 class="workout-title">' + day.workout.title + '</h3>' +
      '<p class="workout-desc">' + day.workout.description + '</p>' +
      '<button class="btn-start-workout" id="btn-start-wo">▶ Iniciar Treino</button></div></div>';
    var bwo = document.getElementById("btn-start-wo");
    if (bwo) bwo.addEventListener("click", function() {
      this.textContent = "✅ Treino em andamento!"; this.classList.add("done"); this.disabled = true;
      showToast("Treino iniciado! 🏋️", day.workout.title, "🔥");
    });
  }
}

window.switchOpt = function(mealIdx, optIdx) {
  var meal = window._meals && window._meals[mealIdx]; if (!meal) return;
  var opt = meal.options && meal.options[optIdx]; if (!opt) return;
  var content = document.getElementById("meal-content-"+mealIdx);
  if (content) content.innerHTML = '<h3 class="meal-title">' + opt.title + '</h3><p class="meal-desc">' + opt.description + '</p>';
  document.querySelectorAll("#meal-opts-"+mealIdx+" .opt-btn").forEach(function(b,i){ b.classList.toggle("active", i===optIdx); });
};

// ─── SHOPPING ────────────────────────────────────────────
function renderShoppingList(list) {
  var c = document.getElementById("shopping-container");
  if (!c || !list || !list.length) return;
  window._shopList = list;
  c.innerHTML = list.map(function(cat, ci) {
    return '<div><p class="shop-category-title">' + cat.category + '</p>' +
      (cat.items||[]).map(function(item, ii) {
        return '<div class="shop-item" id="si-'+ci+'-'+ii+'">' +
          '<span onclick="this.closest(\'.shop-item\').classList.toggle(\'checked\')">' + item + '</span>' +
          '<button class="btn-del" onclick="deleteShopItem('+ci+','+ii+')">🗑</button>' +
          '</div>';
      }).join("") + "</div>";
  }).join("");
}

window.deleteShopItem = function(ci, ii) {
  if (!currentUid || !window._shopList) return;
  window._shopList[ci].items.splice(ii, 1);
  if (!window._shopList[ci].items.length) window._shopList.splice(ci, 1);
  db.collection("users").doc(currentUid).set({ lastGeneratedPlan: { shopping_list: window._shopList } }, { merge: true });
  renderShoppingList(window._shopList);
};

var btnAddShop = document.getElementById("btn-add-shop");
if (btnAddShop) btnAddShop.addEventListener("click", function() {
  var inp = document.getElementById("new-shop-item");
  var text = inp && inp.value && inp.value.trim();
  if (!text || !currentUid) return;
  if (!window._shopList) window._shopList = [];
  var manual = null;
  for (var i=0; i<window._shopList.length; i++) { if (window._shopList[i].category==="Meus Itens") { manual=window._shopList[i]; break; } }
  if (!manual) { manual = { category:"Meus Itens", items:[] }; window._shopList.unshift(manual); }
  manual.items.push(text);
  db.collection("users").doc(currentUid).set({ lastGeneratedPlan: { shopping_list: window._shopList } }, { merge: true });
  renderShoppingList(window._shopList);
  if (inp) inp.value = "";
});

// ─── PROFILE ─────────────────────────────────────────────
var profTab = document.querySelector('.nav-btn[data-view="profile"]');
if (profTab) profTab.addEventListener("click", function() {
  if (!currentUid) return;
  db.collection("users").doc(currentUid).get().then(function(snap) {
    if (!snap.exists) return;
    var d = snap.data();
    function set(id,val) { var el=document.getElementById(id); if(el&&val!=null) el.value=val; }
    set("prof-age",d.age); set("prof-gender",d.gender); set("prof-weight",d.weight);
    set("prof-height",d.height); set("prof-goal",d.goalWeight);
    set("prof-activity",d.activityLevel||"1.2"); set("prof-fasting-goal",d.fastingGoal||"16");
  });
});

var btnSaveProf = document.getElementById("btn-save-profile");
if (btnSaveProf) btnSaveProf.addEventListener("click", function() {
  if (!currentUid) return;
  function get(id) { var e=document.getElementById(id); return e?e.value:""; }
  var data = { age:get("prof-age"), gender:get("prof-gender"), weight:get("prof-weight"),
    height:get("prof-height"), goalWeight:get("prof-goal"),
    activityLevel:get("prof-activity"), fastingGoal:get("prof-fasting-goal") };
  btnSaveProf.textContent = "Salvando…"; btnSaveProf.disabled = true;
  db.collection("users").doc(currentUid).set(data, { merge: true })
    .then(function() {
      fastingGoal = parseInt(data.fastingGoal) || 16;
      dailyLimit  = calcLimit(data);
      updateCaloriesUI();
      showToast("Perfil Salvo!", "Seu plano foi atualizado.", "✅");
    })
    .catch(function() { showToast("Erro", "Falha ao salvar.", "❌"); })
    .finally(function() { btnSaveProf.textContent = "Salvar Perfil"; btnSaveProf.disabled = false; });
});

// ─── DASHBOARD CONTENT (BLOG) ──────────────────────────────
function loadBlogPosts() {
  db.collection("posts").orderBy("createdAt", "desc").limit(5).get().then(function(snap) {
    var section = document.getElementById("blog-section");
    var feed = document.getElementById("blog-feed");
    if (!feed || !section) return;

    if (snap.empty) {
      section.style.display = "none";
      return;
    }

    section.style.display = "block";
    feed.innerHTML = snap.docs.map(function(doc) {
      var p = doc.data();
      return `
        <div class="card" style="margin-bottom:0; cursor:pointer;" onclick="showPostDetail(\`${p.title}\`, \`${p.category}\`, \`${p.text.replace(/\n/g,'<br>')}\`)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <strong style="font-size:15px; color:var(--text);">${p.title}</strong>
            <span style="font-size:11px; font-weight:700; background:var(--green-light); color:var(--green); padding:2px 8px; border-radius:12px;">${p.category || 'Dica'}</span>
          </div>
          <p style="font-size:13px; color:var(--muted); overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; line-height:1.4;">${p.text}</p>
        </div>
      `;
    }).join('');
  });
}

function showPostDetail(title, cat, text) {
  // Poderia abrir um modal, mas por simplicidade vamos usar um alert customizado ou apenas expandir.
  // Vamos criar um modal simples no app se não houver.
  alert(title + "\n\n" + text.replace(/<br>/g, '\n'));
}

// ─── LOAD DASHBOARD ──────────────────────────────────────
function loadDashboard() {
  if (!currentUid) return;
  loadBlogPosts();
  db.collection("users").doc(currentUid).get().then(function(snap) {
    if (snap.exists) {
      var d = snap.data();
      isFasting       = d.isFasting || false;
      fastStartTime   = d.fastStartTime  ? d.fastStartTime.toDate()  : null;
      eatingStartTime = d.eatingStartTime ? d.eatingStartTime.toDate() : null;
      
      // Se não estiver em jejum e não tiver hora de comer, define agora uma vez
      if (!isFasting && !eatingStartTime) {
        eatingStartTime = new Date();
        db.collection("users").doc(currentUid).set({ eatingStartTime: eatingStartTime }, { merge: true });
      }
      waterCount      = d.waterGlasses || 0;
      fastingGoal     = parseInt(d.fastingGoal) || 16;
      dailyLimit      = calcLimit(d);

      var selGoal = document.getElementById("select-fast-goal");
      if (selGoal) selGoal.value = fastingGoal;

      // Verificação da Data para Reset (Calorias e Água) e Cálculo do Streak
      var today = new Date();
      var todayStr = today.toDateString();

      // Carrega status de notificação do banco
      notifiedFastEnd = (d.lastNotifiedFast === todayStr);
      notified30m     = (d.lastNotified30m === todayStr);
      notified5m      = (d.lastNotified5m  === todayStr);

      var lastCalDate = d.lastCalorieDate ? d.lastCalorieDate.toDate().toDateString() : "";
      
      var lastCheckInDate = d.lastCheckIn ? d.lastCheckIn.toDate() : null;
      var streakCount = d.streakCount || 0;
      var needsStreakUpdate = false;

      // Lógica de Ocorrência (Streak)
      if (!lastCheckInDate || lastCheckInDate.toDateString() !== todayStr) {
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastCheckInDate && lastCheckInDate.toDateString() === yesterday.toDateString()) {
          // Logou ontem, então conta continua
          streakCount++;
        } else {
          // Passou mais de um dia sem logar ou é novo, reinicia
          streakCount = 1;
        }
        needsStreakUpdate = true;
      }

      // Lógica de Reset Diário
      var needsCalorieReset = (lastCalDate !== todayStr);

      if (needsCalorieReset || needsStreakUpdate) {
        var updatePayload = {};
        
        if (needsCalorieReset) {
          dailyCalories = 0; waterCount = 0;
          updatePayload.dailyCalories = 0;
          updatePayload.waterGlasses = 0;
          updatePayload.lastCalorieDate = today;
        } else {
          dailyCalories = d.dailyCalories || 0;
        }

        if (needsStreakUpdate) {
          updatePayload.lastCheckIn = today;
          updatePayload.streakCount = streakCount;
        }

        db.collection("users").doc(currentUid).set(updatePayload, { merge: true });
      } else {
        dailyCalories = d.dailyCalories || 0;
      }

      var streakEl = document.getElementById("streak-count");
      if (streakEl) streakEl.textContent = streakCount;

      var banner = document.getElementById("profile-banner");
      if (banner) banner.classList.toggle("hidden", !!(d.age && d.height && d.weight && d.gender));

      if (d.subscriptionStatus === 'expired' || d.subscriptionStatus === 'canceled') {
        const blurDiv = document.createElement('div');
        blurDiv.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px';
        blurDiv.innerHTML = `
          <div style="background:var(--surface);padding:30px;border-radius:24px;max-width:350px;color:var(--text);box-shadow:0 24px 60px rgba(0,0,0,0.2);">
            <div style="font-size:40px;margin-bottom:10px">⚠️</div>
            <h2 style="font-size:22px;margin-bottom:10px;font-weight:800;">Acesso Suspenso</h2>
            <p style="color:var(--muted);margin-bottom:24px;line-height:1.5;font-size:15px;font-weight:500;">
              Sua assinatura consta como <strong>${d.subscriptionStatus === 'expired' ? 'Vencida' : 'Cancelada'}</strong>. 
              Regularize o pagamento para voltar a acessar o seu plano.
            </p>
            <button onclick="auth.signOut();location.reload()" style="background:var(--green);color:#fff;border:none;padding:14px 20px;border-radius:12px;font-weight:700;font-size:16px;cursor:pointer;width:100%">Desconectar e Sair</button>
          </div>
        `;
        document.body.appendChild(blurDiv);
        return; // Interrompe o carregamento do painel
      }

      if (d.lastGeneratedPlan && d.lastGeneratedPlan.weekly_plan) {
        weeklyPlan = d.lastGeneratedPlan.weekly_plan;
        renderMeals(currentDayIndex);
        renderShoppingList(d.lastGeneratedPlan.shopping_list || []);
      }
    }
    updateCaloriesUI();
    updateTimerUI();
    renderWaterDots();
    var wlbl = document.getElementById("water-label");
    if (wlbl) wlbl.textContent = waterCount + " / 8 copos";
    // Lembrete de água a cada 2h
    setInterval(function() { showToast("Hora da Água! 💧", "Beba um copo agora.", "💧"); }, 7200000);
  }).catch(function(e) {
    console.warn("loadDashboard error:", e);
    updateCaloriesUI(); updateTimerUI(); renderWaterDots();
  });
}

// ─── HELPERS ─────────────────────────────────────────────
function calcLimit(d) {
  var age = parseInt(d.age)||30, height=parseInt(d.height)||165, weight=parseFloat(d.weight)||70;
  var gender=d.gender||"feminino", act=parseFloat(d.activityLevel)||1.2;
  var bmr = gender==="masculino"
    ? 10*weight + 6.25*height - 5*age + 5
    : 10*weight + 6.25*height - 5*age - 161;
  return Math.max(1200, Math.round(bmr * act - 500));
}

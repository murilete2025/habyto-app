import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ─── FIREBASE ────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCSbf0N5vYjqTTcLHAzHVja-VdPjKxvP_4",
  authDomain: "app-jejum-emagrecimento.firebaseapp.com",
  projectId: "app-jejum-emagrecimento",
  storageBucket: "app-jejum-emagrecimento.firebasestorage.app",
  messagingSenderId: "279209135099",
  appId: "1:279209135099:web:675c01b0f6e680acc3195e",
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db   = getFirestore(firebaseApp);

// ─── UTILS ───────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById("toast-admin");
  if (!el) return;
  el.textContent = msg; el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3000);
}

function fmt(dateVal) {
  if (!dateVal) return "—";
  try {
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" });
  } catch { return "—"; }
}

function badge(text, color) {
  return `<span class="badge badge-${color}">${text}</span>`;
}

// ─── AUTH ─────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById("admin-email").value.trim();
  const pass  = document.getElementById("admin-pass").value;
  const errEl = document.getElementById("auth-error");
  errEl.style.display = "none";

  if (!email || !pass) {
    errEl.textContent = "Preencha e-mail e senha.";
    errEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("btn-admin-login");
  btn.textContent = "Entrando…"; btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    console.error("Erro de login:", e.code, e.message);
    const msgs = {
      "auth/invalid-credential":      "E-mail ou senha incorretos.",
      "auth/user-not-found":           "Usuário não encontrado.",
      "auth/wrong-password":           "Senha incorreta.",
      "auth/invalid-email":            "E-mail inválido.",
      "auth/too-many-requests":        "Muitas tentativas. Aguarde alguns minutos.",
      "auth/network-request-failed":   "Sem conexão. Verifique sua internet.",
      "auth/unauthorized-domain":      "Domínio não autorizado no Firebase. Veja instruções abaixo.",
    };
    errEl.textContent = msgs[e.code] || `Erro (${e.code}): ${e.message}`;
    errEl.style.display = "block";
  } finally {
    btn.textContent = "Entrar no Painel"; btn.disabled = false;
  }
}

document.getElementById("btn-admin-login").addEventListener("click", doLogin);

// Suporte à tecla Enter
["admin-email", "admin-pass"].forEach(id => {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
});

document.getElementById("btn-logout-admin").addEventListener("click", () => signOut(auth));

// ─── AUTH STATE ───────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app-screen").style.display  = "block";

    const name = user.email.split("@")[0];
    const nameEl  = document.getElementById("admin-name");
    const emailEl = document.getElementById("admin-email-display");
    const avatarEl = document.getElementById("admin-avatar");
    if (nameEl)  nameEl.textContent  = name.charAt(0).toUpperCase() + name.slice(1);
    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.textContent = name[0].toUpperCase();

    await loadAllData();
    loadSettings();
  } else {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app-screen").style.display  = "none";
  }
});

// ─── NAVIGATION ───────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    const page = item.dataset.page;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add("active");
  });
});

// ─── LOAD ALL DATA ────────────────────────────────────────
let allUsers = [];

async function loadAllData() {
  const lastEl = document.getElementById("last-updated");
  const dashDateEl = document.getElementById("dash-date");
  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    allUsers = [];
    snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));

    const total    = allUsers.length;
    const complete = allUsers.filter(u => u.age && u.height && u.weight && u.gender).length;
    const fasting  = allUsers.filter(u => u.isFasting).length;
    const plans    = allUsers.filter(u => u.lastGeneratedPlan).length;

    setText("m-total",    total);
    setText("m-complete", complete);
    setText("m-fasting",  fasting);
    setText("m-plans",    plans);
    setText("user-count", total);

    const now = new Date().toLocaleString("pt-BR");
    if (lastEl) lastEl.textContent = `Atualizado: ${now}`;
    if (dashDateEl) dashDateEl.textContent = now;

    renderRecentUsers(allUsers.slice(0, 5));
    renderUsersTable(allUsers);
  } catch (e) {
    console.error("Erro ao carregar usuários:", e);
    if (lastEl) lastEl.textContent = "Erro ao carregar dados. Verifique as regras do Firestore.";
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── RECENT TABLE (DASHBOARD) ─────────────────────────────
function renderRecentUsers(users) {
  const tbody = document.getElementById("recent-body");
  if (!tbody) return;
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted);">Nenhum usuário cadastrado ainda.</td></tr>'; return; }

  tbody.innerHTML = users.map(u => {
    const isComplete = !!(u.age && u.height && u.weight && u.gender);
    return `<tr>
      <td class="user-cell"><strong>${(u.email || "—").split("@")[0]}</strong><span>${u.email || "—"}</span></td>
      <td>${fmt(u.createdAt)}</td>
      <td>${u.weight || "—"}kg → ${u.goalWeight || "—"}kg</td>
      <td>${isComplete ? badge("Completo","green") : badge("Incompleto","amber")}</td>
    </tr>`;
  }).join("");
}

// ─── USERS TABLE ─────────────────────────────────────────
function renderUsersTable(users) {
  const tbody = document.getElementById("users-body");
  if (!tbody) return;
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);">Nenhum usuário encontrado.</td></tr>'; return; }

  tbody.innerHTML = users.map(u => {
    const isComplete = !!(u.age && u.height && u.weight && u.gender);
    const planBadge  = u.lastGeneratedPlan ? badge("Com plano", "green") : badge("Sem plano", "gray");
    const fastBadge  = u.isFasting ? badge("🔥 Em jejum","green") : badge("Janela alimentar","gray");

    return `<tr>
      <td class="user-cell"><strong>${(u.email || "—").split("@")[0]}</strong><span>${u.email || "—"}</span></td>
      <td>${fmt(u.createdAt)}</td>
      <td>${u.age || "—"} anos / ${u.gender || "—"}</td>
      <td>${u.weight || "—"}kg → ${u.goalWeight || "—"}kg</td>
      <td>${fastBadge}</td>
      <td>${isComplete ? badge("Completo","green") : badge("Incompleto","amber")}</td>
      <td><button class="btn-detail" data-uid="${u.id}">Ver detalhes</button></td>
    </tr>`;
  }).join("");

  // Attach click to detail buttons
  tbody.querySelectorAll(".btn-detail").forEach(btn => {
    btn.addEventListener("click", () => openModal(btn.dataset.uid));
  });
}

// ─── SEARCH ───────────────────────────────────────────────
document.getElementById("search-input").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = q ? allUsers.filter(u => (u.email || "").toLowerCase().includes(q)) : allUsers;
  renderUsersTable(filtered);
  setText("user-count", filtered.length);
});

// ─── MODAL DETAIL ─────────────────────────────────────────
async function openModal(uid) {
  const overlay = document.getElementById("modal-overlay");
  const body    = document.getElementById("modal-body");
  const title   = document.getElementById("modal-title");
  if (!overlay || !body) return;

  body.innerHTML = `<div style="text-align:center;padding:30px;"><div style="border:3px solid #f0f0f0;border-top-color:var(--green);border-radius:50%;width:32px;height:32px;animation:spin 1s linear infinite;margin:auto;"></div></div>`;
  overlay.classList.add("open");

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) { body.innerHTML = "<p>Usuário não encontrado.</p>"; return; }
    const u = snap.data();
    if (title) title.textContent = (u.email || uid).split("@")[0];

    const rows = [
      ["E-mail", u.email || "—"],
      ["Cadastro", fmt(u.createdAt)],
      ["Idade", u.age ? `${u.age} anos` : "—"],
      ["Gênero", u.gender || "—"],
      ["Altura", u.height ? `${u.height} cm` : "—"],
      ["Peso Atual", u.weight ? `${u.weight} kg` : "—"],
      ["Peso Meta", u.goalWeight ? `${u.goalWeight} kg` : "—"],
      ["Atividade", u.activityLevel || "—"],
      ["Meta de Jejum", u.fastingGoal ? `${u.fastingGoal}h` : "16h"],
      ["Em Jejum Agora", u.isFasting ? "✅ Sim" : "❌ Não"],
      ["Água Hoje", u.waterGlasses ? `${u.waterGlasses} copos` : "0"],
      ["Calorias Hoje", u.dailyCalories ? `${u.dailyCalories} kcal` : "0 kcal"],
      ["Streak", u.streakCount ? `${u.streakCount} dias 🔥` : "0"],
      ["Último check-in", fmt(u.lastCheckIn)],
      ["Plano gerado", u.lastGeneratedPlan ? `✅ Sim (${fmt(u.lastGeneratedPlan.generatedAt)})` : "❌ Ainda não"],
    ];

    body.innerHTML = rows.map(([label, value]) =>
      `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`
    ).join("");
  } catch (e) {
    body.innerHTML = `<p style="color:var(--red);">Erro ao carregar: ${e.message}</p>`;
  }
}

document.getElementById("btn-close-modal").addEventListener("click", () => {
  document.getElementById("modal-overlay").classList.remove("open");
});
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});

// ─── SETTINGS ────────────────────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "config", "global"));
    if (!snap.exists()) return;
    const d = snap.data();
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set("cfg-quiz-url",      d.quiz_url);
    set("cfg-mp-mensal",     d.mp_mensal);
    set("cfg-mp-anual",      d.mp_anual);
    set("cfg-fasting-default", d.fasting_default);
    set("cfg-price-mensal",  d.price_mensal);
    set("cfg-price-anual",   d.price_anual);
  } catch { /* sem config ainda */ }
}

window.saveConfig = async (key, inputId) => {
  const el = document.getElementById(inputId);
  if (!el) return;
  try {
    await setDoc(doc(db, "config", "global"), { [key]: el.value }, { merge: true });
    toast(`✅ ${key} salvo com sucesso!`);
  } catch (e) { toast(`❌ Erro: ${e.message}`); }
};

window.savePrices = async () => {
  const mensal = document.getElementById("cfg-price-mensal")?.value;
  const anual  = document.getElementById("cfg-price-anual")?.value;
  try {
    await setDoc(doc(db, "config", "global"), { price_mensal: mensal, price_anual: anual }, { merge: true });
    toast("✅ Preços salvos!");
  } catch (e) { toast(`❌ Erro: ${e.message}`); }
};

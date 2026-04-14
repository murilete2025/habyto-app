// ===== STATE =====
const state = {
  age: '30-39',
  gender: '',
  goals: [],
  startPoint: '',
  dreamBody: '',
  concerns: [],
  bestShape: '',
  knowledge: '',
  routine: '',
  firstMeal: '',
  meals: '3',
  mealType: '',
  foods: [],
  water: '',
  fatigue: '',
  cooking: '',
  bodyIssues: [],
  workSchedule: '',
  habits: [],
  weightEvents: [],
  heightCm: 170,
  heightFt: 5,
  heightIn: 7,
  currentWeight: 70,
  goalWeight: 58,
  age2: 30,
  email: '',
  weightUnit: 'kg',
  heightUnit: 'cm'
};

let currentScreen = 0;
const totalScreens = 30; // 0-29

// ===== NAVIGATION =====
function nextScreen() {
  const cur = document.getElementById('screen-' + currentScreen);
  
  if (cur) {
    // VALIDAÇÃO: Se for uma tela de opções, verifica se algo foi selecionado
    const hasSelection = cur.querySelector('.option-item.selected, .multi-opt.selected, .food-tag.selected');
    const numberInput = cur.querySelector('.number-input:not(.hidden)');
    const emailInput = cur.querySelector('.email-input');

    if (!hasSelection && !numberInput && !emailInput && currentScreen !== 0 && currentScreen !== 1 && currentScreen !== 3 && currentScreen !== 10 && currentScreen !== 19) {
        // Se não for tela informativa e não tiver seleção, impede de avançar
        alert("Por favor, selecione uma opção para continuar.");
        return;
    }

    if (numberInput && !numberInput.value) {
        numberInput.style.borderColor = '#ef4444';
        return;
    }

    cur.classList.remove('active');
  }
  
  currentScreen++;
  if (currentScreen === 28) {
    showScreen(28);
    startLoadingSequence();
    return;
  }
  showScreen(currentScreen);
}

function prevScreen() {
  if (currentScreen <= 0) return;
  const cur = document.getElementById('screen-' + currentScreen);
  if (cur) cur.classList.remove('active');
  currentScreen--;
  showScreen(currentScreen);
}

function showScreen(n) {
  const el = document.getElementById('screen-' + n);
  if (el) {
    el.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// ===== AGE SELECTION (Step 0 -> 1) =====
function selectAge(age) {
  state.age = age;
  nextScreen();
}

// ===== SINGLE OPTION PICK =====
function pickOption(el, key, val) {
  // Deselect siblings
  const siblings = el.closest('.option-list').querySelectorAll('.option-item');
  siblings.forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  state[key] = val;

  if (key === 'gender') {
      const img1 = document.getElementById('motive-img-1');
      const text1 = document.getElementById('motive-gender-text');
      if (val === 'Masculino') {
          if(img1) img1.src = 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&q=80'; // Homem treinando
          if(text1) text1.textContent = 'homens';
      } else {
          if(img1) img1.src = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=80'; // Mulher meditando
          if(text1) text1.textContent = 'mulheres';
      }
  }

  // Auto-advance after delay for single-choice questions
  setTimeout(() => nextScreen(), 350);
}

// ===== MULTI OPTION TOGGLE =====
function toggleMulti(el) {
  el.classList.toggle('selected');
}

// ===== SELECT ALL TOGGLE =====
function toggleSelectAll(groupId) {
  const group = document.getElementById(groupId);
  const checkbox = document.getElementById('selectAll' + groupId.charAt(0).toUpperCase() + groupId.slice(1));
  const items = group.querySelectorAll('.multi-opt');
  if (checkbox.checked) {
    items.forEach(i => i.classList.add('selected'));
  } else {
    items.forEach(i => i.classList.remove('selected'));
  }
}

// ===== FOOD TAGS =====
function toggleTag(el) {
  el.classList.toggle('selected');
}

// ===== HEIGHT UNITS =====
function setUnit(unit) {
  state.heightUnit = unit;
  document.getElementById('btn-cm').classList.toggle('active', unit === 'cm');
  document.getElementById('btn-ft').classList.toggle('active', unit === 'ft');
  document.getElementById('cm-input').classList.toggle('hidden', unit !== 'cm');
  document.getElementById('ft-input').classList.toggle('hidden', unit === 'cm');
}

// ===== WEIGHT UNITS =====
function setWeightUnit(unit) {
  state.weightUnit = unit;
  document.getElementById('btn-kg').classList.toggle('active', unit === 'kg');
  document.getElementById('btn-lb').classList.toggle('active', unit === 'lb');
  document.getElementById('weight-unit-lbl').textContent = unit;
  document.getElementById('gweight-unit-lbl').textContent = unit;
}

// ===== PLAN SELECTION =====
window.selectPlan = function(el, plan) {
  const cards = document.querySelectorAll('.plan-card');
  cards.forEach(c => c.classList.remove('selected', 'plan-selected')); 
  el.classList.add('selected');
  state.selectedPlan = plan;
  
  const btn = document.getElementById('checkout-btn');
  if (plan === 'mensal') {
      btn.textContent = "Assinar Plano Mensal - R$ 29,90 →";
  } else {
      btn.textContent = "Assinar Plano Anual - R$ 97,00 →";
  }
}

// ===== LOADING SEQUENCE =====
function startLoadingSequence() {
  const loadingEl = document.getElementById('loading-anim');
  const formEl = document.getElementById('email-form');
  const steps = loadingEl.querySelectorAll('.loading-step');

  let i = 0;
  const interval = setInterval(() => {
    if (i < steps.length) {
      steps[i].classList.add('done');
      steps[i].textContent = '✔ ' + steps[i].textContent.replace('⏳ ', '');
      i++;
    } else {
      clearInterval(interval);
      // Show email form
      setTimeout(() => {
        loadingEl.style.display = 'none';
        formEl.classList.remove('hidden');
      }, 600);
    }
  }, 900);
}

// ===== GO TO RESULTS =====
function goToResults() {
  const email = document.getElementById('email-input').value;
  if (!email || !email.includes('@')) {
    document.getElementById('email-input').style.borderColor = '#e53e3e';
    document.getElementById('email-input').placeholder = 'Por favor, insira um e-mail válido';
    return;
  }
  state.email = email;

  // Save questionnaire answers
  const cw = parseFloat(document.getElementById('current-weight').value) || 70;
  const gw = parseFloat(document.getElementById('goal-weight').value) || 58;
  const ageVal = parseFloat(document.getElementById('age-input').value) || 30;
  state.currentWeight = cw;
  state.goalWeight = gw;
  state.age2 = ageVal;

  // Hide email form and show AI Loading
  const formEl = document.getElementById('email-form');
  const loaderEl = document.getElementById('final-loading');
  if (formEl) formEl.classList.add('hidden');
  if (loaderEl) loaderEl.classList.remove('hidden');

  // Fake AI Generation Time Before Results (4 seconds)
  setTimeout(() => {
      // Navigate to results
      const cur = document.getElementById('screen-' + currentScreen);
      if (cur) cur.classList.remove('active');
      currentScreen = 29;
      showScreen(29);
      
      // Reset loader state for back button consistency
      if (loaderEl) loaderEl.classList.add('hidden');

      // Update results data
      updateResultsPage(cw, gw, ageVal);
      startCountdown();
  }, 4200);
}

// ===== UPDATE RESULTS =====
function updateResultsPage(cw, gw, age) {
  const unit = state.weightUnit;

  document.getElementById('res-current-w').textContent = cw + ' ' + unit;
  document.getElementById('res-goal-w').textContent = gw + ' ' + unit;

  // Simple calorie estimate (Mifflin-St Jeor base)
  let heightCm = state.heightUnit === 'cm'
    ? (parseFloat(document.getElementById('height-cm').value) || 170)
    : (parseFloat(document.getElementById('height-ft').value) || 5) * 30.48 + (parseFloat(document.getElementById('height-in').value) || 7) * 2.54;
  let weightKg = unit === 'kg' ? cw : cw * 0.453592;
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161; // female formula
  let tdee = Math.round(bmr * 1.375); // lightly active
  let target = Math.round(tdee * 0.8); // 20% deficit

  document.getElementById('res-calories').textContent = target.toLocaleString('pt-BR') + ' kcal';
}

// ===== COUNTDOWN TIMER =====
function startCountdown() {
  let totalSec = 9 * 60 + 59;
  const el = document.getElementById('countdown');
  const timer = setInterval(() => {
    if (totalSec <= 0) { clearInterval(timer); return; }
    totalSec--;
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }, 1000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Make sure first screen is active
  showScreen(0);
});

// ===== GO TO FINAL CHECKOUT =====
async function goToCheckout() {
  if (!state.selectedPlan) {
      alert("Por favor, selecione um plano para continuar.");
      document.getElementById('pricing-section').scrollIntoView({behavior:'smooth'});
      return;
  }

  // Save full state to localStorage for the App to pick up
  localStorage.setItem('quiz_results', JSON.stringify(state));
  const btn = document.getElementById('checkout-btn');
  const originalText = btn.textContent;
  btn.textContent = "Processando pagamento...";
  btn.disabled = true;

  const params = new URLSearchParams({
    age: state.age2 || state.age,
    weight: state.currentWeight,
    goalWeight: state.goalWeight,
    body: state.startPoint || 'não especificado',
    gender: state.gender || 'não especificado',
    email: state.email,
    plan: state.selectedPlan
  }).toString();
  
  try {
    // Busca dados de pagamento ao vivo do painel Admin de forma super leve
    const fbRes = await fetch("https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/config/global");
    const fbData = await fbRes.json();
    
    if (fbData && fbData.fields) {
      let checkoutUrl = '';
      if (state.selectedPlan === 'mensal' && fbData.fields.mp_mensal?.stringValue) {
        checkoutUrl = fbData.fields.mp_mensal.stringValue;
      } else if (state.selectedPlan === 'anual' && fbData.fields.mp_anual?.stringValue) {
        checkoutUrl = fbData.fields.mp_anual.stringValue;
      }
      
      if (checkoutUrl && checkoutUrl.includes('http')) {
        // Envia o usuário com os parâmetros UTM e dados salvos no cache pro MP
        window.location.href = checkoutUrl;
        return;
      }
    }
  } catch(e) {
    console.warn("Erro ao ler links de checkout", e);
  }

  // Fallback: se os botões do Mercado Pago lá no Painel Admin ainda estiverem vazios
  console.log("Nenhum link ativo encontrado no admin, direcionando para dashboard demo.");
  window.location.href = `/?${params}`;
}

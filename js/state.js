// Estado Global Reativo (Simples)
export const state = {
  currentUid: null,
  isFasting: false,
  timerInterval: null,
  weeklyPlan: null,
  currentDayIndex: 0,
  waterCount: 0,
  dailyCalories: 0,
  dailyLimit: 1500,
  waterGoal: 8,
  waterInterval: 60,
  waterTimer: null,
  fastingGoal: 16,
  fastStartTime: null,
  eatingStartTime: null,
  notifiedFastEnd: false,
  notified30m: false,
  notified5m: false,
  pendingMealData: null,
  userProfile: {}
};

// Helpers de persistência local ou sessâo se necessário no futuro
export function updateState(updates) {
  Object.assign(state, updates);
}

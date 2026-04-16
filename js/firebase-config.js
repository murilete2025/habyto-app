// Configuração centralizada do Firebase (Compat Mode)
// Depende dos scripts carregados no index.html

export const firebaseConfig = {
  apiKey: "AIzaSyCSbf0N5vYjqTTcLHAzHVja-VdPjKxvP_4",
  authDomain: "app-jejum-emagrecimento.firebaseapp.com",
  projectId: "app-jejum-emagrecimento",
  storageBucket: "app-jejum-emagrecimento.firebasestorage.app",
  messagingSenderId: "279209135099",
  appId: "1:279209135099:web:675c01b0f6e680acc3195e",
};

// Inicialização (Global firebase já deve existir)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();

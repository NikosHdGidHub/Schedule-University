// js/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBJLntTOgh8nqXKDLfQt0Cixc3U3JUQKSs",
  authDomain: "scheduleapp-1c897.firebaseapp.com",
  projectId: "scheduleapp-1c897",
  storageBucket: "scheduleapp-1c897.firebasestorage.app",
  messagingSenderId: "512840221806",
  appId: "1:512840221806:web:f7f399d8b92846879bd27f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Функция для анонимного входа
export function loginAnonymously() {
  return signInAnonymously(auth);
}

// Функция-обёртка для отслеживания состояния аутентификации
export function onAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
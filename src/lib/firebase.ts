import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Shared Firebase project with Investio
const firebaseConfig = {
  projectId: "investio-ug",
  appId: "1:471220111855:web:1305788313735defc20e1a",
  apiKey: "AIzaSyBdqw9ijNhRNkJJugemGA-KAmUHg4JiUvs",
  authDomain: "investio-ug.firebaseapp.com",
  storageBucket: "investio-ug.firebasestorage.app",
  messagingSenderId: "471220111855",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

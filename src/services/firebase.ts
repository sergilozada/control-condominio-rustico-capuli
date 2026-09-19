import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const required = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID',
] as const;
export const isFirebaseConfigured = required.every(key => Boolean(import.meta.env[key]));

// Los valores de reserva solo permiten mostrar la pantalla de configuración.
// Los valores de reserva nunca se conectan a proyectos Firebase reales.
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'PENDING_SETUP',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pending.invalid',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pending-control-rustico-capuli',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pending.invalid',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '0',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'pending-setup',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;


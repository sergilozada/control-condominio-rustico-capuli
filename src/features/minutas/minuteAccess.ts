import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const minuteAccessEmail = 'minutas@condominiorusticocapuli.com';

export async function unlockMinutes(password: string): Promise<void> {
  const app = getApps().find(item => item.name === 'capuli-minute-access') || initializeApp(getApp().options, 'capuli-minute-access');
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  await signInWithEmailAndPassword(auth, minuteAccessEmail, password);
  await signOut(auth);
}

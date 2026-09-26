import { createUserWithEmailAndPassword, deleteUser, getAuth, inMemoryPersistence, setPersistence, signOut } from 'firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { UserRole } from '@/config/permissions';

export interface StaffProfile {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  role: UserRole;
  active: boolean;
  deleted?: boolean;
}

const domain = '@condominiorusticocapuli.com';
const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/;

export function staffEmail(username: string) {
  const local = username.trim().toLowerCase();
  if (!usernamePattern.test(local) || local.includes('..')) throw new Error('El usuario admite letras, números, puntos, guiones y guion bajo.');
  return `${local}${domain}`;
}

function secondaryAuth() {
  const app = getApps().find(item => item.name === 'capuli-staff-creator') || initializeApp(getApp().options, 'capuli-staff-creator');
  return getAuth(app);
}

function staffEvent(action: string, uid: string, actorUid: string, actorEmail: string) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'userEvents')), { action, targetUid: uid, actorUid, actorEmail, createdAt: serverTimestamp() });
  return batch;
}

export async function createStaffUser(input: { name: string; username: string; jobTitle: string; role: UserRole; password: string }, actorUid: string, actorEmail: string) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) throw new Error('Escribe un nombre de 2 a 100 caracteres.');
  if (input.password.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
  const email = staffEmail(input.username);
  const auth = secondaryAuth();
  await setPersistence(auth, inMemoryPersistence);
  const credential = await createUserWithEmailAndPassword(auth, email, input.password);
  try {
    const batch = staffEvent('crear', credential.user.uid, actorUid, actorEmail);
    batch.set(doc(db, 'users', credential.user.uid), {
      name, email, jobTitle: input.jobTitle.trim().slice(0, 100), role: input.role,
      active: true, deleted: false, createdAt: serverTimestamp(), createdBy: actorUid,
    });
    await batch.commit();
  } catch (error) {
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}

export async function updateStaffUser(uid: string, changes: { role?: UserRole; active?: boolean; deleted?: boolean }, action: string, actorUid: string, actorEmail: string) {
  if (uid === actorUid) throw new Error('No puedes modificar tu propia cuenta aquí.');
  const batch = staffEvent(action, uid, actorUid, actorEmail);
  batch.update(doc(db, 'users', uid), { ...changes, updatedAt: serverTimestamp(), updatedBy: actorUid });
  await batch.commit();
}

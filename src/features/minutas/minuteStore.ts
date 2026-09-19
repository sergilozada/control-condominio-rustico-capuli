import type { User } from 'firebase/auth';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { MinuteDraft } from './types';

type MinuteAction = 'minuta_crear' | 'minuta_actualizar' | 'minuta_generar';

function addAudit(batch: ReturnType<typeof writeBatch>, actor: User, minuteId: string, clientId: string, action: MinuteAction) {
  const entry = doc(collection(db, 'auditLogs'));
  batch.set(entry, {
    actorUid: actor.uid, actorEmail: actor.email || '', clientId, minuteId, action,
    fields: action === 'minuta_generar' ? ['status'] : ['draft'],
    summary: action === 'minuta_crear' ? 'Borrador de minuta creado' : action === 'minuta_generar' ? 'Borrador Word generado' : 'Borrador de minuta actualizado',
    createdAt: serverTimestamp(),
  });
  return entry.id;
}

export async function createMinute(actor: User, draft: MinuteDraft, clientName: string) {
  const reference = doc(collection(db, 'minutes'));
  const batch = writeBatch(db);
  const lastAuditId = addAudit(batch, actor, reference.id, draft.clientId, 'minuta_crear');
  batch.set(reference, {
    reference: `CRC-${new Date().toISOString().slice(0, 7).replace('-', '')}-${reference.id.slice(0, 6).toUpperCase()}`,
    clientId: draft.clientId, clientName, draft, status: 'borrador',
    createdBy: actor.uid, updatedBy: actor.uid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastAuditId,
  });
  await batch.commit();
  return reference.id;
}

export async function updateMinute(actor: User, minuteId: string, draft: MinuteDraft, action: Exclude<MinuteAction, 'minuta_crear'> = 'minuta_actualizar') {
  const batch = writeBatch(db);
  const lastAuditId = addAudit(batch, actor, minuteId, draft.clientId, action);
  batch.update(doc(db, 'minutes', minuteId), {
    draft, clientId: draft.clientId,
    ...(action === 'minuta_generar' ? { status: 'generada' } : {}),
    updatedBy: actor.uid, updatedAt: serverTimestamp(), lastAuditId,
  });
  await batch.commit();
}

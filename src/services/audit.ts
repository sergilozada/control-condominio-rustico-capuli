import { User } from 'firebase/auth';
import { collection, doc, serverTimestamp, writeBatch, type WriteBatch } from 'firebase/firestore';
import { db } from '@/services/firebase';

export type AuditAction = 'crear' | 'actualizar' | 'eliminar' | 'minuta_documento';
export type QuotaAction = 'pago_registrar' | 'voucher_actualizar' | 'boleta_actualizar';

function addAudit(batch: WriteBatch, actor: User, clientId: string, action: AuditAction, fields: string[], summary = '') {
  const entry = doc(collection(db, 'auditLogs'));
  batch.set(entry, {
    actorUid: actor.uid,
    actorEmail: actor.email || '',
    clientId,
    action,
    fields,
    summary,
    createdAt: serverTimestamp(),
  });
  return entry.id;
}

export async function createClientWithAudit(actor: User, data: Record<string, unknown>) {
  const client = doc(collection(db, 'clients'));
  const batch = writeBatch(db);
  const lastAuditId = addAudit(batch, actor, client.id, 'crear', Object.keys(data));
  batch.set(client, { ...data, lastAuditId });
  await batch.commit();
  return client.id;
}

export async function updateClientWithAudit(
  actor: User, clientId: string, data: Record<string, unknown>, summary = '', action: AuditAction = 'actualizar',
) {
  const batch = writeBatch(db);
  const lastAuditId = addAudit(batch, actor, clientId, action, Object.keys(data), summary);
  batch.update(doc(db, 'clients', clientId), { ...data, lastAuditId });
  await batch.commit();
}

export async function updateQuotaWithAudit(
  actor: User, clientId: string, quotas: unknown[], quotaIndex: number, action: QuotaAction,
) {
  const batch = writeBatch(db);
  const entry = doc(collection(db, 'auditLogs'));
  batch.set(entry, {
    actorUid: actor.uid, actorEmail: actor.email || '', clientId, action,
    quotaIndex, fields: ['cuotas'],
    summary: action === 'pago_registrar' ? `Cuota ${quotaIndex + 1} marcada pagada`
      : action === 'voucher_actualizar' ? `Voucher de cuota ${quotaIndex + 1} actualizado`
        : `Boleta de cuota ${quotaIndex + 1} actualizada`,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'clients', clientId), { cuotas: quotas, lastAuditId: entry.id });
  await batch.commit();
}

export async function deleteClientWithAudit(actor: User, clientId: string) {
  const batch = writeBatch(db);
  addAudit(batch, actor, clientId, 'eliminar', []);
  batch.delete(doc(db, 'clients', clientId));
  await batch.commit();
}

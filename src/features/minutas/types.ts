export interface MinuteBuyer {
  name: string;
  document: string;
  occupation: string;
  maritalStatus: string;
  address: string;
}

export interface InitialPayment {
  date: string;
  method: string;
  amount: number;
}

export interface MinuteDraft {
  clientId: string;
  buyers: MinuteBuyer[];
  propertyType: 'lote' | 'macrolote';
  block: string;
  lot: string;
  area: number;
  totalPrice: number;
  initialAmount: number;
  initialPayments: InitialPayment[];
  installments: number;
  firstDueDate: string;
  notes: string;
}

export interface MinuteRecord {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  status: 'borrador' | 'generada';
  draft: MinuteDraft;
  createdBy: string;
  updatedBy: string;
  updatedAt?: { toDate: () => Date };
}

export const blankBuyer = (): MinuteBuyer => ({ name: '', document: '', occupation: '', maritalStatus: '', address: '' });

export const blankMinute = (): MinuteDraft => ({
  clientId: '', buyers: [blankBuyer()], propertyType: 'lote', block: '', lot: '', area: 0,
  totalPrice: 0, initialAmount: 0, initialPayments: [], installments: 12,
  firstDueDate: '', notes: '',
});

export const money = (amount: number) => `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function validateMinute(draft: MinuteDraft): string[] {
  const errors: string[] = [];
  if (!draft.clientId) errors.push('Selecciona un cliente.');
  if (!draft.buyers.length || draft.buyers.some(buyer => !buyer.name.trim() || !/^\d{8}$/.test(buyer.document.trim()))) {
    errors.push('Cada comprador necesita nombre y DNI de ocho dígitos.');
  }
  if (!draft.block.trim() || !draft.lot.trim() || !Number.isFinite(draft.area) || draft.area <= 0) errors.push('Completa manzana, lote y área.');
  if (!Number.isFinite(draft.totalPrice) || draft.totalPrice <= 0 || !Number.isFinite(draft.initialAmount) || draft.initialAmount < 0 || draft.initialAmount >= draft.totalPrice) errors.push('Revisa el precio y la cuota inicial.');
  if (!Number.isInteger(draft.installments) || draft.installments < 1 || draft.installments > 240 || !/^\d{4}-\d{2}-\d{2}$/.test(draft.firstDueDate)) errors.push('Indica entre 1 y 240 cuotas y la fecha de la primera.');
  if (draft.initialPayments.some(payment => !payment.date || !payment.method || !Number.isFinite(payment.amount) || payment.amount <= 0)) errors.push('Completa cada pago inicial registrado.');
  const paymentSum = draft.initialPayments.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
  if (paymentSum !== Math.round(draft.initialAmount * 100)) errors.push('Los pagos iniciales deben sumar la cuota inicial.');
  return errors;
}

export function buildSchedule(draft: MinuteDraft) {
  const balanceCents = Math.round((draft.totalPrice - draft.initialAmount) * 100);
  const regularCents = Math.floor(balanceCents / draft.installments);
  const [year, month, day] = draft.firstDueDate.split('-').map(Number);
  return Array.from({ length: draft.installments }, (_, index) => {
    const date = new Date(year, month - 1 + index, 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const dueDate = new Date(date.getFullYear(), date.getMonth(), Math.min(day, lastDay));
    const amountCents = index === draft.installments - 1
      ? balanceCents - regularCents * (draft.installments - 1) : regularCents;
    return {
      number: index + 1,
      dueDate: [dueDate.getFullYear(), String(dueDate.getMonth() + 1).padStart(2, '0'), String(dueDate.getDate()).padStart(2, '0')].join('-'),
      amount: amountCents / 100,
    };
  });
}

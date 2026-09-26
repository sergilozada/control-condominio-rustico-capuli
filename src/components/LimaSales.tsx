import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch, type Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/FirebaseAuthContext';
import { db } from '@/services/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { money } from '@/features/minutas/types';

interface SalePayment {
  id: string; seller: string; weekStart: string; contractReference: string; buyer: string;
  lot: string; amount: number; paid: boolean; createdAt?: Timestamp; updatedBy?: string;
}

export default function LimaSales() {
  const { user, preview } = useAuth();
  const [items, setItems] = useState<SalePayment[]>([]);
  const [seller, setSeller] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [contractReference, setContractReference] = useState('');
  const [buyer, setBuyer] = useState('');
  const [lot, setLot] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview || user?.role !== 'admin') return;
    return onSnapshot(collection(db, 'limaSales'), snapshot => setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as SalePayment))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))), () => setError('No se pudo cargar el registro de ventas.'));
  }, [preview, user?.role]);

  if (user?.role !== 'admin') return null;

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const numeric = Number(amount);
    if (!seller.trim() || !weekStart || !contractReference.trim() || !buyer.trim() || !lot.trim() || !Number.isFinite(numeric) || numeric <= 0) { setError('Completa vendedor, semana, contrato, comprador, lote y pago válido.'); return; }
    if (preview) { setError('La vista de muestra no guarda pagos.'); return; }
    setBusy(true); setError('');
    try {
      const record = doc(collection(db, 'limaSales'));
      const audit = doc(collection(db, 'salesEvents'));
      const batch = writeBatch(db);
      batch.set(record, { seller: seller.trim(), weekStart, contractReference: contractReference.trim(), buyer: buyer.trim(), lot: lot.trim(), amount: numeric, paid: false, createdAt: serverTimestamp(), createdBy: user.id, updatedBy: user.id, lastAuditId: audit.id });
      batch.set(audit, { saleId: record.id, action: 'crear', actorUid: user.id, actorEmail: user.email, summary: `Venta con contrato ${contractReference.trim()} · ${seller.trim()}`, createdAt: serverTimestamp() });
      await batch.commit();
      setSeller(''); setWeekStart(''); setContractReference(''); setBuyer(''); setLot(''); setAmount('');
    } catch { setError('No se pudo guardar el registro.'); }
    finally { setBusy(false); }
  };

  const setPaid = async (item: SalePayment) => {
    setBusy(true); setError('');
    try {
      const audit = doc(collection(db, 'salesEvents'));
      const batch = writeBatch(db);
      batch.update(doc(db, 'limaSales', item.id), { paid: !item.paid, updatedAt: serverTimestamp(), updatedBy: user.id, lastAuditId: audit.id });
      batch.set(audit, { saleId: item.id, action: item.paid ? 'pendiente' : 'pagado', actorUid: user.id, actorEmail: user.email, summary: `${item.seller} · ${item.contractReference} · ${money(item.amount)}`, createdAt: serverTimestamp() });
      await batch.commit();
    } catch { setError('No se pudo actualizar el pago.'); }
    finally { setBusy(false); }
  };

  const pending = items.filter(item => !item.paid).reduce((sum, item) => sum + item.amount, 0);
  return <div className="space-y-5">
    <div className="rounded-3xl bg-[#17250c] p-7 text-white"><p className="text-xs font-semibold uppercase tracking-widest text-[#eadca4]">Equipo comercial · Lima</p><h1 className="brand-display mt-2 text-3xl">Vendedores de Lima</h1><p className="mt-2 text-sm text-white/80">Registra pagos semanales por ventas con contrato y confirma cuándo se abonan.</p></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
      <Card><CardHeader><CardTitle>Registrar venta y pago semanal</CardTitle></CardHeader><CardContent><form onSubmit={event => void create(event)} className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="sale-seller">Vendedor</Label><Input id="sale-seller" value={seller} onChange={event => setSeller(event.target.value)} required /></div>
        <div><Label htmlFor="sale-week">Inicio de semana</Label><Input id="sale-week" type="date" value={weekStart} onChange={event => setWeekStart(event.target.value)} required /></div>
        <div><Label htmlFor="sale-contract">Número o referencia de contrato</Label><Input id="sale-contract" value={contractReference} onChange={event => setContractReference(event.target.value)} required /></div>
        <div><Label htmlFor="sale-buyer">Comprador</Label><Input id="sale-buyer" value={buyer} onChange={event => setBuyer(event.target.value)} required /></div>
        <div><Label htmlFor="sale-lot">Lote</Label><Input id="sale-lot" value={lot} onChange={event => setLot(event.target.value)} required /></div>
        <div><Label htmlFor="sale-amount">Pago semanal S/</Label><Input id="sale-amount" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></div>
        <Button type="submit" disabled={busy || preview} className="bg-[#2f4817] hover:bg-[#17250c] sm:col-span-2">Registrar pago pendiente</Button>
      </form></CardContent></Card>
      <Card><CardHeader><CardTitle>Pagos semanales</CardTitle><p className="text-sm text-[#667060]">Pendiente: {money(pending)} · {items.length} ventas con contrato</p></CardHeader><CardContent className="space-y-3">{items.length === 0 && <p className="text-sm text-[#667060]">Aún no hay ventas registradas.</p>}{items.map(item => <div key={item.id} className="rounded-xl border border-[#dfe4d6] p-4"><div className="flex flex-wrap justify-between gap-3"><div><strong>{item.seller}</strong><p className="text-sm text-[#667060]">Semana del {item.weekStart} · Contrato {item.contractReference}</p><p className="text-sm text-[#667060]">{item.buyer} · Lote {item.lot}</p></div><div className="text-right"><strong>{money(item.amount)}</strong><p className={item.paid ? 'text-sm text-emerald-700' : 'text-sm text-amber-700'}>{item.paid ? 'Pagado' : 'Pendiente'}</p></div></div><Button size="sm" variant="outline" disabled={busy} className="mt-3" onClick={() => void setPaid(item)}>{item.paid ? 'Marcar pendiente' : 'Confirmar pago'}</Button></div>)}</CardContent></Card>
    </div>
  </div>;
}

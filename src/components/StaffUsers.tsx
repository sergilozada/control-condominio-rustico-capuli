import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { roleLabel, type UserRole } from '@/config/permissions';
import { db } from '@/services/firebase';
import { createStaffUser, updateStaffUser, type StaffProfile } from '@/services/staffUsers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const roles = Object.keys(roleLabel) as UserRole[];
interface StaffEvent { id: string; action: string; targetUid: string; actorEmail: string; createdAt?: Timestamp }

function errorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/email-already-in-use') return 'Ese usuario ya existe en Firebase.';
    if (error.code === 'permission-denied') return 'Firebase rechazó el cambio. Revisa el rol de administración.';
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export default function StaffUsers() {
  const { user, preview } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<UserRole>('consulta');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (preview || user?.role !== 'admin') return;
    const offUsers = onSnapshot(collection(db, 'users'), snapshot => setStaff(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as StaffProfile))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))), () => setNotice('No se pudo cargar la lista de usuarios.'));
    const offEvents = onSnapshot(query(collection(db, 'userEvents'), orderBy('createdAt', 'desc'), limit(20)), snapshot =>
      setEvents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as StaffEvent))), () => setNotice('No se pudo cargar el historial de usuarios.'));
    return () => { offUsers(); offEvents(); };
  }, [preview, user?.role]);

  if (user?.role !== 'admin') return null;

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (preview) return;
    if (role === 'admin' && !window.confirm('Este rol tendrá control completo. ¿Crear otro administrador?')) return;
    setBusy(true); setNotice('');
    try {
      await createStaffUser({ name, username, jobTitle, role, password }, user.id, user.email);
      setName(''); setUsername(''); setJobTitle(''); setRole('consulta'); setPassword('');
      setNotice('Usuario creado. Entrégale su correo y contraseña inicial de forma privada.');
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const change = async (profile: StaffProfile, changes: { role?: UserRole; active?: boolean; deleted?: boolean }, action: string) => {
    setBusy(true); setNotice('');
    try { await updateStaffUser(profile.id, changes, action, user.id, user.email); setNotice('Acceso actualizado.'); }
    catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="rounded-3xl bg-[#17250c] p-7 text-white"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#eadca4]"><ShieldCheck className="h-4 w-4" /> Solo administración</p><h1 className="brand-display mt-2 text-3xl">Usuarios</h1><p className="mt-2 text-sm text-white/80">Crea accesos individuales y administra los permisos de cada persona.</p></div>
    {notice && <p role="status" className="rounded-xl border border-[#dfe4d6] bg-[#f4f7ef] p-3 text-sm">{notice}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.5fr)]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Crear usuario</CardTitle></CardHeader><CardContent><form onSubmit={event => void create(event)} className="space-y-4">
        <div><Label htmlFor="staff-name">Nombre completo</Label><Input id="staff-name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} /></div>
        <div><Label htmlFor="staff-job">Cargo o área</Label><Input id="staff-job" value={jobTitle} onChange={event => setJobTitle(event.target.value)} maxLength={100} /></div>
        <div><Label htmlFor="staff-username">Usuario</Label><div className="flex min-w-0 items-center rounded-lg border"><input id="staff-username" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} required autoComplete="off" className="h-10 min-w-0 flex-1 px-3 outline-none" placeholder="nombre.apellido" /><span className="pr-3 text-xs text-[#667060]">@condominiorusticocapuli.com</span></div></div>
        <div><Label htmlFor="staff-role">Rol</Label><select id="staff-role" value={role} onChange={event => setRole(event.target.value as UserRole)} className="h-10 w-full rounded-lg border bg-white px-3">{roles.map(item => <option key={item} value={item}>{roleLabel[item]}</option>)}</select></div>
        <div><Label htmlFor="staff-password">Contraseña inicial</Label><Input id="staff-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={10} autoComplete="new-password" /><p className="mt-1 text-xs text-[#667060]">Mínimo 10 caracteres. No se guarda en Firestore.</p></div>
        <Button type="submit" disabled={busy || preview} className="w-full bg-[#2f4817] hover:bg-[#17250c]">{busy ? 'Creando…' : 'Crear usuario'}</Button>
      </form></CardContent></Card>
      <Card><CardHeader><CardTitle>Equipo y accesos</CardTitle></CardHeader><CardContent className="space-y-3">
        {preview && <p className="text-sm text-[#667060]">La lista real aparece al ingresar con la cuenta administradora.</p>}
        {staff.map(profile => <div key={profile.id} className="rounded-xl border border-[#dfe4d6] bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2"><div><strong>{profile.name}</strong><p className="break-all text-sm text-[#667060]">{profile.email}</p><p className="text-xs text-[#667060]">{profile.jobTitle || 'Sin cargo'} · {profile.deleted ? 'Eliminado' : profile.active ? 'Activo' : 'Suspendido'}</p></div><span className="text-sm text-[#2f4817]">{roleLabel[profile.role] || profile.role}</span></div>
          {profile.id !== user.id && !profile.deleted && <div className="mt-3 flex flex-wrap gap-2"><select aria-label={`Rol de ${profile.name}`} value={profile.role} disabled={busy} onChange={event => void change(profile, { role: event.target.value as UserRole }, 'rol')} className="h-9 rounded-lg border bg-white px-2 text-sm">{roles.map(item => <option key={item} value={item}>{roleLabel[item]}</option>)}</select><Button size="sm" variant="outline" disabled={busy} onClick={() => void change(profile, { active: !profile.active }, profile.active ? 'suspender' : 'reactivar')}>{profile.active ? 'Suspender' : 'Reactivar'}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm(`¿Revocar el acceso de ${profile.name}?`)) void change(profile, { active: false, deleted: true }, 'eliminar'); }}>Revocar acceso</Button></div>}
        </div>)}
      </CardContent></Card>
    </div>
    {events.length > 0 && <Card><CardHeader><CardTitle>Actividad de usuarios</CardTitle></CardHeader><CardContent className="space-y-2">{events.map(event => <p key={event.id} className="rounded-lg border p-3 text-sm"><strong>{event.actorEmail}</strong> · {event.action} · {staff.find(profile => profile.id === event.targetUid)?.name || event.targetUid} <span className="text-[#667060]">{event.createdAt?.toDate().toLocaleString('es-PE') || 'Pendiente'}</span></p>)}</CardContent></Card>}
  </div>;
}

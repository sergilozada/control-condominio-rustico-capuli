import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  onSnapshot,
  orderBy,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db, storage } from '@/services/firebase';
import { ref as storageRef, listAll, deleteObject } from 'firebase/storage';
import type { ObservationEntry, Titular } from '@/types/client';
import { clientMatchesTitular } from '@/types/client';
import { createClientWithAudit, updateClientWithAudit, deleteClientWithAudit } from '@/services/audit';
import { updateQuotaWithAudit } from '@/services/audit';
import { canManageClients, canManageReceipts, canRegisterPayments, type UserRole } from '@/config/permissions';

interface User {
  id: string;
  username: string;
  role: UserRole;
  email: string;
}

export interface DemoAuditEntry {
  id: string;
  actorEmail: string;
  clientId: string;
  action: string;
  fields: string[];
  summary: string;
  createdAt: Date;
}

const demoAccounts: Record<UserRole, { username: string; email: string }> = {
  admin: { username: 'Administrador de muestra', email: 'admin@capuli.example' },
  pagos: { username: 'Pagos de muestra', email: 'pagos@capuli.example' },
  boletas: { username: 'Boletas de muestra', email: 'boletas@capuli.example' },
  legal: { username: 'Legal de muestra', email: 'legal@capuli.example' },
};

interface Client {
  id: string;
  titulares?: Titular[];
  nombre1: string;
  nombre2?: string;
  dni1: string;
  dni2?: string;
  celular1?: string;
  celular2?: string;
  email1?: string;
  email2?: string;
  observaciones?: string;
  observationEntries?: ObservationEntry[];
  manzana: string;
  lote: string;
  metraje: number;
  montoTotal: number;
  formaPago: 'contado' | 'cuotas';
  inicial?: number;
  numeroCuotas?: number;
  fechaRegistro: string;
  cuotas?: Cuota[];
  userId: string; // Para asociar con el usuario
}

interface Cuota {
  numero: number;
  vencimiento: string;
  monto: number;
  mora?: number;
  total?: number;
  manualMora?: boolean;
  fechaPago?: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  voucher?: string | string[] | { url: string; name?: string; path?: string } | Array<{ url: string; name?: string; path?: string }>;
  boleta?: string | string[] | { url: string; name?: string; path?: string } | Array<{ url: string; name?: string; path?: string }>;
}

interface AuthContextType {
  preview?: boolean;
  demoAuditEntries?: DemoAuditEntry[];
  setPreviewRole?: (role: UserRole) => void;
  user: User | null;
  firebaseUser: FirebaseUser | null;
  clients: Client[];
  selectedClientId: string | null;
  loading: boolean;
  setSelectedClientId: (id: string | null) => void;
  formatLocalISO: (date?: Date | string) => string;
  parseLocalDate: (iso: string) => Date;
  login: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'fechaRegistro' | 'cuotas' | 'userId'>) => Promise<boolean>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  generateCuotas: (clientId: string) => Promise<void>;
  updateCuota: (clientId: string, cuotaIndex: number, cuota: Partial<Cuota>) => Promise<void>;
  calculateMora: (vencimiento: string, monto: number) => number;
  searchClients: (manzana: string, lote: string, dniNombre?: string) => Client[];
  markCuotaAsPaid: (clientId: string, cuotaIndex: number, fechaPago: string) => Promise<void>;
  updateCuotaAmount: (clientId: string, newAmount: number) => Promise<void>;
  updateCuotaDates: (clientId: string, cuotaIndex: number, newDate: string) => Promise<void>;
  appendObservation: (clientId: string, text: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.trace('FirebaseAuthContext: useAuth called without provider');
    throw new Error('useAuth (Firebase) must be used within a Firebase AuthProvider');
  }
  return context;
};

export const useOptionalAuth = () => useContext(AuthContext);

// Vista local aislada: datos ficticios y ninguna conexión a Firestore.
export const DemoAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [previewRole, setPreviewRole] = useState<UserRole>('admin');
  const [demoOverrides, setDemoOverrides] = useState<Record<string, Client>>({});
  const [demoAuditEntries, setDemoAuditEntries] = useState<DemoAuditEntry[]>([]);
  const [observations, setObservations] = useState<Record<string, ObservationEntry[]>>({});
  const today = new Date();
  const iso = (offsetMonths: number) => {
    const date = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 10);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), '10'].join('-');
  };
  const demoClients: Client[] = [
    { id: 'demo-1', userId: 'demo', nombre1: 'Alicia Torres', dni1: '00000001', manzana: 'A', lote: '12', metraje: 120, montoTotal: 48000, formaPago: 'cuotas', inicial: 12000, numeroCuotas: 3, fechaRegistro: iso(-6), cuotas: [-5, -4, -3].map((month, index) => ({ numero: index + 1, vencimiento: iso(month), monto: 12000, estado: 'pagado' as const, fechaPago: iso(month) })) },
    { id: 'demo-2', userId: 'demo', nombre1: 'Carlos Vega', dni1: '00000002', manzana: 'B', lote: '07', metraje: 150, montoTotal: 60000, formaPago: 'cuotas', inicial: 15000, numeroCuotas: 5, fechaRegistro: iso(-5), cuotas: [-3, -2, -1, 0, 1].map((month, index) => ({ numero: index + 1, vencimiento: iso(month), monto: 9000, estado: 'pendiente' as const })) },
    { id: 'demo-3', userId: 'demo', nombre1: 'Elena Ruiz', dni1: '00000003', manzana: 'C', lote: '04', metraje: 110, montoTotal: 44000, formaPago: 'cuotas', inicial: 11000, numeroCuotas: 3, fechaRegistro: iso(-1), cuotas: [0, 1, 2].map((month, index) => ({ numero: index + 1, vencimiento: iso(month), monto: 11000, estado: 'pendiente' as const })) },
  ];
  const clients = demoClients.map(client => ({ ...client, ...demoOverrides[client.id], observationEntries: observations[client.id] || [] }));
  const previewOnly = async (): Promise<never> => { throw new Error('La vista previa no guarda cambios.'); };
  const recordDemoChange = (clientId: string, action: string, fields: string[], summary: string) => {
    setDemoAuditEntries(current => [{
      id: crypto.randomUUID(), actorEmail: demoAccounts[previewRole].email,
      clientId, action, fields, summary, createdAt: new Date(),
    }, ...current]);
  };
  const formatLocalISO = (date?: Date | string) => {
    const value = date ? new Date(date) : new Date();
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  };
  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  return <AuthContext.Provider value={{
    preview: true, demoAuditEntries, setPreviewRole,
    user: { id: `demo-${previewRole}`, ...demoAccounts[previewRole], role: previewRole },
    firebaseUser: null, clients, selectedClientId, loading: false, setSelectedClientId,
    formatLocalISO, parseLocalDate,
    login: async () => false, resetPassword: previewOnly,
    logout: async () => { window.location.assign(window.location.pathname); },
    addClient: previewOnly, updateClient: previewOnly, deleteClient: previewOnly,
    generateCuotas: previewOnly, updateCuota: previewOnly,
    calculateMora: (dueDate: string) => Math.max(0, Math.floor((Date.now() - parseLocalDate(dueDate).getTime()) / 86400000) - 7) * 2,
    searchClients: (manzana, lote, dniNombre) => clients.filter(client =>
      (!manzana || client.manzana.toLowerCase().includes(manzana.toLowerCase())) &&
      (!lote || client.lote.toLowerCase().includes(lote.toLowerCase())) &&
      (!dniNombre || clientMatchesTitular(client, dniNombre))),
    markCuotaAsPaid: async (clientId, cuotaIndex, fechaPago) => {
      if (!canRegisterPayments(previewRole)) throw new Error('Este usuario no registra pagos.');
      const client = clients.find(item => item.id === clientId);
      if (!client?.cuotas?.[cuotaIndex] || client.cuotas[cuotaIndex].estado === 'pagado') throw new Error('Cuota no disponible.');
      setDemoOverrides(current => ({
        ...current,
        [clientId]: {
          ...client,
          cuotas: client.cuotas!.map((cuota, index) => index === cuotaIndex
            ? { ...cuota, estado: 'pagado' as const, fechaPago } : cuota),
        },
      }));
      recordDemoChange(clientId, 'pago_registrar', ['cuotas'], `Cuota ${client.cuotas[cuotaIndex].numero} marcada pagada (muestra)`);
    }, updateCuotaAmount: previewOnly,
    updateCuotaDates: previewOnly,
    appendObservation: async (clientId, value) => {
      if (!canManageClients(previewRole)) throw new Error('Solo el administrador agrega observaciones.');
      setObservations(current => ({
        ...current,
        [clientId]: [...(current[clientId] || []), { id: crypto.randomUUID(), text: value.trim(), author: demoAccounts[previewRole].email, at: new Date().toISOString() }],
      }));
      recordDemoChange(clientId, 'actualizar', ['observationEntries'], 'Nueva anotación en el libro de observaciones (muestra)');
    },
  }}>{children}</AuthContext.Provider>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // a small key to force re-subscribing to Firestore listeners on error
  const [listenerKey, setListenerKey] = useState(0);

  // Escuchar cambios de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const profile = await getDoc(doc(db, 'users', firebaseUser.uid));
          const data = profile.data();
          if (profile.exists() && data?.active === true &&
              ['admin', 'pagos', 'boletas', 'legal'].includes(data.role)) {
            setUser({
              id: firebaseUser.uid,
              username: data.name || firebaseUser.email || 'Usuario',
              email: firebaseUser.email || '',
              role: data.role,
            });
          } else setUser(null);
        } catch (error) {
          console.error('No se pudo cargar el perfil:', error);
          setUser(null);
        }
      } else {
        setUser(null);
        setClients([]);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Escuchar cambios en los clientes cuando el usuario está autenticado
  useEffect(() => {
    if (!firebaseUser || !user) {
      setClients([]);
      return;
    }

    const clientsQuery = query(collection(db, 'clients'), orderBy('fechaRegistro', 'desc'));

    // Subscribe with an error callback so we can handle transient network/protocol errors
    const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
      const clientsData: Client[] = [];
      snapshot.forEach((doc) => {
        clientsData.push({
          id: doc.id,
          ...doc.data()
        } as Client);
      });
      setClients(clientsData);

      // Ensure cuotas are generated for any client that doesn't have them yet (race condition fix)
      clientsData.forEach(c => {
        if (c.userId === firebaseUser.uid && (!c.cuotas || c.cuotas.length === 0)) {
          // fire-and-forget; generateCuotas will fetch the client if necessary
          generateCuotas(c.id).catch(err => console.error('generateCuotas error on snapshot:', err));
        }
      });
    }, (error) => {
      // Common: net::ERR_QUIC_PROTOCOL_ERROR originates from the browser/network layer when
      // attempting HTTP/3/QUIC connections to Firestore's listen channel. It's usually transient
      // or caused by a proxy/VPN/antivirus. Log and attempt to re-subscribe after a short backoff.
      console.error('onSnapshot error (will retry):', error);
      // schedule a re-subscribe by bumping listenerKey after a short delay
      setTimeout(() => setListenerKey(k => k + 1), 1500);
    });

    return () => unsubscribe();
  }, [firebaseUser, user, listenerKey]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error('Error de login:', error);
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    auth.languageCode = 'es';
    await sendPasswordResetEmail(auth, email.trim());
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error de logout:', error);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id' | 'fechaRegistro' | 'cuotas' | 'userId'>): Promise<boolean> => {
    if (!firebaseUser || !canManageClients(user?.role)) return false;

    try {
      // Verificar si ya existe un cliente con la misma manzana y lote
      // Firestore equality queries are exact; to avoid issues with case/whitespace
      // and eventual consistency, compare against the shared company portfolio.
      const snapshot = await getDocs(query(collection(db, 'clients')));
      const normalizedNewManzana = (clientData.manzana || '').toString().trim().toLowerCase();
      const normalizedNewLote = (clientData.lote || '').toString().trim().toLowerCase();

      for (const d of snapshot.docs) {
        const data = d.data() as any;
        const man = (data.manzana || '').toString().trim().toLowerCase();
        const lot = (data.lote || '').toString().trim().toLowerCase();
        if (man === normalizedNewManzana && lot === normalizedNewLote) {
          return false; // Ya existe
        }
      }

      // Build new client object but remove any undefined fields (Firestore rejects undefined)
      const rawClient: Record<string, any> = {
        ...clientData,
        userId: firebaseUser.uid,
        fechaRegistro: new Date().toISOString().split('T')[0],
        cuotas: []
      };

      const newClient: Record<string, any> = {};
      Object.keys(rawClient).forEach((k) => {
        const v = (rawClient as any)[k];
        if (v !== undefined) newClient[k] = v;
      });

      const clientId = await createClientWithAudit(firebaseUser, newClient);
      
      // Generar cuotas
      setTimeout(() => generateCuotas(clientId), 100);
      
      return true;
    } catch (error) {
      console.error('Error al agregar cliente:', error);
      return false;
    }
  };

  const updateClient = async (id: string, clientData: Partial<Client>): Promise<void> => {
    try {
      const safeClientData = { ...clientData };

      if (!firebaseUser || !canManageClients(user?.role)) throw new Error('No tienes permiso para editar clientes.');
      await updateClientWithAudit(firebaseUser, id, safeClientData);
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
      throw error;
    }
  };

  const deleteClient = async (id: string): Promise<void> => {
    if (!firebaseUser || !canManageClients(user?.role)) throw new Error('Solo el administrador puede eliminar.');
    try {
      // Borrar adjuntos en todos los niveles (cuotas/índice/tipo/archivo y minutas).
      try {
        const removeTree = async (folder: ReturnType<typeof storageRef>): Promise<void> => {
          const result = await listAll(folder);
          await Promise.all(result.items.map(item => deleteObject(item)));
          await Promise.all(result.prefixes.map(removeTree));
        };
        await removeTree(storageRef(storage, `clients/${id}`));
      } catch (err) {
        console.warn('Error cleaning up storage for client', id, err);
      }

      await deleteClientWithAudit(firebaseUser, id);
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      throw error;
    }
  };

  const getLastDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const parseLocalDate = (iso: string) => {
    if (!iso) return new Date();
    const parts = iso.toString().split('-');
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2].slice(0,2), 10);
      return new Date(y, m, d);
    }
    return new Date(iso);
  };

  const formatLocalISO = (date?: Date | string) => {
    let d: Date;
    if (!date) d = new Date();
    else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) d = parseLocalDate(date);
    else d = new Date(date as any);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const generateCuotas = async (clientId: string): Promise<void> => {
    if (!canManageClients(user?.role)) throw new Error('Solo el administrador puede generar cuotas.');
    let client = clients.find(c => c.id === clientId) as Client | undefined;

    // If client is not yet in local state (race with onSnapshot), fetch it directly from Firestore
    if (!client) {
      try {
        const clientDoc = await getDoc(doc(db, 'clients', clientId));
        if (clientDoc.exists()) {
          client = { id: clientDoc.id, ...(clientDoc.data() as any) } as Client;
        }
      } catch (err) {
        console.error('Error fetching client for generateCuotas:', err);
      }
    }

    if (!client) return;

    try {
      const cuotas: Cuota[] = [];
      const fechaRegistro = new Date(client.fechaRegistro);
      
      // Agregar cuota inicial (número 0)
      if (client.inicial && client.inicial > 0) {
        // Do not set `mora` here so that automatic calculation applies unless user overrides it later
        cuotas.push({
          numero: 0,
          vencimiento: client.fechaRegistro,
          monto: client.inicial,
          total: client.inicial,
          estado: 'pendiente'
        } as any);
      }

      // Generar cuotas mensuales
      if (client.numeroCuotas && client.numeroCuotas > 0) {
        const montoFinanciar = client.montoTotal - (client.inicial || 0);
        const montoCuota = Math.floor((montoFinanciar / client.numeroCuotas) * 100) / 100;
        
        for (let i = 0; i < client.numeroCuotas; i++) {
          const fechaVencimiento = new Date(fechaRegistro.getFullYear(), fechaRegistro.getMonth() + i + 1, 1);
          const ultimoDia = getLastDayOfMonth(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth());
          fechaVencimiento.setDate(ultimoDia);
          
          const esUltimaCuota = i === client.numeroCuotas - 1;
          const monto = esUltimaCuota ? 
            montoFinanciar - (montoCuota * (client.numeroCuotas - 1)) : 
            montoCuota;
          
          // Do not set `mora` on generated cuotas so the UI will calculate mora dynamically
          cuotas.push({
            numero: i + 1,
            vencimiento: formatLocalISO(fechaVencimiento),
            monto: monto,
            total: monto,
            estado: 'pendiente'
          } as any);
        }
      }
      
      await updateClient(clientId, { cuotas });
    } catch (error) {
      console.error('Error al generar cuotas:', error);
    }
  };

  const updateCuota = async (clientId: string, cuotaIndex: number, cuotaData: Partial<Cuota>): Promise<void> => {
    const client = clients.find(c => c.id === clientId);
    if (!client?.cuotas?.[cuotaIndex] || !firebaseUser) throw new Error('Cuota no encontrada.');

    const updatedCuotas = client.cuotas.map((cuota, index) => index === cuotaIndex ? { ...cuota, ...cuotaData } : cuota);
    const keys = Object.keys(cuotaData);
    if (keys.length === 1 && keys[0] === 'voucher' && canRegisterPayments(user?.role)) {
      await updateQuotaWithAudit(firebaseUser, clientId, updatedCuotas, cuotaIndex, 'voucher_actualizar');
    } else if (keys.length === 1 && keys[0] === 'boleta' && canManageReceipts(user?.role)) {
      await updateQuotaWithAudit(firebaseUser, clientId, updatedCuotas, cuotaIndex, 'boleta_actualizar');
    } else if (canManageClients(user?.role)) {
      await updateClientWithAudit(firebaseUser, clientId, { cuotas: updatedCuotas });
    } else throw new Error('No tienes permiso para esta operación de cuotas.');
  };

  const markCuotaAsPaid = async (clientId: string, cuotaIndex: number, fechaPago: string): Promise<void> => {
    if (!canRegisterPayments(user?.role) || !firebaseUser) throw new Error('No tienes permiso para registrar pagos.');
    const client = clients.find(c => c.id === clientId);
    if (!client?.cuotas?.[cuotaIndex]) throw new Error('Cuota no encontrada.');

    try {
      const updatedCuotas = [...client.cuotas];
      const cuota = updatedCuotas[cuotaIndex];
      
    let mora = 0;
    if (cuota.numero === 0) mora = 0;
    // If mora was manually set (manualMora === true) prefer that value (even 0); otherwise calculate it
    else if (typeof cuota.mora === 'number' && (cuota as any).manualMora === true) mora = cuota.mora;
    else mora = calculateMora(cuota.vencimiento, cuota.monto);

      const fechaPagoISO = formatLocalISO(fechaPago);

      updatedCuotas[cuotaIndex] = {
        ...cuota,
        fechaPago: fechaPagoISO,
        estado: 'pagado',
        ...(user?.role === 'admin' ? { mora, total: cuota.monto + mora } : {}),
      };
      
      if (user?.role === 'admin') await updateClientWithAudit(firebaseUser, clientId, { cuotas: updatedCuotas });
      else await updateQuotaWithAudit(firebaseUser, clientId, updatedCuotas, cuotaIndex, 'pago_registrar');
    } catch (error) {
      console.error('Error al marcar cuota como pagada:', error);
      throw error;
    }
  };

  const updateCuotaAmount = async (clientId: string, newAmount: number): Promise<void> => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.cuotas) return;

    try {
      const cuotas = [...client.cuotas];
      const numeroCuotas = cuotas.filter(c => c.numero > 0).length;
      
      // Actualizar todas las cuotas excepto la última y la inicial
      for (let i = 0; i < cuotas.length; i++) {
        if (cuotas[i].numero > 0 && cuotas[i].numero < numeroCuotas) {
          cuotas[i].monto = newAmount;
          cuotas[i].total = newAmount + cuotas[i].mora;
        }
      }
      
      // Calcular monto de la última cuota
      if (numeroCuotas > 0) {
        const montoFinanciar = client.montoTotal - (client.inicial || 0);
        const montoUltimasCuotas = newAmount * (numeroCuotas - 1);
        const montoUltimaCuota = montoFinanciar - montoUltimasCuotas;
        
        const ultimaCuotaIndex = cuotas.findIndex(c => c.numero === numeroCuotas);
        if (ultimaCuotaIndex !== -1) {
          cuotas[ultimaCuotaIndex].monto = montoUltimaCuota;
          cuotas[ultimaCuotaIndex].total = montoUltimaCuota + cuotas[ultimaCuotaIndex].mora;
        }
      }
      
      await updateClient(clientId, { cuotas });
    } catch (error) {
      console.error('Error al actualizar montos de cuotas:', error);
    }
  };

  const updateCuotaDates = async (clientId: string, cuotaIndex: number, newDate: string): Promise<void> => {
    await updateCuota(clientId, cuotaIndex, { vencimiento: newDate });
  };

  const appendObservation = async (clientId: string, value: string): Promise<void> => {
    const text = value.trim();
    if (!text || text.length > 2000) throw new Error('La observación debe tener entre 1 y 2000 caracteres.');
    if (!firebaseUser || !canManageClients(user?.role)) throw new Error('No tienes permiso para agregar observaciones.');
    const entry: ObservationEntry = {
      id: crypto.randomUUID(), text, author: firebaseUser.email || user.username,
      at: new Date().toISOString(),
    };
    await updateClientWithAudit(firebaseUser, clientId, { observationEntries: arrayUnion(entry) }, 'Nueva anotación en el libro de observaciones');
  };

  const calculateMora = (vencimiento: string, monto: number): number => {
    const fechaVencimiento = parseLocalDate(vencimiento);
    const hoy = new Date();
    const diffTime = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - new Date(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth(), fechaVencimiento.getDate()).getTime();
    const diasVencidos = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Contratos de muestra: S/ 2 diarios desde el octavo día de atraso.
    return diasVencidos >= 8 ? (diasVencidos - 7) * 2 : 0;
  };

  const searchClients = (manzana: string, lote: string, dniNombre?: string): Client[] => {
    return clients.filter(client => {
      const matchManzana = !manzana || client.manzana.toLowerCase().includes(manzana.toLowerCase());
      const matchLote = !lote || client.lote.toLowerCase().includes(lote.toLowerCase());
      const matchDniNombre = !dniNombre || clientMatchesTitular(client, dniNombre);
      
      return matchManzana && matchLote && matchDniNombre;
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      clients,
      selectedClientId,
      loading,
      setSelectedClientId,
      formatLocalISO,
      parseLocalDate,
      login,
      resetPassword,
      logout,
      addClient,
      updateClient,
      deleteClient,
      generateCuotas,
      updateCuota,
      calculateMora,
      searchClients,
      markCuotaAsPaid,
      updateCuotaAmount,
      updateCuotaDates,
      appendObservation,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Clock,
  FileSignature,
  FileText,
  Home,
  History,
  LogOut,
  Plus,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import FirebaseClientForm from '@/components/FirebaseClientForm';
import ClientList from '@/components/ClientList';
import ProjectionView from '@/components/ProjectionView';
import StatsView from '@/components/StatsView';
import MinutaUploadButton from '@/components/MinutaUploadButton';
import { MinutasWorkspace } from '@/features/minutas';
import AuditLog from '@/components/AuditLog';
import type { Titular } from '@/types/client';
import { getClientDisplayDnis, getClientDisplayName } from '@/types/client';
import { canManageClients, canManageMinutes, canRegisterPayments, canViewAnalytics, roleLabel, type UserRole } from '@/config/permissions';

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
  manzana: string;
  lote: string;
  metraje: number;
  montoTotal: number;
  formaPago: 'contado' | 'cuotas';
  inicial?: number;
  numeroCuotas?: number;
  fechaRegistro: string;
  cuotas?: Cuota[];
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

const menuItems = [
  { id: 'inicio', label: 'Vista general', description: '', icon: Home },
  { id: 'clientes', label: 'Clientes', description: 'Cartera y propiedades', icon: Users },
  { id: 'proyeccion', label: 'Proyección', description: 'Ingresos previstos', icon: TrendingUp },
  { id: 'estadisticas', label: 'Estadísticas', description: 'Indicadores clave', icon: BarChart3 },
  { id: 'reporte', label: 'Reportes', description: 'Documentos y datos', icon: FileText },
  { id: 'pendientes', label: 'Pendientes', description: 'Cuotas del mes', icon: Clock },
  { id: 'atrasados', label: 'Atrasados', description: 'Pagos vencidos', icon: AlertTriangle },
  { id: 'minutas', label: 'Minutas', description: 'Contratos y cronogramas', icon: FileSignature },
  { id: 'auditoria', label: 'Historial', description: 'Cambios de usuarios', icon: History },
];

export default function FirebaseDashboard({ demo = false }: { demo?: boolean }) {
  const { logout, user, clients, searchClients, setSelectedClientId, setPreviewRole } = useAuth();
  const [activeTab, setActiveTab] = useState('inicio');
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [showNewClient, setShowNewClient] = useState(false);
  const [minuteClientId, setMinuteClientId] = useState<string | null>(null);
  const [searchManzana, setSearchManzana] = useState('');
  const [searchLote, setSearchLote] = useState('');
  const [searchDniNombre, setSearchDniNombre] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const activeMenuItem = menuItems.find(item => item.id === activeTab) || menuItems[0];

  const handleSearch = () => {
    if (!searchManzana && !searchLote && !searchDniNombre) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchResults(searchClients(searchManzana, searchLote, searchDniNombre));
    setShowSearchResults(true);
  };

  const clearSearch = () => {
    setSearchManzana('');
    setSearchLote('');
    setSearchDniNombre('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const pendingPayments = clients.filter(client => {
    const today = new Date();
    return client.cuotas?.some(cuota => {
      const dueDate = new Date(cuota.vencimiento);
      return dueDate.getMonth() === today.getMonth()
        && dueDate.getFullYear() === today.getFullYear()
        && cuota.estado === 'pendiente'
        && cuota.numero > 0;
    });
  });

  const overduePayments = clients.filter(client => {
    const today = new Date();
    return client.cuotas?.some(cuota => (
      new Date(cuota.vencimiento) < today
      && cuota.estado === 'pendiente'
      && cuota.numero > 0
    ));
  });

  const getClientStatus = (client: Client) => {
    if (!client.cuotas || client.cuotas.length === 0) return 'Sin cuotas';
    const paid = client.cuotas.filter(cuota => cuota.estado === 'pagado' && cuota.numero > 0).length;
    const total = client.cuotas.filter(cuota => cuota.numero > 0).length;
    const pending = total - paid;
    return pending === 0 ? 'Completado' : `${pending} pendientes`;
  };

  const openClient = (clientId: string) => {
    setActiveTab('clientes');
    setSelectedClientId(clientId);
  };

  const createMinuteForClient = (clientId: string) => {
    if (!canManageMinutes(user?.role)) return;
    setMinuteClientId(clientId);
    setActiveTab('minutas');
  };

  const statCards = [
    {
      label: 'Clientes activos',
      value: clients.length,
      helper: 'Cartera total registrada',
      icon: Users,
      iconClass: 'bg-[#f2ebf7] text-[#54317f]',
      action: () => setActiveTab('clientes'),
    },
    {
      label: 'Pendientes este mes',
      value: pendingPayments.length,
      helper: 'Requieren seguimiento',
      icon: Clock,
      iconClass: 'bg-[#fff7e3] text-[#8a6215]',
      action: () => setActiveTab('pendientes'),
    },
    {
      label: 'Pagos atrasados',
      value: overduePayments.length,
      helper: 'Fuera de fecha',
      icon: AlertTriangle,
      iconClass: 'bg-rose-50 text-rose-700',
      action: () => setActiveTab('atrasados'),
    },
  ];

  return (
    <div className="vh-dashboard-shell capuli-design min-h-screen bg-[#f2f1ec] text-[#182033]">
      {demo && <div className="capuli-demo-banner flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[#fff4c7] px-4 py-2 text-center text-sm font-medium text-[#69430d]">
        <span>Vista previa local · datos ficticios · los cambios no se guardan</span>
        <label className="flex items-center gap-2">Usuario de muestra
          <select aria-label="Usuario de muestra" value={user?.role || 'admin'} onChange={event => { setPreviewRole?.(event.target.value as UserRole); setActiveTab('inicio'); }} className="rounded-xl border border-[#d2b97e] bg-white px-2 py-1 text-[#33204f]">
            {(Object.keys(roleLabel) as UserRole[]).map(role => <option key={role} value={role}>{roleLabel[role]}</option>)}
          </select>
        </label>
      </div>}
      <header className="vh-header-enter sticky top-0 z-40 border-b border-[#d9ddd9]/90 bg-[#fffefb]/95 backdrop-blur-xl">
        <div className="flex h-16 w-full items-center justify-between gap-2 px-2.5 sm:gap-4 sm:px-5 lg:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('inicio')}
            aria-label="Ir a Vista general"
            aria-current={activeTab === 'inicio' ? 'page' : undefined}
            title="Ir a Vista general"
            className="group flex min-h-12 min-w-0 items-center gap-2 rounded-xl px-1.5 text-left transition-[background-color,transform] duration-200 hover:bg-[#f2ebf7]/70 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c3585] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none sm:gap-3 sm:px-2"
          >
            <img
              src="/brand/capuli-logo.png"
              alt="Condominio Rústico Capulí"
              className="h-11 w-32 shrink-0 rounded-lg border border-[#d9ddd9] bg-white object-contain object-center p-0.5 shadow-sm transition-transform duration-200 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none sm:h-12 sm:w-40"
            />
            <div className="min-w-0">
              <p className="hidden truncate text-sm font-semibold tracking-tight text-[#33204f] sm:block sm:text-base">
                Condominio Rústico Capulí
              </p>
            </div>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#c7ddd9] bg-[#f7f2fb] px-2.5 text-xs font-semibold text-[#33204f] sm:px-3 sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-[#54317f]" aria-hidden="true" />
              {user?.role ? roleLabel[user.role] : 'Usuario'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              aria-label="Cerrar sesión"
              className="min-h-9 border-[#d9ddd9] bg-white px-2.5 text-[#33204f] transition-[border-color,background-color,color,transform,box-shadow] duration-200 hover:border-[#54317f] hover:bg-[#f7f2fb] hover:text-[#54317f] hover:shadow-sm active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none sm:px-3"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={`w-full transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none lg:grid lg:gap-4 lg:pr-5 ${
          navigationOpen
            ? 'lg:grid-cols-[220px_minmax(0,1fr)]'
            : 'lg:grid-cols-[60px_minmax(0,1fr)]'
        }`}
      >
        <aside className={`vh-sidebar-enter border-b border-[#d9ddd9] bg-[#fffefb] py-3 transition-[padding] duration-300 motion-reduce:transition-none lg:sticky lg:top-16 lg:z-30 lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col lg:border-b-0 lg:border-r lg:py-4 ${navigationOpen ? 'px-3 lg:px-3' : 'px-2 lg:px-2'}`}>
          <button
            type="button"
            className={`vh-menu-button flex min-h-12 items-center rounded-xl border border-[#d9ddd9] bg-white py-2.5 text-left shadow-sm transition-[width,border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none hover:border-[#b9c3bd] hover:bg-[#fffefb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c3585] focus-visible:ring-offset-2 ${navigationOpen ? 'w-full justify-between gap-3 px-3' : 'w-12 justify-center px-0'}`}
            data-open={navigationOpen}
            aria-expanded={navigationOpen}
            aria-controls="dashboard-navigation"
            aria-label={navigationOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            onClick={() => setNavigationOpen(open => !open)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="vh-menu-icon" aria-hidden="true">
                <span className="vh-menu-bar" />
                <span className="vh-menu-bar" />
                <span className="vh-menu-bar" />
              </span>
              {navigationOpen && (
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b927f]">Navegación</span>
                  <span className="block truncate text-sm font-semibold text-[#33204f]">{activeMenuItem.label}</span>
                </span>
              )}
            </span>
            {navigationOpen && <span className="text-xs font-medium text-[#54317f]">Cerrar</span>}
          </button>

          <div
            id="dashboard-navigation"
            className={`vh-mobile-menu mt-4 min-h-0 flex-1 flex-col ${navigationOpen ? 'flex' : 'hidden lg:flex'}`}
          >
              <TabsList aria-label="Secciones del panel" className="flex h-auto w-full flex-col justify-start gap-1 overflow-visible bg-transparent p-0">
                {menuItems.filter(item => {
                  if (['proyeccion', 'estadisticas', 'reporte', 'auditoria'].includes(item.id)) return canViewAnalytics(user?.role);
                  if (item.id === 'minutas') return canManageMinutes(user?.role);
                  if (item.id === 'pendientes') return canRegisterPayments(user?.role);
                  if (item.id === 'atrasados') return canRegisterPayments(user?.role) || canManageMinutes(user?.role);
                  return true;
                }).map(item => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger
                      key={item.id}
                      value={item.id}
                      aria-label={item.label}
                      title={!navigationOpen ? item.label : undefined}
                      className={`group min-h-11 w-full rounded-xl border border-transparent py-2.5 text-[#5f6878] transition-[color,background-color,border-color,transform] duration-200 hover:translate-x-0.5 hover:bg-white/80 data-[state=active]:border-[#bfe4df] data-[state=active]:bg-[#f2ebf7] data-[state=active]:text-[#54317f] data-[state=active]:shadow-none motion-reduce:transform-none motion-reduce:transition-none ${navigationOpen ? 'justify-start gap-3 px-3' : 'justify-center px-0'}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {navigationOpen && (
                        <span className={item.description ? 'text-left' : 'text-center'}>
                          <span className={`block text-sm ${item.description ? 'font-medium' : 'font-semibold'}`}>{item.label}</span>
                          {item.description && (
                            <span className="block text-xs font-normal text-[#5f6878] group-data-[state=active]:text-[#54317f]">{item.description}</span>
                          )}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

          </div>
        </aside>

        <main className="min-w-0 px-3 py-4 sm:px-4 lg:px-0 lg:py-5">
          <TabsContent value="inicio" className="mt-0 space-y-4">
            <section className="vh-hero-enter relative isolate min-h-[230px] overflow-hidden rounded-3xl bg-[#33204f] px-5 py-5 text-white shadow-xl shadow-[#33204f]/15 sm:px-6 sm:py-6">
              <img src="/brand/capuli-logo.png" alt="Condominio Rústico Capulí" className="vh-hero-image absolute inset-0 -z-20 h-full w-full object-contain object-right opacity-20" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#261838]/95 via-[#452968]/82 to-[#54317f]/35" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#5c3585] via-[#ff9e32] to-transparent" aria-hidden="true" />
              <div className="flex min-h-[174px] flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#261838]/30 px-3 py-1 text-xs font-medium text-[#ead7fb] backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                    Panel administrativo
                  </div>
                  <h1 className="brand-display text-3xl font-medium tracking-tight sm:text-4xl">Condominio Rústico Capulí</h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
                    Gestiona la cartera del proyecto, revisa compromisos de pago y centraliza los documentos de cada propietario.
                  </p>
                </div>
                {canManageClients(user?.role) && <Button
                  size="lg"
                  className="vh-primary-action min-h-11 bg-[#5c3585] text-white shadow-lg shadow-[#261838]/25 hover:bg-[#54317f]"
                  onClick={() => setShowNewClient(true)}
                >
                  <Plus className="h-4 w-4" />
                  Nuevo cliente
                </Button>}
              </div>
            </section>

            <section aria-label="Indicadores principales" className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {statCards.filter(stat => stat.label === 'Clientes activos' ||
                (stat.label === 'Pendientes este mes' && canRegisterPayments(user?.role)) ||
                (stat.label === 'Pagos atrasados' && (canRegisterPayments(user?.role) || canManageMinutes(user?.role)))).map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={stat.action}
                    className="vh-stat-enter group rounded-2xl border border-[#d9ddd9] bg-[#fffefb] p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#b9c3bd] hover:shadow-lg hover:shadow-[#33204f]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c3585] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                    style={{ animationDelay: `${120 + index * 70}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-[#b5bbb1] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#5c3585] motion-reduce:transform-none" />
                    </div>
                    <p className="brand-display mt-5 text-3xl font-semibold tracking-tight text-[#33204f]">{stat.value}</p>
                    <p className="mt-1 text-sm font-medium text-[#182033]">{stat.label}</p>
                    <p className="mt-1 text-xs text-[#697386]">{stat.helper}</p>
                  </button>
                );
              })}
            </section>

            <Card className="vh-panel-enter overflow-hidden border-[#d9ddd9] bg-[#fffefb] shadow-sm" style={{ animationDelay: '300ms' }}>
              <CardHeader className="border-b border-[#e9ebe7] bg-[#fffefb] px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2ebf7] text-[#54317f]">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Buscar cliente o propiedad</CardTitle>
                    <CardDescription className="mt-1">Usa uno o varios criterios para encontrar un registro.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.65fr_0.65fr_1.7fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="manzana">Manzana</Label>
                    <Input id="manzana" placeholder="Ej. A" value={searchManzana} onChange={event => setSearchManzana(event.target.value)} onKeyDown={event => event.key === 'Enter' && handleSearch()} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lote">Lote</Label>
                    <Input id="lote" placeholder="Ej. 12" value={searchLote} onChange={event => setSearchLote(event.target.value)} onKeyDown={event => event.key === 'Enter' && handleSearch()} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dni-nombre">DNI o nombre</Label>
                    <Input id="dni-nombre" placeholder="Escribe un DNI o nombre" value={searchDniNombre} onChange={event => setSearchDniNombre(event.target.value)} onKeyDown={event => event.key === 'Enter' && handleSearch()} />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={handleSearch} className="min-h-10 flex-1 lg:flex-none">
                      <Search className="h-4 w-4" />
                      Buscar
                    </Button>
                    <Button variant="outline" size="icon" onClick={clearSearch} aria-label="Limpiar búsqueda" title="Limpiar búsqueda">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-[#e9ebe7] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#697386]">También puedes revisar la cartera completa y sus documentos.</p>
                  <Button variant="ghost" onClick={() => setActiveTab('clientes')} className="group self-start sm:self-auto">
                    Ver todos los clientes
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
                  </Button>
                </div>

                {showSearchResults && (
                  <div className="vh-soft-enter mt-6 border-t border-[#e9ebe7] pt-6" aria-live="polite">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-base font-semibold text-[#33204f]">Resultados</h2>
                      <Badge variant="secondary">{searchResults.length} encontrados</Badge>
                    </div>
                    {searchResults.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-[#d9ddd9]">
                        <Table>
                          <TableHeader className="bg-[#f5f4ef]">
                            <TableRow>
                              <TableHead>Cliente</TableHead>
                              <TableHead>DNI</TableHead>
                              <TableHead>Propiedad</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchResults.map(client => (
                              <TableRow key={client.id}>
                                <TableCell className="max-w-72 font-medium text-[#182033]">{getClientDisplayName(client)}</TableCell>
                                <TableCell className="max-w-52 text-[#5f6878]">{getClientDisplayDnis(client)}</TableCell>
                                <TableCell>Mz. {client.manzana} · Lote {client.lote}</TableCell>
                                <TableCell>S/ {client.montoTotal.toFixed(2)}</TableCell>
                                <TableCell><Badge variant="outline">{getClientStatus(client)}</Badge></TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-2">
                                    {canManageMinutes(user?.role) && <MinutaUploadButton clientId={client.id} clientName={getClientDisplayName(client)} onCreate={createMinuteForClient} />}
                                    <Button size="sm" variant="ghost" onClick={() => openClient(client.id)}>Ver cliente</Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#d9ddd9] bg-[#f5f4ef] px-5 py-8 text-center">
                        <Search className="mx-auto h-6 w-6 text-[#8b927f]" />
                        <p className="mt-3 text-sm font-medium text-[#182033]">No encontramos coincidencias</p>
                        <p className="mt-1 text-sm text-[#697386]">Revisa los criterios o limpia la búsqueda para intentarlo nuevamente.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="vh-tab-enter mt-0"><ClientList onCreateMinute={createMinuteForClient} /></TabsContent>
          {canManageMinutes(user?.role) && <TabsContent value="minutas" className="vh-tab-enter mt-0"><MinutasWorkspace initialClientId={minuteClientId} /></TabsContent>}
          {user?.role === 'admin' && <TabsContent value="auditoria" className="vh-tab-enter mt-0"><AuditLog /></TabsContent>}
          {canViewAnalytics(user?.role) && <TabsContent value="proyeccion" className="vh-tab-enter mt-0"><ProjectionView /></TabsContent>}
          {canViewAnalytics(user?.role) && <TabsContent value="estadisticas" className="vh-tab-enter mt-0"><StatsView /></TabsContent>}
          {canViewAnalytics(user?.role) && <TabsContent value="reporte" className="vh-tab-enter mt-0"><StatsView showReport /></TabsContent>}
          {canRegisterPayments(user?.role) && <TabsContent value="pendientes" className="vh-tab-enter mt-0">
            <Card><CardHeader><CardTitle className="text-xl">Cuotas pendientes este mes</CardTitle><CardDescription>Clientes con compromisos próximos dentro del mes actual.</CardDescription></CardHeader><CardContent><ClientList filterType="pending" /></CardContent></Card>
          </TabsContent>}
          {(canRegisterPayments(user?.role) || canManageMinutes(user?.role)) && <TabsContent value="atrasados" className="vh-tab-enter mt-0">
            <Card><CardHeader><CardTitle className="text-xl">Clientes con cuotas atrasadas</CardTitle><CardDescription>Pagos vencidos que requieren seguimiento.</CardDescription></CardHeader><CardContent><ClientList filterType="overdue" /></CardContent></Card>
          </TabsContent>}
        </main>
      </Tabs>

      {showNewClient && canManageClients(user?.role) && <FirebaseClientForm onClose={() => setShowNewClient(false)} />}
    </div>
  );
}

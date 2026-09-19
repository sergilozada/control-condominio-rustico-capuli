import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, DemoAuthProvider, useAuth } from '@/context/FirebaseAuthContext';
import FirebaseLogin from '@/pages/FirebaseLogin';
import FirebaseDashboard from '@/pages/FirebaseDashboard';
import ErrorBoundary from '@/components/ErrorBoundary';
import { isFirebaseConfigured } from '@/services/firebase';

const queryClient = new QueryClient();

function AppContent() {
  const { user, loading, firebaseUser, logout } = useAuth();
  if (loading) return <main className="grid min-h-screen place-items-center">Preparando el panel…</main>;
  if (firebaseUser && !user) {
    return <main className="grid min-h-screen place-items-center p-6 text-center">
      <div><h1 className="text-xl font-semibold">Usuario sin acceso</h1>
      <p className="mt-2">El administrador debe crear tu perfil en Firestore.</p>
      <button onClick={() => void logout()} className="mt-4 rounded-lg border px-4 py-2">Cerrar sesión</button></div>
    </main>;
  }
  return user ? <FirebaseDashboard /> : <FirebaseLogin />;
}

export default function App() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) {
    return <QueryClientProvider client={queryClient}>
      <TooltipProvider><Toaster /><ErrorBoundary><DemoAuthProvider><FirebaseDashboard demo /></DemoAuthProvider></ErrorBoundary></TooltipProvider>
    </QueryClientProvider>;
  }
  if (!isFirebaseConfigured) {
    if (import.meta.env.DEV) return <QueryClientProvider client={queryClient}>
      <TooltipProvider><Toaster /><ErrorBoundary><DemoAuthProvider><FirebaseLogin preview /></DemoAuthProvider></ErrorBoundary></TooltipProvider>
    </QueryClientProvider>;
    return <main className="grid min-h-screen place-items-center bg-[#f7f4fb] p-6 text-center">
      <div className="max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <img src="/brand/capuli-logo.png" alt="Condominio Rústico Capulí" className="mx-auto h-28 w-80 max-w-full object-contain" />
        <h1 className="mt-6 text-xl font-semibold">Configurar Firebase de Condominio Rústico Capulí</h1>
        <p className="mt-2 text-sm text-slate-600">Completa las variables VITE_FIREBASE_* en .env.local y reinicia la aplicación.</p>
      </div>
    </main>;
  }
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider><Toaster /><ErrorBoundary><AuthProvider><AppContent /></AuthProvider></ErrorBoundary></TooltipProvider>
  </QueryClientProvider>;
}

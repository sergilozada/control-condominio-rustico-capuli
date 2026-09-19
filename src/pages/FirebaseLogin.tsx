import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FirebaseError } from 'firebase/app';
import { Eye, EyeOff, Leaf, LoaderCircle, LockKeyhole, MailCheck, Send, ShieldCheck } from 'lucide-react';

export default function FirebaseLogin({ preview = false }: { preview?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const { login, resetPassword } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(email, password);
      if (!success) setError('Email o contraseña incorrectos');
    } catch (loginError) {
      console.error('Firebase login error:', loginError);
      setError('No se pudo iniciar sesión. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const openResetDialog = () => {
    setResetEmail(email.trim());
    setResetError('');
    setResetSent(false);
    setResetDialogOpen(true);
  };

  const handleResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = resetEmail.trim();

    if (!normalizedEmail) {
      setResetError('Ingresa el correo electrónico de tu cuenta.');
      return;
    }

    setResetError('');
    setResetLoading(true);

    try {
      await resetPassword(normalizedEmail);
      setResetSent(true);
    } catch (requestError) {
      const errorCode = requestError instanceof FirebaseError ? requestError.code : '';

      if (errorCode === 'auth/user-not-found') {
        setResetSent(true);
      } else if (errorCode === 'auth/invalid-email') {
        setResetError('Ingresa un correo electrónico válido.');
      } else if (errorCode === 'auth/too-many-requests') {
        setResetError('Se realizaron varios intentos. Espera unos minutos y vuelve a intentarlo.');
      } else if (errorCode === 'auth/network-request-failed') {
        setResetError('No hay conexión. Revisa tu internet e inténtalo nuevamente.');
      } else {
        setResetError('No se pudo procesar la solicitud. Inténtalo nuevamente.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="vh-login-scene relative flex min-h-screen items-center justify-center overflow-hidden bg-[#17250c] p-3 sm:px-6 sm:py-3">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(196,154,34,0.18),transparent_30%),radial-gradient(circle_at_90%_90%,rgba(102,114,59,0.24),transparent_26%)]" aria-hidden="true" />

      <div className="vh-login-shell-enter relative grid w-full max-w-6xl overflow-hidden rounded-[26px] border border-white/15 bg-[#fffefa] shadow-[0_38px_110px_rgba(0,8,24,0.46)] lg:min-h-[680px] lg:grid-cols-[1.12fr_0.88fr]">
        <section className="vh-login-visual-enter relative hidden min-h-[680px] overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
          <img src="/brand/capuli-plan.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-25 grayscale" aria-hidden="true" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(196,154,34,0.26),transparent_28%),linear-gradient(145deg,rgba(60,90,32,0.92),rgba(23,37,12,0.96)_65%,rgba(23,37,12,0.99))]" aria-hidden="true" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#17250c]/35 px-3 py-1.5 text-xs font-semibold tracking-wide text-[#eadca4] backdrop-blur-md">
              <Leaf className="h-3.5 w-3.5" />
              Administración inmobiliaria
            </div>
          </div>

          <div className="relative max-w-xl">
            <div className="mb-6 h-px w-20 bg-[#c49a22]" aria-hidden="true" />
            <h1 className="brand-display text-5xl font-medium leading-[0.98] tracking-[-0.035em] xl:text-6xl">
              Control de clientes<br />y pagos
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/80">
              Una plataforma clara y segura para administrar clientes, pagos y documentos del proyecto.
            </p>
            <p className="mt-4 max-w-lg font-serif text-lg italic text-[#eadca4]">Naturaleza, patrimonio y gestión en un solo lugar.</p>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-[#17250c]/35 px-3 py-2 text-xs text-white/85 backdrop-blur-md">Cartera de clientes</span>
              <span className="rounded-full border border-white/15 bg-[#17250c]/35 px-3 py-2 text-xs text-white/85 backdrop-blur-md">Control de pagos</span>
              <span className="rounded-full border border-white/15 bg-[#17250c]/35 px-3 py-2 text-xs text-white/85 backdrop-blur-md">Documentos centralizados</span>
            </div>
          </div>
        </section>

        <section className="flex min-h-[600px] flex-col justify-center px-5 py-9 sm:min-h-[620px] sm:px-12 sm:py-10 lg:px-14 lg:py-6 xl:px-16">
          <div className="vh-login-form-enter mx-auto w-full max-w-sm">
            <div className="mb-8 flex items-center justify-between gap-4">
              <img
                src="/brand/capuli-logo.png"
                alt="Condominio Rústico Capulí"
                className="h-20 w-56 rounded-2xl border border-[#dfe3d8] bg-white object-contain p-1 shadow-sm"
              />
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#2f4817]">
                <span className="h-2 w-2 rounded-full bg-[#c49a22]" aria-hidden="true" />
                Acceso seguro
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2f4817]">Panel administrativo</p>
            <h2 className="brand-display mt-2 text-4xl font-medium tracking-tight text-[#17250c]">Bienvenido</h2>
            <p className="mt-3 text-sm leading-6 text-[#667060]">
              Ingresa tus credenciales para continuar a Condominio Rústico Capulí.
            </p>
            {preview && <div className="mt-5 rounded-xl border border-[#eadca4] bg-[#fbf4d9] p-3 text-sm text-[#69430d]">
              Firebase aún no está conectado. Puedes recorrer el panel con datos ficticios.
              <a href="?demo" className="mt-3 flex min-h-10 items-center justify-center rounded-lg bg-[#2f4817] px-4 font-semibold text-white hover:bg-[#17250c]">Entrar a la vista de muestra</a>
            </div>}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={loading}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#17250c]">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  disabled={preview}
                  className="h-12 rounded-xl bg-white transition-[border-color,box-shadow] duration-200 focus-visible:border-[#3c5a20]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#17250c]">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    disabled={preview}
                    className="h-12 rounded-xl bg-white pr-12 transition-[border-color,box-shadow] duration-200 focus-visible:border-[#3c5a20]"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword(current => !current)}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#667060] transition-colors hover:bg-[#f8f5eb] hover:text-[#2f4817] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3c5a20]"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openResetDialog}
                    disabled={preview}
                    className="-mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#2f4817] transition-colors hover:bg-[#f8f5eb] hover:text-[#223610] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3c5a20] focus-visible:ring-offset-2"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" role="alert" aria-live="assertive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" size="lg" className="vh-primary-action h-12 w-full rounded-xl bg-gradient-to-r from-[#3c5a20] to-[#2f4817] shadow-[0_10px_24px_rgba(47,72,23,0.24)]" disabled={loading || preview}>
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                    Validando acceso…
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4" />
                    Iniciar sesión
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 flex items-center gap-3 border-t border-[#e8eadf] pt-6">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#2f4817]" />
              <p className="text-xs leading-5 text-[#667060]">Acceso restringido al equipo autorizado del proyecto.</p>
            </div>

            <div className="mt-7 flex items-center gap-3">
              <span className="text-xs text-[#667060]">Gestión comercial · Condominio Rústico Capulí</span>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-[#dfe3d8] bg-[#fffefa] p-6 shadow-2xl sm:p-7">
          <DialogHeader className="text-left">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8f5eb] text-[#2f4817]" aria-hidden="true">
              <MailCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="brand-display text-2xl font-semibold text-[#17250c]">
              {resetSent ? 'Revisa tu correo' : 'Restablecer contraseña'}
            </DialogTitle>
            <DialogDescription className="leading-6 text-[#667060]">
              {resetSent
                ? 'Si existe una cuenta asociada, recibirás un enlace seguro para crear una nueva contraseña.'
                : 'Ingresa el correo que utilizas para acceder al panel.'}
            </DialogDescription>
          </DialogHeader>

          {resetSent ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#d4ddc4] bg-[#f8f5eb] px-4 py-3 text-sm leading-6 text-[#3c5a20]" role="status" aria-live="polite">
                Revisa la bandeja de entrada y la carpeta de correo no deseado de <span className="font-semibold break-all">{resetEmail.trim()}</span>.
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  className="vh-primary-action h-11 w-full rounded-xl bg-gradient-to-r from-[#3c5a20] to-[#2f4817]"
                  onClick={() => setResetDialogOpen(false)}
                >
                  Volver al inicio de sesión
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-5" aria-busy={resetLoading}>
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-[#17250c]">Correo electrónico</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={resetEmail}
                  onChange={event => {
                    setResetEmail(event.target.value);
                    if (resetError) setResetError('');
                  }}
                  aria-invalid={Boolean(resetError)}
                  aria-describedby={resetError ? 'reset-email-error' : 'reset-email-help'}
                  placeholder="nombre@empresa.com"
                  required
                  className="h-12 rounded-xl bg-white transition-[border-color,box-shadow] duration-200 focus-visible:border-[#3c5a20]"
                />
                <p id="reset-email-help" className="text-xs leading-5 text-[#667060]">Solo necesitas el correo registrado; no solicitaremos datos de clientes.</p>
              </div>

              {resetError && (
                <Alert variant="destructive" role="alert" aria-live="assertive">
                  <AlertDescription id="reset-email-error">{resetError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl"
                  disabled={resetLoading}
                  onClick={() => setResetDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="vh-primary-action h-11 rounded-xl bg-gradient-to-r from-[#3c5a20] to-[#2f4817]"
                  disabled={resetLoading || !resetEmail.trim()}
                >
                  {resetLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar enlace
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

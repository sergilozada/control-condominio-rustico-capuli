import { useState } from 'react';
import {
  Building2,
  Loader2,
  Mail,
  Phone,
  UserRound,
  UsersRound,
  WalletCards
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ClientRegistrationPayload, Titular } from '@/types/client';

interface ClientRegistrationDialogProps {
  onClose: () => void;
  onSave: (client: ClientRegistrationPayload) => boolean | Promise<boolean>;
}

interface FormData {
  celular: string;
  email: string;
  manzana: string;
  lote: string;
  metraje: string;
  montoTotal: string;
  formaPago: string;
  numeroCuotas: string;
  inicial: string;
}

const MAX_TITULARES = 10;
const TITULAR_OPTIONS = Array.from({ length: MAX_TITULARES }, (_, index) => index + 1);
const EMPTY_TITULARES: Titular[] = Array.from({ length: MAX_TITULARES }, () => ({ nombre: '', dni: '' }));

export default function ClientRegistrationDialog({ onClose, onSave }: ClientRegistrationDialogProps) {
  const [numeroTitulares, setNumeroTitulares] = useState(1);
  const [titulares, setTitulares] = useState<Titular[]>(EMPTY_TITULARES);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    celular: '',
    email: '',
    manzana: '',
    lote: '',
    metraje: '',
    montoTotal: '',
    formaPago: '',
    numeroCuotas: '',
    inicial: ''
  });

  const handleTitularChange = (index: number, field: keyof Titular, value: string) => {
    setTitulares(current => current.map((titular, titularIndex) => (
      titularIndex === index ? { ...titular, [field]: value } : titular
    )));
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const selectedTitulares = titulares.slice(0, numeroTitulares).map(titular => ({
      nombre: titular.nombre.trim(),
      dni: titular.dni.trim()
    }));
    const incompleteIndex = selectedTitulares.findIndex(titular => !titular.nombre || !titular.dni);

    if (incompleteIndex >= 0) {
      toast.error(`Completa el nombre y DNI del titular ${incompleteIndex + 1}`);
      return;
    }

    if (!formData.manzana.trim() || !formData.lote.trim() || !formData.montoTotal || !formData.formaPago) {
      toast.error('Completa los datos obligatorios de la propiedad y el pago');
      return;
    }

    const numeroCuotas = Number.parseInt(formData.numeroCuotas, 10);
    const montoTotal = Number.parseFloat(formData.montoTotal);
    if (!Number.isInteger(numeroCuotas) || numeroCuotas < 1 || !Number.isFinite(montoTotal) || montoTotal <= 0) {
      toast.error('Ingresa un monto total y un número de cuotas válidos');
      return;
    }

    if (formData.formaPago === 'cuotas' && !formData.inicial) {
      toast.error('Para pagos en cuotas debes especificar la inicial');
      return;
    }

    const clientData: ClientRegistrationPayload = {
      titulares: selectedTitulares,
      // Estos cuatro campos conservan compatibilidad con reportes y registros anteriores.
      nombre1: selectedTitulares[0].nombre,
      nombre2: selectedTitulares[1]?.nombre || undefined,
      dni1: selectedTitulares[0].dni,
      dni2: selectedTitulares[1]?.dni || undefined,
      celular1: formData.celular.trim() || undefined,
      email1: formData.email.trim() || undefined,
      manzana: formData.manzana.trim(),
      lote: formData.lote.trim(),
      metraje: Number.parseFloat(formData.metraje) || 0,
      montoTotal,
      formaPago: formData.formaPago as 'contado' | 'cuotas',
      numeroCuotas,
      inicial: formData.formaPago === 'cuotas' ? Number.parseFloat(formData.inicial) || 0 : 0
    };

    setLoading(true);
    try {
      const success = await Promise.resolve(onSave(clientData));
      if (success) {
        toast.success(`${numeroTitulares === 1 ? 'Cliente registrado' : `${numeroTitulares} titulares registrados`} exitosamente`);
        onClose();
      } else {
        toast.error('Ya existe un registro con esa manzana y lote');
      }
    } catch (error) {
      console.error('Error al registrar cliente:', error);
      toast.error('No se pudo registrar el cliente. Inténtalo nuevamente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && !loading && onClose()}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden border-[#dfe3d8] bg-[#fffefa] p-0 shadow-2xl sm:w-[calc(100vw-2rem)] sm:rounded-3xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b border-[#dfe3d8] bg-gradient-to-r from-[#f8f5eb] to-[#fffefa] px-5 py-5 pr-14 sm:px-7 sm:py-6 sm:pr-16">
            <div className="flex items-start gap-3 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2f4817] text-white shadow-sm">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="brand-display text-2xl font-semibold text-[#17250c]">Nuevo registro</DialogTitle>
                <DialogDescription className="mt-1 max-w-2xl leading-5 text-[#667060]">
                  Registra de 1 a 10 titulares. El contacto, la propiedad y las condiciones de pago serán compartidos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <div className="space-y-7">
              <section aria-labelledby="titulares-heading" className="space-y-4">
                <div className="grid gap-4 rounded-2xl border border-[#d4ddc4] bg-[#f8f5eb] p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end sm:p-5">
                  <div>
                    <h2 id="titulares-heading" className="text-base font-semibold text-[#17250c]">Titulares del registro</h2>
                    <p className="mt-1 text-sm leading-5 text-[#667060]">Selecciona cuántas personas aparecerán como propietarias del mismo lote.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero-titulares" className="text-[#17250c]">Cantidad de titulares *</Label>
                    <Select value={String(numeroTitulares)} onValueChange={value => setNumeroTitulares(Number(value))}>
                      <SelectTrigger id="numero-titulares" className="min-h-11 border-[#aab38b] bg-white focus:ring-[#3c5a20]" aria-label="Cantidad de titulares">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TITULAR_OPTIONS.map(option => (
                          <SelectItem key={option} value={String(option)}>{option} {option === 1 ? 'titular' : 'titulares'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {titulares.slice(0, numeroTitulares).map((titular, index) => (
                    <article key={index} className="rounded-2xl border border-[#dfe3d8] bg-white p-4 shadow-sm sm:p-5" aria-labelledby={`titular-${index + 1}-heading`}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8f5eb] text-[#2f4817]" aria-hidden="true">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 id={`titular-${index + 1}-heading`} className="text-sm font-semibold text-[#17250c]">Titular {index + 1}</h3>
                          <p className="text-xs text-[#667060]">Nombre completo y documento</p>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)]">
                        <div className="space-y-2">
                          <Label htmlFor={`nombre-${index + 1}`}>Nombre {index + 1} *</Label>
                          <Input
                            id={`nombre-${index + 1}`}
                            value={titular.nombre}
                            onChange={event => handleTitularChange(index, 'nombre', event.target.value)}
                            placeholder="Nombres y apellidos"
                            autoComplete={index === 0 ? 'name' : 'off'}
                            className="min-h-11 focus-visible:ring-[#3c5a20]"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`dni-${index + 1}`}>DNI {index + 1} *</Label>
                          <Input
                            id={`dni-${index + 1}`}
                            value={titular.dni}
                            onChange={event => handleTitularChange(index, 'dni', event.target.value)}
                            placeholder="Documento"
                            inputMode="numeric"
                            autoComplete="off"
                            className="min-h-11 focus-visible:ring-[#3c5a20]"
                            required
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section aria-labelledby="contacto-heading" className="space-y-4 border-t border-[#e5e7df] pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f0e6] text-[#17250c]">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id="contacto-heading" className="text-base font-semibold text-[#17250c]">Contacto compartido</h2>
                    <p className="text-sm text-[#667060]">Un celular y un email para todos los titulares.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="celular">Celular</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8275]" aria-hidden="true" />
                      <Input id="celular" type="tel" inputMode="tel" autoComplete="tel" value={formData.celular} onChange={event => handleInputChange('celular', event.target.value)} placeholder="Número de contacto" className="min-h-11 pl-10 focus-visible:ring-[#3c5a20]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8275]" aria-hidden="true" />
                      <Input id="email" type="email" inputMode="email" autoComplete="email" value={formData.email} onChange={event => handleInputChange('email', event.target.value)} placeholder="correo@ejemplo.com" className="min-h-11 pl-10 focus-visible:ring-[#3c5a20]" />
                    </div>
                  </div>
                </div>
              </section>

              <section aria-labelledby="propiedad-heading" className="space-y-4 border-t border-[#e5e7df] pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f0e6] text-[#17250c]">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id="propiedad-heading" className="text-base font-semibold text-[#17250c]">Propiedad compartida</h2>
                    <p className="text-sm text-[#667060]">Datos únicos del lote para este registro.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="manzana">Manzana *</Label>
                    <Input id="manzana" value={formData.manzana} onChange={event => handleInputChange('manzana', event.target.value)} placeholder="Ej. A" className="min-h-11 focus-visible:ring-[#3c5a20]" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lote">Lote *</Label>
                    <Input id="lote" value={formData.lote} onChange={event => handleInputChange('lote', event.target.value)} placeholder="Ej. 12" className="min-h-11 focus-visible:ring-[#3c5a20]" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metraje">Metraje (m²)</Label>
                    <Input id="metraje" type="number" min="0" step="0.01" inputMode="decimal" value={formData.metraje} onChange={event => handleInputChange('metraje', event.target.value)} placeholder="0.00" className="min-h-11 focus-visible:ring-[#3c5a20]" />
                  </div>
                </div>
              </section>

              <section aria-labelledby="pago-heading" className="space-y-4 border-t border-[#e5e7df] pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf4d9] text-[#a67b0d]">
                    <WalletCards className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id="pago-heading" className="text-base font-semibold text-[#17250c]">Condiciones de pago</h2>
                    <p className="text-sm text-[#667060]">El monto, la forma de pago y las cuotas aplican a todo el registro.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="monto-total">Monto total *</Label>
                    <Input id="monto-total" type="number" min="0.01" step="0.01" inputMode="decimal" value={formData.montoTotal} onChange={event => handleInputChange('montoTotal', event.target.value)} placeholder="S/ 0.00" className="min-h-11 focus-visible:ring-[#3c5a20]" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="forma-pago">Forma de pago *</Label>
                    <Select value={formData.formaPago} onValueChange={value => handleInputChange('formaPago', value)}>
                      <SelectTrigger id="forma-pago" className="min-h-11 focus:ring-[#3c5a20]" aria-label="Forma de pago">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contado">Contado</SelectItem>
                        <SelectItem value="cuotas">Cuotas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero-cuotas">Número de cuotas *</Label>
                    <Input id="numero-cuotas" type="number" min="1" step="1" inputMode="numeric" value={formData.numeroCuotas} onChange={event => handleInputChange('numeroCuotas', event.target.value)} placeholder="Ej. 24" className="min-h-11 focus-visible:ring-[#3c5a20]" required />
                  </div>
                  {formData.formaPago === 'cuotas' && (
                    <div className="space-y-2">
                      <Label htmlFor="inicial">Inicial *</Label>
                      <Input id="inicial" type="number" min="0" step="0.01" inputMode="decimal" value={formData.inicial} onChange={event => handleInputChange('inicial', event.target.value)} placeholder="S/ 0.00" className="min-h-11 focus-visible:ring-[#3c5a20]" required />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#dfe3d8] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-xs leading-5 text-[#667060]">* Campos obligatorios · Se guardará un solo registro para el lote.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="min-h-11 sm:min-w-28">Cancelar</Button>
              <Button type="submit" disabled={loading} className="min-h-11 bg-[#2f4817] text-white hover:bg-[#223610] sm:min-w-40">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UsersRound className="h-4 w-4" aria-hidden="true" />}
                {loading ? 'Registrando…' : `Registrar ${numeroTitulares === 1 ? 'cliente' : 'titulares'}`}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

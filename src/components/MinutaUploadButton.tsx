import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileCheck2, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { deleteObject, getDownloadURL, getMetadata, listAll, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/services/firebase';
import { useAuth } from '@/context/FirebaseAuthContext';
import { updateClientWithAudit } from '@/services/audit';
import { canManageMinutes } from '@/config/permissions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface MinutaUploadButtonProps {
  clientId: string;
  clientName: string;
  onCreate?: (clientId: string) => void;
}

interface StoredMinute {
  name: string;
  path: string;
  url: string;
  uploadedAt?: string;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx'];

const sanitizeFileName = (fileName: string) => (
  fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
);

export default function MinutaUploadButton({ clientId, clientName, onCreate }: MinutaUploadButtonProps) {
  const { firebaseUser, user, preview } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [minutes, setMinutes] = useState<StoredMinute[]>([]);
  const [minuteToDelete, setMinuteToDelete] = useState<StoredMinute | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMinutes = useCallback(async () => {
    if (preview) { setMinutes([]); return; }
    setLoading(true);
    try {
      const folder = storageRef(storage, `clients/${clientId}/minutas`);
      const result = await listAll(folder);
      const items = await Promise.all(result.items.map(async (item) => {
        const [url, metadata] = await Promise.all([
          getDownloadURL(item),
          getMetadata(item),
        ]);

        return {
          name: metadata.customMetadata?.originalName || item.name.replace(/^\d+_/, ''),
          path: item.fullPath,
          url,
          uploadedAt: metadata.timeCreated,
        };
      }));

      setMinutes(items.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || '')));
    } catch (error) {
      console.error('Error al consultar minutas:', error);
      toast.error('No se pudieron consultar las minutas de este cliente');
    } finally {
      setLoading(false);
    }
  }, [clientId, preview]);

  useEffect(() => {
    if (open) void loadMinutes();
  }, [loadMinutes, open]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!firebaseUser || !canManageMinutes(user?.role)) return;

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      toast.error('Selecciona un archivo PDF, DOC o DOCX');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('La minuta no puede superar los 15 MB');
      return;
    }

    setUploading(true);
    try {
      const storedName = `${Date.now()}_${sanitizeFileName(file.name)}`;
      const destination = storageRef(storage, `clients/${clientId}/minutas/${storedName}`);

      await uploadBytes(destination, file, {
        contentType: file.type || undefined,
        customMetadata: { originalName: file.name },
      });
      try {
        await updateClientWithAudit(firebaseUser, clientId, {
          lastDocumentEvent: { action: 'subir', name: file.name, at: new Date().toISOString() },
        }, `Minuta subida: ${file.name}`, 'minuta_documento');
      } catch (auditError) {
        console.error('La minuta se subió sin registrar el historial:', auditError);
        toast.warning('Minuta subida, pero no se pudo registrar en el historial');
      }

      await loadMinutes();
      toast.success('Minuta subida correctamente');
    } catch (error) {
      console.error('Error al subir la minuta:', error);
      toast.error('No se pudo subir la minuta. Inténtalo nuevamente');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMinute = async () => {
    if (!minuteToDelete) return;
    if (!firebaseUser || !canManageMinutes(user?.role)) return;

    setDeleting(true);
    try {
      await deleteObject(storageRef(storage, minuteToDelete.path));
      try {
        await updateClientWithAudit(firebaseUser, clientId, {
          lastDocumentEvent: { action: 'eliminar', name: minuteToDelete.name, at: new Date().toISOString() },
        }, `Minuta eliminada: ${minuteToDelete.name}`, 'minuta_documento');
      } catch (auditError) {
        console.error('La minuta se eliminó sin registrar el historial:', auditError);
        toast.warning('Minuta eliminada, pero no se pudo registrar en el historial');
      }
      setMinutes(current => current.filter(minute => minute.path !== minuteToDelete.path));
      setMinuteToDelete(null);
      toast.success('Minuta eliminada correctamente');
    } catch (error) {
      console.error('Error al eliminar la minuta:', error);
      toast.error('No se pudo eliminar la minuta. Inténtalo nuevamente');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-[#d4ddc4] bg-[#f8f5eb] text-[#2f4817] hover:bg-[#edf0e5] hover:text-[#2f4817]"
          aria-label={`Gestionar minuta de ${clientName}`}
        >
          <Upload className="h-4 w-4" />
          Minuta
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-[#dfe3d8] bg-[#fffefa] p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[#e8eadf] bg-[#f8f5eb]/80 px-6 py-5 text-left">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#2f4817] text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl text-[#17250c]">Minuta del cliente</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[#667060]">
            {clientName}. Adjunta documentos PDF o Word sin modificar la información del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {onCreate && <Button type="button" className="w-full bg-[#2f4817] text-white" onClick={() => { setOpen(false); onCreate(clientId); }}>
            Crear borrador de minuta para este cliente
          </Button>}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={handleFileChange}
          />

          {!preview && canManageMinutes(user?.role) && <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#aab38b] bg-[#f8f5eb]/70 px-5 py-6 text-center transition-colors hover:border-[#3c5a20] hover:bg-[#eef1e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3c5a20] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="mb-3 h-7 w-7 animate-spin text-[#2f4817]" />
            ) : (
              <Upload className="mb-3 h-7 w-7 text-[#2f4817]" />
            )}
            <span className="font-semibold text-[#17250c]">
              {uploading ? 'Subiendo minuta…' : 'Seleccionar minuta'}
            </span>
            <span className="mt-1 text-sm text-[#667060]">PDF, DOC o DOCX · máximo 15 MB</span>
          </button>}

          <section aria-labelledby={`minutes-${clientId}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id={`minutes-${clientId}`} className="text-sm font-semibold text-[#17250c]">
                Documentos disponibles
              </h3>
              {!loading && (
                <span className="rounded-full bg-[#eef1e6] px-2.5 py-1 text-xs font-medium text-[#2f4817]">
                  {minutes.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#f8f5eb] p-4 text-sm text-[#667060]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando documentos…
              </div>
            ) : minutes.length > 0 ? (
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {minutes.map((minute) => (
                  <div
                    key={minute.path}
                    className="group flex min-h-14 items-center gap-2 rounded-xl border border-[#dfe3d8] bg-white p-1.5 transition-colors hover:border-[#d4ddc4] hover:bg-[#f8f5eb]/40"
                  >
                    <a
                      href={minute.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3c5a20]"
                      aria-label={`Abrir minuta ${minute.name}`}
                    >
                      <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#172012]">
                        {minute.name}
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-[#aab38b] group-hover:text-[#3c5a20]" />
                    </a>
                    {canManageMinutes(user?.role) && <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setMinuteToDelete(minute)}
                      className="h-10 w-10 shrink-0 text-[#a63d45] hover:bg-rose-50 hover:text-[#8e2932]"
                      aria-label={`Eliminar minuta ${minute.name}`}
                      title="Eliminar minuta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[#dfe3d8] bg-[#f8f5eb] px-4 py-5 text-center text-sm text-[#667060]">
                Aún no hay minutas cargadas para este cliente.
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="border-t border-[#e8eadf] bg-[#f8f5eb]/80 px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={minuteToDelete !== null} onOpenChange={nextOpen => {
        if (!nextOpen && !deleting) setMinuteToDelete(null);
      }}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] rounded-2xl border-[#dfe3d8] bg-[#fffefa] sm:max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-[#a63d45] sm:mx-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-[#17250c]">¿Eliminar esta minuta?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#667060]">
              {minuteToDelete?.name}. El documento se eliminará del almacenamiento y esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setMinuteToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteMinute()} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? 'Eliminando…' : 'Eliminar minuta'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

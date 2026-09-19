import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { FileCheck2, FileWarning } from 'lucide-react';
import { getClientDisplayDnis, getClientDisplayName } from '@/types/client';
import { applyPdfBrand, loadPdfLogo, PDF_COLORS, PDF_CONTENT_TOP, pdfGeneratedAt } from '@/utils/pdfBrand';

interface Installment {
  numero: number;
  vencimiento: string;
  monto: number;
  estado: 'pendiente' | 'pagado' | 'vencido';
}
interface DocumentClient {
  titulares?: { nombre: string; dni: string }[];
  nombre1: string;
  nombre2?: string;
  dni1: string;
  dni2?: string;
  manzana: string;
  lote: string;
  cuotas?: Installment[];
}

function todayIso() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
function paragraph(pdf: jsPDF, text: string, y: number) {
  const lines = pdf.splitTextToSize(text, 174);
  for (const line of lines) {
    if (y > 258) {
      pdf.addPage();
      y = PDF_CONTENT_TOP + 5;
    }
    pdf.text(line, 18, y);
    y += 5.5;
  }
  return y + 7;
}
function save(pdf: jsPDF, prefix: string, client: DocumentClient) {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9-]/g, '_');
  pdf.save(`${prefix}-mz-${safe(client.manzana)}-lote-${safe(client.lote)}.pdf`);
}
function signature(pdf: jsPDF, y: number) {
  if (y > 245) {
    pdf.addPage();
    y = PDF_CONTENT_TOP + 5;
  }
  pdf.setDrawColor(...PDF_COLORS.green);
  pdf.text('_______________________________', 18, y + 15);
  pdf.text('Firma y sello autorizados', 18, y + 21);
}

export function NoDebtCertificateButton({ client }: { client: DocumentClient }) {
  const installments = client.cuotas || [];
  const canIssue = installments.length > 0 && installments.every(c => c.estado === 'pagado');
  const generate = async () => {
    if (!canIssue) return;
    const pdf = new jsPDF();
    const logo = await loadPdfLogo();
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    let y = paragraph(pdf, `Condominio Rústico Capulí deja constancia de que, según los pagos registrados en este sistema al ${formatDate(todayIso())}, ${getClientDisplayName(client)}, identificado(a) con DNI ${getClientDisplayDnis(client)}, no presenta cuotas pendientes respecto del lote Mz. ${client.manzana}, Lote ${client.lote}.`, PDF_CONTENT_TOP + 8);
    y = paragraph(pdf, 'Esta constancia se limita al cronograma de cuotas registrado. Debe contrastarse con los comprobantes y la contabilidad antes de su firma o entrega. No acredita obligaciones ajenas a ese cronograma.', y);
    signature(pdf, Math.max(y, 123));
    applyPdfBrand(pdf, {
      title: 'Constancia de no adeudo',
      subtitle: `Generada el ${pdfGeneratedAt()}`,
      logo,
      footerLabel: 'Constancia para revisión y firma',
    });
    save(pdf, 'constancia-no-adeudo', client);
  };
  return <Button size="sm" variant="outline" disabled={!canIssue} onClick={() => void generate()}
    title={canIssue ? 'Generar constancia para revisión y firma' : 'Requiere todas las cuotas pagadas y registradas'}>
    <FileCheck2 className="mr-1 h-4 w-4" /> No adeudo
  </Button>;
}

export function ResolutionDraftButton({ client }: { client: DocumentClient }) {
  const overdue = (client.cuotas || []).filter(c =>
    c.numero > 0 && c.estado !== 'pagado' && c.vencimiento.slice(0, 10) < todayIso());
  const canDraft = overdue.length >= 3;
  const generate = async () => {
    if (!canDraft) return;
    const pdf = new jsPDF();
    const logo = await loadPdfLogo();
    pdf.setFillColor(...PDF_COLORS.goldLight);
    pdf.roundedRect(18, PDF_CONTENT_TOP + 4, 174, 11, 2, 2, 'F');
    pdf.setTextColor(91, 59, 21);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.text('BORRADOR PARA REVISIÓN. NO ENVIADO NI NOTIFICADO.', 23, PDF_CONTENT_TOP + 11);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    let y = paragraph(pdf, `Destinatario: ${getClientDisplayName(client)} (DNI ${getClientDisplayDnis(client)}). Lote Mz. ${client.manzana}, Lote ${client.lote}.`, PDF_CONTENT_TOP + 25);
    y = paragraph(pdf, 'Asunto: revisión de posible resolución del contrato por falta de pago. Verificar el texto, la cláusula aplicable y los medios de notificación pactados en el contrato firmado de este cliente.', y);
    y = paragraph(pdf, `Al ${formatDate(todayIso())}, el sistema registra ${overdue.length} cuotas vencidas sin pago: ${overdue.map(c => `N.° ${c.numero} (venció ${formatDate(c.vencimiento)}, S/ ${c.monto.toFixed(2)})`).join('; ')}.`, y);
    y = paragraph(pdf, 'Antes de decidir o comunicar una resolución, el área responsable debe verificar el contrato suscrito, pagos recientes, comprobantes, abonos parciales, identidad y domicilio o correo pactado. La generación de este borrador no modifica el estado del contrato ni constituye notificación.', y);
    signature(pdf, y);
    applyPdfBrand(pdf, {
      title: 'Borrador de resolución contractual',
      subtitle: `Generado el ${pdfGeneratedAt()}`,
      logo,
      footerLabel: 'Documento legal sujeto a revisión',
    });
    save(pdf, 'borrador-resolucion', client);
  };
  return <Button size="sm" variant="outline" disabled={!canDraft} onClick={() => void generate()}
    title={canDraft ? 'Generar borrador para revisión' : 'Disponible con tres cuotas vencidas sin pagar'}>
    <FileWarning className="mr-1 h-4 w-4" /> Borrador de resolución
  </Button>;
}

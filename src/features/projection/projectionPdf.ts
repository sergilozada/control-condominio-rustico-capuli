import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { applyPdfBrand, loadPdfLogo, PDF_COLORS, PDF_CONTENT_BOTTOM, PDF_CONTENT_TOP } from '@/utils/pdfBrand';

export interface ProjectionRow {
  month: string;
  installments: number;
  amount: number;
}

export type ProjectionKind = 'month' | 'range' | 'monthly';

const money = (value: number) => `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function loadProjectionLogo(): Promise<string> {
  return loadPdfLogo();
}

export function createProjectionPdf(kind: ProjectionKind, subtitle: string, rows: ProjectionRow[], logo: string) {
  const pdf = new jsPDF();
  pdf.setProperties({ title: `Proyección de ingresos - ${subtitle}`, author: 'Condominio Rústico Capulí' });
  const totalInstallments = rows.reduce((sum, row) => sum + row.installments, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  pdf.setTextColor(...PDF_COLORS.ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Resumen', 16, PDF_CONTENT_TOP + 5);
  pdf.setFillColor(...PDF_COLORS.cream);
  pdf.roundedRect(16, PDF_CONTENT_TOP + 10, 178, 25, 3, 3, 'F');
  pdf.setTextColor(...PDF_COLORS.green);
  pdf.setFontSize(10);
  pdf.text(`Cuotas previstas: ${totalInstallments}`, 22, PDF_CONTENT_TOP + 20);
  pdf.text(`Ingreso proyectado: ${money(totalAmount)}`, 22, PDF_CONTENT_TOP + 28);

  autoTable(pdf, {
    startY: PDF_CONTENT_TOP + 45,
    margin: { left: 16, right: 16, top: PDF_CONTENT_TOP, bottom: PDF_CONTENT_BOTTOM },
    head: [['Mes', 'Número de cuotas', 'Total proyectado']],
    body: rows.map(row => [row.month, String(row.installments), money(row.amount)]),
    foot: [['Total', String(totalInstallments), money(totalAmount)]],
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.green, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: PDF_COLORS.cream, textColor: PDF_COLORS.green, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: PDF_COLORS.paper },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3.5, textColor: PDF_COLORS.ink, lineColor: PDF_COLORS.line, lineWidth: 0.1 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
    showFoot: 'lastPage',
  });

  applyPdfBrand(pdf, { title: 'Proyección de ingresos', subtitle, logo, footerLabel: 'Proyección de ingresos' });
  return pdf;
}

export async function downloadProjectionPdf(kind: ProjectionKind, subtitle: string, rows: ProjectionRow[]) {
  const logo = await loadProjectionLogo();
  const pdf = createProjectionPdf(kind, subtitle, rows, logo);
  const date = new Date();
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  pdf.save(`proyeccion_${kind}_${day}.pdf`);
}

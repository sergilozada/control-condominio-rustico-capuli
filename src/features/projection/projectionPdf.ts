import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export interface ProjectionRow {
  month: string;
  installments: number;
  amount: number;
}

export type ProjectionKind = 'month' | 'range' | 'monthly';

const brandGreen: [number, number, number] = [49, 82, 29];
const brandLight: [number, number, number] = [241, 246, 235];
const ink: [number, number, number] = [34, 32, 47];
const money = (value: number) => `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function loadProjectionLogo(): Promise<string> {
  const response = await fetch('/brand/capuli-logo.png');
  if (!response.ok) throw new Error('No se pudo cargar el logo de Condominio Rústico Capulí.');
  const source = URL.createObjectURL(await response.blob());
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    // Ajusta el logotipo completo dentro de una banda blanca sin recortarlo.
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar el logo.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally { URL.revokeObjectURL(source); }
}

function pageChrome(pdf: jsPDF, subtitle: string, logo: string, page: number, pages: number) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(...brandGreen);
  pdf.rect(0, 0, width, 41, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('PROYECCIÓN DE INGRESOS', 16, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(subtitle, 16, 28);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(width - 73, 7, 58, 25, 3, 3, 'F');
  pdf.addImage(logo, 'JPEG', width - 70, 11, 52, 16);
  pdf.setDrawColor(...brandGreen);
  pdf.line(16, height - 18, width - 16, height - 18);
  pdf.setTextColor(...brandGreen);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('CONDOMINIO RÚSTICO CAPULÍ  ·  Proyección de ingresos', 16, height - 12);
  pdf.text(`${page} / ${pages}`, width - 16, height - 12, { align: 'right' });
}

export function createProjectionPdf(kind: ProjectionKind, subtitle: string, rows: ProjectionRow[], logo: string) {
  const pdf = new jsPDF();
  pdf.setProperties({ title: `Proyección de ingresos - ${subtitle}`, author: 'Condominio Rústico Capulí' });
  const totalInstallments = rows.reduce((sum, row) => sum + row.installments, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  pdf.setTextColor(...ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Resumen', 16, 55);
  pdf.setFillColor(...brandLight);
  pdf.roundedRect(16, 60, 178, 25, 3, 3, 'F');
  pdf.setTextColor(...brandGreen);
  pdf.setFontSize(10);
  pdf.text(`Cuotas previstas: ${totalInstallments}`, 22, 70);
  pdf.text(`Ingreso proyectado: ${money(totalAmount)}`, 22, 78);

  autoTable(pdf, {
    startY: 95,
    margin: { left: 16, right: 16, top: 49, bottom: 25 },
    head: [['Mes', 'Número de cuotas', 'Total proyectado']],
    body: rows.map(row => [row.month, String(row.installments), money(row.amount)]),
    foot: [['Total', String(totalInstallments), money(totalAmount)]],
    theme: 'grid',
    headStyles: { fillColor: brandGreen, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: brandLight, textColor: brandGreen, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [251, 249, 252] },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3.5, textColor: ink, lineColor: [225, 218, 230], lineWidth: 0.1 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
    showFoot: 'lastPage',
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pageChrome(pdf, subtitle, logo, page, pages);
  }
  return pdf;
}

export async function downloadProjectionPdf(kind: ProjectionKind, subtitle: string, rows: ProjectionRow[]) {
  const logo = await loadProjectionLogo();
  const pdf = createProjectionPdf(kind, subtitle, rows, logo);
  const date = new Date();
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  pdf.save(`proyeccion_${kind}_${day}.pdf`);
}

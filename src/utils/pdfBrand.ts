import type { jsPDF } from 'jspdf';

type Rgb = [number, number, number];

export const PDF_COLORS = {
  forest: [23, 37, 12] as Rgb,
  green: [47, 72, 23] as Rgb,
  olive: [102, 114, 59] as Rgb,
  gold: [196, 154, 34] as Rgb,
  goldLight: [234, 220, 164] as Rgb,
  cream: [248, 245, 235] as Rgb,
  paper: [255, 254, 250] as Rgb,
  ink: [23, 32, 18] as Rgb,
  muted: [102, 112, 96] as Rgb,
  line: [220, 226, 213] as Rgb,
};

export const PDF_CONTENT_TOP = 50;
export const PDF_CONTENT_BOTTOM = 22;

export async function loadPdfLogo(): Promise<string> {
  const response = await fetch('/brand/capuli-logo.png');
  if (!response.ok) throw new Error('No se pudo cargar el logo de Condominio Rústico Capulí.');

  const source = URL.createObjectURL(await response.blob());
  try {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar el logo institucional.');

    context.fillStyle = '#fffefa';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(source);
  }
}

interface PdfBrandOptions {
  title: string;
  subtitle?: string;
  logo: string;
  footerLabel?: string;
}

function drawHeader(pdf: jsPDF, options: PdfBrandOptions) {
  const width = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(...PDF_COLORS.forest);
  pdf.rect(0, 0, width, 39, 'F');
  pdf.setFillColor(...PDF_COLORS.gold);
  pdf.rect(0, 39, width, 2, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(options.title.toUpperCase(), 15, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...PDF_COLORS.goldLight);
  pdf.text(options.subtitle || 'Documento de gestión inmobiliaria', 15, 28);

  pdf.setFillColor(...PDF_COLORS.paper);
  pdf.roundedRect(width - 72, 7, 57, 25, 3, 3, 'F');
  pdf.addImage(options.logo, 'JPEG', width - 69, 11, 51, 16);
}

function drawFooter(pdf: jsPDF, label: string, page: number, pages: number) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  pdf.setDrawColor(...PDF_COLORS.gold);
  pdf.setLineWidth(0.45);
  pdf.line(15, height - 17, width - 15, height - 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...PDF_COLORS.green);
  pdf.text(`CONDOMINIO RÚSTICO CAPULÍ · ${label}`, 15, height - 11);
  pdf.text(`Página ${page} de ${pages}`, width - 15, height - 11, { align: 'right' });
}

export function applyPdfBrand(pdf: jsPDF, options: PdfBrandOptions) {
  const pages = pdf.getNumberOfPages();
  pdf.setProperties({
    title: options.title,
    author: 'Condominio Rústico Capulí',
    subject: options.footerLabel || options.title,
  });

  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    drawHeader(pdf, options);
    drawFooter(pdf, options.footerLabel || options.title, page, pages);
  }
}

export function pdfGeneratedAt(date = new Date()) {
  return date.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' });
}

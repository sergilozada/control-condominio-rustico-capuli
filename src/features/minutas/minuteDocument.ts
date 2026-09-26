import { AlignmentType, Document, Footer, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { buildSchedule, documentLabel, money, validateMinute, type MinuteDraft } from './types';

const cell = (value: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold })] })] });
const row = (...values: string[]) => new TableRow({ children: values.map(value => cell(value)) });
const label = (value: string) => new Paragraph({ text: value, heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 } });
const paragraph = (value: string) => new Paragraph({ text: value, spacing: { after: 110 } });
const table = (rows: TableRow[]) => new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });

export async function createMinuteDocument(draft: MinuteDraft): Promise<Blob> {
  const errors = validateMinute(draft);
  if (errors.length) throw new Error(errors.join(' '));
  const schedule = buildSchedule(draft);
  const paymentRows = draft.initialPayments.map(payment => row(payment.date, payment.method, payment.bank || '—', money(payment.amount)));
  const buyerNames = draft.buyers.map(buyer => buyer.name.trim()).filter(Boolean).join(' y ');
  const footer = new Footer({ children: [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      cell(`____________________________\nSello y firma de Gerencia\n${draft.managerName}`),
      cell(`____________________________\n${buyerNames || 'Comprador'} · firma`),
    ] })],
  })] });
  const children = [
    new Paragraph({ text: 'BORRADOR DE MINUTA PARA REVISIÓN', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 180 } }),
    paragraph('Condominio Rústico Capulí · Borrador de operación inmobiliaria'),
    paragraph('Documento de trabajo generado con los datos registrados. No sustituye el contrato firmado, la revisión legal ni la autorización de un abogado.'),
    label('Partes y compradores'),
    paragraph('Promitente transferente: Condominio Rústico Capulí. La razón social, identidad y facultades de su representante deben completarse y verificarse antes de firmar.'),
    table([row('Comprador', 'Documento', 'Ocupación', 'Estado civil'), ...draft.buyers.map(buyer => row(buyer.name, `${documentLabel(buyer.documentType)} ${buyer.document}`, buyer.occupation || 'Por completar', buyer.maritalStatus || 'Por completar'))]),
    ...draft.buyers.map((buyer, index) => paragraph(`Domicilio del comprador ${index + 1}: ${buyer.address || 'Por completar'}.`)),
    label('Lote y precio'),
    paragraph(`Tipo: ${draft.propertyType === 'macrolote' ? 'Macrolote' : 'Lote'} · Manzana ${draft.block} · Lote ${draft.lot} · Área ${draft.area.toLocaleString('es-PE')} m².`),
    paragraph(`Precio total declarado: ${money(draft.totalPrice)}. Cuota inicial: ${money(draft.initialAmount)}. Saldo a financiar: ${money(draft.totalPrice - draft.initialAmount)}.`),
    label('Pagos de cuota inicial'),
    table([row('Fecha', 'Medio', 'Banco', 'Monto'), ...paymentRows]),
    label('Cronograma calculado'),
    paragraph(`El saldo se distribuye en ${draft.installments} cuotas. La última ajusta cualquier diferencia de redondeo.`),
    table([row('Comprador', 'Vencimiento', 'Monto'), ...schedule.map(item => row(buyerNames, item.dueDate, money(item.amount)))]),
    label('Observaciones para revisión'),
    paragraph(draft.notes.trim() || 'Sin observaciones adicionales.'),
    paragraph('Antes de entregar o firmar: verificar el contrato aplicable al lote, los documentos de identidad, la posesión y ubicación, todos los pagos, el cronograma, el representante autorizado y la redacción legal final.'),
    label('Cierre y firmas para revisión'),
    paragraph(`Lugar y fecha de suscripción: ${draft.signaturePlace}, ${draft.signatureDate}.`),
    paragraph('La redacción final de las cláusulas de cierre, representación y conformidad debe ser aprobada por el área legal antes de la firma. Este borrador no acredita por sí solo la aceptación de las partes.'),
    paragraph(`Gerencia o representante autorizado: ${draft.managerName} ____________________________________`),
    ...draft.buyers.map(buyer => paragraph(`${buyer.name} · ${documentLabel(buyer.documentType)} ${buyer.document}: ____________________________________`)),
  ];
  const doc = new Document({
    creator: 'Condominio Rústico Capulí',
    title: 'Borrador de minuta para revisión',
    sections: [{ properties: { page: { margin: { top: 1100, right: 1000, bottom: 1600, left: 1000 } } }, footers: { default: footer }, children }],
  });
  return Packer.toBlob(doc);
}

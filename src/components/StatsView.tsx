import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';
import { getClientDisplayDnis, getClientDisplayName } from '@/types/client';

  const fetchImageAsDataURL = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

interface StatsViewProps {
  showReport?: boolean;
}

interface RegistroDetalle {
  fecha: string;
  nombre: string;
  dni: string;
  manzana: string;
  lote: string;
  formaPago: string;
  montoTotal: number;
  inicial: number;
}

export default function StatsView({ showReport = false }: StatsViewProps) {
  const { clients, parseLocalDate, formatLocalISO } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const shouldReduceMotion = useReducedMotion();

  const getMonthStats = (month: number, year: number) => {
    const today = new Date();
    let totalCuotas = 0;
    let cuotasAdelantadas = 0;
    let montoAdelantadas = 0;
    let cuotasPagadas = 0;
    let montoPagadas = 0;
    let cuotasPendientes = 0;
    let montoPendientes = 0;
    let montoProyectado = 0;
    let montoIngresado = 0;

    clients.forEach(client => {
      // Solo procesar clientes que NO sean de contado para estadísticas
      if (client.formaPago !== 'contado' && client.cuotas) {
        client.cuotas.forEach(cuota => {
          // Solo contar cuotas regulares (número > 0), no la inicial
          if (cuota.numero > 0) {
            const vencimiento = new Date(cuota.vencimiento);
            
            // Cuotas del mes seleccionado
            if (vencimiento.getMonth() === month && vencimiento.getFullYear() === year) {
              totalCuotas++;
              montoProyectado += cuota.monto;
              
              if (cuota.estado === 'pagado') {
                cuotasPagadas++;
                montoPagadas += cuota.monto;
                montoIngresado += cuota.monto;
              } else {
                cuotasPendientes++;
                montoPendientes += cuota.monto;
              }
            }
            
            // Cuotas adelantadas (pagadas este mes pero vencen después)
            if (cuota.fechaPago) {
              const fechaPago = new Date(cuota.fechaPago);
              if (fechaPago.getMonth() === month && fechaPago.getFullYear() === year && vencimiento > fechaPago) {
                cuotasAdelantadas++;
                montoAdelantadas += cuota.monto;
                montoIngresado += cuota.monto;
              }
            }
          }
        });
      }
    });

    const porcentajePagadas = totalCuotas > 0 ? (cuotasPagadas / totalCuotas) * 100 : 0;
    const porcentajePendientes = totalCuotas > 0 ? (cuotasPendientes / totalCuotas) * 100 : 0;
    const porcentajeIngresado = montoProyectado > 0 ? (montoIngresado / montoProyectado) * 100 : 0;

    return {
      totalCuotas,
      cuotasAdelantadas,
      montoAdelantadas,
      cuotasPagadas,
      montoPagadas,
      porcentajePagadas,
      cuotasPendientes,
      montoPendientes,
      porcentajePendientes,
      montoProyectado,
      montoIngresado,
      porcentajeIngresado
    };
  };

  const getMonthReport = (month: number, year: number) => {
    let totalClientes = 0;
    let clientesConCuotas = 0;
    let clientesAlContado = 0;
    let totalIngresos = 0;
    let ingresosPorIniciales = 0;
    let ingresosPorContado = 0;
    const detalleRegistros: RegistroDetalle[] = [];

    clients.forEach(client => {
      // Determine the effective entry date for the client.
      // Use the vencimiento of the initial cuota (numero === 0) if present — the report should be grouped by that vencimiento.
  const initialCuota = client.cuotas ? client.cuotas.find(c => c.numero === 0) : undefined;
  const entryDate = (initialCuota && initialCuota.vencimiento) ? parseLocalDate(initialCuota.vencimiento) : parseLocalDate(client.fechaRegistro);

      if (entryDate.getMonth() === month && entryDate.getFullYear() === year) {
        totalClientes++;

        if (client.formaPago === 'cuotas') {
          clientesConCuotas++;
          // Count ingresos por iniciales based on the initial cuota amount or client.inicial (grouped by vencimiento)
          if (initialCuota) {
            const inicialAmount = typeof initialCuota.monto === 'number' ? initialCuota.monto : (client.inicial || 0);
            ingresosPorIniciales += inicialAmount;
            totalIngresos += inicialAmount;
          } else if (client.inicial) {
            ingresosPorIniciales += client.inicial;
            totalIngresos += client.inicial;
          }
        } else {
          clientesAlContado++;
          // For contado clients, attribute an ingreso based on client.montoTotal (full price). If montoTotal missing, fallback to inicial.
          const contadoAmount = Number(client.montoTotal ?? client.inicial ?? 0);
          ingresosPorContado += contadoAmount;
          totalIngresos += contadoAmount;
        }

        // Ensure montoTotal/inicial are numeric for display
        const montoTotalNumeric = Number(client.montoTotal ?? client.inicial ?? 0);
        const inicialNumeric = Number((initialCuota && typeof initialCuota.monto === 'number') ? initialCuota.monto : (client.inicial || 0));

        detalleRegistros.push({
          // Use the initial vencimiento if present as the "fecha" shown in the report; otherwise fallback to fechaRegistro
          fecha: (initialCuota && initialCuota.vencimiento) ? formatLocalISO(initialCuota.vencimiento) : formatLocalISO(client.fechaRegistro),
          nombre: getClientDisplayName(client),
          dni: getClientDisplayDnis(client),
          manzana: client.manzana,
          lote: client.lote,
          formaPago: client.formaPago,
          montoTotal: montoTotalNumeric,
          inicial: inicialNumeric
        });
      }
    });

    return {
      totalClientes,
      clientesConCuotas,
      clientesAlContado,
      totalIngresos,
      ingresosPorIniciales,
      ingresosPorContado,
      detalleRegistros
    };
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Try to fetch and embed the logo across the top (edge-to-edge within margins)
    let titleY = 20;
    try {
      const logoData = await fetchImageAsDataURL('/logo.jpeg');
      if (logoData) {
        try {
          const imgProps = (doc as any).getImageProperties(logoData);
          const imgW = pageWidth - 20; // 10mm margin each side
          const imgH = (imgProps.height * imgW) / imgProps.width;
          doc.addImage(logoData, 'JPEG', 10, 6, imgW, imgH);
          titleY = 6 + imgH + 8;
        } catch (err) {
          console.error('Error adding logo to stats PDF:', err);
        }
      }
    } catch (err) {
      console.error('Logo fetch error', err);
    }

    try {
      if (showReport) {
        const report = getMonthReport(selectedMonth, selectedYear);

        // Encabezado
        doc.setFontSize(20);
        doc.text('REPORTE MENSUAL', pageWidth / 2, titleY, { align: 'center' });

        doc.setFontSize(14);
        doc.text(`${monthNames[selectedMonth]} ${selectedYear}`, pageWidth / 2, titleY + 15, { align: 'center' });

        // Resumen (incluye ingresos por iniciales y por contado)
        const summaryRows = [
          ['Total Clientes', report.totalClientes.toString()],
          ['Con Cuotas', report.clientesConCuotas.toString()],
          ['Al Contado', report.clientesAlContado.toString()],
          ['Total Ingresos', `S/ ${report.totalIngresos.toFixed(2)}`],
          ['Ingresos por Iniciales', `S/ ${report.ingresosPorIniciales.toFixed(2)}`],
          ['Ingresos por Contado', `S/ ${report.ingresosPorContado.toFixed(2)}`]
        ];

        const anyDoc = doc as jsPDF & { autoTable?: (options: any) => any };
        let afterSummaryY = titleY + 30;

        if (typeof anyDoc.autoTable === 'function') {
          anyDoc.autoTable({
            startY: titleY + 30,
            head: [['Concepto', 'Valor']],
            body: summaryRows,
            theme: 'plain',
            styles: { fontSize: 10 },
            columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } }
          });
          afterSummaryY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : titleY + 60;
        } else {
          // fallback: draw as text lines
          let y = titleY + 30;
          doc.setFontSize(10);
          summaryRows.forEach(([k, v]) => {
            doc.text(`${k}: ${v}`, 20, y);
            y += 8;
          });
          afterSummaryY = y + 6;
        }

        // Tabla de registros (detalle)
        if (report.detalleRegistros.length > 0) {
          // Build a robust tableData ensuring numeric fields are always strings
          // Helper to format date as dd/mm/yyyy using local parsing to avoid timezone shifts
          const formatDate = (iso: string) => {
            try {
              const d = parseLocalDate(iso);
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              return `${day}/${month}/${year}`;
            } catch (e) {
              return iso;
            }
          };

          const tableData = report.detalleRegistros.map((registro) => {
            const montoVal = Number((registro as any).montoTotal ?? (registro as any).monto ?? 0);
            const inicialVal = Number((registro as any).inicial ?? 0);
            return [
              formatDate(registro.fecha),
              String(registro.nombre ?? ''),
              String(registro.dni ?? ''),
              String(registro.manzana ?? ''),
              String(registro.lote ?? ''),
              String(registro.formaPago ?? ''),
              `S/ ${montoVal.toFixed(2)}`,
              `S/ ${inicialVal.toFixed(2)}`
            ];
          });

          // Debug: print tableData and report to console with full content for diagnosis
          // eslint-disable-next-line no-console
          console.log('Reporte - tableData sample (detailed):\n' + JSON.stringify(tableData.slice(0,5), null, 2));
          // eslint-disable-next-line no-console
          console.log('Reporte full object sample registros (detailed):\n' + JSON.stringify(report.detalleRegistros.slice(0,5), null, 2));

          // Force manual table drawing to guarantee every cell is rendered exactly
          const forceManualTable = true;

          if (!forceManualTable && typeof anyDoc.autoTable === 'function') {
            anyDoc.autoTable({
              startY: afterSummaryY,
              head: [['Fecha', 'Nombre', 'DNI', 'Manzana', 'Lote', 'Forma\nPago', 'Monto\nTotal', 'Inicial']],
              body: tableData,
              theme: 'grid',
              styles: { fontSize: 8 },
              columnStyles: { 6: { halign: 'right' }, 7: { halign: 'right' } }
            });
          } else {
            // fallback: draw a proper table with blue header and borders
            const pageW = pageWidth;
            const pageH = doc.internal.pageSize.getHeight();
            const margin = 10;
            const contentW = pageW - margin * 2;
            const startX = margin;
            let y = afterSummaryY;
            const baseRowH = 8; // minimal row height

            // Column widths adjusted: Fecha 12%, Nombre 30%, DNI 10%, Manzana 8%, Lote 6%, Forma Pago 12%, Monto 11%, Inicial 11%
            // This reduces 'Lote' to give more room for Monto/Inicial so numbers don't wrap or disappear.
            const colWidths = [contentW * 0.12, contentW * 0.30, contentW * 0.10, contentW * 0.08, contentW * 0.06, contentW * 0.12, contentW * 0.11, contentW * 0.11];
            const tableW = colWidths.reduce((s, w) => s + w, 0);

            const drawHeader = () => {
              // header background
              const headerH = Math.max(baseRowH, 12);
              doc.setFillColor(14, 165, 233);
              doc.rect(startX, y, tableW, headerH, 'F');
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(9);
              // single-line headers
              doc.text('Fecha', startX + 3, y + 8);
              doc.text('Nombre', startX + colWidths[0] + 3, y + 8);
              doc.text('DNI', startX + colWidths[0] + colWidths[1] + 3, y + 8);
              doc.text('Manzana', startX + colWidths[0] + colWidths[1] + colWidths[2] + 3, y + 8);
              doc.text('Lote', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 3, y + 8);
              // two-line headers: Forma / Pago
              const formaX = startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 3;
              doc.text('Forma', formaX, y + 5);
              doc.text('Pago', formaX, y + headerH - 3);
              // two-line headers: Monto / Total
              const montoX = startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + 3;
              doc.text('Monto', montoX, y + 5);
              doc.text('Total', montoX, y + headerH - 3);
              // Inicial
              doc.text('Inicial', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + 3, y + 8);
              // header border
              doc.setDrawColor(0, 0, 0);
              doc.rect(startX, y, tableW, headerH, 'S');
              y += headerH;
              doc.setTextColor(0, 0, 0);
            };

            const drawRow = (row: string[]) => {
              // We will ensure numeric columns (indices 6 and 7) fit on one line and apply that font to entire row
              const maxAllowedLines = 3;
              const baseFont = 9;
              const minFont = 6;

              // Determine minimal font required so numeric cells fit in one line
              let numericMin = baseFont;
              for (const i of [6, 7]) {
                const text = row[i] ?? '';
                let candidate = baseFont;
                (doc as any).setFontSize(candidate);
                while (candidate > minFont && (doc as any).getTextWidth(String(text)) > (colWidths[i] - 6)) {
                  candidate -= 1;
                  (doc as any).setFontSize(candidate);
                }
                if (candidate < numericMin) numericMin = candidate;
              }

              // Start with numericMin for entire row to keep consistency
              let rowFont = numericMin;
              (doc as any).setFontSize(rowFont);

              // compute wrapped lines for each cell with current rowFont
              const cellLines: string[][] = [];
              let maxLines = 1;
              for (let i = 0; i < colWidths.length; i++) {
                const wrapWidth = colWidths[i] - 6;
                (doc as any).setFontSize(rowFont);
                const lines = (doc as any).splitTextToSize(String(row[i] ?? ''), wrapWidth);
                cellLines.push(lines);
                if (lines.length > maxLines) maxLines = lines.length;
              }

              // If too many lines, reduce font (up to minFont)
              while (maxLines > maxAllowedLines && rowFont > minFont) {
                rowFont -= 1;
                (doc as any).setFontSize(rowFont);
                maxLines = 1;
                for (let i = 0; i < colWidths.length; i++) {
                  const wrapWidth = colWidths[i] - 6;
                  const lines = (doc as any).splitTextToSize(String(row[i] ?? ''), wrapWidth);
                  cellLines[i] = lines;
                  if (lines.length > maxLines) maxLines = lines.length;
                }
              }

              const lineHeight = rowFont + 2;
              const rowHeight = Math.max(baseRowH, maxLines * lineHeight + 6);

              // page break if needed
              if (y + rowHeight > pageH - margin) {
                doc.addPage();
                y = margin;
                drawHeader();
              }

              let x = startX;
              for (let i = 0; i < colWidths.length; i++) {
                doc.rect(x, y, colWidths[i], rowHeight, 'S');
                const lines = cellLines[i] || [''];
                const textBlockH = lines.length * lineHeight;
                const textStartY = y + (rowHeight - textBlockH) / 2 + (rowFont - 1);

                (doc as any).setTextColor(0, 0, 0);
                (doc as any).setFontSize(rowFont);
                  if (i === 6 || i === 7) {
                    // right align numeric single-line values, ensure they fit and cap position
                    // Use the explicit numeric text from the original row to avoid split/wrap issues
                    const numericText = (row[i] ?? '').toString() || `S/ 0.00`;
                    // Force a known font family/style and size for numeric columns to guarantee rendering
                    try {
                      (doc as any).setFont('helvetica', 'normal');
                    } catch (e) {
                      // setFont may not be available in some builds; ignore errors
                    }
                    const numericFont = Math.max(rowFont, 7);
                    (doc as any).setFontSize(numericFont);
                    (doc as any).setTextColor(0, 0, 0);
                    const textW = (doc as any).getTextWidth(numericText);
                    let tx = x + colWidths[i] - 3 - textW;
                    if (tx < x + 3) tx = x + 3;
                    // Draw numeric text explicitly
                    doc.text(numericText, tx, textStartY);
                  } else {
                  (doc as any).setTextColor(0, 0, 0);
                  for (let li = 0; li < lines.length; li++) {
                    doc.text(lines[li], x + 3, textStartY + li * lineHeight);
                  }
                }

                x += colWidths[i];
              }
              y += rowHeight;
            };

            // draw header then rows (use tableData we constructed to ensure consistency)
            drawHeader();
            tableData.forEach(row => drawRow(row));
          }
        } else {
          // no registros
          doc.setFontSize(12);
          doc.text('No hay registros para el mes seleccionado.', 20, afterSummaryY + 6);
        }
      } else {
        const stats = getMonthStats(selectedMonth, selectedYear);

        // Encabezado
        doc.setFontSize(20);
        doc.text('ESTADÍSTICAS DE PAGOS', pageWidth / 2, titleY, { align: 'center' });

        doc.setFontSize(14);
        doc.text(`${monthNames[selectedMonth]} ${selectedYear}`, pageWidth / 2, titleY + 15, { align: 'center' });

        // Estadísticas: render as boxed cards (3 columns) to match UI layout
        const margin = 12;
        const gap = 8;
        const cols = 3;
        const cardW = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
        const cardH = 56;
        const cardY = titleY +  thirtyFive();

        // helper to keep spacing consistent
        function thirtyFive() {
          return 35;
        }

        const cards: Array<{ title: string; value: string; subtitle?: string } > = [
          { title: 'Total Clientes', value: String(report.totalClientes) },
          { title: 'Con Cuotas', value: String(report.clientesConCuotas) },
          { title: 'Al Contado', value: String(report.clientesAlContado) },
          { title: 'Total Ingresos', value: `S/ ${report.totalIngresos.toFixed(2)}` },
          { title: 'Ingresos por Iniciales', value: `S/ ${report.ingresosPorIniciales.toFixed(2)}` },
          { title: 'Ingresos por Contado', value: `S/ ${report.ingresosPorContado.toFixed(2)}` }
        ];

        // Draw rows of cards
        doc.setFont('helvetica', 'normal');
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = margin + col * (cardW + gap);
          const y = cardY + row * (cardH + gap);

          // Card background
          doc.setFillColor(250, 250, 250);
          doc.rect(x, y, cardW, cardH, 'F');

          // Value (big)
          doc.setFontSize(16);
          doc.setTextColor(23, 23, 23);
          // center-left align value near top-left with padding
          doc.text(c.value, x + 8, y + 20);

          // Title (small)
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(c.title, x + 8, y + 36);

          // Card border
          doc.setDrawColor(220, 220, 220);
          doc.rect(x, y, cardW, cardH, 'S');
        }
      }
    } catch (err) {
      console.error('Stats export error', err);
      toast.error('Ocurrió un error al generar el PDF. Revisa la consola.');
    } finally {
      try {
        doc.save(`${showReport ? 'reporte' : 'estadisticas'}_${monthNames[selectedMonth]}_${selectedYear}.pdf`);
        toast.success('PDF descargado exitosamente');
      } catch (err) {
        console.error('Error saving stats PDF', err);
        toast.error('No se pudo descargar el PDF. Revisa la consola.');
      }
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const stats = getMonthStats(selectedMonth, selectedYear);
  const report = getMonthReport(selectedMonth, selectedYear);
  const paymentStatusData = [
    { name: 'Pagadas', value: stats.cuotasPagadas, color: '#5c3585' },
    { name: 'Pendientes', value: stats.cuotasPendientes, color: '#ff9e32' },
  ];
  const monthlyTrendData = Array.from({ length: 12 }, (_, index) => {
    const period = new Date(selectedYear, selectedMonth - 11 + index, 1);
    const periodStats = getMonthStats(period.getMonth(), period.getFullYear());

    return {
      period: `${monthNames[period.getMonth()].slice(0, 3)} ${String(period.getFullYear()).slice(-2)}`,
      proyectado: Number(periodStats.montoProyectado.toFixed(2)),
      ingresado: Number(periodStats.montoIngresado.toFixed(2)),
    };
  });
  const formatCompactCurrency = (value: number) => new Intl.NumberFormat('es-PE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
  const formatCurrency = (value: number) => `S/ ${new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

  if (showReport) {
    return (
      <div className="space-y-6 w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Reporte Mensual</span>
              <Button onClick={exportToPDF} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">Seleccionar mes:</span>
              <Select value={`${selectedMonth}`} onValueChange={(value) => {
                setSelectedMonth(parseInt(value));
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((monthName, index) => (
                    <SelectItem key={index} value={`${index}`}>
                      {monthName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={`${selectedYear}`} onValueChange={(value) => {
                setSelectedYear(parseInt(value));
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                    <SelectItem key={year} value={`${year}`}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">
                Resumen de {monthNames[selectedMonth]} {selectedYear}
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{report.totalClientes}</div>
                    <p className="text-sm text-gray-600">Total Clientes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{report.clientesConCuotas}</div>
                    <p className="text-sm text-gray-600">Con Cuotas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{report.clientesAlContado}</div>
                    <p className="text-sm text-gray-600">Al Contado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">S/ {report.totalIngresos.toFixed(2)}</div>
                    <p className="text-sm text-gray-600">Total Ingresos</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xl font-bold">S/ {report.ingresosPorIniciales.toFixed(2)}</div>
                    <p className="text-sm text-gray-600">Ingresos por Iniciales</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xl font-bold">S/ {report.ingresosPorContado.toFixed(2)}</div>
                    <p className="text-sm text-gray-600">Ingresos por Contado</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Detalle de Registros</h3>
              <div className="w-full overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>DNI</TableHead>
                      <TableHead>Manzana</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Forma Pago</TableHead>
                      <TableHead>Monto Total</TableHead>
                      <TableHead>Inicial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.detalleRegistros.map((registro, index) => {
                      const d = (() => {
                        try {
                          const dt = parseLocalDate(registro.fecha);
                          const day = String(dt.getDate()).padStart(2, '0');
                          const month = String(dt.getMonth() + 1).padStart(2, '0');
                          const year = dt.getFullYear();
                          return `${day}/${month}/${year}`;
                        } catch (e) {
                          return registro.fecha;
                        }
                      })();
                      return (
                        <TableRow key={index}>
                          <TableCell>{d}</TableCell>
                          <TableCell>{registro.nombre}</TableCell>
                          <TableCell>{registro.dni}</TableCell>
                          <TableCell>{registro.manzana}</TableCell>
                          <TableCell>{registro.lote}</TableCell>
                          <TableCell>
                            <Badge variant={registro.formaPago === 'contado' ? 'default' : 'secondary'}>
                              {registro.formaPago}
                            </Badge>
                          </TableCell>
                          <TableCell>S/ {registro.montoTotal.toFixed(2)}</TableCell>
                          <TableCell>S/ {registro.inicial.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Estadísticas de Pagos</span>
            <Button onClick={exportToPDF} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Estadísticas de</span>
            <Select value={`${selectedMonth}`} onValueChange={(value) => {
              setSelectedMonth(parseInt(value));
            }}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((monthName, index) => (
                  <SelectItem key={index} value={`${index}`}>
                    {monthName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={`${selectedYear}`} onValueChange={(value) => {
              setSelectedYear(parseInt(value));
            }}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                  <SelectItem key={year} value={`${year}`}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reordenado según el pedido: Total de Cuotas, Cuotas Pagadas, Cuotas Pendientes, Cuotas adelantadas, Monto Proyectado y Monto Ingresado */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold">{stats.totalCuotas}</div>
                <p className="text-sm text-gray-600">Total de Cuotas</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xl font-bold">
                  {stats.cuotasPagadas} ({stats.porcentajePagadas.toFixed(1)}%)
                </div>
                <div className="text-lg">S/ {stats.montoPagadas.toFixed(2)}</div>
                <p className="text-sm text-gray-600">Cuotas Pagadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xl font-bold">
                  {stats.cuotasPendientes} ({stats.porcentajePendientes.toFixed(1)}%)
                </div>
                <div className="text-lg">S/ {stats.montoPendientes.toFixed(2)}</div>
                <p className="text-sm text-gray-600">Cuotas Pendientes</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xl font-bold">{stats.cuotasAdelantadas}</div>
                <div className="text-lg">S/ {stats.montoAdelantadas.toFixed(2)}</div>
                <p className="text-sm text-gray-600">Cuotas Adelantadas</p>
                <p className="text-xs text-gray-500">Pagadas este mes, vencen después</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xl font-bold">S/ {stats.montoProyectado.toFixed(2)}</div>
                <p className="text-sm text-gray-600">Monto Proyectado</p>
                <p className="text-xs text-gray-500">Lo que se esperaba recibir este mes</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-xl font-bold">
                  S/ {stats.montoIngresado.toFixed(2)} ({stats.porcentajeIngresado.toFixed(0)}% del proyectado)
                </div>
                <p className="text-sm text-gray-600">Monto Ingresado</p>
                <p className="text-xs text-gray-500">Incluye cuotas del mes + adelantadas</p>
              </CardContent>
            </Card>
          </div>

          <section aria-label="Gráficos de estadísticas" className="grid min-w-0 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="vh-panel-enter min-w-0 overflow-hidden border-[#d9ddd9] bg-[#fffefb] shadow-sm">
              <CardHeader className="border-b border-[#e9ebe7] pb-4">
                <CardTitle className="text-lg text-[#33204f]">Ingresos de los últimos 12 meses</CardTitle>
                <CardDescription>Montos proyectados e ingresados, expresados en soles.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div
                  className="h-[320px] w-full min-w-0"
                  role="img"
                  aria-label={`Tendencia de montos proyectados e ingresados durante los 12 meses hasta ${monthNames[selectedMonth]} de ${selectedYear}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrendData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid stroke="#d9ddd9" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="period" tick={{ fill: '#697386', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#bfc5bf' }} />
                      <YAxis
                        tick={{ fill: '#697386', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatCompactCurrency(Number(value))}
                      />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(Number(value)), name === 'proyectado' ? 'Proyectado' : 'Ingresado']}
                        contentStyle={{ borderRadius: 12, borderColor: '#d9ddd9', background: '#fffefb', boxShadow: '0 12px 30px rgba(21,40,77,.12)' }}
                        labelStyle={{ color: '#33204f', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ color: '#5f6878', fontSize: 12, paddingTop: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="proyectado"
                        name="Proyectado"
                        stroke="#33204f"
                        strokeWidth={2.5}
                        strokeDasharray="6 5"
                        dot={{ r: 3, fill: '#fffefb', strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={800}
                      />
                      <Line
                        type="monotone"
                        dataKey="ingresado"
                        name="Ingresado"
                        stroke="#5c3585"
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#5c3585', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={900}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="vh-panel-enter min-w-0 overflow-hidden border-[#d9ddd9] bg-[#fffefb] shadow-sm" style={{ animationDelay: '90ms' }}>
              <CardHeader className="border-b border-[#e9ebe7] pb-4">
                <CardTitle className="text-lg text-[#33204f]">Estado de las cuotas</CardTitle>
                <CardDescription>{monthNames[selectedMonth]} {selectedYear} · cantidad de cuotas.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div
                  className="h-[320px] w-full min-w-0"
                  role="img"
                  aria-label={`${stats.cuotasPagadas} cuotas pagadas y ${stats.cuotasPendientes} cuotas pendientes en ${monthNames[selectedMonth]} de ${selectedYear}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentStatusData} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="#d9ddd9" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#5f6878', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#bfc5bf' }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#697386', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value) => [`${Number(value)} cuotas`, 'Cantidad']}
                        contentStyle={{ borderRadius: 12, borderColor: '#d9ddd9', background: '#fffefb', boxShadow: '0 12px 30px rgba(21,40,77,.12)' }}
                        cursor={{ fill: '#f2f1ec' }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[10, 10, 3, 3]}
                        isAnimationActive={!shouldReduceMotion}
                        animationDuration={750}
                      >
                        {paymentStatusData.map(item => <Cell key={item.name} fill={item.color} />)}
                        <LabelList dataKey="value" position="top" fill="#33204f" fontSize={12} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

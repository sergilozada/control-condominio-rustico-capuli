import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Titular } from '@/types/client';
import { getClientDisplayDnis, getClientDisplayName } from '@/types/client';
import { applyPdfBrand, loadPdfLogo, PDF_COLORS, PDF_CONTENT_BOTTOM, PDF_CONTENT_TOP, pdfGeneratedAt } from '@/utils/pdfBrand';

type JsPDFWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
  internal: {
    getNumberOfPages?: () => number;
    pageSize: {
      getHeight(): number;
      getWidth(): number;
    };
  };
};

interface Client {
  id: string;
  titulares?: Titular[];
  nombre1: string;
  nombre2?: string;
  dni1: string;
  dni2?: string;
  celular1?: string;
  celular2?: string;
  email1?: string;
  email2?: string;
  manzana: string;
  lote: string;
  metraje: number;
  montoTotal: number;
  formaPago: 'contado' | 'cuotas';
  inicial?: number;
  numeroCuotas?: number;
  fechaRegistro: string;
  cuotas?: Cuota[];
}

interface Cuota {
  numero: number;
  vencimiento: string;
  monto: number;
  mora?: number;
  total?: number;
  manualMora?: boolean;
  fechaPago?: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  voucher?: string | string[] | { url: string; name?: string; path?: string } | Array<{ url: string; name?: string; path?: string }>;
  boleta?: string | string[] | { url: string; name?: string; path?: string } | Array<{ url: string; name?: string; path?: string }>;
}

interface DelinquentClient {
  client: Client;
  overdueCuotasCount: number;
  overdueCuotas: Cuota[];
  totalOverdueAmount: number;
}

export default function DelinquentClientsReport() {
  const { clients, parseLocalDate } = useAuth();
  const [overdueCountFilter, setOverdueCountFilter] = useState<'all' | '1' | '2' | '3' | '4+'>('all');

  const getFilterLabel = () => {
    switch (overdueCountFilter) {
      case '1':
        return 'Solo 1 cuota atrasada';
      case '2':
        return 'Solo 2 cuotas atrasadas';
      case '3':
        return 'Solo 3 cuotas atrasadas';
      case '4+':
        return '4 o más cuotas atrasadas';
      default:
        return 'Todas (1+ cuotas atrasadas)';
    }
  };

  // Calcular clientes deudores
  const getDelinquentClients = (): DelinquentClient[] => {
    if (!clients || clients.length === 0) return [];
    
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return clients
      .map((client) => {
        // Filtrar cuotas atrasadas (pendientes/vencidas y con vencimiento menor a hoy)
        const overdueCuotas = (client.cuotas || []).filter((cuota) => {
          if (cuota.numero <= 0) return false; // Excluir iniciales
          if (cuota.estado === 'pagado') return false; // Excluir pagadas

          try {
            const vencDate = parseLocalDate(cuota.vencimiento);
            const vencMid = new Date(vencDate.getFullYear(), vencDate.getMonth(), vencDate.getDate());
            return vencMid.getTime() < todayMid.getTime(); // Vencidas antes de hoy
          } catch {
            return false;
          }
        });

        return {
          client,
          overdueCuotasCount: overdueCuotas.length,
          overdueCuotas,
          totalOverdueAmount: overdueCuotas.reduce((sum, cuota) => sum + (cuota.total || cuota.monto), 0),
        };
      })
      .filter((item) => item.overdueCuotasCount > 0)
      .filter((item) => {
        if (overdueCountFilter === 'all') return true;
        if (overdueCountFilter === '4+') return item.overdueCuotasCount >= 4;
        return item.overdueCuotasCount === parseInt(overdueCountFilter, 10);
      })
      .sort((a, b) => b.overdueCuotasCount - a.overdueCuotasCount); // Ordenar por cantidad descendente
  };

  const handleDownloadReport = async () => {
    try {
      const delinquent = getDelinquentClients();

      if (delinquent.length === 0) {
        toast.error('No hay clientes deudores de 2 o más cuotas para descargar.');
        return;
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'A4',
      }) as JsPDFWithAutoTable;
      const logo = await loadPdfLogo();

      // Tabla con datos
      const tableData = delinquent.map((item) => [
        getClientDisplayName(item.client),
        getClientDisplayDnis(item.client),
        item.client.celular1 || '-',
        item.client.email1 || '-',
        item.client.manzana,
        item.client.lote,
        item.overdueCuotasCount.toString(),
        `S/ ${item.totalOverdueAmount.toFixed(2)}`,
      ]);

      const totalOverdueSum = delinquent.reduce((sum, item) => sum + item.totalOverdueAmount, 0);

      autoTable(pdf, {
        head: [['Cliente', 'DNI', 'Celular', 'Email', 'Manzana', 'Lote', 'Cuotas Atrasadas', 'Monto Total']],
        body: tableData,
        startY: PDF_CONTENT_TOP,
        headStyles: {
          fillColor: PDF_COLORS.green,
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 11,
        },
        bodyStyles: {
          textColor: PDF_COLORS.ink,
          halign: 'left',
          fontSize: 10,
        },
        columnStyles: {
          0: { cellWidth: 45, halign: 'left' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 40, halign: 'left' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 15, halign: 'center' },
          6: { halign: 'center', cellWidth: 25 },
          7: { halign: 'right', cellWidth: 35 },
        },
        alternateRowStyles: { fillColor: PDF_COLORS.cream },
        styles: { lineColor: PDF_COLORS.line, lineWidth: 0.1 },
        margin: { top: PDF_CONTENT_TOP, right: 10, bottom: PDF_CONTENT_BOTTOM, left: 10 },
      });

      let finalY = pdf.lastAutoTable?.finalY || PDF_CONTENT_TOP;
      if (finalY > pdf.internal.pageSize.getHeight() - 32) {
        pdf.addPage();
        finalY = PDF_CONTENT_TOP;
      }
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...PDF_COLORS.green);
      pdf.text(`Clientes deudores: ${delinquent.length} · Total general: S/ ${totalOverdueSum.toFixed(2)}`, 14, finalY + 10);

      applyPdfBrand(pdf, {
        title: 'Reporte de clientes deudores',
        subtitle: `${getFilterLabel()} · ${pdfGeneratedAt()}`,
        logo,
        footerLabel: 'Seguimiento de cartera vencida',
      });

      pdf.save('reporte_clientes_deudores.pdf');
      toast.success('Reporte descargado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el reporte. Intenta de nuevo.');
    }
  };

  const delinquent = getDelinquentClients();

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Clientes Deudores</CardTitle>
          <p className="text-sm text-slate-500">{getFilterLabel()}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
            <Label className="text-sm font-medium text-slate-600">Filtrar por cuotas atrasadas:</Label>
            <Select value={overdueCountFilter} onValueChange={(value) => setOverdueCountFilter(value as 'all' | '1' | '2' | '3' | '4+')}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas (1+ cuotas)</SelectItem>
                <SelectItem value="1">Solo 1 cuota</SelectItem>
                <SelectItem value="2">Solo 2 cuotas</SelectItem>
                <SelectItem value="3">Solo 3 cuotas</SelectItem>
                <SelectItem value="4+">4 o más cuotas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleDownloadReport} className="gap-2" disabled={delinquent.length === 0}>
            <Download className="w-4 h-4" />
            Descargar Reporte
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {delinquent.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No hay clientes con 2 o más cuotas atrasadas.</p>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex justify-between items-center">
              <p className="text-sm text-yellow-800">
                Total de clientes deudores: <span className="font-semibold">{delinquent.length}</span>
              </p>
              <p className="text-sm text-yellow-800">
                Total de deuda: <span className="font-semibold">S/ {delinquent.reduce((sum, item) => sum + item.totalOverdueAmount, 0).toFixed(2)}</span>
              </p>
            </div>
            <div className="w-full overflow-x-auto">
              <Table className="vh-spaced-table vh-debt-table w-full min-w-[1050px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Manzana</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Celular</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Cuotas Atrasadas</TableHead>
                    <TableHead className="text-right">Monto Total Atrasado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delinquent.map((item) => (
                    <TableRow key={item.client.id}>
                      <TableCell className="font-medium">
                        {getClientDisplayName(item.client)}
                      </TableCell>
                      <TableCell>{getClientDisplayDnis(item.client)}</TableCell>
                      <TableCell>{item.client.manzana}</TableCell>
                      <TableCell>{item.client.lote}</TableCell>
                      <TableCell>{item.client.celular1 || '-'}</TableCell>
                      <TableCell>{item.client.email1 || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">{item.overdueCuotasCount}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        S/ {item.totalOverdueAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


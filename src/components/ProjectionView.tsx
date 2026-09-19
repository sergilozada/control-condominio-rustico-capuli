import { useState } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { downloadProjectionPdf, type ProjectionRow } from '@/features/projection/projectionPdf';

export default function ProjectionView() {
  const { clients } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [rangeStart, setRangeStart] = useState<Date>(new Date());
  const [rangeEnd, setRangeEnd] = useState<Date>(new Date());
  const [showMonthlyProjections, setShowMonthlyProjections] = useState(false);
  const localDate = (iso: string) => {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const getMonthProjection = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    let totalCuotas = 0;
    let totalProyectado = 0;
    
    clients.forEach(client => {
      if (client.cuotas) {
        client.cuotas.forEach(cuota => {
          // Excluir iniciales (número 0) de la proyección
          if (cuota.numero > 0) {
            const vencimiento = localDate(cuota.vencimiento);
            if (vencimiento.getMonth() === month && vencimiento.getFullYear() === year) {
              totalCuotas++;
              totalProyectado += cuota.monto;
            }
          }
        });
      }
    });
    
    return { totalCuotas, totalProyectado };
  };

  // Devuelve un arreglo con desglose por mes entre startDate y endDate (inclusive)
  const getRangeProjection = (startDate: Date, endDate: Date) => {
    const rows: { year: number; month: number; monthKey: string; monthLabel: string; totalCuotas: number; totalProyectado: number }[] = [];

    // Normalizar a primer día del mes para start y último día para end
    const s = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    for (let d = new Date(s); d <= e; d.setMonth(d.getMonth() + 1)) {
      const year = d.getFullYear();
      const month = d.getMonth();
      let totalCuotas = 0;
      let totalProyectado = 0;

      clients.forEach(client => {
        client.cuotas?.forEach(cuota => {
          if (cuota.numero > 0) {
            const vencimiento = localDate(cuota.vencimiento);
            if (vencimiento.getFullYear() === year && vencimiento.getMonth() === month) {
              totalCuotas++;
              totalProyectado += cuota.monto;
            }
          }
        });
      });

      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = format(new Date(year, month, 1), 'MMMM yyyy', { locale: es });
      rows.push({ year, month, monthKey, monthLabel, totalCuotas, totalProyectado });
    }

    return rows;
  };

  const getMonthlyProjections = () => {
    const projections = [];
    const currentDate = new Date();
    
    // Empezar desde el próximo mes
    for (let i = 1; i <= 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const projection = getMonthProjection(date);
      projections.push({
        month: format(date, 'MMMM yyyy', { locale: es }),
        ...projection
      });
    }
    
    return projections;
  };

  const exportToPDF = async (type: 'month' | 'range' | 'monthly') => {
    try {
      let subtitle: string;
      let rows: ProjectionRow[];
      if (type === 'month') {
        const projection = getMonthProjection(selectedDate);
        subtitle = format(selectedDate, 'MMMM yyyy', { locale: es });
        rows = [{ month: subtitle, installments: projection.totalCuotas, amount: projection.totalProyectado }];
      } else if (type === 'range') {
        if (new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1) >
          new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)) {
          toast.error('La fecha inicial debe ser anterior a la final.');
          return;
        }
        subtitle = `${format(rangeStart, 'MMMM yyyy', { locale: es })} - ${format(rangeEnd, 'MMMM yyyy', { locale: es })}`;
        rows = getRangeProjection(rangeStart, rangeEnd).map(item => ({
          month: item.monthLabel, installments: item.totalCuotas, amount: item.totalProyectado,
        }));
      } else {
        subtitle = 'Próximos 12 meses';
        rows = getMonthlyProjections().map(item => ({
          month: item.month, installments: item.totalCuotas, amount: item.totalProyectado,
        }));
      }
      await downloadProjectionPdf(type, subtitle, rows);
      toast.success('PDF descargado exitosamente');
    } catch (error) {
      console.error('No se pudo generar la proyección:', error);
      toast.error('No se pudo generar el PDF con el logo.');
    }
  };
  const monthProjection = getMonthProjection(selectedDate);
  const rangeProjection = getRangeProjection(rangeStart, rangeEnd);
  const monthlyProjections = getMonthlyProjections();

  return (
    <div className="space-y-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Proyección de Ingresos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selección de mes */}
          <div className="flex items-center space-x-4 flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Proyección de Ingresos</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'MMMM yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex space-x-2 flex-wrap gap-2">
              <Button onClick={() => getMonthProjection(selectedDate)}>
                Ver mes
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowMonthlyProjections(!showMonthlyProjections)}
              >
                Ver proyección mes a mes
              </Button>
              <Button variant="outline" onClick={() => exportToPDF('month')}>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Resultados del mes seleccionado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold">{monthProjection.totalCuotas}</div>
                <p className="text-sm text-gray-600">Número de cuotas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold">S/ {monthProjection.totalProyectado.toFixed(2)}</div>
                <p className="text-sm text-gray-600">Total proyectado</p>
              </CardContent>
            </Card>
          </div>

          {/* Rango histórico */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Ver rango histórico:</h3>
            <div className="flex items-center space-x-4 mb-4 flex-wrap gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(rangeStart, 'MMMM yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeStart}
                    onSelect={(date) => date && setRangeStart(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <span>a</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(rangeEnd, 'MMMM yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeEnd}
                    onSelect={(date) => date && setRangeEnd(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Button onClick={() => getRangeProjection(rangeStart, rangeEnd)}>
                Ver rango
              </Button>
              <Button variant="outline" onClick={() => exportToPDF('range')}>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>

            {/* Resultados del rango: desglose por mes */}
            <div className="space-y-4">
              {/** Agregado: totales del rango */}
              {(() => {
                const projections = getRangeProjection(rangeStart, rangeEnd);
                const totalCuotas = projections.reduce((s, p) => s + p.totalCuotas, 0);
                const totalProyectado = projections.reduce((s, p) => s + p.totalProyectado, 0);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-xl font-bold">{totalCuotas}</div>
                        <p className="text-sm text-gray-600">Número de cuotas (rango)</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-xl font-bold">S/ {totalProyectado.toFixed(2)}</div>
                        <p className="text-sm text-gray-600">Total proyectado (rango)</p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              <div className="w-full overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead>Número de Cuotas</TableHead>
                      <TableHead>Total Proyectado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getRangeProjection(rangeStart, rangeEnd).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.monthLabel}</TableCell>
                        <TableCell>{p.totalCuotas}</TableCell>
                        <TableCell>S/ {p.totalProyectado.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Proyección mes a mes */}
          {showMonthlyProjections && (
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Proyección mes a mes (próximos 12 meses):</h3>
                <Button variant="outline" onClick={() => exportToPDF('monthly')}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyProjections.map((projection, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-2">{projection.month}</h4>
                      <div className="space-y-1">
                        <div className="text-lg font-bold">{projection.totalCuotas} cuotas</div>
                        <div className="text-sm text-gray-600">S/ {projection.totalProyectado.toFixed(2)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

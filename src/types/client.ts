export interface Titular {
  nombre: string;
  dni: string;
}

export interface ObservationEntry {
  id: string;
  text: string;
  author: string;
  at: string;
}

export interface ClientTitularSource {
  titulares?: Titular[];
  nombre1?: string;
  nombre2?: string;
  dni1?: string;
  dni2?: string;
}

export interface ClientRegistrationPayload {
  titulares: Titular[];
  nombre1: string;
  nombre2?: string;
  dni1: string;
  dni2?: string;
  celular1?: string;
  email1?: string;
  manzana: string;
  lote: string;
  metraje: number;
  montoTotal: number;
  formaPago: 'contado' | 'cuotas';
  numeroCuotas: number;
  inicial: number;
}

export const getClientTitulares = (client: ClientTitularSource): Titular[] => {
  const titulares = client.titulares
    ?.filter(titular => titular && (titular.nombre?.trim() || titular.dni?.trim()))
    .map(titular => ({
      nombre: titular.nombre?.trim() || '',
      dni: titular.dni?.trim() || ''
    }));

  if (titulares?.length) return titulares;

  return [
    { nombre: client.nombre1?.trim() || '', dni: client.dni1?.trim() || '' },
    { nombre: client.nombre2?.trim() || '', dni: client.dni2?.trim() || '' }
  ].filter(titular => titular.nombre || titular.dni);
};

export const getClientDisplayName = (client: ClientTitularSource): string => (
  getClientTitulares(client)
    .map(titular => titular.nombre)
    .filter(Boolean)
    .join(' · ') || 'Cliente sin nombre'
);

export const getClientDisplayDnis = (client: ClientTitularSource): string => (
  getClientTitulares(client)
    .map(titular => titular.dni)
    .filter(Boolean)
    .join(' · ') || 'Sin DNI'
);

export const clientMatchesTitular = (client: ClientTitularSource, query: string): boolean => {
  const normalizedQuery = query.trim().toLocaleLowerCase('es-PE');
  if (!normalizedQuery) return true;

  return getClientTitulares(client).some(titular => (
    titular.nombre.toLocaleLowerCase('es-PE').includes(normalizedQuery)
    || titular.dni.toLocaleLowerCase('es-PE').includes(normalizedQuery)
  ));
};

export type UserRole = 'admin' | 'pagos' | 'boletas' | 'legal' | 'consulta';

export const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  pagos: 'Registro de pagos',
  boletas: 'Boletas',
  legal: 'Área legal',
  consulta: 'Solo consulta',
};

export const canManageClients = (role?: UserRole) => role === 'admin';
export const canRegisterPayments = (role?: UserRole) => role === 'admin' || role === 'pagos';
export const canManageReceipts = (role?: UserRole) => role === 'admin' || role === 'boletas';
export const canManageMinutes = (role?: UserRole) => role === 'admin' || role === 'legal';
export const canViewAnalytics = (role?: UserRole) => role === 'admin';

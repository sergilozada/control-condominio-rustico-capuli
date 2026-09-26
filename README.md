# Control Condominio Rústico Capulí

Aplicación web independiente para administrar clientes, lotes, cuotas, pagos, comprobantes, proyecciones, reportes y minutas de Condominio Rústico Capulí.

El proyecto nació de la estructura funcional usada en otros controles, pero no contiene sus credenciales, bases de datos, repositorios ni configuraciones de despliegue. Debe conectarse exclusivamente a un Firebase nuevo de Capulí.

## Funciones incluidas

- Registro, búsqueda y edición de clientes y lotes.
- Cronogramas, cuotas, mora, pagos, vouchers y boletas.
- Panel de pendientes, atrasados, reportes, estadísticas y proyecciones.
- Constancia de no adeudo desde Clientes, habilitada cuando todas las cuotas registradas están pagadas.
- Borrador de resolución dentro de Atrasados, habilitado al registrar tres o más cuotas vencidas e impagas. Genera un PDF para revisión; no modifica el contrato ni envía notificaciones.
- Minutas integradas con expedientes, borradores en Firestore y descarga Word para revisión legal.
- Minutas independientes del registro de Clientes, con DNI, carné de extranjería o pasaporte; pagos en Interbank y BBVA; 30 cuotas predeterminadas y cierre con espacios de firma en cada hoja.
- Historial detallado de modificaciones de cada minuta y acceso adicional de Minutas verificado en Firebase Authentication.
- Registro administrativo de vendedores de Lima, contratos y pagos semanales.
- Gestión de usuarios con correo interno `@condominiorusticocapuli.com`, roles, suspensión y actividad.
- Roles `admin`, `pagos`, `boletas`, `legal` y `consulta`.
- Historial de cambios visible solo para `admin`, con usuario, fecha, acción y cliente afectado.
- Reglas de Firestore y Storage que aplican los permisos también en el servidor.
- Vista local de demostración con datos ficticios, sin conexión a Firebase.

## Desarrollo local

Requisitos: Node.js 20 o superior y pnpm.

```powershell
pnpm install
pnpm dev
```

Sin `.env.local`, la aplicación muestra un acceso a la vista de demostración. También puede abrirse directamente en `http://127.0.0.1:5173/?demo`.

Para compilar:

```powershell
pnpm build
```

## Firebase

La configuración detallada está en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md). El proyecto activo es `controlcondominiorusticocapuli` y el sitio principal es `https://control-condominio-capuli.web.app`.

No se debe copiar `.env.local` desde Villa Hermosa o San Bartolomeo. `.env.local`, `node_modules`, `.firebase` y `dist` están excluidos de Git.

## Decisiones que debe confirmar la empresa

- Razón social exacta, RUC, representante y facultades que aparecerán en documentos legales.
- Texto contractual aprobado para minutas y resoluciones.
- Si “a partir de la tercera cuota” significa tres cuotas vencidas acumuladas —comportamiento actual— o específicamente la cuota número 3.
- Número de cobranza, cuentas bancarias y destinatarios de notificación.
- Revisión legal antes de firmar o enviar constancias, minutas o resoluciones.

La aplicación genera borradores de trabajo. Ningún documento generado sustituye la revisión contable o legal ni ejecuta automáticamente una resolución contractual.

# Configuración de Firebase para Capulí

Se recomienda un proyecto Firebase nuevo. No conviene usar el de Villa Hermosa ni el de San Bartolomeo: separar Authentication, Firestore, Storage, reglas, copias de seguridad y facturación evita cruces accidentales de clientes y documentos.

## 1. Crear el proyecto

1. Entra a `https://console.firebase.google.com/` con la cuenta propietaria.
2. El proyecto creado usa `controlcondominiorusticocapuli`: contiene el nombre completo y ocupa los 30 caracteres máximos permitidos por Firebase.
   El Hosting usa el sitio secundario `control-condominio-capuli`, definido en `firebase.json`, para ofrecer una dirección más legible.
3. Google Analytics es opcional para este control administrativo.
4. En Configuración del proyecto → Tus apps, agrega una aplicación Web llamada `Control Condominio Rustico Capuli`.
5. Copia los seis valores del objeto `firebaseConfig`.

## 2. Conectar la aplicación local

1. Duplica `.env.example` como `.env.local`.
2. Completa únicamente con los datos de la nueva app web:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

3. Confirma que `VITE_FIREBASE_PROJECT_ID` sea el proyecto de Capulí.
4. Ejecuta `pnpm build`. La clave web de Firebase no es una contraseña; la protección real está en Authentication y en las reglas incluidas.

## 3. Activar servicios

1. Authentication → Sign-in method → habilita Correo electrónico/Contraseña.
2. Firestore Database → Crear base de datos → modo Producción. Para Perú, elige una región compatible cercana y recuerda que luego no puede cambiarse.
3. Storage → Comenzar, si se cargarán vouchers, boletas o adjuntos de minutas. Firebase puede exigir plan Blaze; revisa precios, presupuesto y alertas antes de activarlo.

## 4. Crear el primer administrador

1. Authentication → Users → Add user. Crea la cuenta real del administrador.
2. Copia el UID generado.
3. Firestore → Start collection → colección `users`.
4. Crea un documento cuyo ID sea exactamente el UID, con estos campos:

| Campo | Tipo | Valor |
| --- | --- | --- |
| `name` | string | Nombre de la persona |
| `role` | string | `admin` |
| `active` | boolean | `true` |

Este primer perfil se crea en consola porque todavía no existe otro administrador autorizado.

## 5. Publicar reglas y Hosting

Desde esta carpeta:

```powershell
pnpm install
pnpm build
pnpm add -g firebase-tools
firebase login
firebase use --add
```

Selecciona solamente el proyecto nuevo de Capulí y usa el alias `default`. Luego verifica `.firebaserc`: no debe mencionar Villa Hermosa ni San Bartolomeo.

Publica:

```powershell
firebase deploy --only firestore:rules,storage,hosting --project controlcondominiorusticocapuli
```

Si elegiste otro ID, reemplázalo en el comando y en `.firebaserc`.

## 6. Crear los demás usuarios

Por cada persona:

1. Crea su cuenta en Authentication.
2. Copia su UID.
3. Crea `users/{UID}` en Firestore con `name`, `active: true` y uno de estos roles exactos:

| Rol | Acceso |
| --- | --- |
| `admin` | Control completo, reportes e Historial |
| `pagos` | Registrar pagos y gestionar vouchers |
| `boletas` | Gestionar boletas |
| `legal` | Minutas y borradores de resolución |
| `consulta` | Consulta de clientes sin permisos de edición |

La sección Usuarios crea accesos con el dominio interno `@condominiorusticocapuli.com`. La cuenta de verificación adicional de Minutas es `minutas@condominiorusticocapuli.com` y no debe tener documento en `users/{UID}`; no inicia sesión en el control ni tiene acceso a datos. Su contraseña se administra en Firebase Authentication y no se almacena en el repositorio.

Para suspender a alguien sin borrar evidencia, cambia `active` a `false`.

## 7. Verificación final

- El admin crea y edita un cliente y ve el evento en Historial.
- Pagos marca una cuota y no ve Historial.
- Boletas carga una boleta y no puede marcar pagos.
- Legal entra a Minutas y genera el borrador de resolución únicamente desde Atrasados con tres cuotas vencidas.
- Una constancia de no adeudo solo se habilita si todas las cuotas están pagadas.
- Un usuario autenticado sin documento `users/{UID}` no puede entrar.
- Los documentos muestran el logo de Capulí y no contienen nombres de otras empresas.

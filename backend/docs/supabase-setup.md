# Configuración reproducible con Supabase

Esta guía conecta M-Team a un proyecto de Supabase sin exponer PostgreSQL ni
credenciales privadas al frontend. Todos los comandos se ejecutan desde
`backend/`.

## 1. Dependencias y archivos locales

Instalar exactamente el lockfile:

```powershell
npm ci
```

La carga de configuración respeta este orden, sin sobrescribir valores ya
definidos:

1. variables del proceso;
2. `.env.<APP_ENV|NODE_ENV>.local`;
3. `.env`.

Comprobar que los archivos locales estén ignorados y no versionados:

```powershell
git check-ignore -v -- .env .env.development.local `
  .env.bootstrap.local .env.smoke.local
git ls-files -- .env ".env.*.local"
```

`DATABASE_URL` es la conexión del backend. `DIRECT_URL` es la conexión usada
por Prisma CLI y las migraciones. En una red con IPv6 puede usarse la conexión
directa de Supabase. En una red sólo IPv4 deben copiarse del panel **Connect**
las cadenas de **Session pooler** en puerto `5432`; el host del pooler no se
debe adivinar. Usar TLS (`sslmode=require`) y codificar caracteres reservados
de la contraseña.

Si `JWT_SECRET` falta o está vacío, generarlo localmente sin imprimirlo:

```powershell
npm run local:ensure-jwt-secret
```

## 2. Inspección y migraciones

La inspección no muestra cadenas de conexión ni secretos. Enumera tablas,
conteos, migraciones, checksums y permisos efectivos:

```powershell
npm run prisma:validate
npm run database:inspect
npm run prisma:migrate:deploy
npm run prisma:migrate:status
npm run database:inspect
```

La migración `20260925120000_secure_supabase_data_api` habilita RLS y revoca
DML a `anon` y `authenticated` sobre las tablas de M-Team. No crea políticas
porque el acceso público debe pasar por Express, no por Supabase Data API. El
usuario propietario que usa Prisma conserva sus permisos. Cada futura tabla
de aplicación debe recibir la misma protección; los privilegios por defecto
también quedan revocados para esos roles.

No usar `prisma migrate reset`, `prisma db push`, `DROP` ni `TRUNCATE` sobre una
instancia compartida.

## 3. Primer administrador

El bootstrap nunca contiene una contraseña predeterminada. Hay dos formas de
proveer sus datos:

- copiar `.env.bootstrap.local.example` a `.env.bootstrap.local` y completar
  todas las variables localmente; o
- definir sólo los datos de identidad en el proceso y ejecutar
  `npm run bootstrap:admin:prepare`. Si no se define
  `BOOTSTRAP_ADMIN_PASSWORD`, el comando genera una contraseña aleatoria y la
  guarda únicamente en `.env.bootstrap.local`.

Después ejecutar:

```powershell
npm run bootstrap:admin
```

El comando es idempotente: una segunda ejecución con la misma identidad no
cambia la contraseña ni los datos. Aborta si el email o documento pertenecen a
otro usuario, o si ya existe un administrador diferente.

Para iniciar sesión, consultar localmente `BOOTSTRAP_ADMIN_EMAIL` y
`BOOTSTRAP_ADMIN_PASSWORD` en `.env.bootstrap.local` y enviarlos a
`POST /api/auth/login`. No copiar la contraseña a commits, logs, PRs ni
documentación.

## 4. Arranque y smoke real

Compilar y levantar el backend:

```powershell
npm run build
npm start
```

Swagger UI queda en `http://localhost:3000/api/docs`.

El smoke real deja datos deliberadamente identificados con
`TEST-SUPABASE-SMOKE-20260925`. No elimina registros y puede reejecutarse:

```powershell
npm run smoke:supabase:prepare
npm run smoke:supabase
```

Para comprobar persistencia, detener y volver a iniciar el backend y ejecutar:

```powershell
$env:SMOKE_VERIFY_ONLY = "true"
npm run smoke:supabase
Remove-Item Env:SMOKE_VERIFY_ONLY
```

El flujo verifica health más una consulta real, login de ADMIN, registro y
login de MEMBER, cambio de contraseña, `401` sin token, `403` por rol, creación
de TRAINER, precio de cuota, acreditación y anulación de pago, sede y clase.

## 5. Pruebas aisladas y validaciones

La suite actual usa mocks y no limpia una base real. Aun así, debe ejecutarse
con `.env.test.local` apuntando a una base descartable o con URLs ficticias si
ningún test necesita PostgreSQL. Nunca reutilizar indiscriminadamente el
`.env` compartido para suites que puedan borrar datos.

```powershell
npm test
npm run build
npm run openapi:validate
npm run prisma:validate
```

Estas validaciones automatizadas no sustituyen el smoke real contra Supabase.

La auditoría funcional reproducible y el estado requisito por requisito están en
[`supabase-requirements-verification.md`](./supabase-requirements-verification.md). La
suite real asociada se ejecuta únicamente de forma manual con
`npm run test:integration:supabase` y deja datos identificados por marcador.

## 6. Frontend, CORS y Storage

El frontend local debe usar:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

El backend debe autorizar el origen del navegador, sin `/api`:

```dotenv
CORS_ORIGIN=http://localhost:5173
```

Las credenciales PostgreSQL, `JWT_SECRET` y claves privadas de Supabase son
exclusivas del backend y nunca deben usar el prefijo `VITE_`.

La carga de fotos de perfil requiere las tres variables siguientes:

- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_PROFILE_PHOTO_BUCKET` (bucket público exclusivo para fotos).

`SUPABASE_STORAGE_BUCKET` queda reservado para aptos médicos/documentos
privados, cuyo módulo todavía no está implementado. La contraseña PostgreSQL
no reemplaza ninguna de estas credenciales. Valores opcionales vacíos o con
espacios se normalizan a ausentes, por lo que el backend puede iniciar y los
módulos sin archivos siguen funcionando; el upload de foto responde `503`
mientras Storage no esté configurado.

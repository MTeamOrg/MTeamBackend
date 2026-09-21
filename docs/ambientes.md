# Estrategia de ambientes de M-Team

M-Team utilizará cuatro ambientes aislados. Una versión se promueve entre ambientes utilizando el mismo código versionado; solamente cambian la configuración, las credenciales y los datos.

## Ambientes

| Ambiente | Propósito | Ejecución | Base de datos | Datos permitidos |
|---|---|---|---|---|
| `development` | Desarrollo individual y verificación manual | Computadora de cada integrante | PostgreSQL local o instancia exclusiva de desarrollo | Datos ficticios |
| `test` | Pruebas automatizadas | Local y GitHub Actions | PostgreSQL separada, reiniciable y exclusiva para pruebas | Datos generados por las pruebas |
| `staging` | Validación de la versión integrada | Servicios gratuitos de preproducción | Proyecto o base separada de staging | Datos ficticios representativos |
| `production` | Demostración y uso público final | Vercel, Render y Supabase | Proyecto exclusivo de producción | Solo datos autorizados o ficticios aprobados |

Ningún ambiente puede compartir la base de datos ni las credenciales de `production`. Las pruebas automatizadas nunca deben apuntar a una base persistente de desarrollo, staging o producción.

## Flujo de ramas y promoción

```text
feature/* o fix/*
        │
        ├── development: ejecución local
        ├── test: pruebas automáticas en cada pull request
        ↓
develop
        │
        └── staging: despliegue de la versión integrada
        ↓ pull request aprobado
main
        │
        └── production: despliegue público
```

Reglas:

- El trabajo se realiza en ramas `feature/*`, `fix/*`, `docs/*` o `chore/*`.
- Todo cambio entra en `develop` mediante pull request y debe superar las pruebas.
- `develop` representa el código desplegado en staging.
- `main` representa exclusivamente una versión aceptada para producción.
- La promoción a producción se realiza mediante un pull request de `develop` hacia `main`.
- No se realizan commits directos sobre `develop` ni `main`.
- Los defectos urgentes de producción usan `fix/*` y luego se integran también en `develop`.

## Configuración del backend

Cuando se cree `backend/`, su plantilla `backend/.env.example` deberá contener solamente nombres y valores no sensibles:

```dotenv
NODE_ENV=development
APP_ENV=development
PORT=3000
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=
SUPABASE_PROFILE_PHOTO_BUCKET=
CORS_ORIGIN=http://localhost:5173
```

Propósito de las variables:

| Variable | Uso |
|---|---|
| `NODE_ENV` | Selecciona el comportamiento técnico estándar de Node.js: `development`, `test` o `production`. En staging utiliza `production`. |
| `APP_ENV` | Identifica el ambiente de M-Team: `development`, `test`, `staging` o `production`. |
| `PORT` | Puerto HTTP del backend. |
| `DATABASE_URL` | Conexión utilizada por la aplicación y Prisma. |
| `DIRECT_URL` | Conexión directa para migraciones cuando el proveedor utiliza un pool de conexiones. |
| `JWT_SECRET` | Firma de credenciales de autenticación; debe ser diferente por ambiente. |
| `SUPABASE_URL` | URL del proyecto de almacenamiento correspondiente al ambiente. |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial privada utilizada solamente por el backend. |
| `SUPABASE_STORAGE_BUCKET` | Bucket privado para aptos médicos y otros documentos restringidos. |
| `SUPABASE_PROFILE_PHOTO_BUCKET` | Bucket público exclusivo para fotografías de perfil; no almacena aptos médicos. |
| `CORS_ORIGIN` | Origen del frontend autorizado para ese ambiente. |

### Buckets de Supabase Storage

Cada ambiente debe mantener separados los archivos públicos de los documentos
privados:

1. Crear un bucket público exclusivo para fotografías de perfil, por ejemplo
   `profile-photos`.
2. Asignar ese nombre a `SUPABASE_PROFILE_PHOTO_BUCKET` en el archivo `.env`
   local o en los secretos del ambiente correspondiente.
3. Reservar `SUPABASE_STORAGE_BUCKET` para aptos médicos y otros documentos
   privados.
4. No guardar aptos médicos en el bucket público ni exponer la
   `SUPABASE_SERVICE_ROLE_KEY` al frontend.

Los buckets de development, test, staging y production deben ser independientes
o pertenecer a proyectos Supabase separados. La aplicación no crea buckets
automáticamente: deben configurarse antes de probar la carga de fotografías.

## Configuración del frontend

Cuando se cree `frontend/`, su plantilla `frontend/.env.example` deberá contener:

```dotenv
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_MAPS_API_KEY=
```

El frontend se comunica exclusivamente con la API REST. No recibe `DATABASE_URL`, `JWT_SECRET`, claves administrativas de Supabase ni ninguna otra credencial privada. Toda variable con prefijo `VITE_` queda incorporada al código entregado al navegador y debe considerarse pública.

## Archivos locales

Los archivos reales quedan ignorados por Git:

```text
backend/.env.development.local
backend/.env.test.local
frontend/.env.development.local
```

Las plantillas sin secretos sí se versionan:

```text
backend/.env.example
backend/.env.test.example
frontend/.env.example
```

La aplicación y los scripts de prueba deberán cargar el archivo correspondiente de manera explícita. No se debe depender de cambiar manualmente una misma variable para alternar entre desarrollo y pruebas.

## Servicios por ambiente

| Recurso | Development | Test | Staging | Production |
|---|---|---|---|---|
| Frontend | Vite local | Build y pruebas en CI | Vercel de staging | Vercel de producción |
| Backend | Node.js local | API y pruebas en CI | Render de staging | Render de producción |
| PostgreSQL | Local o desarrollo | Base temporal aislada | Supabase de staging | Supabase de producción |
| Storage | Bucket de desarrollo | Emulado o bucket de prueba | Bucket de staging | Bucket de producción |
| Google Maps | Clave restringida de desarrollo | Simulado en pruebas | Clave restringida de staging | Clave restringida de producción |

Si los límites gratuitos impiden mantener todos los servicios activos, el aislamiento de datos y secretos se conserva. Se puede ejecutar `development` y `test` localmente, pero staging y producción no deben compartir base, Storage ni credenciales administrativas.

## GitHub Environments y secretos

En el repositorio de la organización se crearán los GitHub Environments `staging` y `production`. Los secretos tendrán los mismos nombres definidos en las plantillas, pero valores propios para cada ambiente.

Para `production` se recomienda:

- Requerir aprobación manual de al menos un integrante antes del despliegue.
- Limitar el despliegue a la rama `main`.
- Restringir las claves de Google Maps por dominio y API habilitada.
- Rotar inmediatamente cualquier secreto expuesto.

Los secretos no se escriben en commits, pull requests, capturas, logs, documentación ni mensajes del equipo.

## Migraciones y datos

- Las migraciones de Prisma se crean y revisan en development.
- Test aplica las migraciones sobre una base vacía antes de ejecutar las pruebas.
- Staging aplica las migraciones aprobadas antes de desplegar la API.
- Production aplica exactamente las mismas migraciones que ya fueron validadas en staging.
- Los datos iniciales de development, test y staging son ficticios y reproducibles mediante un script de seed.
- El seed de producción se limita a configuración indispensable, como el primer administrador, y nunca reutiliza contraseñas de otros ambientes.

## Criterio de promoción

Una versión puede avanzar al ambiente siguiente solamente si:

1. El proyecto compila sin errores.
2. Las pruebas automatizadas finalizan correctamente.
3. Las migraciones pueden aplicarse sobre una base vacía.
4. No contiene archivos `.env`, secretos ni datos reales no autorizados.
5. Las funcionalidades modificadas fueron verificadas en el ambiente anterior.
6. El pull request fue revisado y aprobado.

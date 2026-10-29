# Cierre técnico y documental del Manual Técnico — M-Team

**Fecha de revisión:** 2026-10-29  
**Alcance:** `MTeamBackend` y `MTeamFrontend`  
**Ramas de trabajo:** `docs/manual-tecnico-cierre-2026` en ambos repositorios  
**Base backend:** `b704a445bf1bf1a0ae6bc6c35a7c76d526112832`  
**Base frontend:** `73f477b8b12cdad19fb51162149a4574ba10450a`

Este documento registra el cierre técnico de la auditoría y la documentación del sistema. Los cambios locales son documentales y de contrato: no modifican lógica de negocio, migraciones, `schema.prisma`, credenciales, workflows ni servicios externos.

## Resultado ejecutivo

| Área | Resultado | Alcance de la evidencia |
|---|---|---|
| OpenAPI y rutas | Confirmado | 69 operaciones; validación OpenAPI y paridad Express ejecutadas localmente |
| Postman | Confirmado estático | Colección existente actualizada; 69 requests; no se ejecutó contra una base compartida |
| Documentación de recuperación | Confirmado | Gmail SMTP, `PasswordRecoveryToken` y `sessionVersion` alineados en backend/frontend |
| Modelo y trazabilidad | Confirmado documental | Relaciones, idempotencia, deduplicación y recuperación alineadas con Prisma actual |
| CI | Confirmado con alcance explícito | Evidencia histórica y del SHA remoto actual separadas; ver [evidencias](./evidencias-manual-tecnico-m-team.md) |
| Cobertura, Sonar y Qase | Parcial | Configuración y runs disponibles; la evidencia productiva/externalizada debe adjuntarse |
| Ambientes y despliegues | Pendiente externo | No se inventan URLs, SHAs desplegados, proyectos ni secretos |
| Word final | Pendiente | No se encontró el documento original `.docx`; se dejan instrucciones de cierre |

## Auditoría de repositorios y ramas

Antes de modificar archivos se verificaron los worktrees limpios, la rama activa y `origin/develop`; luego se ejecutó `git fetch origin`. La documentación quedó aislada de `develop`/`main` en estas ramas locales:

```text
MTeamBackend   docs/manual-tecnico-cierre-2026   b704a445bf1bf1a0ae6bc6c35a7c76d526112832
MTeamFrontend  docs/manual-tecnico-cierre-2026   73f477b8b12cdad19fb51162149a4574ba10450a
```

No se hizo commit, push, merge, deploy ni migración. Los cambios quedan disponibles para revisión y para el nombre de commit sugerido en inglés: `docs: close M-Team technical manual audit`.

## Correcciones de contrato OpenAPI/Express

Se actualizó [`backend/docs/openapi.yaml`](../backend/docs/openapi.yaml) sin tocar los handlers. Los grupos revisados quedaron así:

| Grupo | Corrección aplicada |
|---|---|
| C1 — identidad, membresía y cuota | Respuestas de membresía propia y precio vigente con esquemas explícitos; prerrequisitos de autenticación, rol y contraseña completada; códigos 401/403 documentados. |
| C2 — sedes | `POST /branches` y `PATCH /branches/{branchId}` usan cuerpos estrictos de creación/actualización; respuestas `AdminBranch`; validaciones de entrada, autorización, conflicto y no encontrado documentadas. `isActive` administrativo es texto `true/false`, consistente con Express. |
| C3 — eventos | Lista paginada con búsqueda, estado, página y límite; respuestas explícitas para colección, detalle, edición y cambio de estado; códigos 400/401/403/404/409 según operación. |
| C4 — novedades | Lista paginada con búsqueda, audiencia, estado, página y límite; respuestas explícitas para colección, detalle, edición y cambio de estado; códigos de validación, autorización, no encontrado y conflicto. |
| C5 — pagos y filtros operativos | `POST /payments` documenta administración, `Idempotency-Key` UUID y respuesta sin exponer la clave; filtros de notificaciones booleanos como texto; modelos de `Payment`, `MembershipPrice` y resultados paginados alineados con serialización real. |

Comandos ejecutados desde `MTeamBackend/backend`:

```text
npm.cmd run openapi:validate
OpenAPI validation passed

npm.cmd run routes:verify
OpenAPI/Express route correspondence passed (69 operations)
```

## Colección Postman existente

Se actualizó [`backend/docs/m-team-api.postman_collection.json`](../backend/docs/m-team-api.postman_collection.json), no se creó una colección paralela.

- Conserva las 69 requests y la secuencia funcional existente.
- La descripción indica la ejecución local y la dependencia de datos sintéticos/locales descartables.
- El login valida que `accessToken` sea un string no vacío y guarda `token` en el entorno sin imprimirlo.
- El script de colección valida códigos documentados, JSON exitoso, metadata de paginación y ausencia de URLs de Render/Supabase.
- Los grupos de membresía, sedes, eventos, novedades y pagos tienen códigos de éxito esperados en el script de colección.
- `Idempotency-Key: {{idempotencyKey}}` está presente en creación de cuota y pago.
- Los filtros operativos están parametrizados: búsqueda, estado de membresía, estado de evento, audiencia, estado de novedad, actividad de sede y lectura de notificaciones.
- El entorno [`backend/docs/m-team-local.postman_environment.json`](../backend/docs/m-team-local.postman_environment.json) contiene valores sintéticos y locales, sin secretos reales.
- No se ejecutó Newman ni se enviaron requests contra staging, producción, Supabase o una base compartida.

La validación JSON estática confirmó que la colección es válida, contiene 69 requests, un script de colección y captura de token únicamente en el request de login.

### Pruebas ejecutadas durante este cierre

Se ejecutó Jest directamente, sin `prisma generate`, sin migraciones y sin conectarse a infraestructura externa:

```text
node_modules\\.bin\\jest.cmd --runInBand --coverage=false \\
  test/route/member-membership.test.ts \\
  test/route/membership-price-management.test.ts \\
  test/route/branch-management.test.ts \\
  test/route/communications.test.ts \\
  test/route/create-payment.test.ts \\
  test/route/account-recovery.test.ts

Test Suites: 6 passed, 6 total
Tests:       62 passed, 62 total
```

La suite completa, la cobertura y las pruebas E2E contra PostgreSQL/Storage/Gmail siguen requiriendo sus entornos respectivos; no se presentan como ejecutadas en este cierre.

## Documentación de dominio y arquitectura

Se actualizaron los siguientes documentos para reflejar Prisma y el backend actual:

- [`docs/diagrama-de-clases.md`](./diagrama-de-clases.md): `sessionVersion`, `PasswordRecoveryToken`, `idempotencyKey`, `Notification.dedupeKey` y relaciones físicas de pagos/aptos a `User`.
- [`docs/modelo-relacional.md`](./modelo-relacional.md): `session_version`, claves de idempotencia, tabla `password_recovery_token`, deduplicación y FKs reales.
- [`docs/matriz-de-trazabilidad.md`](./matriz-de-trazabilidad.md): USR-04 y relaciones de cuotas, pagos y aptos alineadas con el esquema implementado.
- [`docs/diagramas-de-secuencia.md`](./diagramas-de-secuencia.md): recuperación por Gmail SMTP, consumo atómico e invalidación de sesiones.
- [`docs/diagrama-arquitectura-m-team.md`](./diagrama-arquitectura-m-team.md) y [`docs/Diagrama_de_Componentes_M-Team.md`](./Diagrama_de_Componentes_M-Team.md): Gmail SMTP, Storage público/privado, comunicaciones y límites de evidencia externa.
- [`docs/ambientes.md`](./ambientes.md): rutas actuales de ambos repositorios, `FRONTEND_PUBLIC_URL` y variables definitivas de Gmail.
- `backend/docs/access-control.md`, `backend/docs/notifications-implementation-notes.md`, `backend/docs/supabase-requirements-verification.md` y `docs/documento-de-alcance.md`: revocación por `sessionVersion`, estado actual de USR-04 y separación entre evidencia local y aceptación SMTP externa.
- `backend/docs/account-recovery.md` y `MTeamFrontend/docs/account-recovery.md`: eliminado el lenguaje de Resend y la afirmación de JWT no revocable.
- `MTeamFrontend/frontend/README.md`: eventos, novedades e historial de accesos se describen como integrados en API; queda separada la pantalla pública aún pendiente.

### Recuperación de cuenta

La configuración definitiva es:

```dotenv
FRONTEND_PUBLIC_URL=http://localhost:5173
GOOGLE_SMTP_USER=<cuenta-google-dedicada@gmail.com>
GOOGLE_APP_PASSWORD=<contraseña-de-aplicación>
```

La contraseña de aplicación solo existe en el backend y nunca se copia a `VITE_`, Git, Postman o la documentación. La recuperación almacena el hash del token, vence a los 30 minutos, consume el token atómicamente y aumenta `User.sessionVersion`, invalidando sesiones anteriores. La aceptación SMTP no equivale a una garantía de entrega en bandeja.

## Versiones y compatibilidad

| Componente | Declaración/lock verificado | Observación |
|---|---|---|
| Backend runtime | Node 22 en CI | Verificar la versión exacta del runtime remoto al adjuntar evidencia de Render. |
| Backend | Express 5.2.1, Prisma Client 7.10.0, Prisma CLI 7.10.1, TypeScript 7.0.2, Jest 29.7.0, Nodemailer 10.1.7 | Valores del `package-lock.json`; no se modificaron dependencias. |
| Frontend | React 19.2.8, React DOM 19.2.8, React Router 7.18.4, Vite 8.2.1, TypeScript 6.0.3, Vitest 5.0.1, Playwright 1.64.1 | Valores del `package-lock.json`; no se modificaron dependencias. |
| PostgreSQL local | PostgreSQL 16 solicitado para desarrollo local | Debe probarse con la versión del equipo y una base local descartable. |
| PostgreSQL CI | PostgreSQL 17 en workflows actuales | Riesgo principal: diferencias de imagen, extensiones, planner o defaults; ejecutar Prisma/test/migraciones en ambas versiones antes de elegir una política. |

Recomendación: usar PostgreSQL 17 también en desarrollo mediante Docker si el equipo puede hacerlo; si el entorno local debe permanecer en 16, agregar una comprobación CI explícita contra PostgreSQL 16 y mantener 17 como versión de CI/hosting solo después de validar compatibilidad.

## Instalación y verificación local

### Backend

Desde `MTeamBackend/backend`:

```powershell
npm.cmd ci
Copy-Item .env.example .env.development.local
# Completar únicamente valores locales y no sensibles en el archivo ignorado.
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:dev
npm.cmd run dev
```

La base debe ser PostgreSQL local y descartable. Revisar `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, Storage y Gmail antes de arrancar. No ejecutar estos pasos contra Supabase productivo.

### Frontend

Desde `MTeamFrontend/frontend`:

```powershell
npm.cmd ci
Copy-Item .env.example .env
# Verificar VITE_API_URL=http://localhost:3000/api
npm.cmd run dev
```

Las variables `VITE_` son públicas; no pueden contener secretos de JWT, PostgreSQL, Supabase o SMTP.

### Verificación sin infraestructura externa

```powershell
# Backend, desde backend/
npm.cmd run openapi:validate
npm.cmd run routes:verify

# Frontend, desde frontend/
npm.cmd run lint
npm.cmd run build
npm.cmd test -- --run
```

La ejecución completa de integración, migraciones, E2E contra backend real, Storage, Gmail, Vercel, Render y Supabase requiere una base local descartable o credenciales/evidencias externas; no se simuló ese resultado en este cierre.

## Evidencia CI, cobertura y plataformas

La evidencia remota debe distinguir el SHA examinado del SHA de la rama. En la revisión se observó:

- Backend SonarQube #52, run [40935221946](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40935221946): `success` sobre `b704a445bf1bf1a0ae6bc6c35a7c76d526112832`.
- Backend CI #143, run [40930311285](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40930311285): `success` sobre el SHA anterior `793be2e4ee380923f09a1f518d2c4cae94c20f0e`; se conserva como evidencia histórica, no como ejecución del cierre documental.
- Frontend E2E #23, run [40926939096](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40926939096): `success` sobre `73f477b8b12cdad19fb51162149a4574ba10450a`.
- Frontend SonarQube #125, run [40926939032](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40926939032): `success` sobre `73f477b8b12cdad19fb51162149a4574ba10450a`.

Esto no prueba por sí solo cobertura histórica completa, calidad actual de un despliegue ni disponibilidad de plataformas. Los porcentajes y reportes de cobertura deben adjuntarse desde el artefacto de CI/Sonar correspondiente al SHA que se promueva.

Qase, Vercel, Render, Supabase Storage, Gmail SMTP, dominios y URLs de staging/producción quedan en estado **pendiente de evidencia externa**. La plantilla de captura está en [`docs/evidencias-manual-tecnico-m-team.md`](./evidencias-manual-tecnico-m-team.md).

## Word final

No se encontró `M-Team_Manual_Tecnico_Completo.docx` en los repositorios ni en la carpeta de documentos disponible. Por eso no se creó un Word paralelo ni se afirmó que el documento esté cerrado. Cuando el original esté disponible:

1. usar este cierre y los documentos enlazados como fuente;
2. conservar la estructura, tablas y diagramas existentes;
3. actualizar índice y referencias cruzadas;
4. exportar a PDF y revisar visualmente saltos de página, tablas y diagramas;
5. adjuntar el nombre, versión, SHA de fuente y fecha en la matriz de evidencias.

## Archivos modificados y límites

Los cambios de esta tarea son:

- backend: OpenAPI, Postman, entorno local y recuperación de cuenta;
- frontend: recuperación de cuenta y README operativo;
- documentación compartida: arquitectura, componentes, secuencias, clases, modelo relacional, trazabilidad y ambientes;
- nuevos entregables: este cierre y la matriz de evidencias.

No se modificaron `src/`, `schema.prisma`, migraciones, workflows, configuración productiva, credenciales, proveedores externos ni datos persistentes.

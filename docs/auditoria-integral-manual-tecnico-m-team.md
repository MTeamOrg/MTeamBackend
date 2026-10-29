# Auditoría integral para completar el Manual Técnico de M-Team

**Fecha de auditoría:** 2026-10-29 (America/Buenos_Aires)  
**Alcance:** `MTeamOrg/MTeamBackend` y `MTeamOrg/MTeamFrontend`  
**Modo:** lectura; no se modificó código, configuración, ramas, bases de datos ni servicios externos.  
**Resultado:** informe técnico de evidencia para completar el manual; no es una implementación ni una certificación de producción.

## Convenciones de evidencia

- **CONFIRMADO:** demostrado por código, configuración, lockfile, validación local estática o ejecución histórica identificable.
- **DOCUMENTADO:** declarado en documentación, pero no completamente contrastado con una plataforma externa o una ejecución real.
- **NO VERIFICABLE DESDE EL REPOSITORIO:** requiere acceso a Vercel, Render, Supabase, SonarCloud, Qase, correo o la base productiva.
- **DESACTUALIZADO:** contradice el código, el esquema o la configuración vigente revisada.
- **PENDIENTE DE DECISIÓN:** la evidencia permite describir la situación, pero el equipo debe elegir una política o convención.

Las rutas de la matriz son relativas al prefijo `/api`, montado en `backend/src/app.ts:25`.

## A. Resumen ejecutivo

El estado técnico es suficientemente avanzado para completar gran parte del manual, pero no para afirmar que el sistema está validado en producción.

1. La correspondencia estructural entre Express y OpenAPI está **CONFIRMADA**: el verificador del repositorio pasó con **69 operaciones**, y `npm.cmd run openapi:validate` también pasó. No hay una ruta activa ausente del documento ni una operación OpenAPI sin ruta. Sí existen diferencias contractuales en parámetros, esquemas de request/response, tipos de query y documentación de autorización.
2. La colección oficial versionada actual es `backend/docs/m-team-api.postman_collection.json`, no `M-Team_API_Local.postman_collection.json`. Contiene las mismas 69 rutas, pero no tiene scripts de test/pre-request, no encadena login con token y sólo envía `Idempotency-Key` para pagos, no para creación de cuotas.
3. La CI de backend tiene ejecuciones exitosas recientes en el SHA auditado `793be2e4...`; el frontend tiene ejecuciones exitosas recientes en `73f477b...` y en el SHA local `c6166af...`. Esto prueba ejecuciones de CI, no despliegue ni funcionamiento productivo. El historial también muestra fallos de SonarQube en commits anteriores del backend; no se debe presentar sólo el último éxito como garantía permanente.
4. Hay cobertura reproducible configurada con Jest/V8 y Vitest/V8, y existen archivos LCOV locales. Sus fechas son anteriores a los commits auditados, por lo que se consideran evidencia histórica local, no métricas actuales de SonarCloud.
5. La implementación de recuperación por correo con Gmail SMTP, tokens hashados, expiración de 30 minutos, uso único e invalidación de sesiones está **CONFIRMADA en código**. La entrega efectiva a una bandeja de correo no está verificada y no se enviaron correos.
6. Supabase Storage está implementado para fotos públicas y certificados privados con URL firmada de 300 segundos. Las políticas activas del proyecto real, buckets existentes y credenciales efectivas requieren verificación en Supabase.
7. Varios documentos y diagramas están desactualizados: recuperación todavía aparece como administrativa o fuera de alcance, algunas relaciones apuntan a `MemberProfile` cuando las claves reales apuntan a `User`, y faltan `sessionVersion`, claves de idempotencia y `PasswordRecoveryToken`.
8. `M-Team_Manual_Tecnico_Completo.docx` no está disponible en el entorno. No se pudo comparar su índice, numeración, tablas, enlaces o afirmaciones; no fue modificado. Sí se inspeccionó de forma estructural el DOCX disponible `docs/M-Team_Modelo_de_Datos.docx`, que es un entregable de modelo de datos, no el manual solicitado.

Prioridades para cerrar el manual: conseguir el DOCX original y las evidencias de plataformas externas; corregir la especificación OpenAPI y la colección Postman; decidir la versión mayor de PostgreSQL; actualizar diagramas y documentos de recuperación; y registrar métricas/Quality Gates y despliegues mediante enlaces o capturas fechadas.

## B. Matriz de los 17 pendientes

| ID | Tema | Estado | Evidencia | Información faltante | Acción siguiente |
|---:|---|---|---|---|---|
| 1 | OpenAPI frente a Express | **CONFIRMADO con diferencias contractuales** | `backend/scripts/verify-openapi-routes.mjs` pasó con 69 operaciones; `src/app.ts`, `src/route/index.ts`, routers, validadores y controladores fueron contrastados. | Parámetros de filtros, schemas exactos de algunos bodies/responses, errores y roles no están totalmente reflejados. | Actualizar `openapi.yaml` y volver a ejecutar ambos validadores. |
| 2 | Colección Postman oficial | **CONFIRMADO / PENDIENTE DE DECISIÓN** | `backend/docs/m-team-api.postman_collection.json`: 69 requests, seis carpetas, misma pareja método/ruta. El nombre pedido no existe. | Faltan scripts, chaining, ejemplos y variantes de filtros; debe decidirse si el archivo actual reemplaza formalmente al nombre histórico. | Adoptar un nombre oficial y ampliar la colección según la propuesta de este informe. |
| 3 | Validación Postman | **CONFIRMADO parcialmente** | Hay tests unitarios/API y tests de integración PostgreSQL; no hay evidencia de ejecución de esta colección ni Newman versionado. | Respuestas reales de cada request, datos de precondición y estrategia de limpieza. | Ejecutar sólo contra PostgreSQL descartable local, con datos sintéticos y sin Supabase/producción. |
| 4 | Historial CI | **CONFIRMADO** | GitHub Actions devuelve Backend CI/SonarQube exitosos para `793be2e4...`; Frontend E2E/SonarQube exitosos para `73f477b...` y para `c6166af...`. | No hay garantía de que los mismos artefactos o configuraciones correspondan a producción. | Conservar enlaces de runs en el manual con fecha, SHA, workflow y conclusión. |
| 5 | Cobertura y Quality Gate | **CONFIRMADO en configuración; NO VERIFICABLE en plataforma** | Jest/V8 y Vitest/V8 generan texto, HTML y LCOV. Backend espera LCOV y `sonar.qualitygate.wait=true`; frontend no declara `qualitygate.wait`. | Porcentaje actual de Sonar, Quality Gate efectivo, rama/commit analizado y umbral global vigente. | Consultar los proyectos Sonar `MTeamOrg_MTeamBackend` y `MTeamOrg_MTeamFrontend`; registrar Quality Gate y métricas del SHA indicado. |
| 6 | Playwright y Qase | **CONFIRMADO en repositorio; NO VERIFICABLE en Qase** | Frontend tiene 20 specs Playwright, de los cuales 3 son `real-backend`; reporters condicionales en `playwright.config.ts` y `vite.config.ts`. | Runs, casos omitidos/fallidos, HTML, trazas, IDs de casos Qase y vinculación manual. | Consultar Qase y conservar artefactos del run; crear IDs sólo después de registrar los casos manuales. |
| 7 | Versiones | **CONFIRMADO para package/lock/CI/local; NO VERIFICABLE para producción** | Versiones declaradas y resueltas en ambos `package.json`/lockfiles; CI fija Node 22; máquina auditora usa Node 24.11.1 y npm 11.6.2. | Node/npm/Prisma/PostgreSQL realmente instalados en Vercel, Render y Supabase. | Documentar declarada, resuelta y CI; pedir inventario de runtime productivo al equipo. |
| 8 | PostgreSQL 16 vs 17 | **CONFIRMADO; PENDIENTE DE DECISIÓN** | Compose local del backend usa `postgres:16-alpine`; workflows y E2E usan `postgres:17`; la documentación no explica la divergencia. | Resultado de pruebas de compatibilidad en la versión elegida y política de soporte. | Alinear la matriz local/CI o documentar explícitamente la política; probar migraciones en la versión objetivo. |
| 9 | Instalación limpia | **DOCUMENTADO y parcialmente CONFIRMADO** | README, `.env.example`, scripts Prisma, CI y `/api/health` describen el flujo; CI ejecuta instalación, migración descartable, tests, build y validación OpenAPI. | No se ejecutó instalación desde cero en esta auditoría; no se migró ninguna base por restricción. | Validar el procedimiento en una máquina/DB descartable y anotar salida real, sin reutilizar credenciales. |
| 10 | Dominios públicos | **NO VERIFICABLE DESDE EL REPOSITORIO** | Sólo aparecen localhost, 127.0.0.1, URLs de test y la variable de ejemplo `FRONTEND_PUBLIC_URL`; `vercel.json` sólo define rewrite SPA. | URL definitiva frontend/backend, HTTPS, health pública y dominio activo. | Consultar Vercel y Render; capturar dominio y commit desplegado. |
| 11 | Variables Vercel/Render | **CONFIRMADO en nombres esperados; NO VERIFICABLE en configuración efectiva** | `environment.ts`, `.env.example`, `frontend/.env.example` y workflows muestran nombres. No se imprimieron valores. | Qué variables están cargadas en cada ambiente, scopes, secretos rotados y valores públicos efectivos. | Exportar desde los paneles sólo nombres, ambiente y estado de configuración; nunca valores secretos. |
| 12 | Commits desplegados | **NO VERIFICABLE DESDE EL REPOSITORIO** | No existe `.vercel/project.json`, `render.yaml` ni un enlace de deploy asociado en los checkouts. | SHA, rama, fecha, proveedor y mecanismo de promoción de producción. | Vercel: Deployment de Production → Source; Render: Events/Deploy → commit/branch; registrar evidencia fechada. |
| 13 | Supabase Storage y políticas | **DOCUMENTADO / NO VERIFICABLE en proyecto real** | `supabase-setup.md`, servicios Storage y rutas distinguen fotos públicas y certificados privados; migración RLS sólo prueba SQL versionado, no políticas activas en el proyecto. | Buckets reales, RLS/Storage policies, expiración efectiva y proyecto por ambiente. | Verificar proyecto/ref, buckets, políticas de SELECT/INSERT/DELETE y claves de backend en Supabase. |
| 14 | Tests de Storage | **CONFIRMADO en unitarias/integración local; aceptación real pendiente** | Tests de middleware, servicios, rutas y `requirements.integration.ts`; PostgreSQL valida metadatos/flujo, no el bucket real. | Upload/download/rechazo contra Storage aislado, permisos reales y limpieza. | Ejecutar `test:integration:supabase` sólo con proyecto aislado y guardas de escritura aprobadas. |
| 15 | Gmail SMTP | **CONFIRMADO en código; entrega NO VERIFICABLE** | `recovery-email-service.ts` usa `smtp.gmail.com`; config exige el par de variables; token hashado, expira, se consume una vez e incrementa `sessionVersion`. | Entrega real, rebotes, límites, SPF/DKIM/DMARC y cuenta usada por ambiente. | Validar con buzón de prueba autorizado, sin registrar token ni destinatario en el manual. |
| 16 | Coherencia de diagramas | **DESACTUALIZADO** | Diagramas/modelo omiten o contradicen campos y relaciones actuales; secuencia y trazabilidad dicen que el correo no existe. | Decisión de si los diagramas serán conceptuales o fieles al esquema Prisma actual. | Actualizar diagramas desde `schema.prisma` y separar explícitamente modelo conceptual de físico. |
| 17 | Manual Word | **NO VERIFICABLE DESDE EL REPOSITORIO** | No se encontró `M-Team_Manual_Tecnico_Completo.docx` en ambos repositorios ni en `C:\Users\usuario\Documents`. | Índice, capítulos, tablas, enlaces, fuentes y afirmaciones del manual original. | Proporcionar la ubicación del DOCX y repetir una comparación sólo de lectura. |

## C. Inventario de fuentes y snapshots

### C.1 Repositorios

| Repositorio | Ruta local | Rama auditada | Estado | HEAD auditado | Referencias relevantes |
|---|---|---|---|---|---|
| `MTeamOrg/MTeamBackend` | `C:\Users\usuario\Documents\GitHub\M-Team` | `fix/openapi-verifier-https` (tracking `origin/develop`) | limpio | `793be2e4ee380923f09a1f518d2c4cae94c20f0e` | `develop` local apunta al mismo SHA; `main` local=`cd416ab5165870a38a305cf02b171f5efda7a4ab`. |
| `MTeamOrg/MTeamFrontend` | `C:\Users\usuario\Documents\GitHub\MTeamFrontend` | `develop` | limpio; local detrás de `origin/develop` | `c6166af5a96f9c0e2db731bdb88d02c2fec6c2d9` | `origin/develop`=`73f477b8b12cdad19fb51162149a4574ba10450a`; `origin/main`=`22e70fa8f7b96635d99e28af8f32f23a9623ac0f`; no hay rama local `main`. |

No se cambió de rama ni se creó una rama. Los `git status --short --branch` fueron limpios en ambos checkouts.

### C.2 Volumen revisado

El inventario Git devuelve **292 archivos tracked en backend** y **212 en frontend**. El foco detallado incluyó:

- backend: 125 archivos TypeScript de fuente, 90 archivos de prueba bajo `backend/test`, 14 integraciones PostgreSQL, 2 archivos de integración Supabase, Prisma/schema/migraciones, 69 rutas, OpenAPI, Postman, env, scripts, CI y documentación;
- frontend: 148 archivos TypeScript/TSX de fuente, 59 tests Vitest, 20 specs Playwright, 3 specs `real-backend`, configs Vite/Vitest/Playwright, env, Vercel, CI y documentación;
- documentación auxiliar: README raíz, README de frontend, diagramas de arquitectura/clases/secuencia/modelo relacional, matriz de trazabilidad, ambientes, recuperación, Supabase, Qase y `docs/M-Team_Modelo_de_Datos.docx`;
- evidencia externa de lectura: ejecuciones públicas de GitHub Actions asociadas a los commits indicados.

El `M-Team_Manual_Tecnico_Completo.docx` solicitado no fue localizado. El DOCX disponible de modelo de datos fue revisado estructuralmente mediante OOXML; contiene dos saltos de página y tablas de modelo, pero no sustituye al manual ausente. El renderer automático del skill de documentos no pudo ejecutarse porque el Python local no dispone de `pdf2image` y Windows no tiene LibreOffice en PATH; por ello no se presenta una conclusión visual sobre su maquetación.

## D. Resultados técnicos

### D.1 Arquitectura demostrada

La arquitectura que sí puede sostenerse con el código es:

```text
React 19 + Vite 8 + TypeScript 6
        │ VITE_API_URL / fetch / JWT
        ▼
Express 5 + TypeScript 7 (backend /api)
        ├── validadores Zod + middlewares auth/roles
        ├── controladores → servicios → repositorios
        ├── Prisma 7 + pg
        ▼
PostgreSQL / Supabase Database

Backend → Supabase Storage: fotos públicas y certificados privados firmados
Backend → Gmail SMTP: recuperación de contraseña
Frontend → Google Maps URL/visualización pública; la clave VITE no es una credencial de backend
```

La evidencia directa es `backend/src/app.ts:14-25`, `backend/src/route/index.ts:90-...`, `backend/prisma.config.ts`, `backend/prisma/schema.prisma`, `backend/src/service/*storage.ts`, `backend/src/service/recovery-email-service.ts`, `frontend/src/config/environment.ts` y `frontend/src/service/backend-api.ts`. La existencia de estos componentes demuestra la integración programada, no que las instancias externas estén configuradas o disponibles.

### D.2 Matriz completa de endpoints

Resultado del verificador estructural: **69 operaciones Express y 69 operaciones OpenAPI; diferencia de conjuntos = 0**. Las columnas OpenAPI y Router indican correspondencia de método y path; `1` significa “documentada e implementada” a nivel estructural. `4-Cn` significa “ruta presente y documentada, pero con diferencia contractual explicada después”.

| Método | Ruta | OpenAPI | Router activo | Autenticación | Roles | Estado |
|---|---|---:|---:|---|---|---|
| GET | `/access-attempts` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/admin/branches` | Sí | Sí | JWT + password completo | ADMIN | 4-C5 |
| GET | `/admin/branches/{branchId}` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/admin/dashboard/metrics` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/auth/me` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 1 |
| GET | `/branches` | Sí | Sí | Pública | — | 1 |
| GET | `/branches/{branchId}` | Sí | Sí | Pública | — | 1 |
| GET | `/events` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 4-C1 |
| GET | `/events/{eventId}` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 1 |
| GET | `/health` | Sí | Sí | Pública | — | 1 |
| GET | `/medical-certificates` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/medical-certificates/{certificateId}` | Sí | Sí | JWT + password completo | MEMBER/ADMIN, con ownership para socio | 1 |
| GET | `/medical-certificates/{certificateId}/file` | Sí | Sí | JWT + password completo | MEMBER/ADMIN, con ownership para socio | 1 |
| GET | `/members` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/members/{memberId}/payments` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/members/me/medical-certificates` | Sí | Sí | JWT + password completo | MEMBER | 1 |
| GET | `/members/me/membership` | Sí | Sí | JWT + password completo | MEMBER | 4-C4 |
| GET | `/members/me/payments` | Sí | Sí | JWT + password completo | MEMBER | 1 |
| GET | `/membership-prices` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/membership-prices/current` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN autenticado | 4-C4 |
| GET | `/news-posts` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 4-C1 |
| GET | `/news-posts/{newsPostId}` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 1 |
| GET | `/notifications` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 4-C5 |
| GET | `/notifications/{notificationId}` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN, sólo propia | 1 |
| GET | `/payments` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/payments/summary` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/trainer/classes` | Sí | Sí | JWT + password completo | TRAINER | 1 |
| GET | `/trainers` | Sí | Sí | Pública | — | 1 |
| GET | `/users` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/users/{userId}` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/users/{userId}/audit-logs` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| GET | `/users/me` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 1 |
| GET | `/weekly-schedules` | Sí | Sí | Pública | — | 1 |
| GET | `/weekly-schedules/{scheduleId}` | Sí | Sí | Pública | — | 1 |
| PATCH | `/auth/password` | Sí | Sí | JWT | MEMBER/TRAINER/ADMIN | 1 |
| PATCH | `/branches/{branchId}` | Sí | Sí | JWT + password completo | ADMIN | 4-C3 |
| PATCH | `/branches/{branchId}/status` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| PATCH | `/events/{eventId}` | Sí | Sí | JWT + password completo | ADMIN | 4-C2 |
| PATCH | `/events/{eventId}/status` | Sí | Sí | JWT + password completo | ADMIN | 4-C2 |
| PATCH | `/medical-certificates/{certificateId}/review` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| PATCH | `/news-posts/{newsPostId}` | Sí | Sí | JWT + password completo | ADMIN | 4-C2 |
| PATCH | `/news-posts/{newsPostId}/status` | Sí | Sí | JWT + password completo | ADMIN | 4-C2 |
| PATCH | `/notifications/read-status` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 1 |
| PATCH | `/notifications/{notificationId}/read-status` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN, sólo propia | 1 |
| PATCH | `/scheduled-classes/{classId}` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| PATCH | `/users/me` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 1 |
| PATCH | `/users/{userId}` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| PATCH | `/users/{userId}/status` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| POST | `/access-attempts` | Sí | Sí | JWT + password completo | MEMBER/TRAINER | 1 |
| POST | `/auth/login` | Sí | Sí | Pública | — | 1 |
| POST | `/auth/logout` | Sí | Sí | JWT | MEMBER/TRAINER/ADMIN | 1 |
| POST | `/auth/password-recovery` | Sí | Sí | Pública + rate limit IP | — | 1 |
| POST | `/auth/password-recovery/complete` | Sí | Sí | Pública + rate limit IP | — | 1 |
| POST | `/auth/register` | Sí | Sí | Pública | — | 1 |
| POST | `/branches` | Sí | Sí | JWT + password completo | ADMIN | 4-C3 |
| POST | `/events` | Sí | Sí | JWT + password completo | ADMIN | 4-C2 |
| POST | `/members/me/medical-certificates` | Sí | Sí | JWT + password completo | MEMBER | 1 |
| POST | `/membership-prices` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| POST | `/news-posts` | Sí | Sí | JWT + password completo | ADMIN | 4-C2 |
| POST | `/payments` | Sí | Sí | JWT + password completo | ADMIN | 4-C2 |
| POST | `/payments/{paymentId}/voids` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| POST | `/payments/previews` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| POST | `/scheduled-classes` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| POST | `/users` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| POST | `/users/{userId}/password-resets` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| POST | `/weekly-schedules/{scheduleId}/copies` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| PUT | `/users/{userId}/trainer-branches` | Sí | Sí | JWT + password completo | ADMIN | 1 |
| PUT | `/users/me/photo` | Sí | Sí | JWT + password completo | MEMBER/TRAINER/ADMIN | 1 |
| DELETE | `/scheduled-classes/{classId}` | Sí | Sí | JWT + password completo | ADMIN | 1 |

#### Diferencias contractuales encontradas

- **C1 — filtros incompletos:** `eventListQuerySchema` (`backend/src/validator/event-validator.ts:6-39`) acepta `page`, `limit`, `search` y `status`, pero el bloque `/events` del OpenAPI sólo documenta parte de los filtros. `newsPostListQuerySchema` (`backend/src/validator/news-post-validator.ts:7-31`) acepta `page`, `limit`, `search`, `audience` y `status`, mientras `/news-posts` no expone todos.
- **C2 — responses genéricas:** eventos, novedades y creación de pagos usan `Created`/`Success` genéricos en OpenAPI aunque los controladores devuelven objetos concretos. La respuesta no queda inutilizable, pero el manual no puede afirmar un contrato de payload exacto basándose sólo en esos `$ref`.
- **C3 — bodies de sedes genéricos:** `POST /branches` y `PATCH /branches/{branchId}` referencian `GenericJson` (`backend/docs/openapi.yaml:1047,1072`), mientras `branch-validator.ts:45-72` define schemas estrictos con campos concretos.
- **C4 — respuestas y errores incompletos:** `/membership-prices/current` y `/members/me/membership` usan response genérico; además, el rol y los errores 401/403 no están descritos con la misma precisión que el middleware.
- **C5 — query booleano representado como string:** los queries de administración de sedes y notificaciones reciben valores de Express como strings y los validadores usan `z.enum(["true","false"])` (`branch-validator.ts:29-37` y equivalente de notificaciones), pero OpenAPI declara `boolean` (`openapi.yaml:1110,1547`).
- La verificación actual cubre método/path y `operationId`, no prueba que cada request produzca el response esperado ni que una instancia PostgreSQL/Supabase/Gmail esté disponible.

### D.3 Colección Postman y propuesta de ampliación

#### Estado actual

`backend/docs/m-team-api.postman_collection.json` contiene 69 requests y seis carpetas. `backend/docs/m-team-local.postman_environment.json` contiene variables de entorno por nombre (`baseUrl`, token, recovery token, IDs, paginación, fechas e idempotencia), pero no se reproducen valores sensibles en este informe.

Hallazgos:

- método/path coincide con las 69 operaciones activas;
- 69/69 requests tienen cero eventos Postman: no hay pre-request, test assertions, extracción automática del token ni chaining;
- `createPayment` envía `Idempotency-Key`; `createMembershipPrice` no lo envía, aunque el backend y OpenAPI lo exigen;
- `listEvents`, `listNewsPosts` y `listNotifications` no contienen variantes de los filtros reales; las listas de sedes sólo muestran page/limit;
- la colección no contiene ejemplos de response ni aserciones de status/schema;
- no hay endpoint de provisioning de `AccessPoint`; no debe inventarse una solicitud QR administrativa. El flujo disponible es intentar acceso con QR y consultar el historial.

#### Propuesta de ampliación por módulos

Todas las rutas se entienden bajo `/api`. Los bodies son los schemas Zod/OpenAPI vigentes; los nombres de campos concretos deben copiarse desde `openapi.yaml` y los validadores al implementar la colección.

| Módulo | Solicitudes a incluir | Auth | Parámetros/body | Response esperado a documentar |
|---|---|---|---|---|
| Autenticación | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `PATCH /auth/password`, `POST /auth/password-recovery`, `POST /auth/password-recovery/complete` | Públicas para register/login/recovery; bearer para sesión | JSON de registro/login/password; recovery con email/token/password | 201/200 con usuario/token, 204 en logout/password/complete, 202 genérico en recovery, 400/429/503 documentados |
| Usuarios | `GET/PATCH /users/me`, `PUT /users/me/photo`; `GET/POST /users`, `GET/PATCH /users/{userId}`, `PATCH /users/{userId}/status`, `PUT /users/{userId}/trainer-branches`, `GET /users/{userId}/audit-logs`, `POST /users/{userId}/password-resets` | Socio/entrenador para self; ADMIN para administración | IDs, filtros/paginación; multipart `file` para foto; JSON estricto para updates | User/profile, paginated lists, 204 en operaciones sin body, errores de rol/ownership |
| Socios | `GET /members`; `GET /members/me/membership`; `GET /members/me/payments`; `GET /members/{memberId}/payments` | ADMIN para listado de socios/pagos ajenos; MEMBER para sus datos | page/limit, memberId y filtros de pagos | Paginados; membership con estado/calendario; 401/403/404 |
| Entrenadores | `GET /trainers`; `GET /trainer/classes` | Pública para directorio; TRAINER para clases propias | page/limit, fecha/intervalo según schema | Directorio y clases paginadas |
| Sedes | `GET /branches`, `GET /branches/{branchId}`; `GET /admin/branches`, `GET /admin/branches/{branchId}`; `POST /branches`, `PATCH /branches/{branchId}`, `PATCH /branches/{branchId}/status` | Públicas para consulta pública; ADMIN para administración | search/page/limit/isActive; body de sede/status | Sede concreta o lista; 201/200; no usar body genérico en la documentación nueva |
| Cuotas | `GET /membership-prices/current`, `GET /membership-prices`, `POST /membership-prices` | Auth completada para current; ADMIN para historial/alta | page/limit; body de precio; `Idempotency-Key` UUID obligatorio en alta | Precio actual/lista; 201 en alta; repetir misma clave debe demostrar idempotencia |
| Pagos | `GET /payments`, `/payments/summary`, `POST /payments`, `POST /payments/previews`, `POST /payments/{paymentId}/voids`, `GET /members/me/payments`, `GET /members/{memberId}/payments` | ADMIN salvo endpoint propio de MEMBER | filtros from/to/status/member; body de pago/preview/void; `Idempotency-Key` UUID en create | Payment/summary/preview; 201 en create; estado de void; casos 400/404/409 |
| Aptos médicos | `GET/POST /members/me/medical-certificates`, `GET /medical-certificates`, `GET/PATCH /medical-certificates/{certificateId}`, `GET /medical-certificates/{certificateId}/file`, `PATCH /medical-certificates/{certificateId}/review` | MEMBER para propios; ADMIN para lista/review; member/admin para documento autorizado | multipart `file` PDF/JPG/PNG, máximo 5 MB; filters/status/review JSON | 201/lista/review; URL firmada 300 s; rechazo de MIME, firma, tamaño y ownership |
| Accesos QR | `POST /access-attempts`, `GET /access-attempts` | MEMBER/TRAINER para intentar; ADMIN para historial | QR token y datos del intento; paginación/search en historial | Resultado de acceso y razón de rechazo; no agregar CRUD de QR porque no existe ruta |
| Clases y cronogramas | `GET /weekly-schedules`, `GET /weekly-schedules/{scheduleId}`, `POST /weekly-schedules/{scheduleId}/copies`, `GET /trainer/classes`, `POST/PATCH/DELETE /scheduled-classes...` | Consulta pública; TRAINER para propias; ADMIN para mutaciones | week/scheduleId/classId; body de clase/copia | Cronograma/clase; 201/204; conflictos y 404 |
| Eventos | `GET /events`, `GET /events/{eventId}`, `POST/PATCH /events/{eventId}`, `PATCH /events/{eventId}/status` | MEMBER/TRAINER/ADMIN lectura; ADMIN mutación | search/status/page/limit; body de evento/status | paginated Event y status; 400/401/403/404/409 |
| Novedades | `GET /news-posts`, `GET /news-posts/{newsPostId}`, `POST/PATCH /news-posts/{newsPostId}`, `PATCH /news-posts/{newsPostId}/status` | MEMBER/TRAINER/ADMIN lectura; ADMIN mutación | search/audience/status/page/limit; body de publicación/status | paginated NewsPost y status; errores equivalentes |
| Notificaciones | `GET /notifications`, `GET /notifications/{notificationId}`, `PATCH /notifications/read-status`, `PATCH /notifications/{notificationId}/read-status` | MEMBER/TRAINER/ADMIN | page/limit/isRead; IDs; body de lectura | inbox paginada, `unreadCount`, 204/read-status, ownership |
| Administración | `GET /admin/dashboard/metrics`, `GET/POST/PATCH ...` administrativos, `GET /members`, `/access-attempts`, `/medical-certificates`, `/payments` | ADMIN | incluir variables sintéticas de todos los IDs y filtros | métricas, auditoría y respuestas paginadas; incluir 401/403 en tests |

La colección ampliada debe añadir para cada request: `pm.test` de status, extracción controlada de token sólo en entorno local, validación mínima de campos, `Idempotency-Key` en cuotas/pagos, y una carpeta de precondiciones que explique qué datos sintéticos debe crear el operador. No debe contener secretos ni apuntar por defecto a una URL productiva.

### D.4 Estrategia segura de validación Postman

No se ejecutó la colección ni se hicieron escrituras. La estrategia reproducible para el equipo es:

1. Usar una base PostgreSQL descartable del Compose del backend (`postgres:16-alpine`, bind local `127.0.0.1:55432`) o el contenedor equivalente de CI.
2. Copiar `.env.test.example` a un `.env.test` no versionado y usar sólo credenciales sintéticas locales. No reutilizar `DATABASE_URL`, Supabase ni Gmail de ningún entorno compartido.
3. Ejecutar instalación, `prisma generate`, `prisma validate` y `prisma migrate deploy` sólo contra esa base descartable; la auditoría no ejecutó estos pasos.
4. Iniciar backend en un puerto local y comprobar `GET /api/health`; configurar `baseUrl` de Postman en `/api`.
5. Crear o sembrar usuarios sintéticos por rol; guardar sólo los IDs locales en el environment. Login debe ser la precondición de las carpetas protegidas.
6. Ejecutar primero lecturas públicas, autenticación, lecturas de cada rol y luego escrituras agrupadas; verificar 201/204 y una lectura posterior. Probar dos veces la misma idempotency key en cuotas y pagos.
7. Verificar explícitamente 401, 403, 404, 409, 400 por validación, filtros y paginación. Las URLs de certificado deben verificarse con mocks o Storage aislado, no con el bucket real de producción.
8. Eliminar el entorno local al terminar. No enviar correos ni ejecutar escrituras contra Render, Vercel, Supabase productivo o cualquier base compartida.

### D.5 Tests, CI, cobertura y calidad

#### Backend CI

`.github/workflows/backend-ci.yml`:

- eventos: `push` y `pull_request` en `develop` y `main`, limitado a cambios backend/workflow;
- Ubuntu, servicio PostgreSQL 17, Node 22, `npm ci --ignore-scripts`, rebuild de binarios, `prisma generate`, `prisma validate`, `prisma migrate deploy` en DB de CI;
- integración PostgreSQL de notificaciones, unit/API tests con `npm test`, build y `openapi:validate`;
- Qase se activa sólo si existen secret/variable; no se expone el token en el reporte;
- no ejecuta `routes:verify`, no sube coverage como artifact y no prueba Supabase Storage real.

#### Sonar backend

`.github/workflows/sonarcloud.yml` ejecuta Jest con coverage, exige que `backend/coverage/lcov.info` exista y contenga líneas ejecutadas, y usa `sonar.qualitygate.wait=true`. Excluye tests, generated, tipos, scripts y los documentos binarios. No hay un porcentaje global codificado en este workflow; el 80% aparece como objetivo de cobertura del módulo de notificaciones en `jest.coverage.notifications.config.cjs:1,15-17`.

#### Frontend E2E

`.github/workflows/frontend-e2e.yml`:

- eventos: `push`/`pull_request` en `develop` y `main`;
- PostgreSQL 17, Node 22, instala frontend y Chromium;
- hace un segundo checkout de `MTeamOrg/MTeamBackend` en `ref: develop`, sin fijar SHA; por tanto, una ejecución puede combinar frontend auditado con un backend remoto distinto al commit que disparó el workflow;
- ejecuta migraciones y seed en DB descartable, construye/inicia backend en puerto 3100 y espera `/api/health`;
- ejecuta Playwright contra Vite en 4173; sube `frontend/playwright-report/` y `frontend/test-results/` incluso si falla;
- define `E2E_REAL_API_URL` y `E2E_REAL_FIXTURE` para las tres specs real-backend. El resto de specs usa mocks de API/aborts y no prueba PostgreSQL, Supabase ni Gmail.

#### Sonar frontend

`.github/workflows/sonarcloud.yml` ejecuta build, `npm run test:coverage`, comprueba `coverage/lcov.info` y envía el reporte con exclusiones de tests, e2e, configs, coverage y dist. No declara `sonar.qualitygate.wait=true`, por lo que el manual debe consultar el resultado de Quality Gate en la plataforma en vez de inferirlo del exit code del workflow.

#### Evidencia histórica de GitHub Actions

| Repositorio | Workflow/run | Commit | Fecha UTC | Conclusión | Enlace |
|---|---|---|---|---|---|
| Backend | Backend CI #143 | `793be2e4...` | 2026-10-29 18:23 | success | [run 40930311285](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40930311285) |
| Backend | SonarQube #51 | `793be2e4...` | 2026-10-29 18:23 | success | [run 40930311280](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40930311280) |
| Backend | Backend CI #142 | `38baa1d3...` | 2026-10-29 18:16 | success | [run 40929208226](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40929208226) |
| Backend | SonarQube #50 | `38baa1d3...` | 2026-10-29 18:16 | failure | [run 40929208227](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40929208227) |
| Backend | Backend CI #141 | `dd4b7329...` | 2026-10-29 18:06 | success | [run 40927678529](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40927678529) |
| Backend | SonarQube #49 | `dd4b7329...` | 2026-10-29 18:06 | failure | [run 40927678701](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40927678701) |
| Frontend | Frontend E2E #23 | `73f477b8...` | 2026-10-29 18:01 | success | [run 40926939096](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40926939096) |
| Frontend | SonarQube #125 | `73f477b8...` | 2026-10-29 18:01 | success | [run 40926939032](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40926939032) |
| Frontend | Frontend E2E #20 | `c6166af5...` | 2026-10-26 19:41 | success | [run 40389019046](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40389019046) |
| Frontend | SonarQube #123 | `c6166af5...` | 2026-10-26 19:41 | success | [run 40389019278](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40389019278) |

Las conclusiones anteriores son de runs específicos y no son métricas actuales de producción ni sustituyen la consulta de logs/artifacts.

#### Cobertura

Configuración:

- backend: Jest 29 con V8; `backend/jest.coverage.config.cjs:5-20` genera text, JSON summary y LCOV; el workflow no persiste el resultado como artifact;
- frontend: Vitest 5 con `@vitest/coverage-v8`; `frontend/vite.config.ts:31-37` genera text, HTML y LCOV en `frontend/coverage`;
- ambos cubren líneas, statements, functions y branches mediante LCOV; las cifras globales de Quality Gate deben venir de Sonar.

Se encontraron LCOV locales, con fecha anterior a los HEAD auditados:

| Archivo local | Última escritura | Statements/lines equivalentes | Branches | Functions | Uso permitido |
|---|---|---:|---:|---:|---|
| `backend/coverage/lcov.info` | 2026-10-26 | 7.157/8.585 líneas = 83,36% | 983/1.110 = 88,56% | 351/449 = 78,17% | Referencia local histórica; no atribuir a `793be2e`. |
| `MTeamFrontend/frontend/coverage/lcov.info` | 2026-10-25 | 2.178/2.336 líneas = 93,24% | 2.416/2.917 = 82,82% | 885/1.033 = 85,67% | Referencia local histórica; no atribuir a `c6166af`. |

Para completar el manual, una persona debe abrir SonarCloud y registrar, para cada project key y commit, Quality Gate, líneas, condiciones/branches, functions y statements; además debe conservar el enlace al análisis. Qase debe usarse para resultados de pruebas, no como fuente de cobertura.

### D.6 Playwright, integración real y Qase

Clasificación encontrada:

| Tipo | Evidencia | Qué prueba | Qué no prueba |
|---|---|---|---|
| Vitest unit/component | 59 specs bajo `frontend/src` | servicios, hooks, componentes, validaciones, cliente API | navegador real, backend real, DB, SMTP |
| Playwright mock | 17 specs bajo `frontend/e2e` fuera de `real-backend` | navegación, UI, estados y errores con `page.route`/`route.fulfill`/abort | contratos reales, persistencia, Storage, correo |
| Playwright real-backend | `admin-lists.real.spec.ts`, `payments.real.spec.ts`, `notifications.real.spec.ts` | navegador → API local → PostgreSQL descartable | Supabase Storage real, producción, entrega Gmail |
| Jest unit/API | 90 archivos bajo `backend/test` | controladores, servicios, repositorios con mocks y Supertest | proveedor productivo y despliegue |
| PostgreSQL integration | 14 archivos | Prisma/migraciones, notificaciones, pagos, reset, acceso, certificados | bucket Supabase y Gmail real |
| Supabase integration | `test/integration/supabase/requirements.integration.ts` y `target-guard.ts` | sólo si se habilita target aislado y variables de guardas | configuración productiva sin ejecutar esa suite |

Qase sólo se activa con `QASE_MODE=testops`, `QASE_TESTOPS_API_TOKEN` y `QASE_TESTOPS_PROJECT`; el título se separa por suite. No se encontraron IDs numéricos de casos vinculados en los tests. Qase no calcula LCOV.

Para consultar resultados: en GitHub abrir el run, revisar summary, logs y artifacts; en Playwright abrir el artifact `frontend-playwright-results`, `playwright-report/index.html`, screenshots y trace; en Qase filtrar por proyecto/título y revisar passed/failed/skipped. La vinculación con casos manuales está pendiente de crear los casos e incorporar sus IDs reales, sin inventarlos.

### D.7 Tecnologías y versiones

| Tecnología | Declarada | Lockfile resuelto | CI | Instalación local observada | Producción |
|---|---|---|---|---|---|
| Node.js backend/frontend | No fijada en `engines` | No aplica | 22 en los workflows | 24.11.1 | No verificable |
| npm | No fijado | lockfile v3 | npm incluido en Node 22 | 11.6.2 (`npm.cmd`) | No verificable |
| PostgreSQL backend local | `postgres:16-alpine` en Compose | No aplica | 17 | No se ejecutó servidor | Supabase/proveedor no verificable |
| PostgreSQL frontend real E2E | README usa 17 | No aplica | 17 | No se ejecutó | No verificable |
| React / react-dom | `^19.2.8` | 19.2.8 | vía npm ci | instalada en `node_modules`, versión lock 19.2.8 | No verificable |
| Vite | `^8.2.0` | 8.2.1 | vía npm ci | lock 8.2.1 | No verificable |
| TypeScript frontend | `~6.0.2` | 6.0.3 | vía npm ci | lock 6.0.3 | No verificable |
| TypeScript backend | `^7.0.2` | 7.0.2 | vía npm ci | lock 7.0.2 | No verificable |
| Express | `^5.2.1` | 5.2.1 | vía npm ci | lock 5.2.1 | No verificable |
| Prisma Client | `^7.10.0` | 7.10.0 | generate/migrate | lock 7.10.0 | No verificable |
| Prisma CLI | `^7.10.0` | 7.10.1 | generate/migrate | lock 7.10.1 | No verificable |
| Jest | `^29.7.0` | 29.7.0 | `npm test`, coverage | lock 29.7.0 | No aplica |
| Vitest | `^5.0.1` | 5.0.1 | unit/coverage frontend | lock 5.0.1 | No aplica |
| Playwright | `^1.64.1` | 1.64.1 | E2E Chromium | lock 1.64.1 | No aplica |

La única versión local observada es la de Node/npm del equipo auditor. La diferencia Prisma Client 7.10.0 frente a CLI 7.10.1 está resuelta por el lockfile, pero conviene decidir si el manual debe describirlas por separado.

### D.8 PostgreSQL 16 frente a 17

La diferencia está **confirmada**, no justificada. Las migraciones usan tipos, constraints, índices, transacciones y SQL PostgreSQL estándar; eso es evidencia de compatibilidad probable, no una prueba formal entre majors. El backend CI y frontend E2E validan sobre 17; el Compose de pruebas local del backend valida, cuando se ejecuta, sobre 16. El riesgo es que el equipo obtenga resultados distintos por planner, extensiones, imagen, parámetros o diferencias de compatibilidad.

Recomendación: elegir una versión objetivo única para desarrollo, CI y documentación, preferentemente la misma que el entorno administrado que el equipo confirme; si se conserva 16 local y 17 CI, agregar una matriz explícita y una prueba de migración/CRUD en ambas. No se cambió ninguna versión.

### D.9 Instalación limpia reconstruida

Procedimiento que puede entrar al manual, distinguiendo pasos documentados de pasos no ejecutados en esta auditoría:

1. Instalar Git, Node 22 LTS compatible con CI, npm incluido y Docker Desktop/PostgreSQL local. No usar Node 24 como referencia del manual hasta decidir compatibilidad.
2. Clonar ambos repositorios en directorios separados; mantener backend y frontend con sus respectivos lockfiles.
3. Backend: `cd backend; npm ci`; frontend: `cd frontend; npm ci`.
4. Backend: copiar `.env.example` a `.env` local y completar sólo valores locales; frontend: copiar `frontend/.env.example` a `frontend/.env`. No commitear archivos `.env`.
5. Levantar PostgreSQL descartable. Para tests backend, el Compose documentado usa `127.0.0.1:55432`; no apuntar `DATABASE_URL`/`DIRECT_URL` a una base compartida.
6. Ejecutar `npm run prisma:generate` y `npm run prisma:validate`; aplicar `npm run prisma:migrate:deploy` sólo en la base local descartable. En CI este paso sí se ejecuta contra el servicio efímero.
7. Preparar un administrador local con el script documentado `npm run bootstrap:admin`, sin guardar la contraseña en el manual.
8. Arrancar backend con `npm run dev`; comprobar `GET http://localhost:3000/api/health` y consultar Swagger en `/api/docs`.
9. Configurar `CORS_ORIGIN` con el origen real del Vite local y `VITE_API_URL=http://localhost:3000/api`.
10. Arrancar frontend con `npm run dev`; comprobar login, `/auth/me`, navegación y una lectura pública.
11. Para integración local real, usar sólo el flujo documentado de fixture/seed y un backend en puerto separado; no habilitar `E2E_REAL_API_URL` contra staging/producción.
12. Problemas habituales: `npm.ps1` bloqueado en PowerShell → usar `npm.cmd`; `DIRECT_URL` faltante → revisar `prisma.config.ts`; CORS → revisar origen exacto; Supabase 503 → revisar URL, bucket y clave sólo en backend; recuperación 503 → revisar el par Gmail; ruta 401/403 → distinguir token válido de password-change pendiente.

Lo documentado y ejecutado por CI incluye `npm ci`, Prisma generate/validate/migrate, tests, build, health polling, OpenAPI validation y Playwright. Esta auditoría no ejecutó migraciones, tests completos, build ni envió requests de escritura.

### D.10 Variables de entorno y despliegue

#### Variables esperadas

| Variable | Componente | Obligatoria | Ambiente | Función |
|---|---|---:|---|---|
| `NODE_ENV`, `APP_ENV` | Backend | Sí/default según schema | local/test/staging/prod | Selección de ambiente y carga `.env.*`. |
| `PORT` | Backend | Default 3000 | todos | Puerto HTTP. |
| `DATABASE_URL` | Backend | Sí | todos | Conexión de runtime Prisma/pg. |
| `DIRECT_URL` | Prisma CLI | Sí para `prisma.config.ts` | migraciones/validación | Datasource directo para Prisma. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Backend | Secret sí; expiración default | todos | Firma y TTL de JWT. |
| `CORS_ORIGIN` | Backend | default local | todos | Origen permitido. |
| `FRONTEND_PUBLIC_URL` | Backend | Opcional, necesario para links de recuperación | todos con correo | URL pública del frontend en enlace de reset. |
| `SUPABASE_URL` | Backend Storage | Si se usa Storage | por proyecto | Endpoint del proyecto. |
| `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` | Backend Storage | Si se usa Storage | secreto | Autorización server-to-server; nunca frontend. |
| `SUPABASE_STORAGE_BUCKET` | Backend | Si se usan certificados | privado | Bucket de aptos y documentos. |
| `SUPABASE_PROFILE_PHOTO_BUCKET` | Backend | Si se usan fotos | público | Bucket público de fotos. |
| `GOOGLE_SMTP_USER`, `GOOGLE_APP_PASSWORD` | Backend | Ambos o ninguno | ambiente con recovery | Gmail SMTP; credenciales privadas. |
| `VITE_API_URL` | Frontend | default local | build/deploy | URL base de REST incorporada al bundle. Pública. |
| `VITE_GOOGLE_MAPS_API_KEY` | Frontend | Opcional según vista | build/deploy | Configuración pública de Maps; no es un secreto de backend. |
| `E2E_REAL_API_URL`, `E2E_REAL_FIXTURE` | Frontend E2E | Sólo real E2E | CI/local aislado | API y fixture del backend efímero. |
| `QASE_MODE`, `QASE_TESTOPS_API_TOKEN`, `QASE_TESTOPS_PROJECT`, `QASE_TESTOPS_RUN_TITLE` | CI/tests | Condicional | CI/local | Reporter Qase; no son runtime productivo. |
| `SMOKE_API_URL`, `SMOKE_MEMBER_INITIAL_PASSWORD`, `SMOKE_MEMBER_PASSWORD`, `SMOKE_TRAINER_PASSWORD` | Smoke backend | Sólo smoke | local aislado | Datos sintéticos; no usar contra producción. |

El repositorio no demuestra qué nombres están efectivamente cargados en Vercel/Render. La tabla debe aparecer en el manual separando variables públicas `VITE_*` de secretos backend.

#### Dominios y proveedores

No se encontraron dominios productivos ni backend/frontend publicados en README, docs, workflows o configuración local. `frontend/vercel.json` sólo redirige cualquier path a `index.html`; no contiene proyecto, dominio ni commit. No hay `render.yaml` ni `.vercel/project.json` en el checkout auditado. Los dominios y commits desplegados son **NO VERIFICABLES** desde estos repositorios.

Consulta externa requerida:

- **Vercel:** proyecto → Deployments → Production; registrar dominio, estado, fecha, branch y Source Commit; Project Settings → Environment Variables, sólo nombres/ambientes y presencia.
- **Render:** servicio backend → Events/Deploys; registrar URL, branch, commit, fecha, runtime y variables configuradas; no copiar valores.
- **Supabase:** proyecto por ambiente, ref, Database/Storage/Auth y políticas activas; verificar que `SUPABASE_URL` coincida con el proyecto permitido por el guard.
- **Producción:** no asumir que `main` o el último `develop` están desplegados.

### D.11 Supabase Storage, archivos y pruebas

Implementación demostrada:

- `profile-photo-upload-middleware.ts:7-35`: un archivo, máximo 5 MB, `image/jpeg` o `image/png`, con firma binaria validada;
- `medical-certificate-upload-middleware.ts:7-45`: un archivo, máximo 5 MB, PDF/JPG/PNG, con firma binaria validada;
- `profile-photo-storage.ts:25-74`: upsert en ruta estable por usuario y URL pública versionada;
- `medical-certificate-storage.ts:61-111`: bucket privado, URL firmada por defecto por 300 segundos, normalización de path y rechazo de `.`/`..`;
- `medical-certificate-route.ts:16-29`: member/admin según operación y ownership en el servicio/controlador;
- `supabase-setup.md:164-171`: nombres de variables y separación de buckets.

Pruebas existentes cubren middleware, servicios, rutas y repositorios; incluyen formatos inválidos, tamaño límite, firma inválida, rol, password pendiente, ownership, revisión y respuesta de URL firmada simulada. La suite `test/integration/supabase/requirements.integration.ts` tiene guards para target aislado, pero no se ejecutó. La migración `20260925120000_secure_supabase_data_api` habilita RLS/revoca roles en SQL; no prueba que Storage policies estén activas en el proyecto de Supabase.

Conclusión: el manual puede describir controles implementados y pruebas mock/locales; no puede afirmar “Storage seguro en producción” sin evidencia externa de buckets, policies, proyecto y prueba de aceptación.

### D.12 Recuperación de contraseña y Gmail SMTP

Código confirmado:

- `account-recovery-service.ts:9-53`: genera 32 bytes aleatorios, persiste SHA-256, expira a 30 minutos, no revela si el email existe y no registra token;
- `recovery-email-service.ts:10-...`: Nodemailer con `smtp.gmail.com`, puerto seguro 465, timeouts y sanitización de errores;
- `account-recovery-repository.ts:38-58`: transacción con lock de usuario, verifica estado/fingerprint, consume token condicionalmente, borra tokens del usuario, incrementa `sessionVersion` y registra auditoría;
- `schema.prisma:100,349-358` y migraciones `20261015150000_account_recovery`/`20261016140000_revoke_sessions_on_credential_reset`: soporte persistente de tokens y revocación de sesiones;
- frontend `auth-service.ts` llama endpoints públicos sin bearer; Playwright y Vitest prueban UI/API mock.

No se enviaron emails reales. No hay un test de aceptación que demuestre que Gmail aceptó y entregó un mensaje. La evidencia permite afirmar que el flujo está implementado con esa estrategia, no que el proveedor o la bandeja estén operativos en cada ambiente.

Documentación que debe corregirse:

- `backend/docs/account-recovery.md:30` todavía afirma que JWT no tiene revocación; contradice `sessionVersion` y el repositorio actual.
- `MTeamFrontend/docs/account-recovery.md:7,17` menciona `RESEND_API_KEY`, `MAIL_FROM` y Resend; el backend actual usa `GOOGLE_SMTP_USER`/`GOOGLE_APP_PASSWORD`.
- `docs/diagramas-de-secuencia.md:32` dice que la recuperación por correo está fuera de alcance; ya existe.
- `docs/matriz-de-trazabilidad.md:18` todavía describe recovery como administrativo sin correo.

## E. Inconsistencias documentales

### E.1 Diagrama de clases

`docs/diagrama-de-clases.md` es conceptual y no representa completamente Prisma:

- `User` no incluye `sessionVersion` ni la relación con `PasswordRecoveryToken`;
- `Payment` y `MembershipPrice` no incluyen sus claves de idempotencia;
- `Notification` no muestra `userId`/`dedupeKey` de forma completa;
- recovery token no aparece;
- las relaciones `MemberProfile 1—N Payment` y `MemberProfile 1—N MedicalCertificate` (`:191-192`) no son las FK reales: Prisma mantiene `memberId` apuntando a `User`;
- las relaciones de entrenador/sede/clase son útiles conceptualmente, pero el FK real de trainer usa `User`, tablas de perfil/relación deben explicitar esa diferencia.

### E.2 Modelo relacional

`docs/modelo-relacional.md` omite `session_version`, claves de idempotencia y la tabla `password_recovery_token`. Sus relaciones `member_profile → payment/medical_certificate` (`:174-175`) contradicen el esquema físico actual, donde esas entidades referencian `User`. También declara una relación opcional de weekly schedule que no coincide con `ScheduledClass.scheduleId` requerido. `notification.dedupe_key` sí está documentado, pero la documentación global debe incorporar el resto de cambios.

### E.3 Secuencia y trazabilidad

La secuencia de recovery y la matriz USR-04 están obsoletas. Las secuencias de pagos, notificaciones y clases son razonables como visión conceptual, pero deben agregar idempotencia, URLs firmadas, Gmail y relación real de ownership. No debe presentarse un diagrama conceptual como DDL fiel.

### E.4 README y guías de ambientes

El README backend describe las tecnologías y comandos principales, pero la disponibilidad de dominios, Supabase y SMTP sigue siendo dependiente de configuración externa. `docs/ambientes.md` es útil como política de separación, pero conserva frases de etapa previa y no incorpora las variables Gmail en su tabla principal. El README frontend indica que la mayoría de E2E simula API, lo cual debe quedar visible para no confundir cobertura de UI con integración real; también contiene una sección de integraciones que enumera como pendientes eventos/novedades/acceso aunque el backend y `backend-api.ts` ya los consumen.

## F. Pendientes externos y exactamente qué consultar

| Plataforma | Consulta mínima | Evidencia que debe guardar el equipo | Qué no afirmar sin ella |
|---|---|---|---|
| Vercel | proyecto, Production deployment, dominio, branch, SHA, fecha, build command/root, variables `VITE_*` y URL backend | enlace de deployment, SHA, fecha, lista de nombres de variables y screenshot/export sin valores | que `main` o un SHA específico está publicado |
| Render | servicio, URL, branch, commit, runtime Node, health check, variables backend y logs de arranque | enlace del deploy, commit, fecha, nombre de servicio y variables sin valores | que API/SMTP/DB están disponibles sólo porque existe el workflow |
| Supabase | project ref por ambiente, PostgreSQL major, buckets y visibility, Storage policies, RLS, expiración de signed URL y claves server | ref, nombres de buckets/policies, resultado de prueba aislada y fecha | que una migration o un documento activa policies en producción |
| SonarCloud | project key, branch/SHA, Quality Gate, lines/branches/functions/statements, fecha y exclusiones | URL del análisis y métricas del mismo SHA | métricas actuales a partir de LCOV local o un run histórico |
| Qase | proyecto, runs por título, passed/failed/skipped, casos, IDs y attachments | URL del run, export de resultados y mapping de casos | que reporter configurado equivale a resultados enviados o casos vinculados |
| Gmail | cuenta por ambiente, App Password rotada, límites, SPF/DKIM/DMARC, aceptación y entrega a buzón de prueba | resultado de prueba autorizada sin token ni credenciales | que SMTP acepta o entrega porque Nodemailer está implementado |

## G. Preguntas para el equipo

1. ¿Cuál es el `M-Team_Manual_Tecnico_Completo.docx` correcto y dónde debe leerse sin modificarlo?
2. ¿Se adopta `backend/docs/m-team-api.postman_collection.json` como colección oficial o debe conservarse otro nombre/versionado?
3. ¿Qué PostgreSQL mayor se considera objetivo para local, CI, staging y producción?
4. ¿Cuáles son las URLs definitivas de frontend y backend y qué SHA está actualmente en producción en cada proveedor?
5. ¿Qué proyecto/ref de Supabase corresponde a cada ambiente y qué políticas de Storage fueron aprobadas?
6. ¿Qué cuenta Gmail y qué política de envío se usarán en desarrollo, staging y producción?
7. ¿Cuál es el umbral oficial del Quality Gate para frontend y backend, y debe el workflow frontend esperar explícitamente al gate?
8. ¿Qué casos manuales ya existen en Qase y cuáles son sus IDs reales para vincular las pruebas automatizadas?
9. ¿Los diagramas finales deben describir el dominio conceptualmente o reflejar exactamente `schema.prisma` y sus nombres físicos?

## H. Recomendaciones para el Manual Técnico final

| Capítulo | Conservar | Corregir/ampliar | Eliminar o marcar |
|---|---|---|---|
| 1. Arquitectura | React/Vite → REST Express → Prisma/PostgreSQL; Storage y Google Maps | agregar Gmail SMTP, `/api`, Swagger, separación pública/privada de Storage y límites de lo que no fue verificado | afirmaciones de producción sin proveedor/SHA |
| 2. Tecnologías/versiones | tablas con package.json/lock/CI | separar backend/frontend, declarada/resuelta/CI/local; decidir PostgreSQL 16/17; indicar producción no verificada | “versión de producción” inferida del último commit |
| 3. Instalación | `npm ci`, env example, Prisma, health, CORS | procedimiento limpio con DB descartable, Node 22 recomendado, `DIRECT_URL`, bootstrap admin y errores comunes | secretos, contraseñas y URLs de DB reales |
| 4. Estructura/código | capas route/controller/service/repository y convenciones | incluir validadores, middlewares, storage, recovery y frontend `service/features/e2e` | diagramas de carpetas que ya no coincidan |
| 5. Pruebas/cobertura | Jest, Vitest, Playwright, LCOV, Sonar/Qase | distinguir mock vs real-backend vs PostgreSQL vs Supabase; agregar enlaces fechados y métricas del SHA | LCOV local histórico como métrica actual |
| 6. API/Swagger/Postman | matriz de 69 endpoints y `/api/docs` | corregir C1-C5, schemas/responses/roles/errores, ampliar Postman y explicar precondiciones | nombres de endpoint no existentes, CRUD QR no implementado |
| 7. Despliegue | política de ambientes y `vercel.json` SPA fallback | agregar dominios, variables sin valores, SHA/fecha/proveedor desde paneles | localhost como dominio productivo |
| 8. Seguridad/Storage | límites, firmas, roles, URLs firmadas, RLS SQL | añadir evidencia de policies reales, expiración aprobada, rotación y aislamiento | afirmar que RLS/Storage está activo en producción sólo por migration |
| 9. Recuperación | Gmail, token hashado, expiración, consumo, revocación | unificar backend/frontend, agregar aceptación de entrega externa, corregir trazabilidad y diagramas | Resend, `MAIL_FROM`, recovery sólo administrativo y JWT “sin revocación” |
| 10. Modelo y diagramas | valor conceptual del dominio | regenerar desde Prisma actual; incorporar sessionVersion, recovery, idempotencia, dedupe y FK a User | relaciones físicas incorrectas presentadas como esquema real |

## I. Anexo de trazabilidad

### I.1 Rutas y contratos

- Montaje HTTP: `backend/src/app.ts:14-25`.
- Registro de routers: `backend/src/route/index.ts:90-...`.
- Recuperación: `backend/src/route/account-recovery-route.ts:24-25`.
- Auth/self: `backend/src/route/auth-route.ts`, `protected-auth-route.ts`, `user-route.ts`.
- Administración: `backend/src/route/admin-user-route.ts`, `admin-dashboard-route.ts`, `member-route.ts`.
- Sedes: `backend/src/route/branch-route.ts:12-47`.
- Eventos/novedades: `backend/src/route/event-route.ts:14-18`, `news-post-route.ts:14-18`.
- Notificaciones: `backend/src/route/notification-route.ts:13-16`.
- QR/accesos: `backend/src/route/access-attempt-route.ts:31-32`.
- Pagos/cuotas: `backend/src/route/payment-route.ts`, `payment-preview-route.ts`, `membership-price-route.ts`.
- Clases/cronograma: `backend/src/route/scheduled-class-route.ts`, `weekly-schedule-route.ts`.
- Aptos: `backend/src/route/medical-certificate-route.ts:19-29`.
- OpenAPI: `backend/docs/openapi.yaml:580-...`, `1024-...`, `1404-...`, `1469-...`, `1682-1694`.
- Validadores: `backend/src/validator/event-validator.ts:6-39`, `news-post-validator.ts:7-31`, `branch-validator.ts:29-72`.
- Verificación estática: `backend/scripts/verify-openapi-routes.mjs:80` y `validate-openapi.mjs`.

### I.2 Base de datos y seguridad

- Configuración: `backend/src/config/environment.ts:20-60`, `backend/src/config/load-environment-files.ts`, `backend/prisma.config.ts`.
- `sessionVersion`: `backend/prisma/schema.prisma:100`; migration `20261016140000_revoke_sessions_on_credential_reset`.
- Recovery token: `backend/prisma/schema.prisma:349-358`; migration `20261015150000_account_recovery`.
- Idempotencia: modelos/migrations `20261016120000_membership_price_idempotency` y `20261016130000_payment_idempotency`.
- RLS/revokes documentados: `backend/prisma/migrations/20260925120000_secure_supabase_data_api/migration.sql`.
- Storage: `backend/src/middleware/*upload-middleware.ts`, `backend/src/service/profile-photo-storage.ts`, `medical-certificate-storage.ts`, `backend/docs/supabase-setup.md:164-171`.
- Gmail: `backend/src/service/recovery-email-service.ts`, `account-recovery-service.ts`, `account-recovery-repository.ts`.

### I.3 Pruebas, CI y despliegue

- Backend scripts/config: `backend/package.json:7-32`, `backend/jest.coverage.config.cjs`, `backend/jest.coverage.notifications.config.cjs`.
- Backend CI: `.github/workflows/backend-ci.yml:1-68`.
- Sonar backend: `.github/workflows/sonarcloud.yml:1-65`.
- Frontend scripts: `frontend/package.json:7-44`.
- Vitest: `frontend/vite.config.ts:7-37`.
- Playwright: `frontend/playwright.config.ts:6-38`; setup server: `frontend/e2e/global-setup.ts:1-21`.
- Frontend E2E CI: `MTeamFrontend/.github/workflows/frontend-e2e.yml:1-107`.
- Frontend Sonar: `MTeamFrontend/.github/workflows/sonarcloud.yml:1-55`.
- Vercel SPA fallback: `MTeamFrontend/frontend/vercel.json:1-...`.
- Qase: `TESTING-QASE.md` en ambos repositorios.

### I.4 Documentación y diagramas

- Arquitectura: `docs/diagrama-arquitectura-m-team.md` y `docs/Diagrama_de_Componentes_M-Team.md`.
- Clases: `docs/diagrama-de-clases.md:187-208`.
- Modelo relacional: `docs/modelo-relacional.md:161-195,235-256`.
- Secuencias: `docs/diagramas-de-secuencia.md:32,65-192`.
- Trazabilidad: `docs/matriz-de-trazabilidad.md:18,42-60,96-109`.
- Ambientes: `docs/ambientes.md:12,54-106,134`.
- Recovery backend: `backend/docs/account-recovery.md:11-45`.
- Recovery frontend desactualizado: `MTeamFrontend/docs/account-recovery.md:7,17`.
- Modelo DOCX disponible: `docs/M-Team_Modelo_de_Datos.docx`; el manual completo solicitado no fue encontrado.

## Cierre de auditoría

Quedan completamente confirmados desde repositorio: el snapshot y estado limpio de ambos checkouts; la arquitectura base; las 69 rutas activas; la paridad estructural OpenAPI/Express; los nombres de variables esperados; la implementación local de JWT, Prisma, Storage y Gmail; la configuración de tests/coverage/CI; y la clasificación mock vs real-backend.

Quedan fuera del alcance verificable del repositorio: dominios y commits publicados, variables efectivas de Vercel/Render, buckets/policies de Supabase en producción, métricas actuales de SonarCloud, resultados de Qase, entrega Gmail y contenido del Manual Word original.

Este archivo es el único artefacto nuevo generado para la solicitud. No se hicieron correcciones al sistema ni se ejecutaron migraciones, pruebas completas, escrituras externas, commits, push, merge o deploy.

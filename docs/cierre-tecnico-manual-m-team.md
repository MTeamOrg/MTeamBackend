# Cierre técnico del Manual Técnico — M-Team

**Fecha:** 2026-10-29 (America/Buenos_Aires)  
**Backend:** `MTeamOrg/MTeamBackend` — rama `docs/manual-tecnico-final`  
**Frontend:** `MTeamOrg/MTeamFrontend` — rama `docs/manual-tecnico-final`  
**Backend SHA base:** `27748f2f9e6c8ac53900f41965983dcd0a3e3663`  
**Frontend SHA base:** `73f477b8b12cdad19fb51162149a4574ba10450a`

Este informe cierra los pendientes técnicos y documentales identificados en la auditoría. Distingue lo demostrado por código o CI, lo aportado mediante capturas/evidencia del equipo y lo que todavía requiere acceso a una plataforma externa.

## 1. Resumen de cambios

Se completó la documentación de contratos, pruebas, modelo de datos, recuperación, Storage, ambientes y despliegues. No se modificaron lógica de negocio, autenticación, `schema.prisma`, migraciones, bases de datos, configuración de Vercel/Render, buckets ni servicios externos.

Archivos nuevos o actualizados relevantes:

- `docs/cierre-tecnico-manual-m-team.md` — este cierre.
- `docs/cierre-manual-tecnico-m-team.md` — cierre documental anterior, conservado como antecedente.
- `docs/evidencias-manual-tecnico-m-team.md` — matriz de evidencias externas.
- `backend/docs/openapi.yaml` — contrato C1–C5.
- `backend/docs/m-team-api.postman_collection.json` y `backend/docs/m-team-local.postman_environment.json` — colección existente, 69 requests, filtros, aserciones, códigos y datos locales.
- `docs/diagrama-de-clases.md`, `docs/modelo-relacional.md`, `docs/diagramas-de-secuencia.md`, `docs/matriz-de-trazabilidad.md`, `docs/diagrama-arquitectura-m-team.md`, `docs/Diagrama_de_Componentes_M-Team.md` y `docs/ambientes.md`.
- `backend/docs/account-recovery.md` y `MTeamFrontend/docs/account-recovery.md` — Gmail SMTP, ausencia de fallback por logs y riesgos operativos.

## 2. Estado de OpenAPI y las 69 operaciones

La revisión actual contra `backend/src/route/`, controladores, validadores y `backend/scripts/verify-openapi-routes.mjs` mantiene **69 operaciones**.

| Código | Estado |
|---|---|
| C1 — filtros | `GET /events` y `GET /news-posts` documentan búsqueda, estado/audiencia, página y límite según los validadores. |
| C2 — respuestas | Eventos, novedades, pagos, membresía y cuotas utilizan schemas explícitos cuando el serializer lo permite. |
| C3 — sedes | `POST /branches` y `PATCH /branches/{branchId}` reemplazaron `GenericJson` por `CreateBranchRequest` y `UpdateBranchRequest`. |
| C4 — cuotas/membresías | Se documentan autenticación, roles, prerrequisito de contraseña completada, respuestas y códigos 401/403. |
| C5 — booleanos | `isActive` de sedes administrativas e `isRead` de notificaciones son strings `true`/`false`, coincidentes con Express/Zod. |

Validaciones ejecutadas:

```text
npm.cmd run openapi:validate
OpenAPI validation passed

npm.cmd run routes:verify
OpenAPI/Express route correspondence passed (69 operations)
```

No se modificó ningún router o controlador para acomodar el contrato.

## 3. Estado de Postman

La colección oficial existente `backend/docs/m-team-api.postman_collection.json` conserva **69 requests** y no se creó una colección paralela.

Incluye:

- organización por módulos y orden sugerido: health → registro/provisión local → login → identidad → carpetas por rol;
- Bearer global con `{{token}}` y captura de `accessToken` solo después del login, sin imprimirlo;
- filtros reales de búsqueda, paginación, estados, audiencia, actividad de sede y lectura de notificaciones;
- `Idempotency-Key` en creación de cuotas y pagos;
- códigos de éxito esperados para C1–C5 y pagos;
- aserciones de campos esenciales de membresía, sedes, eventos, novedades y pagos;
- aserción estándar de errores con `code` y `message` para respuestas 400+;
- ejemplos sintéticos de escenarios 400, 401, 403, 404 y 409 en la descripción de la colección;
- entorno local con `localhost`, UUID sintéticos y valores `@example.test`, sin credenciales reales.

La validación estática confirmó JSON válido, 69 requests y un script de colección. No se ejecutó Newman ni se enviaron requests contra Render, producción, Supabase o una base compartida. Las escrituras requieren una base local descartable.

## 4. Modelo de datos y diagramas

La documentación quedó alineada con `backend/prisma/schema.prisma`, sin modificar Prisma:

- `User.sessionVersion` forma parte del contrato de sesión y se incrementa al cambiar/restablecer contraseña.
- `PasswordRecoveryToken` conserva hash, usuario, fingerprint y vencimiento; el token en claro no se persiste.
- `MembershipPrice.idempotencyKey` y `Payment.idempotencyKey` son UUID únicos opcionales.
- `Notification.dedupeKey` evita duplicados de avisos por reintentos/concurrencia.
- `Payment.memberId` y `MedicalCertificate.memberId` referencian físicamente `User.id`; `MemberProfile` conserva datos específicos del perfil.
- Las relaciones de entrenadores, sedes y clases diferencian `TrainerProfile` conceptual de las FKs físicas que usan `User`/`TrainerBranch`.
- Los diagramas separan modelo conceptual de modelo físico PostgreSQL y documentan `ON DELETE RESTRICT`/`NO ACTION` donde corresponde.

## 5. Recuperación de contraseña

### Implementación presente en el backend

El código implementa Gmail SMTP mediante Nodemailer con:

- `smtp.gmail.com`, puerto 465 y conexión segura;
- `GOOGLE_SMTP_USER` y `GOOGLE_APP_PASSWORD`, configuradas juntas solo en backend;
- token aleatorio almacenado como SHA-256, vencimiento de 30 minutos y consumo atómico;
- incremento de `sessionVersion` para invalidar sesiones anteriores;
- respuesta genérica para no revelar si una cuenta existe;
- errores de proveedor reducidos a metadatos SMTP conocidos, sin destinatarios, enlaces, tokens, contraseñas o respuestas completas.

Los tests también verifican que la variable histórica `PASSWORD_RECOVERY_LOG_TEST_EMAIL` no habilite ningún fallback y que los secretos no lleguen a logs.

### Mecanismo operativo informado por el equipo

La evidencia aportada indica que, por limitaciones económicas del despliegue utilizado, el equipo intentó obtener el enlace desde logs de Render en vez de enviar correo. La revisión del código demuestra que ese mecanismo **no está implementado**: no existe una ruta, variable activa ni rama de logging que escriba enlaces de recuperación.

Por lo tanto:

- Gmail SMTP está implementado, pero no hay evidencia de aceptación o entrega real en producción.
- El mecanismo de logs de Render no puede considerarse operativo ni seguro.
- Habilitarlo expondría un token reutilizable durante su vigencia a usuarios, integraciones o retención de logs con acceso al servicio.
- No se habilitó logging de tokens ni se modificó autenticación.
- La alternativa segura es un ambiente aislado con una cuenta de correo autorizada o un proveedor transaccional con credenciales separadas por ambiente, políticas de retención y rotación.

## 6. Supabase Storage

### Evidencia aportada por el equipo

La evidencia visual del panel indica:

| Recurso | Evidencia informada |
|---|---|
| PostgreSQL de Supabase | PostgreSQL 17.6 |
| `m-team-private-files` | Privado, límite 5 MB, PNG/JPEG/PDF |
| `profile-photos` | Público, límite 5 MB, JPEG/PNG/WebP |
| Políticas de Storage | Cero políticas creadas en las capturas aportadas |

Estos valores se registran como **evidencia aportada**, no como comprobación directa de la cuenta por este entorno. El proyecto, ref, fecha y captura original deben adjuntarse en la matriz de evidencias sin incluir claves.

### Controles demostrados por código

| Control | Evidencia en código | Estado |
|---|---|---|
| Autenticación y roles | Rutas de certificados requieren autenticación, contraseña completada y rol MEMBER/ADMIN según operación | Demostrado estáticamente |
| Propiedad del certificado | MEMBER solo accede si `certificate.memberId === requester.id`; ADMIN puede acceder según autorización | Demostrado estáticamente; requiere aceptación real |
| Bucket privado | `SUPABASE_STORAGE_BUCKET` se usa solo desde backend con `SUPABASE_SECRET_KEY` o fallback `SUPABASE_SERVICE_ROLE_KEY` | Demostrado estáticamente |
| URL firmada | `POST /storage/v1/object/sign/...` con expiración de 300 segundos | Demostrado en código/tests; no verificado contra bucket real |
| Carga de certificados | Un archivo, máximo 5 MB, PDF/JPEG/PNG, MIME y firma binaria comprobados | Demostrado en middleware/tests |
| Ruta de objeto | Segmentos normalizados, sin `.`/`..`, ruta generada bajo `<memberId>/<uuid>.<ext>` | Demostrado estáticamente |
| Limpieza | Si falla la creación de la fila, intenta borrar el objeto cargado | Demostrado en servicio/tests |
| Fotos de perfil | Carga server-side con clave privilegiada, upsert por usuario y URL pública versionada | Demostrado estáticamente |
| MIME de fotos | El backend acepta JPEG/PNG y máximo 5 MB; el bucket informado también permite WebP, pero el código no lo acepta | Diferencia documentada |
| Políticas/RLS reales | No se pueden deducir de migraciones o código de cliente server-side | Pendiente de prueba de aceptación |

La ausencia de políticas de Storage no prueba por sí sola que el backend esté abierto: el backend actúa como gateway privilegiado. Sí implica que debe probarse formalmente que ningún cliente puede saltar la autorización de la API y que las claves privilegiadas jamás llegan al frontend.

## 7. Pruebas, CI, cobertura y Qase

### Pruebas ejecutadas en este cierre

```text
OpenAPI validation passed
OpenAPI/Express route correspondence passed (69 operations)
Postman collection/environment JSON valid; requests=69

6 route suites passed
62 tests passed
```

Las suites ejecutadas fueron membresía, precio de cuota, sedes, comunicaciones, pagos y recuperación. Se ejecutaron sin migraciones y sin infraestructura externa.

No se ejecutaron en este cierre:

- suite completa con cobertura;
- integración PostgreSQL local;
- integración Supabase Storage;
- E2E frontend contra backend real;
- aceptación Gmail SMTP;
- Test Runs de Qase.

Qase no se considera probado sin acceso a sus Test Runs.

### Evidencia CI consultada

| Repositorio | Workflow | SHA | Resultado | Evidencia |
|---|---|---|---|---|
| Backend | Backend CI #144 | `27748f2f9e6c8ac53900f41965983dcd0a3e3663` | success | [run 40936902070](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40936902070) |
| Backend | SonarQube #53 | `27748f2f9e6c8ac53900f41965983dcd0a3e3663` | success | [run 40936902061](https://github.com/MTeamOrg/MTeamBackend/actions/runs/40936902061) |
| Frontend | Frontend E2E #23 | `73f477b8b12cdad19fb51162149a4574ba10450a` | success | [run 40926939096](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40926939096) |
| Frontend | SonarQube #125 | `73f477b8b12cdad19fb51162149a4574ba10450a` | success | [run 40926939032](https://github.com/MTeamOrg/MTeamFrontend/actions/runs/40926939032) |

### Evidencia visual de Sonar aportada por el equipo

La captura fechada el 29/10/2026 informa, sin asociación demostrada a un SHA específico:

| Indicador | Frontend | Backend |
|---|---:|---:|
| Quality Gate | Passed | Passed |
| Issues | 0 | 0 |
| Cobertura | 88,1 % | 84,0 % |
| Duplicaciones | 0,0 % | 0,6 % |

Se registra como evidencia fechada de panel, no como sustituto de la URL del análisis o de la asociación commit→métrica.

## 8. Versiones y entornos

| Área | Valor confirmado |
|---|---|
| Node.js CI | 22 en workflows backend/frontend |
| Node/npm de esta máquina | Node 24.11.1 / npm 11.6.2; no se debe inferir que sea Render |
| PostgreSQL Supabase observado | 17.6, según evidencia aportada |
| PostgreSQL local Docker Compose | `postgres:16-alpine` en `backend/docker-compose.test.yml` |
| PostgreSQL CI/E2E | `postgres:17` en workflows |
| Backend resuelto | Express 5.2.1, Prisma Client 7.10.0, Prisma CLI 7.10.1, TypeScript 7.0.2, Jest 29.7.0, Supertest 7.2.2, Nodemailer 10.1.7, Zod 4.4.3, pg 8.23.0 |
| Frontend resuelto | React 19.2.8, React DOM 19.2.8, React Router 7.18.4, Vite 8.2.1, TypeScript 6.0.3, Vitest 5.0.1, Playwright 1.64.1 |
| Node/npm de Render | No verificado; no se inventa |

No se encontró una justificación histórica formal para PostgreSQL 16 local frente a 17 en CI. Recomendación: elegir PostgreSQL 17 como referencia común si el equipo puede actualizar Docker; si se conserva 16 local, probar migraciones y suites en 16 y 17 y documentar ambas como política de compatibilidad.

## 9. Despliegue de producción

### Frontend — evidencia aportada

La evidencia visual informa:

- Vercel, proyecto `m-team-frontend`.
- `https://m-team-frontend.vercel.app`.
- Rama observada: `develop`.
- SHA abreviado observado: `73f477b`.
- Estado: Production / Ready.
- `VITE_API_URL` visible para All Environments, sin registrar su valor en este documento.

No se consultó el panel de Vercel desde esta tarea; registrar deployment ID, SHA completo, fecha y dominio en la matriz externa.

### Backend — evidencia aportada y discrepancia

La evidencia visual informa:

- Render, servicio `MTeamBackend`.
- `https://mteambackend.onrender.com`.
- Rama configurada: `develop`.
- Plan Free.
- Un despliegue exitoso observado sobre `793be2e`, el 29/10/2026 15:23:13 GMT-3.
- Otra captura muestra `27748f2` como commit activo.

La discrepancia no puede resolverse solo con GitHub. El repositorio remoto actualmente apunta a `27748f2f...` y sus workflows CI/Sonar son exitosos, pero eso no demuestra qué proceso está activo en Render. Falta adjuntar una captura o URL de Render con deployment ID, commit completo, estado y fecha. No se afirma que `793be2e` ni `27748f2` sea el deployment productivo vigente.

Las variables de Render observadas en la auditoría se documentan únicamente por nombre: base de datos, JWT, Supabase y recuperación. No se copian valores.

## 10. Limitaciones y riesgos de producción

- Gmail SMTP no tiene evidencia de aceptación ni entrega productiva.
- El fallback por logs de Render no existe en el código; si se habilitara informalmente, expondría tokens de recuperación.
- Las capturas muestran cero políticas de Storage; la autorización server-side existe, pero la seguridad real de buckets, RLS y acceso directo requiere aceptación en Supabase.
- El backend acepta JPEG/PNG para fotos, mientras el bucket aportado también permite WebP; esto debe decidirse/documentarse, sin cambiarlo automáticamente.
- PostgreSQL 16 local y 17 CI/Supabase requieren una política formal y prueba cruzada.
- La cobertura Sonar aportada es fechada, pero no está asociada de forma demostrada a un SHA.
- Qase, Vercel, Render, Supabase y Gmail requieren evidencias con fecha, ambiente y SHA/deployment ID.
- No se encontró `M-Team_Manual_Tecnico_Ampliado_Evidencias_Supabase.docx` ni el Word original completo; no se sobrescribió ni se generó un Word alternativo.

## 11. Pendientes que debe completar el equipo

1. Adjuntar el documento Word correcto y exportar/revisar visualmente el manual final.
2. Reconciliar el deployment activo de Render (`793be2e` frente a `27748f2`).
3. Adjuntar deployment ID, SHA completo y fecha de Vercel/Render.
4. Confirmar proyecto Supabase, PostgreSQL 17.6, buckets y políticas con pruebas de acceso/denegación.
5. Ejecutar aceptación de Gmail SMTP en una cuenta de prueba y registrar solo metadatos seguros.
6. Decidir la política PostgreSQL 16/17 y probar migraciones en ambas si corresponde.
7. Adjuntar runs de Qase y asociarlos al SHA real.
8. Asociar cobertura/Quality Gate de Sonar al análisis y SHA concretos.

## 12. Verificación final y control de cambios

La rama de trabajo es `docs/manual-tecnico-final` en ambos repositorios. No se realizó commit, push, merge, pull request, deploy, migración ni escritura en base de datos externa.

Nombre de commit sugerido en inglés, si el equipo decide confirmar estos cambios:

```text
docs: finalize M-Team technical manual closure
```

# Notificaciones: decisiones, verificación y puntos pendientes

Este apunte registra el comportamiento verificado del módulo de notificaciones, las decisiones técnicas tomadas donde los documentos vigentes no son concluyentes y los problemas encontrados y corregidos. No reemplaza ni modifica el Documento de Alcance, los diagramas ni el Modelo de Datos. El contrato HTTP está en `openapi.yaml` (`/notifications`).

## 1. Qué avisos se generan

Los avisos son internos y se muestran dentro de la plataforma. No hay canales push, SMS ni correo.

| Requisito | Evento | Destinatarios | Aviso | Clave de deduplicación (`dedupe_key`) |
|---|---|---|---|---|
| CUO-06 | Se registra un valor de cuota **mayor** que el inmediatamente anterior | Socios activos | Aumento de cuota: nuevo importe y fecha desde la que se aplica | `membership-price-changed:{precio}:{socio}` |
| CUO-04/05 | Al abrir la bandeja: la última acreditación vence dentro de 5 días o menos | El propio socio | Cuota próxima a vencer: fecha y hora de vencimiento | `membership-expiring:{socio}:{vencimiento}` |
| CUO-05 | Al abrir la bandeja: la vigencia terminó o nunca hubo un pago acreditado | El propio socio | Cuota vencida: con la fecha cuando existe; sin pagos explica que todavía no hay un pago acreditado | `membership-expired:{socio}:{vencimiento\|none}` |
| APM-06 | Un administrador aprueba o rechaza un apto médico | Solo el socio dueño | Resultado; si se rechazó, incluye la observación | `medical-certificate-reviewed:{apto}:{estado}` |
| NOV-03 | Se crea una clase con entrenador o se copia una semana | El entrenador asignado | Clase asignada | `class-changed:{clase}:created:{entrenador}` |
| NOV-03 | Cambia la actividad, el horario o la sede | El entrenador que conserva la clase | Clase modificada, indicando qué cambió | `class-changed:{clase}:{cambio}:{entrenador}` |
| NOV-03 | Se reemplaza o quita al entrenador | El anterior ("Clase reasignada") y el nuevo ("Clase asignada") | Cada uno ve su propia situación | ídem |
| NOV-03 | Se elimina una clase con entrenador | El entrenador asignado | Clase cancelada | `class-changed:{clase}:deleted:{entrenador}` |
| EVE-03 | Se cancela un evento **publicado** | Socios y entrenadores activos | Evento cancelado | `event-cancelled:{evento}:{usuario}` |

Notas de alcance:

- Un aumento solo se avisa si el nuevo importe supera al anterior. Un importe igual o menor, o el primer valor registrado, no genera avisos.
- La cancelación de un evento en borrador no se avisa: ningún usuario llegó a verlo como publicado (EVE-03 habla de eventos publicados). El evento se conserva con estado `CANCELLED` en ambos casos.
- Los administradores no reciben avisos automáticos y la interfaz no les muestra la pantalla de notificaciones, porque ningún evento del alcance los tiene como destinatarios.
- `GENERAL` queda reservado para comunicaciones internas. Publicar una novedad no genera notificaciones: NOV-03 no la incluye y las novedades ya se consultan en su propio apartado (ENT-04).
- Los textos de cuota vencida no piden al socio que "registre un pago": los pagos los acredita siempre un administrador (R-07). Un socio sin pagos recibe una explicación (todavía no hay un pago acreditado, por eso la cuota figura vencida, CUO-05) y no un "venció" ni "renová" que no corresponde.
- Copiar una semana avisa a cada entrenador por cada clase que recibe: en el sistema la copia es una acción explícita del administrador ("Generar desde la semana anterior") y las clases nuevas son visibles para todos desde que se crean. El diagrama de secuencia del cronograma no dibuja el aviso en la copia; el alcance (CLA-04, NOV-03) ni lo exige ni lo prohíbe. Si se prefiere una copia silenciosa, el cambio es quitar `notifyClassesAssigned` de `copySchedule` y ajustar sus pruebas.

## 2. Deduplicación, concurrencia y transacciones

`dedupe_key` identifica **un evento real del dominio**, nunca un estado. Un mismo evento repetido no crea otro aviso y un evento nuevo siempre lo crea, aunque deje los datos iguales a los de uno anterior (por ejemplo una clase que pasa de A a B, vuelve a A y otra vez a B genera tres avisos).

- Las escrituras usan `createMany({ skipDuplicates: true })` (`INSERT … ON CONFLICT DO NOTHING`) sobre la restricción única, de modo que reintentos y solicitudes simultáneas no duplican.
- Cada operación de negocio escribe el cambio y sus avisos en una misma transacción Prisma (precio, apto, evento, clase y copia semanal).
- Avisar a todos los usuarios activos (aumento de cuota, cancelación de un evento) inserta miles de filas en esa transacción. Prisma cancela las transacciones interactivas a los 5 s, así que con unos 15.000 usuarios la operación completa se revertía (el evento seguía publicado y el precio no se guardaba). Esas dos transacciones declaran `AUDIENCE_TRANSACTION_OPTIONS` (60 s).
- Las clases, los aptos y los eventos se bloquean con `SELECT … FOR UPDATE` antes de decidir. Una solicitud repetida o simultánea encuentra el estado ya aplicado y no hace nada.
- En las clases, un cambio real recibe su propio identificador (UUID). Un reintento exacto no llega a generar nada porque la clase ya tiene el estado pedido.
- **Corregido:** el alta y la baja de una clase usaban la misma clave (`class-changed:{clase}:{clase}:{entrenador}`), por lo que el aviso de cancelación se descartaba en silencio cuando el entrenador estaba asignado desde el alta. Ahora cada evento tiene su propia clave (`created`, `deleted`). Las filas históricas no se modifican y no colisionan con las nuevas.

## 3. Fechas y zona horaria

- Los instantes se guardan como `timestamptz` y la API los devuelve en UTC (ISO 8601).
- Todo texto persistido que menciona una fecha u hora se genera con `America/Argentina/Buenos_Aires` explícita y hora de 24 horas (`src/model/notification-message.ts`). Antes dependía de la zona del servidor: en un servidor UTC un evento del 03/03 a las 23:30 se anunciaba como "4/3". La interfaz ya mostraba las fechas en horario argentino.
- Se verificaron vencimientos justo antes y después de medianoche, cruces de mes, de año y un 29 de febrero, y la misma batería con el proceso corriendo en `UTC`, `Pacific/Kiritimati` (UTC+14) y `Pacific/Pago_Pago` (UTC−11).
- Las fechas de los avisos ya generados antes de este cambio conservan el texto con el que se guardaron.

## 4. Generación de los avisos de cuota: evaluación y decisión

**Decisión: se conserva la generación bajo demanda** (cuando el socio abre su bandeja o consulta su contador) y se la refuerza. No se agrega un proceso programado.

Por qué alcanza:

1. NOV-03 pide avisos **dentro de la plataforma**. Un socio solo puede verlos abriendo la aplicación, y esa consulta es la que los genera, así que el aviso existe cuando hace falta. Un proceso programado solo aportaría valor para canales fuera de la aplicación, excluidos del alcance.
2. No depende de infraestructura: funciona igual si el servidor se reinicia, duerme (planes gratuitos) o hay varias instancias. No hay que configurar cron, workers ni servicios pagos.
3. Es idempotente y seguro ante concurrencia: el aviso de un vencimiento se identifica por `socio + vencimiento`. Se verificó con 10 consultas simultáneas.

Evidencia que sostiene la decisión (cierre del módulo):

| Escenario exigido | Cómo se verificó |
|---|---|
| El socio recibe el aviso cuando corresponde, aunque solo use la plataforma | E2E con backend y PostgreSQL reales: el socio permanece en su panel, entra en los 5 días y el aviso aparece; la cuota vence con la página abierta y aparece el segundo aviso, sin recargar ni abrir la bandeja (el sondeo de 60 s del espacio de trabajo lo dispara) |
| No se duplica al abrir repetidamente, con varias sesiones o varias instancias | 30 aperturas simultáneas repartidas en dos instancias del servidor con conexiones separadas generan un solo aviso; otro dispositivo lee los mismos avisos y no crea ninguno |
| Persiste y sobrevive al reinicio de Render | Los avisos están en PostgreSQL; la prueba de persistencia reinicia la aplicación y el estado se conserva |
| Umbral exacto de cinco días, medianoche, mes, año y bisiesto | Pruebas con reloj controlado: 5 días exactos avisa, 5 días + 1 ms no, 1 ms antes avisa, el instante del vencimiento ya es "vencida" |
| Pago nuevo, anulación e historial | Un pago nuevo no crea avisos del período nuevo; anularlo vuelve a un estado ya avisado y no lo repite; tras anular el último de dos pagos se avisa el vencimiento del anterior y el aviso previo sigue en el historial |

Alternativa B (proceso programado): solo aportaría valor para un canal fuera de la aplicación, excluido del alcance (3.2). En la infraestructura gratuita (R-06) exigiría un servicio externo (cron del proveedor, GitHub Actions o `pg_cron`) y una credencial, sin cambiar lo que el socio ve. No se agrega.

Refuerzos incluidos: reutiliza `calculateMembershipStatus` (el mismo criterio de 5 días que usan el listado de socios y el control de acceso), informa el vencimiento exacto en horario argentino y, si la generación fallara, la bandeja existente sigue siendo legible (el error se registra en el log del servidor).

Limitación conocida: la consulta (`GET`) tiene un efecto lateral idempotente. Si en el futuro hiciera falta avisar sin que el socio abra la aplicación (por ejemplo por correo), el punto de partida es `NotificationRepository.ensureMembershipStatusNotification(userId, now)`: se puede invocar por lote desde un job programado (cron del proveedor, GitHub Actions o `pg_cron`) sin cambiar el modelo, porque ya es idempotente.

## 5. Contrato de la API

- `GET /api/notifications`, `GET /api/notifications/:id`, `PATCH /api/notifications/:id/read-status` y `PATCH /api/notifications/read-status`, para `MEMBER`, `TRAINER` y `ADMIN` (cada uno solo ve las suyas).
- La respuesta del listado incluye ahora `unreadCount`: todas las no leídas de la cuenta, sin importar la página ni el filtro `isRead`. `total` sigue contando las que cumplen el filtro. El campo es aditivo; el frontend funciona también contra un backend que no lo envía.
- Orden: más reciente primero, con desempate estable por `id`. Marcar como leída es idempotente y conserva la primera fecha de lectura; nunca se elimina nada del historial.
- Valores extremos de `page` (por ejemplo `2147483647` o `1e30`) se resuelven sin error 500.

## 6. Seguridad y aislamiento

- La identidad sale siempre del token. No existe ningún parámetro para consultar la bandeja de otra persona: `?userId=` se rechaza con 400 y un `userId` en el cuerpo se ignora.
- Cada consulta vuelve a leer rol y estado del usuario en la base: una cuenta inactiva recibe 403 y un token de un usuario inexistente, 401. La cuenta con contraseña temporal debe cambiarla antes de usar la API.
- Una notificación ajena responde el **mismo 404** que una inexistente y nunca se modifica. `PATCH` de lectura total solo afecta a la cuenta autenticada.
- Las respuestas llevan `Cache-Control: private, no-store`.
- El administrador no tiene acceso a bandejas ajenas: no existe una operación que lo permita.
- Los errores no exponen detalles internos (500 genérico) y las consultas validan `page`, `limit` e `isRead`.

## 7. Decisiones funcionales pendientes

- **Acciones manuales de ADMIN:** el perfil de administrador menciona administrar notificaciones, pero no hay criterios para redactarlas, elegir destinatarios, editarlas o retirarlas. No se agregan esas operaciones.
- **Destinatarios de cambios de clase:** el modelo no relaciona socios con clases y el alcance excluye reservas y cupos (R-09). Por eso se notifica solo al entrenador asignado (y al anterior cuando se lo reemplaza). Los socios se enteran de los cambios de horario por el cronograma público (CLA-01) y por Novedades, cuyo propósito incluye "cambios de horarios" (NOV-01).
- **Avisos fuera de la aplicación:** el correo electrónico es opcional en el alcance y no se implementó.

## 8. Discrepancia del Modelo de Datos

`docs/M-Team_Modelo_de_Datos.docx` y el diagrama de clases describen las columnas funcionales de `notification`, pero no `dedupe_key`. El esquema Prisma vigente la incluye como columna nullable con unicidad global (migración `20261002120000_add_notification_dedupe_key`, que no se modificó) y `docs/modelo-relacional.md` ya la refleja. Los documentos proponen índices `(user_id, created_at DESC)` y `(user_id, read_at)`; Prisma tiene el compuesto `(user_id, read_at, created_at)`. No se cambiaron índices: no hay una medición que lo justifique con el volumen esperado. Este trabajo **no agrega migraciones**.

## 9. Pruebas y cómo ejecutarlas

Desde `backend/`:

| Qué | Comando |
|---|---|
| Unitarias (con mocks) | `npm test` |
| Integración con PostgreSQL real: API, autenticación (incluida la sesión revocada), servicios, repositorios, restricciones del esquema (columnas, enum, índices, claves foráneas), persistencia tras reiniciar la aplicación, audiencias grandes, **integridad transaccional** (un trigger hace fallar el aviso y se comprueba que cada operación administrativa se deshace y su reintento funciona), **concurrencia** (copias, aumentos, modificar+eliminar y reasignaciones simultáneas, 30 aperturas desde dos instancias) y **novedades por audiencia** | `npm run test:integration:notifications` |
| Cobertura del módulo (meta de la materia: 80 %) | `npm run test:coverage:notifications` |
| Contrato y esquema | `npm run openapi:validate` · `npm run prisma:validate` |

Las pruebas de integración **solo aceptan** una base `localhost`/`127.0.0.1` cuyo nombre contenga `test`, indicada en `NOTIFICATION_TEST_DATABASE_URL`, y solo eliminan las filas que ellas mismas crean. Ejemplo con Docker (el CI usa `postgres:17`):

```powershell
docker run -d --name mteam-test-pg -e POSTGRES_USER=mteam -e POSTGRES_PASSWORD=mteam_test_password -e POSTGRES_DB=mteam_test -p 127.0.0.1:54329:5432 postgres:17-alpine
$env:DATABASE_URL = 'postgresql://mteam:mteam_test_password@localhost:54329/mteam_test'
$env:DIRECT_URL = $env:DATABASE_URL
$env:NOTIFICATION_TEST_DATABASE_URL = $env:DATABASE_URL
$env:JWT_SECRET = 'solo-para-pruebas-locales'
npm.cmd run prisma:migrate:deploy
npm.cmd run test:integration:notifications
```

Estas pruebas necesitan `node --experimental-vm-modules` (ya incluido en el script): el cliente Prisma carga su compilador de consultas como módulo ESM y Jest en modo CommonJS no puede cargarlo.

La verificación de punta a punta con el navegador (frontend contra este backend y una base local) usa `npm run seed:e2e:notifications` y se describe en el README del frontend (`e2e/real-backend`).

## 10. Registro de problemas encontrados y corregidos

| # | Hallazgo | Causa | Severidad | Corrección |
|---|---|---|---|---|
| N-01 | El CI de `develop` quedó en rojo y el test de integración PostgreSQL **nunca llegó a ejecutarse** | Import `../../src` en lugar de `../../../src`; Jest CommonJS no carga el runtime WASM de Prisma; `document_number` de 36 caracteres en una columna `VARCHAR(30)` | Alta | Rutas, modo ESM y fixtures corregidos; suite ampliada a 44 casos reales |
| N-02 | El aviso de cancelación de una clase se perdía | Alta y baja compartían `dedupe_key` | Alta | Claves por evento (`created`, `deleted`, UUID por cambio) |
| N-03 | Fechas y horas de los textos dependían de la zona del servidor | `toLocaleDateString("es-AR")` sin `timeZone` | Alta | `model/notification-message.ts` con zona de Argentina y 24 h |
| N-04 | Se avisaba la cancelación de eventos que nunca se publicaron | No se miraba el estado previo | Media | Solo `PUBLISHED → CANCELLED` |
| N-05 | Cancelaciones simultáneas del mismo evento no estaban serializadas | Sin bloqueo de fila (la clave única evitaba duplicados) | Baja | `SELECT … FOR UPDATE` |
| N-06 | Los avisos de clase no decían qué cambió y el entrenador reemplazado leía "se modificó" | Texto único para todos | Media | Un texto por destinatario con el detalle del cambio |
| N-07 | Importes sin formato (`$25000.5`) | Se imprimía el `Decimal` crudo | Baja | `$ 25.000,50` |
| N-08 | La respuesta no permitía conocer el total de no leídas | Solo existía `total` del filtro | Media | `unreadCount` |
| N-09 | Un fallo al generar el aviso de cuota impedía leer toda la bandeja | La excepción se propagaba | Media | Se registra y la bandeja sigue funcionando |
| N-10 | El umbral de 5 días estaba duplicado | Copia de la regla de `membership-status` | Baja | Se reutiliza `calculateMembershipStatus` |
| N-11 | Código muerto (`audienceRoles`) | Sin usos | Baja | Eliminado |
| N-12 | Con 25.000 socios activos, cancelar un evento publicado o registrar un aumento de cuota fallaba con `A commit cannot be executed on an expired transaction` y se revertía todo | La transacción interactiva por defecto de Prisma dura 5 s y el reparto tardaba 8–10 s | Media | Timeout explícito de 60 s en esas dos transacciones; prueba de regresión con 4.000 socios y un cliente con timeout por defecto de 100 ms |
| N-13 | El aviso de cuota vencida pedía al socio "registrar un nuevo pago" (solo un administrador acredita pagos, R-07) y a quien nunca pagó le decía que renovara un acceso que no tenía | Texto único escrito sin distinguir el caso de CUO-05 "sin pago acreditado" | Media | Textos nuevos en `membershipExpiredNotice`; los avisos ya generados conservan el texto con el que se guardaron |
| N-14 | (Frontend) Leer un aviso reconstruía la lista: en el celular, con 20 avisos, la página volvía al inicio (scroll 3.500 px → 0), el aviso se recreaba y el foco caía al `body` | `reload()` pone la pantalla en "Cargando…" y desmonta la lista | Media | Actualización local inmediata, refresco en segundo plano y foco devuelto al aviso; reproducido antes y verificado después con navegador y datos reales |
| N-15 | (Frontend) Una misma tarjeta mostraba la fecha con reloj de 12 h y año de 2 dígitos en la cabecera y con 24 h y año de 4 dígitos en el texto del aviso | `formatDateTime` usaba los estilos cortos de `es-AR` | Media | `dd/mm/aaaa HH:mm` en horario argentino, independiente de la zona del navegador |
| N-16 | (Frontend) El error de red decía "Verificá que el backend esté iniciado" a un socio | Mensaje pensado para desarrollo | Baja | "Revisá tu conexión a internet e intentá nuevamente" |
| N-17 | (Frontend) No existía la acción "abrir una notificación" del diagrama de secuencia (solo un botón "Marcar como leída") | Brecha entre diagrama y pantalla | Media | "Ver detalle" abre el aviso, lo marca como leído y muestra cuándo llegó y cuándo se leyó; el botón explícito se conserva |

Verificado sin cambios (no se encontraron defectos): atomicidad aviso+operación (7 operaciones), concurrencia de copias, aumentos, bajas y reasignaciones, deduplicación por evento, aislamiento entre cuentas, sesión revocada, umbral de 5 días, fechas en horario argentino, novedades por audiencia y estado.

Frontend (repositorio `MTeamFrontend`): el celular no tenía forma de llegar a Notificaciones (la barra inferior tiene cinco pestañas), no había contador de no leídas, "Marcar todas como leídas" miraba solo la página visible, la pantalla no se actualizaba con la aplicación abierta y las pruebas E2E solo usaban una API simulada.

## 11. Hallazgos fuera de alcance (registrados aparte)

- El README del frontend decía que eventos, novedades y notificaciones estaban "pendientes"; solo se corrigió lo referido a notificaciones.
- El frontend no tiene workflow de CI (lint, build y tests no se ejecutan automáticamente).
- Los archivos de test del backend no se tipan (SWC los transforma sin chequeo) y varios tienen errores de tipos bajo el `tsconfig` estricto.
- Un test unitario del frontend (`AdminUsersScreen`) agotó los 5 s de Vitest en una ejecución con la máquina cargada; no es de este módulo y no se reprodujo luego.
- La recuperación de contraseña por correo (`/auth/password-recovery`) amplía USR-04 y está documentada como flujo vigente en `account-recovery.md` y `diagramas-de-secuencia.md`. El restablecimiento administrativo con contraseña temporal de ADM-04 también existe como mecanismo separado.
- `GET /dashboard` figura en `openapi.yaml` pero el backend no lo implementa (responde 404); el frontend usa `/admin/dashboard/metrics`.
- Los pagos se acreditan con `accreditedAt = now()` y la base impone `expires_at = accredited_at + 30 días`, por lo que ordenar "el último pago" por vencimiento (avisos) o por acreditación (estado de cuota, acceso, listado) es equivalente hoy; conviene unificarlo si algún día se permitiera acreditar con una fecha distinta.

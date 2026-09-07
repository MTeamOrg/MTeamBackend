# Matriz de trazabilidad de requisitos y dominio

Esta matriz vincula los requerimientos funcionales del documento de alcance con el modelo definido en [`diagrama-de-clases.md`](./diagrama-de-clases.md). El documento de alcance es la fuente de verdad; las imágenes se utilizan solamente como referencia visual cuando no lo contradicen.

## Criterio de cobertura

- **Cubierto**: el modelo contiene las entidades y datos persistentes necesarios.
- **Parcial**: falta un atributo, relación o decisión explícita.
- **Aplicación**: se resuelve principalmente mediante interfaz, API o lógica de negocio y no requiere otra clase de dominio.

## Usuarios, administración y socios

| Requisito | Clases o reglas relacionadas | Cobertura | Observación |
|---|---|---|---|
| USR-01 | `User`, `MemberProfile`, `UserRole` | Cubierto | Documento y correo deberán tener restricciones únicas. |
| USR-02 | `User`, `UserStatus` | Aplicación | Validación de credenciales y mensajes seguros en autenticación. |
| USR-03 | `User` | Aplicación | La invalidación de credenciales pertenece al mecanismo de sesión. |
| USR-04 | `User.isPasswordChangeRequired`, `UserAuditLog` | Cubierto | El administrador asigna una clave temporal; no se requiere correo automático. |
| USR-05 | `User.role`, `UserRole` | Aplicación | La autorización se valida en el backend. |
| USR-06 | `User`, `MemberProfile`, `TrainerProfile` | Cubierto | La API debe impedir modificar campos protegidos. |
| USR-07 | `User.status`, `UserAuditLog` | Cubierto | La desactivación no elimina relaciones ni historial. |
| ADM-01 | `User`, `UserRole`, `UserStatus` | Aplicación | Búsqueda, filtros y paginación corresponden a consultas. |
| ADM-02 | `User`, perfiles y relaciones de pagos, aptos y clases | Cubierto | El detalle se compone desde las relaciones existentes. |
| ADM-03 | `User`, `MemberProfile`, `TrainerProfile` | Cubierto | La creación administrativa utiliza las mismas restricciones de unicidad. |
| ADM-04 | `User`, `UserAuditLog` | Cubierto | La auditoría registra responsable y fecha. |
| ADM-05 | `User.status`, `UserAuditLog` | Cubierto | `reason` conserva el motivo opcional. |
| ADM-06 | `UserAuditLog`, `UserAuditAction` | Cubierto | Historial de creación, modificación, activación y desactivación. |
| SOC-01 | `User`, `MemberProfile` | Cubierto | La información personal común permanece en `User`. |
| SOC-02 | `User`, `Payment`, `MedicalCertificate` | Aplicación | El resumen y los días restantes son valores calculados. |
| SOC-03 | `User` | Aplicación | La API limita los campos editables y valida la unicidad del correo. |

## Cuota y pagos

| Requisito | Clases o reglas relacionadas | Cobertura | Observación |
|---|---|---|---|
| CUO-01 | `MembershipPrice` | Cubierto | Existe una sola cuota común, sin planes. |
| CUO-02 | `MembershipPrice`, `User` | Cubierto | Cada nuevo precio conserva importe, vigencia y administrador. |
| CUO-03 | `MembershipPrice`, `Payment` | Aplicación | Precio actual, último pago, vencimiento y días se obtienen mediante consultas y cálculo. |
| CUO-04 | `Payment.accreditedAt`, `Payment.expiresAt` | Aplicación | El backend fija 30 días sin acumular vigencias. |
| CUO-05 | `Payment` | Aplicación | `CURRENT`, `EXPIRING_SOON` y `EXPIRED` son estados calculados; el umbral es cinco días. |
| CUO-06 | `MembershipPrice`, `Notification` | Cubierto | Un cambio de precio genera una notificación interna. |
| PAG-01 | `Payment`, `MemberProfile`, `User` | Cubierto | Incluye socio, importe, medio, comprobante, acreditación y responsable. |
| PAG-02 | `MembershipPrice`, `Payment` | Aplicación | El resumen previo no necesita persistencia adicional. |
| PAG-03 | `Payment`, `PaymentStatus` | Cubierto | Conserva estado y vencimiento generado, incluso al anularse. |
| PAG-04 | `Payment`, `User` | Aplicación | Los filtros se implementan en el repositorio/API. |
| PAG-05 | `Payment`, `PaymentStatus` | Cubierto | Se conserva el pago anulado y se recalcula desde pagos válidos. |
| PAG-06 | `Payment`, `User` | Cubierto | Se registran por separado creación, confirmación y anulación, con sus responsables y fechas. |
| PAG-07 | `Payment`, `PaymentStatus` | Aplicación | Total por rango calculado solamente con pagos acreditados. |

## Aptos médicos

| Requisito | Clases o reglas relacionadas | Cobertura | Observación |
|---|---|---|---|
| APM-01 | `MedicalCertificate`, `MemberProfile` | Aplicación | Formatos, tamaño y vista previa se validan en frontend, backend y almacenamiento. |
| APM-02 | `MedicalCertificateStatus.PENDING`, `Payment` | Cubierto | Todo documento nuevo queda pendiente; la excepción inicial se calcula desde el primer pago válido. |
| APM-03 | `MedicalCertificate`, `Payment` | Cubierto | Estado, carga, observación y período restante están disponibles o se calculan. |
| APM-04 | `MedicalCertificate`, `User` | Aplicación | Filtros y acceso privado al archivo se controlan en API y Storage. |
| APM-05 | `MedicalCertificate`, `User` | Cubierto | Registra decisión, observación, responsable y momento; el aprobado no vence. |
| APM-06 | `MedicalCertificate`, `Notification` | Cubierto | La notificación puede incluir la observación del rechazo. |
| APM-07 | `MemberProfile` 1—N `MedicalCertificate` | Cubierto | El modelo conserva cada carga y su revisión en el historial. |

## Accesos mediante QR

| Requisito | Clases o reglas relacionadas | Cobertura | Observación |
|---|---|---|---|
| ACC-01 | `User`, `AccessPoint` | Aplicación | El usuario autenticado escanea el QR fijo con la cámara. |
| ACC-02 | `AccessPoint.qrToken`, `Branch`, `AccessLog` | Cubierto | Un QR inexistente o alterado se rechaza y registra como `INVALID_QR`, sin sede ni punto asociados. |
| ACC-03 | `User`, `UserStatus` | Aplicación | La identidad procede de la sesión, nunca del QR. |
| ACC-04 | `User`, `Payment`, `MedicalCertificate`, `AccessLog` | Aplicación | Las reglas cambian según el rol y se validan con datos vigentes. |
| ACC-05 | `AccessLog`, `AccessResult`, `AccessDenialReason` | Cubierto | Incluye el motivo `INVALID_QR` además de los rechazos asociados con cuenta, cuota, apto, sede o punto. |
| ACC-06 | `AccessLog`, `User`, `AccessPoint`, `Branch` | Cubierto | `roleAtAttempt` conserva el rol histórico; sede y punto se conservan cuando el QR permite identificarlos. |
| ACC-07 | `AccessLog` y relaciones | Aplicación | Historial y filtros se implementan mediante consultas paginadas. |
| ACC-08 | Sin clase adicional | Aplicación | Permisos y errores de cámara corresponden al frontend. |

## Sedes, clases y entrenadores

| Requisito | Clases o reglas relacionadas | Cobertura | Observación |
|---|---|---|---|
| SED-01 | `Branch` | Cubierto | Incluye nombre, imagen, dirección, horarios, teléfono y descripción. |
| SED-02 | `Branch`, `ScheduledClass` | Cubierto | El detalle dispone de los datos de la sede y sus clases programadas. |
| SED-03 | `Branch.latitude`, `Branch.longitude` | Cubierto | Las coordenadas son opcionales; la información principal sigue disponible sin Maps. |
| SED-04 | `Branch`, `User` | Cubierto | Nombre y dirección deberán tener restricciones únicas. |
| SED-05 | `Branch.isActive`, `ScheduledClass` | Cubierto | La regla impide nuevas asignaciones y conserva el historial. |
| SED-06 | `Branch` y relaciones | Aplicación | Búsqueda y filtros corresponden a consultas administrativas. |
| CLA-01 | `WeeklySchedule`, `ScheduledClass`, `Branch`, `TrainerProfile` | Cubierto | El cronograma es informativo. |
| CLA-02 | `WeeklySchedule`, `ScheduledClass` | Cubierto | Se administran actividad, fecha/hora, sede y entrenador opcional. |
| CLA-03 | `Branch.isActive`, `User.status`, `ScheduledClass` | Aplicación | La validación ocurre antes de asignar sede o entrenador. |
| CLA-04 | `WeeklySchedule.copiedFrom`, `ScheduledClass` | Cubierto | La copia crea una semana nueva, conserva la referencia conceptual a la semana de origen y no altera el historial anterior. |
| ENT-01 | `User`, `TrainerProfile` | Cubierto | Nombre y foto provienen de `User`; especialidad y descripción del perfil. |
| ENT-02 | `User`, `TrainerProfile`, `TrainerBranch` | Cubierto | Incluye datos, fotografía, especialidad, descripción y sedes. |
| ENT-03 | `TrainerProfile`, `ScheduledClass`, `Branch` | Cubierto | Las clases asignadas se consultan por la relación existente. |
| ENT-04 | `NewsPost`, `Notification` | Cubierto | Comunicaciones internas disponibles para el entrenador. |
| ENT-05 | `User.status`, `TrainerProfile` | Cubierto | La desactivación preserva el historial e impide nuevas asignaciones. |
| ENT-06 | `UserRole` y autorización | Aplicación | No existe relación entrenador—socio; los permisos se restringen en backend. |

## Eventos, novedades, notificaciones y panel

| Requisito | Clases o reglas relacionadas | Cobertura | Observación |
|---|---|---|---|
| EVE-01 | `Event` | Cubierto | Incluye título, descripción, fecha/hora, ubicación, imagen y estado. |
| EVE-02 | `Event`, `EventStatus`, `User` | Cubierto | Permite borrador y publicación con administrador responsable. |
| EVE-03 | `EventStatus.CANCELLED`, `Notification` | Cubierto | La cancelación no elimina el evento y genera avisos. |
| EVE-04 | `Event.startsAt`, `EventStatus` | Aplicación | Próximo/finalizado se deriva de la fecha; cancelado se persiste. |
| NOV-01 | `NewsPost` | Cubierto | Contiene título, contenido, fecha e imagen opcional. |
| NOV-02 | `NewsPost`, audiencia y estado | Cubierto | Soporta todos, socios o entrenadores y desactivación lógica. |
| NOV-03 | `Notification`, `NotificationType`, entidades origen | Cubierto | Las reglas determinan destinatarios y momento de creación. |
| NOV-04 | `Notification.readAt` | Cubierto | `readAt = null` representa no leída; el historial no se elimina. |
| PAN-01 | Todas las entidades administrativas | Aplicación | El panel compone indicadores y accesos sin una entidad propia. |
| PAN-02 | `User`, `Payment`, `MedicalCertificate` | Aplicación | Indicadores calculados mediante consultas. |
| PAN-03 | `WeeklySchedule`, `ScheduledClass` | Aplicación | Se consulta la semana actual y la existencia de la siguiente. |
| PAN-04 | `AccessLog`, `User`, `AccessPoint`, `Branch` | Aplicación | El resumen se obtiene de los intentos más recientes. |

## Brechas resueltas en el modelo

La revisión de trazabilidad permitió resolver estas brechas antes de derivar el modelo relacional:

1. Se agregaron `imageUrl` y `description` a `Branch` para SED-01, SED-02 y SED-04.
2. Se completó la trazabilidad de `Payment` exigida por PAG-06, diferenciando creación, confirmación y anulación.
3. `AccessLog` conserva el rol utilizado y la sede correspondiente al momento del intento, como exige ACC-06.
4. Se incorporó la regla de PAG-05: si se anula el primer pago, el período inicial se recalcula desde la acreditación válida más antigua.

Ninguna de estas brechas requiere incorporar reservas, cupos, asistencias, beneficios, referidos, evaluaciones ni un QR personal.

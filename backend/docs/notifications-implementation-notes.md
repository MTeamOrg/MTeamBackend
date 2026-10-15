# Notificaciones: decisiones y puntos pendientes

Este apunte registra el comportamiento verificado al corregir el módulo, junto con decisiones funcionales que los documentos vigentes no terminan de definir. No reemplaza ni modifica el Documento de Alcance, los diagramas ni el Modelo de Datos.

## Comportamiento alineado con NOV-03 y NOV-04

- Las consultas y acciones de lectura identifican al usuario desde la sesión y filtran por su `userId`. El detalle de una notificación ajena responde como inexistente.
- La bandeja se ordena por `createdAt` descendente y desempata por `id` descendente. Marcar una o todas como leídas actualiza `readAt`; no elimina filas del historial.
- Los avisos siguen siendo internos y visibles en la plataforma. No se agregan canales push ni SMS.
- Los cambios de clase notifican a los entrenadores asignados a esa clase, incluidos los entrenadores anterior y nuevo cuando se reasigna.

## Decisiones funcionales pendientes

- **Generación de vencimientos:** el backend crea el aviso de cuota vencida o próxima a vencer al consultar la bandeja del socio. El alcance exige esos avisos, pero no establece si deben generarse por un proceso programado o al consultar. La generación programada queda pendiente de una decisión; este cambio conserva el comportamiento actual.
- **Acciones manuales de ADMIN:** el perfil de administrador menciona administrar notificaciones, pero no hay criterios para redactarlas, elegir destinatarios, editarlas o retirarlas. No se agregan esas operaciones.
- **Destinatarios de cambios de clase:** el modelo no relaciona socios con clases y el alcance excluye reservas y cupos. Por eso no hay una forma respaldada por los documentos de determinar qué socios recibirían el aviso; por ahora se notifica a entrenadores asignados.
- **Zona horaria de los mensajes:** la interfaz usa explícitamente `America/Argentina/Buenos_Aires`; los textos generados por el backend usan `es-AR` sin fijar `timeZone`, por lo que la hora depende de la zona configurada en el servidor. Se necesita acordar la zona funcional antes de cambiar el texto persistido.

## Discrepancia del Modelo de Datos

`docs/M-Team_Modelo_de_Datos.docx` y `docs/modelo-relacional.md` describen las columnas funcionales de `notification`, pero no incluyen `dedupe_key`. El esquema Prisma vigente sí lo incluye como columna nullable con unicidad global, agregada por `20261002120000_add_notification_dedupe_key`. Los documentos también proponen índices separados para usuario/fecha y usuario/lectura; Prisma tiene el índice compuesto `(user_id, read_at, created_at)`. No se agregaron ni cambiaron índices: no hay una medición de consultas que lo justifique.

La identidad nueva de cada cambio real de clase reutiliza la columna única existente. Una repetición que ya aplicó el mismo estado se trata como no-op y no vuelve a crear el aviso. No se requiere una migración adicional.

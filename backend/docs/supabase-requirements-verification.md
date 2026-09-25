# Verificación de requisitos del backend con Supabase

Fecha de verificación: 25 de septiembre de 2026.

Esta evidencia corresponde al backend ejecutado contra el proyecto real de Supabase. No
evalúa pantallas del frontend. Todos los datos creados por la suite usan el marcador
`TEST-SUPABASE-VERIFY-20260925`; no se consultaron ni modificaron identidades ajenas a
las credenciales locales de bootstrap y a los registros de prueba.

## Resultado de infraestructura

- La conexión con PostgreSQL funciona mediante Prisma y mediante una consulta real del
  backend.
- Existen las 16 tablas de aplicación y `_prisma_migrations`.
- Las tres migraciones están finalizadas, ninguna está revertida y sus checksums
  coinciden. En Windows, la migración de seguridad requiere normalizar CRLF a LF para
  comparar con el contenido aplicado; `.gitattributes` fija LF para nuevos checkouts.
- `20260925120000_secure_supabase_data_api` no contiene `DROP`, `TRUNCATE`, reset ni
  borrado de datos. Habilita RLS y revoca privilegios de Data API.
- RLS está habilitado en las 16 tablas y en `_prisma_migrations`. `anon` y
  `authenticated` no tienen DML; las pruebas directas de DML fallan con `42501`.
- El rol usado por Prisma conserva propiedad, `SELECT`, `INSERT`, `UPDATE`, `DELETE` y
  permisos de uso y creación sobre `public`. El backend siguió leyendo y escribiendo
  después de aplicar la seguridad.
- Se reinició el proceso del backend y se volvieron a consultar usuarios, pagos, sedes y
  cronogramas creados antes del reinicio.

## Cobertura funcional verificada

`COMPLETO` significa que la implementación de backend, su persistencia y sus permisos se
probaron con Supabase. `PARCIAL` identifica una parte del requisito que aún no puede
verificarse de punta a punta. La columna de frontend queda separada deliberadamente.

### Usuarios y perfiles

| Requisito | Backend | Supabase real | Estado | Frontend |
|---|---|---|---|---|
| USR-01 | Registro público, validación y unicidad | Usuario, perfil y auditoría persistidos; duplicados `409` | COMPLETO | Pendiente de integración |
| USR-02 | Login y error genérico | Login válido, credenciales inválidas `401` | COMPLETO | Pendiente de integración |
| USR-04 | Reset administrativo y cambio obligatorio | Clave temporal, bloqueo de rutas y cambio posterior verificados | COMPLETO | Pendiente de integración |
| USR-05 | Middleware por rol | Casos `401` y `403` con MEMBER, TRAINER y ADMIN | COMPLETO | Pendiente de integración |
| USR-06 | Lectura y edición de contacto/contraseña; endpoint de foto | Contacto y contraseña verificados; foto responde `503` sin Storage | PARCIAL | Pendiente de integración |
| USR-07 | Estado consultado en login y en cada request | Login y token existente bloqueados al desactivar; reactivación verificada | COMPLETO | Pendiente de integración |
| ADM-01 | Búsqueda, rol, estado y paginación | Filtros y paginación reales | COMPLETO | Pendiente de integración |
| ADM-02 | Detalle de socio/entrenador y relaciones | Perfiles, pagos y clases leídos desde relaciones reales | COMPLETO | Pendiente de integración |
| ADM-03 | Alta de MEMBER, TRAINER y ADMIN | Tres roles persistidos; carrera duplicada deja una sola transacción | COMPLETO | Pendiente de integración |
| ADM-04 | Edición y auditoría transaccional | Datos personales/profesionales y responsable persistidos | COMPLETO | Pendiente de integración |
| ADM-05 | Activar, desactivar y reactivar | Estado e historial conservados | COMPLETO | Pendiente de integración |
| ADM-06 | Historial paginado | CREATED, UPDATED, ACTIVATED, DEACTIVATED y PASSWORD_RESET verificados | COMPLETO | Pendiente de integración |
| SOC-01 | Perfil de socio vinculado | Datos personales y contacto de emergencia en `user`/`member_profile` | COMPLETO | Pendiente de integración |
| SOC-03 | Edición de correo y teléfono | Unicidad, campos permitidos y rechazo de rol protegido | COMPLETO | Pendiente de integración |

### Cuota y pagos

| Requisito | Backend | Supabase real | Estado | Frontend |
|---|---|---|---|---|
| CUO-01 | Alta de precio único vigente | Precio decimal creado y consultado como vigente | COMPLETO | Pendiente de integración |
| CUO-02 | Historial inmutable de precios | Dos valores y su relación con el anterior persistidos | COMPLETO | Pendiente de integración |
| CUO-03 | Consulta de cuota propia | Precio, último pago, vencimiento, días y estado reales | COMPLETO | Pendiente de integración |
| CUO-04 | Vigencia exacta de 30 días | Restricción SQL y cálculo backend verificados al milisegundo | COMPLETO | Pendiente de integración |
| CUO-05 | CURRENT, EXPIRING_SOON y EXPIRED | Tres filtros ejecutados con pagos vigentes, próximos y ausentes | COMPLETO | Pendiente de integración |
| PAG-01 | Acreditación manual transaccional | Pago, socio, medio, comprobante y responsables persistidos | COMPLETO | Pendiente de integración |
| PAG-02 | Vista previa sin persistencia | Resumen correcto y conteo de `payment` sin cambios | COMPLETO | Pendiente de integración |
| PAG-03 | Historial propio y administrativo | Orden, paginación y pago anulado visibles | COMPLETO | Pendiente de integración |
| PAG-04 | Filtros administrativos | Socio, documento, rango, medio y estado verificados | COMPLETO | Pendiente de integración |
| PAG-05 | Anulación y fallback al último pago válido | Anulación y nuevo vencimiento verificados; el período médico inicial no tiene API integrada | PARCIAL | Pendiente de integración |
| PAG-06 | Trazabilidad de pago | Creación, confirmación y anulación con administrador y fechas | COMPLETO | Pendiente de integración |
| PAG-07 | Total acreditado por rango | Resultado de API igual al agregado SQL, excluyendo anulados | COMPLETO | Pendiente de integración |

### Sedes, clases y entrenadores

| Requisito | Backend | Supabase real | Estado | Frontend |
|---|---|---|---|---|
| SED-01 | Listado público activo | Tarjeta completa y filtro público verificados | COMPLETO | Pendiente de integración |
| SED-02 | Detalle público con clases | Datos, coordenadas y clases relacionadas verificados | COMPLETO | Pendiente de integración |
| SED-04 | Alta y modificación administrativa | Decimales, edición y duplicado de nombre `409` | COMPLETO | Pendiente de integración |
| SED-05 | Activación lógica | Sede inactiva oculta y rechazada para nuevas clases | COMPLETO | Pendiente de integración |
| SED-06 | Listado administrativo | Búsqueda, estado y paginación verificados | COMPLETO | Pendiente de integración |
| CLA-01 | Consulta pública semanal | Actividad, horario, sede y entrenador reales | COMPLETO | Pendiente de integración |
| CLA-02 | Crear, editar y borrar clase futura | Las tres operaciones se ejecutaron sobre datos de la suite | COMPLETO | Pendiente de integración |
| CLA-03 | Validación de asignaciones | Sede y entrenador inactivos rechazados sin escritura parcial | COMPLETO | Pendiente de integración |
| CLA-04 | Copia transaccional de semana | Fechas trasladadas en Buenos Aires, origen intacto y duplicado `409` | COMPLETO | Pendiente de integración |
| ENT-01 | Listado exclusivo de entrenadores activos | Estado, nombre, especialidad y descripción verificados; foto no verificable sin Storage | PARCIAL | Pendiente de integración |

## Funciones no verificadas como completas

Los modelos y el contrato OpenAPI también describen aptos médicos, accesos QR, puntos de
acceso, eventos, novedades, notificaciones, dashboard y algunas vistas privadas de
entrenadores. Sus rutas no están montadas en el backend actual o sus flujos no están
implementados de punta a punta. Por eso APM-01..07, ACC-01..08, EVE-01..04,
NOV-01..04 y los indicadores PAN permanecen pendientes; la existencia de tablas o de
OpenAPI no se considera implementación.

## Pruebas y datos identificables

La suite aislada se ejecuta manualmente y no forma parte de `npm test` ni de CI:

```powershell
npm run test:integration:supabase
```

Cada corrida genera claves aleatorias en memoria y usa las credenciales ignoradas del
administrador de bootstrap. La suite no imprime tokens ni contraseñas. Comprueba:

- esquema, migraciones, checksums, RLS, privilegios del propietario y DML rechazado;
- registro, login, contraseña temporal, perfil, estados, roles, auditoría y concurrencia;
- precios, precisión decimal, vista previa sin escrituras, pagos, anulación, filtros y total;
- sedes, entrenadores activos, clases, transacciones, zona horaria y copia de semanas;
- persistencia después de detener y volver a iniciar el backend.

No se borraron registros. Durante el endurecimiento reejecutable de la suite hubo corridas
parciales y una corrida final exitosa. Quedaron identificados por marcador:

| Tabla o grupo | Registros |
|---|---:|
| `user` | 20 |
| `member_profile` | 12 |
| `trainer_profile` | 4 |
| `membership_price` con importes reservados de prueba | 8 |
| `payment` | 9 |
| `branch` | 4 |
| `weekly_schedule` | 6 |
| `scheduled_class` | 6 |
| `user_audit_log` | 54 |

`npm run database:inspect` vuelve a calcular estos conteos sin mostrar identidades ni
secretos. Las clases eliminadas por CLA-02 eran exclusivamente registros creados en la
misma corrida; no se eliminó ningún otro dato.

## Storage pendiente

La base PostgreSQL no reemplaza las credenciales de Supabase Storage. En el ambiente
verificado faltan las cuatro variables opcionales:

- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_PROFILE_PHOTO_BUCKET` para fotos públicas de perfil;
- `SUPABASE_STORAGE_BUCKET` reservado para documentos privados futuros.

Los valores vacíos se normalizan a ausentes: el backend arranca y todos los módulos sin
archivos funcionan. Solo la carga de foto responde `503` hasta configurar las primeras
tres variables y un bucket público exclusivo.

## Reproducción sin secretos

Desde `backend/`:

```powershell
npm ci
npm run prisma:validate
npm run prisma:migrate:status
npm run database:inspect
npm test
npm run test:integration:supabase
npm run build
npm run openapi:validate
```

La suite real se detiene con una lista de nombres de variables faltantes si no encuentra
la configuración local. Los archivos `.env`, `.env.development.local`,
`.env.bootstrap.local`, `.env.smoke.local` y `.env.integration.supabase.local` deben
permanecer ignorados y fuera de Git.

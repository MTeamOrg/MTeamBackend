# Control de acceso (USR-04 / USR-05 / USR-07)

Las rutas privadas componen los controles en este orden:

```ts
authenticate,
requirePasswordChangeCompleted,
authorize(UserRole.ADMIN, UserRole.TRAINER),
controller
```

`createAuthenticationMiddleware` valida `Authorization: Bearer <JWT>` mediante
el servicio de tokens existente (HS256, firma, expiración y estructura de
claims). El contrato emitido sigue siendo `sub`, `role` y `exp`; `sub` debe ser
un UUID.

En cada solicitud se consultan `id`, `role`, `status` e
`isPasswordChangeRequired` del usuario actual. Si no existe, se responde 401
`UNAUTHORIZED`; si no está activo, se responde 403 `ACCOUNT_INACTIVE`. De esta
forma, los cambios de estado, rol o exigencia de cambio de contraseña se aplican
en la siguiente solicitud aunque el JWT no haya vencido.

La request recibe solamente:

```ts
authenticatedUser: { id, role, isPasswordChangeRequired }
```

`requirePasswordChangeCompleted` responde 403 `PASSWORD_CHANGE_REQUIRED` si el
usuario todavía usa una contraseña temporal. `authorize` evalúa el rol actual de
la base de datos y responde 403 `FORBIDDEN` cuando no está permitido.

Registro, login y health son públicos. Las rutas privadas actuales son:

- `GET /api/auth/me`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `PATCH /api/auth/password`
- `POST /api/auth/logout`
- `PUT /api/users/me/photo`
- `GET /api/users` (solo `ADMIN`)
- `PATCH /api/users/{userId}/status` (solo `ADMIN`)
- `GET /api/users/{userId}/audit-logs` (solo `ADMIN`)
- `POST /api/users/{userId}/password-resets` (solo `ADMIN`)

`PATCH /api/auth/password` y `POST /api/auth/logout` son las excepciones al
bloqueo por contraseña temporal. La primera debe permanecer accesible para que
el usuario pueda reemplazarla y la segunda permite cerrar la sesión. El cambio
exitoso desactiva `isPasswordChangeRequired`.

El cierre de sesión valida el JWT y devuelve `204`. Debido a que no se
persisten sesiones, el frontend es responsable de eliminar el token almacenado
y redirigir al formulario de ingreso.

El restablecimiento administrativo almacena exclusivamente el hash bcrypt,
activa `isPasswordChangeRequired` y registra en `UserAuditLog` el usuario
afectado, el administrador que realizó la acción, la fecha y la acción
`PASSWORD_RESET`. La actualización y la auditoría se ejecutan en una misma
transacción.

El listado administrativo permite buscar por nombre, apellido, documento o
correo, y filtrar por rol o estado con paginación. El cambio de estado sólo
actualiza `User.status`; activar, desactivar o reactivar una cuenta no elimina
relaciones ni historial. Cuando el estado cambia, se registra `ACTIVATED` o
`DEACTIVATED` junto con el motivo opcional y el administrador responsable en la
misma transacción. Si se solicita el mismo estado, la operación es idempotente
y no crea un evento de auditoría falso.

El historial administrativo es de sólo lectura, paginado y devuelve la acción,
el motivo, la fecha y la identidad básica del administrador responsable. No
incluye `passwordHash` ni otros secretos.

Los futuros endpoints privados deben aplicar autenticación y el bloqueo por
contraseña temporal, además de `authorize(...)` cuando correspondan roles
específicos.

No hay revocación de JWT ni persistencia de sesiones.

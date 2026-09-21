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
- `POST /api/users/{userId}/password-resets` (solo `ADMIN`)

`PATCH /api/auth/password` es la única excepción al bloqueo por contraseña
temporal: requiere autenticación, pero debe permanecer accesible para que el
usuario pueda reemplazarla. El cambio exitoso desactiva
`isPasswordChangeRequired`.

El restablecimiento administrativo almacena exclusivamente el hash bcrypt,
activa `isPasswordChangeRequired` y registra en `UserAuditLog` el usuario
afectado, el administrador que realizó la acción, la fecha y la acción
`PASSWORD_RESET`. La actualización y la auditoría se ejecutan en una misma
transacción.

Los futuros endpoints privados deben aplicar autenticación y el bloqueo por
contraseña temporal, además de `authorize(...)` cuando correspondan roles
específicos.

No hay revocación de JWT ni persistencia de sesiones.

# Control de acceso (USR-05 / USR-07)

Las futuras rutas privadas deben componer los middlewares en este orden,
reutilizando las instancias de `TokenService` y `UserRepository`:

```ts
const authenticate = createAuthenticationMiddleware(tokenService, userRepository);
// En la declaración de una ruta privada:
// authenticate, authorize(UserRole.ADMIN, UserRole.TRAINER), controller
```

`createAuthenticationMiddleware` valida `Authorization: Bearer <JWT>` mediante
el servicio de tokens existente (HS256, firma, expiración y estructura de claims).
El contrato emitido sigue siendo `sub`, `role` y `exp`. El identificador debe ser
un UUID, como los identificadores del modelo User.

En cada solicitud consulta solamente `id`, `role` y `status` del usuario actual.
Si no existe, responde 401 `UNAUTHORIZED`; si no está ACTIVE, responde 403
`ACCOUNT_INACTIVE`. No modifica ni elimina al usuario, sus relaciones o historial.
Una desactivación se aplica a la siguiente solicitud aunque el JWT no haya vencido.

La request recibe únicamente `authenticatedUser: { id, role }`. `authorize`
evalúa ese rol actual de la base de datos, no el rol histórico del token, y
responde 403 `FORBIDDEN` cuando no está permitido. Sin autenticación responde
401; una lista vacía de roles no permite accesos.

Registro, login y health siguen siendo públicos. El login conserva su bloqueo
de cuentas inactivas. Este incremento no agrega rutas privadas: proporciona la
infraestructura que deberán aplicar los futuros endpoints, incluido el escáner.
Las rutas usadas para probar los middlewares existen únicamente en los tests.

No hay revocación de JWT, persistencia de sesiones ni cambios en Prisma.

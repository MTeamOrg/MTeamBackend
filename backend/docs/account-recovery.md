# Recuperación de cuenta por correo — USR-04

Amplía USR-04 del documento de alcance, que describe el restablecimiento administrativo. ADM-04 y el flujo de contraseña temporal permanecen intactos. No se inventó un identificador nuevo.

## Configuración y prueba local

En `backend/.env.development.local` (o el archivo local utilizado por el entorno), configurar:

```dotenv
FRONTEND_PUBLIC_URL=http://localhost:5173
GOOGLE_SMTP_USER=<cuenta-google-dedicada@gmail.com>
GOOGLE_APP_PASSWORD=<contraseña-de-aplicación-de-16-caracteres>
```

Crear una cuenta Google dedicada, activar la verificación en dos pasos y generar una contraseña de aplicación para Mail. Usar esa contraseña, nunca la contraseña normal de Google. El remitente visible será la cuenta configurada en `GOOGLE_SMTP_USER`. Nodemailer usa la configuración segura de Gmail SMTP. No guardar la contraseña de aplicación en Git ni en variables `VITE_`; configurar ambos secretos solo en el backend y reiniciarlo al cambiarlos. Google puede bloquear inicios de sesión SMTP que considere sospechosos y Gmail tiene límites de envío; por eso esta opción sirve para desarrollo/demostración y no se recomienda para producción. El frontend público debe servir `index.html` para `/restablecer-contrasena`.

En una base **local de desarrollo**, ejecutar desde backend `npm run prisma:generate`, `npm run prisma:migrate:dev`, `npm run dev`. La migración preparada es 20261015150000_account_recovery; no se ejecutó contra producción. Para una implementación futura aprobada aplicar la migración con `npm run prisma:migrate:deploy` en el proceso habitual, antes de activar la nueva versión. Revisar primero DATABASE_URL; nunca usar una base de producción para pruebas.

Iniciar frontend con `npm run dev`. Abrir /iniciar-sesion, solicitar recuperación, abrir el enlace recibido y establecer/confirmar contraseña; iniciar sesión con la nueva. Probar vencimiento a los 30 minutos, reutilización y solicitudes repetidas. Los errores de envío se muestran como 503; no se informa éxito antes de la aceptación del proveedor (no implica entrega garantizada a la bandeja).

`npm test -- account-recovery recovery-email` prueba con transporte simulado sin enviar correos reales ni necesitar claves. La prueba de entrega real requiere las variables y cuenta anteriores.

## Seguridad y decisiones

- Token aleatorio de 32 bytes, persistencia SHA-256, vencimiento de 30 minutos y consumo atómico con bloqueo de la fila de usuario. Actualización de contraseña con bcrypt del proyecto y política de 8–72 caracteres, distinta de la actual. Se elimina la obligación de cambiar contraseña temporal.
- El enlace contiene solo un token en el fragmento; no contiene correo ni identificadores personales. El fragmento no viaja al servidor web ni por Referer. Se retira del historial al completar el cambio; no se guarda en localStorage ni se registra.
- La respuesta 202 es idéntica para cuentas existentes, inexistentes e inactivas. Para que los errores y tiempos del proveedor tampoco revelen cuentas, **se envía el mismo correo a toda dirección válida**, pero solo se almacena un token utilizable para una cuenta activa. Los enlaces de otras direcciones son inválidos. Esto tiene costo de envío; limitar tráfico en infraestructura y usar un dominio habilitado. No registrar cuerpos de solicitudes/respuestas en proxies ni herramientas de observabilidad de estas rutas.
- Fallos del proveedor se devuelven como 503 en ambos casos y eliminan el token recién emitido. Ante fallos de base se suprime el error técnico para no registrar argumentos sensibles. No se envían contraseñas ni se exponen respuestas del proveedor.
- Cada cambio exitoso invalida todos los enlaces anteriores. Cambios administrativos o autenticados también los invalidan mediante una huella del hash de contraseña, comprobada nuevamente dentro de la transacción. No se alteran roles, estados o permisos.
- Se conserva el patrón de sesiones del proyecto: JWT stateless sin revocación, incluso en cambios de contraseña existentes. Las sesiones emitidas siguen válidas hasta JWT_EXPIRES_IN; el restablecimiento no inicia una sesión. Revocarlas requeriría ampliar el contrato de sesiones, fuera de este cambio.
- Límite en memoria: 10 solicitudes por IP/minuto compartido por las dos rutas. En producción con varias instancias agregar límite distribuido en el proxy y configurar IP de cliente con proxies confiables; no habilitar trust proxy indiscriminadamente. El frontend bloquea reenvío un minuto tras éxito o 429. No se invalida un enlace anterior al solicitar otro; todos quedan invalidados cuando se cambia la contraseña.
- Para mantenimiento, purgar periódicamente filas vencidas de password_recovery_token con la operación habitual de base de datos. No habilitar tareas contra producción desde este cambio.

## Fallos de entrega y registros

Los enlaces y tokens de recuperación nunca se registran, tampoco en staging ni para cuentas de prueba. Se eliminó la opción `PASSWORD_RECOVERY_LOG_TEST_EMAIL`; quitarla de la configuración de los entornos donde se hubiera definido. Los fallos de SMTP o la falta de configuración devuelven 503 en todos los entornos. El registro no reemplaza el envío del correo.

Los logs de errores contienen únicamente códigos SMTP conocidos, comandos sin argumentos y códigos de respuesta numéricos. No incluyen destinatarios, enlaces, tokens, contraseñas ni mensajes o respuestas completas del proveedor.

## Contrato

- POST /api/auth/password-recovery `{ "email": "persona@example.com" }`: 202 con mensaje genérico; 400 validación; 429 límite; 503 error recuperable.
- POST /api/auth/password-recovery/complete `{ "token": "<64 hex>", "newPassword": "<contraseña nueva>" }`: 204; 400 con INVALID_RECOVERY_TOKEN, EXPIRED_RECOVERY_TOKEN, PASSWORD_REUSE o VALIDATION_ERROR; 429 o 503.

Pruebas: `npm test`, `npm run build`, `npm run prisma:validate`, `npm run openapi:validate`. No hay script lint en este backend; el build ejecuta typecheck. No ejecutar pruebas de integración Supabase sin un entorno aislado configurado.

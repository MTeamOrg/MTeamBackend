# Evidencias requeridas para cerrar el Manual Técnico — M-Team

Esta matriz separa lo verificado localmente de lo que requiere acceso a CI, hosting, proveedores o documentos externos. Completarla sin copiar secretos, tokens, cookies, contraseñas, datos personales ni URLs firmadas de larga duración.

## Identificación del cierre

| Campo | Valor a registrar |
|---|---|
| Fecha/hora UTC | `YYYY-MM-DD HH:mm UTC` |
| Backend repository | `MTeamOrg/MTeamBackend` |
| Backend SHA desplegado | `sha completo` |
| Frontend repository | `MTeamOrg/MTeamFrontend` |
| Frontend SHA desplegado | `sha completo` |
| Backend branch | `develop` / `main` / release aprobada |
| Frontend branch | `develop` / `main` / release aprobada |
| Responsable | nombre/equipo |
| Documento Word final | nombre, versión y ubicación segura |

## CI y calidad

| Evidencia | Estado inicial | Qué adjuntar | No adjuntar |
|---|---|---|---|
| Backend CI | `success` histórico en run 40930311285 sobre SHA anterior | URL del run, SHA, fecha, jobs, artefactos y conclusión | logs con secretos o variables expandidas |
| Backend SonarQube | `success` en run 40935221946 sobre `b704a445` | URL, proyecto, branch/SHA, quality gate, cobertura y fecha | tokens de Sonar |
| Frontend E2E | `success` en run 40926939096 sobre `73f477b` | URL, SHA, navegador, suites, artefactos y fecha | videos/capturas con datos reales |
| Frontend SonarQube | `success` en run 40926939032 sobre `73f477b` | URL, quality gate, cobertura, duplicación, vulnerabilidades y fecha | token o dump privado |
| Qase backend | `pendiente externo` | proyecto, suite, ejecución, fecha, pass/fail y SHA | API key |
| Qase frontend | `pendiente externo` | proyecto, suite, ejecución, fecha, pass/fail y SHA | API key |

## Despliegues y versiones

| Plataforma | Evidencia requerida | Estado |
|---|---|---|
| Vercel frontend | proyecto, URL, ambiente, deployment ID, SHA, build, fecha, fallback SPA y dominio | pendiente externo |
| Render backend | servicio, URL, ambiente, deployment ID, SHA, runtime Node, health check y fecha | pendiente externo |
| Supabase PostgreSQL | proyecto/ambiente sin claves, versión de PostgreSQL, migración aplicada y fecha | pendiente externo |
| Supabase Storage público | bucket de fotos, política pública, proyecto/ambiente y prueba de URL no sensible | pendiente externo |
| Supabase Storage privado | bucket de aptos, política privada, prueba de URL firmada de corta duración y revocación/expiración | pendiente externo |
| Dominios | frontend, API, CORS, HTTPS, DNS y fecha de comprobación | pendiente externo |

## Gmail SMTP y recuperación

| Comprobación | Resultado esperado | Evidencia segura |
|---|---|---|
| Variables presentes | `GOOGLE_SMTP_USER` y `GOOGLE_APP_PASSWORD` configuradas juntas en backend | nombre de ambiente y captura redactada; nunca el valor |
| SMTP aceptado | Gmail acepta el mensaje de prueba | fecha, código SMTP, message-id redactado y destinatario de prueba autorizado |
| Enlace funcional | `/restablecer-contrasena#token=...` abre el frontend y completa una cuenta local | resultado funcional sin mostrar token |
| Expiración | token inválido después de 30 minutos | test/log resumido, sin token |
| Reutilización | token consumido no vuelve a funcionar | resultado del test |
| Invalidación de sesiones | `sessionVersion` cambia y JWT anterior recibe 401 | resultado del test con IDs anonimizados |
| Entrega | bandeja de una cuenta de prueba recibe el correo | fecha y resultado; no almacenar el correo completo |

La aceptación SMTP no garantiza la llegada a la bandeja. La entrega productiva y los límites de Gmail deben documentarse como riesgo del proveedor.

## PostgreSQL y Storage

| Comprobación | Evidencia requerida |
|---|---|
| PostgreSQL 16 local | versión, imagen/instancia y resultado de migración sobre base descartable |
| PostgreSQL 17 CI/hosting | versión, workflow/deployment y resultado de migración |
| Compatibilidad 16/17 | resultado de tests/migraciones en ambas versiones o decisión formal de una sola versión |
| Migraciones | nombre/versión de migración y base aislada; nunca una URL completa |
| Restricciones | prueba de FKs, unicidad, idempotencia y `Notification.dedupeKey` |
| Limpieza | confirmación de que los datos de prueba se eliminaron de la base descartable |

## API, Postman y rutas

| Comprobación | Resultado local | Evidencia adicional |
|---|---|---|
| OpenAPI | `npm.cmd run openapi:validate` pasó | conservar salida del comando y SHA |
| Paridad de rutas | 69 operaciones, `npm.cmd run routes:verify` pasó | conservar salida del comando y SHA |
| JSON Postman | 69 requests; colección y environment parseables | adjuntar hash del archivo, no secretos |
| Secuencia local | health → registro/provisión → login → identidad → carpetas por rol | fecha, base local y resultado resumido |
| Idempotencia | misma clave no duplica cuota/pago | IDs sintéticos y resultado, sin datos reales |
| Errores | 400/401/403/404/409/429/503 según contrato | tabla de casos y códigos; no cuerpos con PII |

## Datos de plataforma y producción

Para cada evidencia externa registrar únicamente:

```text
platform: Vercel | Render | Supabase | Gmail | SonarCloud | Qase
environment: development | test | staging | production
url: URL pública no sensible o URL del run
deployment_or_run_id: identificador
commit_sha: SHA completo
checked_at_utc: fecha/hora UTC
result: passed | failed | pending
owner: responsable
notes: riesgos y acciones pendientes
```

No registrar secretos, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, claves Supabase, contraseñas de aplicación, tokens de recuperación, bearer tokens, cookies, archivos `.env`, dumps de base ni datos reales de socios.

## Criterio de cierre

El manual puede marcarse como cerrado cuando:

1. CI, Sonar y Qase tienen evidencia identificada por SHA.
2. Vercel y Render tienen deployment IDs y URLs verificadas.
3. Supabase confirma PostgreSQL, migraciones y Storage público/privado.
4. Gmail SMTP acepta un caso de recuperación y se registra la limitación de entrega.
5. La matriz de trazabilidad y el Word final apuntan a la misma versión.
6. Las diferencias PostgreSQL 16/17 tienen una decisión documentada.
7. No quedan secretos ni datos reales en anexos, capturas o logs.

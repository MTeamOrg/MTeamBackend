# Qase: registro de ejecuciones de pruebas

Qase centraliza los resultados y la documentación de casos; Sonar sigue siendo la fuente para cobertura de código y su umbral del 80 %. Los reporters de Qase no cambian ni combinan los archivos LCOV.

## Configuración de la cuenta

En cada repositorio de GitHub (`MTeamBackend` y `MTeamFrontend`), abrir **Settings → Secrets and variables → Actions** y agregar:

- Secret `QASE_TESTOPS_API_TOKEN`: token de integración de Qase. Preferí un App Token y no lo guardes en el repo ni lo pegues en el chat.
- Variable `QASE_TESTOPS_PROJECT`: código del proyecto Qase al que se enviarán las ejecuciones. Se puede usar el mismo proyecto para ambos repositorios.

Sin ambas variables los reporters quedan desactivados y los tests corren como antes. Con ambas, CI envía resultados y crea ejecuciones separadas por tipo.

## Qué reporta CI

- Backend: unitarias/API y la integración PostgreSQL de notificaciones, en ejecuciones distintas.
- Frontend: unitarias/componentes y E2E de Playwright, en ejecuciones distintas.
- Las ejecuciones indican aprobadas, fallidas o omitidas. No equivalen a cobertura de líneas/ramas; esa medida continúa en Sonar.

Los resultados automatizados se identifican inicialmente por suite/título. Para vincular una prueba con un caso manual existente en Qase, agregá a la prueba el ID numérico de Qase usando el helper `qase(...)` del reporter correspondiente. No inventes IDs antes de crear los casos en Qase.

## Documentación segura de casos existentes

El reporter de Jest está configurado para enviar resultados de ejecución. La documentación de casos existentes se analiza y sincroniza por separado para no confundir un reporte de resultados con una actualización de campos del caso.

Desde `backend/`, la vista previa local es el modo predeterminado:

```powershell
npm run qase:docs:preview
```

El script analiza los tests `backend/test/**/*.test.ts`, genera la propuesta completa en `backend/docs/qase-test-documentation-preview.json` y un informe resumido en `backend/docs/qase-test-documentation-report.md`. Clasifica las pruebas como unitarias, API, integración o seguridad/autorización; las pruebas de rutas no se consideran E2E automáticamente.

Los vínculos persistentes se registran en `backend/docs/qase-test-case-manifest.json` con el localizador exacto del test y el ID numérico existente de Qase. El script no usa el título como vínculo automático: sin una entrada del manifiesto o un ID `qase(...)` en el código, el caso queda sin modificar y se marca para revisión humana.

Solo después de revisar la vista previa y autorizar una muestra de hasta cinco casos se puede ejecutar `npm run qase:docs:sync` con `QASE_TESTOPS_API_TOKEN` y `QASE_TESTOPS_PROJECT`. La escritura usa la API oficial de Qase, no crea casos ni suites, no cambia títulos o IDs y completa únicamente campos autorizados que estén vacíos. Los campos ya documentados se conservan. Para una actualización mayor se requiere además `--allow-mass-update` de forma explícita; no se ejecuta desde CI.

## Ejecutar localmente y enviar resultados

En PowerShell, desde la carpeta del repositorio que contiene el `package.json`:

```powershell
$env:QASE_MODE = "testops"
$env:QASE_TESTOPS_API_TOKEN = "<token-local>"
$env:QASE_TESTOPS_PROJECT = "<codigo-del-proyecto>"
```

Backend:

```powershell
$env:QASE_TESTOPS_RUN_TITLE = "Backend - unit and API"
npm test
$env:QASE_TESTOPS_RUN_TITLE = "Backend - PostgreSQL integration - notifications"
npm run test:integration:notifications
```

Frontend:

```powershell
$env:QASE_TESTOPS_RUN_TITLE = "Frontend - unit and component"
npm run test
$env:QASE_TESTOPS_RUN_TITLE = "Frontend - end-to-end"
npm run test:e2e
```

No uses un entorno compartido con escrituras para E2E ni integración: mantené la base local descartable ya definida para las pruebas PostgreSQL.

Para volver al comportamiento normal de la terminal:

```powershell
Remove-Item Env:QASE_MODE, Env:QASE_TESTOPS_API_TOKEN, Env:QASE_TESTOPS_PROJECT, Env:QASE_TESTOPS_RUN_TITLE -ErrorAction SilentlyContinue
```

## Casos funcionales prioritarios para cargar en Qase

Crear suites `Accesos QR`, `Bandeja administrativa de accesos` y `Aptos médicos`. Para cada caso registrar precondiciones, datos de prueba, pasos, resultado esperado y comportamiento de error. Como base:

1. Socio activo escanea QR válido de una sede: se registra el acceso para esa sede y el administrador recibe la notificación correspondiente.
2. QR inválido, vencido o ajeno a la sede: no se registra un acceso permitido ni se notifica una entrada exitosa.
3. Administrador consulta últimos accesos: aparecen sede, socio, fecha y resultado; filtros y paginación conservan los criterios seleccionados.
4. Administrador abre la bandeja de aptos médicos: estados, filtros y paginación coinciden con los registros persistidos; aprobación/rechazo refleja el resultado esperado.

Cuando los casos estén creados, relacioná las pruebas automatizadas con sus IDs para que los resultados de CI actualicen esos casos y no creen entradas desconectadas.

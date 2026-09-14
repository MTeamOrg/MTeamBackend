# Contrato OpenAPI del backend

El contrato único se encuentra en [`backend/docs/openapi.yaml`](../backend/docs/openapi.yaml). La aplicación lo carga al iniciar, lo muestra con Swagger UI y publica el mismo documento como JSON. No hay una segunda especificación generada.

## Estado visible del contrato

Todas las operaciones incluyen la extensión `x-implementation-status` y una descripción visible:

- `implemented-verified`: existe una ruta Express y una prueba automatizada la verificó.
- `implemented-unverified`: existe la ruta, pero todavía no se logró probarla.
- `pending`: contrato futuro sin implementación. Swagger muestra la forma prevista, pero **Try it out responderá 404**.

El detalle por módulo está en [`estado-implementacion-openapi.md`](./estado-implementacion-openapi.md) y el vínculo entre flujos y endpoints en [`matriz-cobertura-openapi.md`](./matriz-cobertura-openapi.md).

## Fuentes inspeccionadas

- Código de `backend/src`: aplicación, configuración de ambiente y OpenAPI, rutas, controlador y servicio de health, y middlewares de errores y 404.
- `README.md`, `backend/package.json`, plantillas de ambiente y `tsconfig.json`.
- Documento de alcance y matriz de trazabilidad.
- Modelo relacional y diagrama de clases.
- Diagramas de arquitectura y de secuencia.
- Convenciones de nombres y estrategia de ambientes.
- Historial y ramas remotas del repositorio.

El prototipo de Figma indicado en la tarea no pudo inspeccionarse: el entorno no ofreció un navegador controlable y Figma bloqueó la lectura web automatizada. No se atribuye cobertura a pantallas no vistas. Para cerrar esa cobertura hace falta un enlace de diseño con acceso de lectura, capturas o una exportación navegable.

## Ejecutar el backend y abrir Swagger

Requisitos: una versión reciente de Node.js compatible con el proyecto y npm.

```bash
cd backend
npm ci
npm run dev
```

Con el puerto predeterminado:

- Swagger UI: `http://localhost:3000/api/docs`
- Documento JSON: `http://localhost:3000/api/docs/openapi.json`
- Health check: `http://localhost:3000/api/health`

Para ejecutar el build compilado:

```bash
cd backend
npm ci
npm run build
npm start
```

No se necesitan base de datos, migraciones ni secretos para consultar health o Swagger en el estado actual.

## Validar el contrato

```bash
cd backend
npm ci
npm run validate:openapi
npm test
npm run build
```

`validate:openapi` realiza en forma reproducible estas comprobaciones:

1. Sintaxis OpenAPI 3.1, semántica y resolución de referencias con Swagger Parser.
2. `operationId` obligatorios y únicos.
3. Tags declarados, resúmenes, descripciones y respuestas exitosas.
4. Parámetros de ruta declarados y obligatorios.
5. Roles en operaciones autenticadas y estado de implementación en todas las operaciones.
6. Advertencia visible para contratos pendientes.
7. Ejemplos de schemas comprobados contra su JSON Schema con AJV 2020.
8. Comparación entre rutas encontradas en Express y operaciones marcadas como implementadas.
9. Ausencia de un prefijo `/api` duplicado entre `servers` y `paths`.

Las pruebas cubren `/api/health`, Swagger UI y la publicación del JSON.

## Decisiones y contradicciones abiertas

| Tema | Evidencia o conflicto | Decisión aplicada al contrato | Pendiente |
|---|---|---|---|
| Rol recepcionista | La consigna pide contrastarlo, pero alcance, modelo y enums solo definen socio, entrenador y administrador. | No se agregó `RECEPTIONIST`; las operaciones manuales siguen en `ADMIN`. | M-Team debe decidir si incorpora un cuarto rol y qué permisos tendría. |
| Evento y sede | El modelo relacional anterior usa `event.location` libre; la consigna requiere una relación con `Branch`. | Los DTO de eventos usan `branchId`/`branch` y no aceptan ubicación libre. | Actualizar el modelo y la futura migración antes de implementar eventos. |
| Logout | USR-03 exige cerrar sesión en el navegador, pero no define revocación de JWT y no existe implementación. | No se publicó un endpoint `/auth/logout`; el cliente deberá descartar la credencial hasta acordar revocación. | Definir si el backend necesita lista de revocación o sesiones persistentes. |
| Refresh y recuperación automática | No están implementados ni acordados; el alcance descarta correo automático. | No se documentaron refresh tokens ni recuperación por correo. | Ninguno para el alcance actual. |
| Subida de archivos | El OpenAPI previo usaba multipart y la arquitectura prevé Supabase Storage, pero no define límites. | Se conserva multipart para foto y apto; no se inventa tamaño máximo. Los aptos se descargan por una ruta autenticada. | Confirmar tamaños, MIME reales, nombres y política de almacenamiento. |
| Imágenes de sedes, eventos y novedades | El modelo usa URL, pero no existe flujo de carga confirmado. | Los DTO aceptan `imageUrl`; no se inventaron endpoints de upload ni URLs firmadas. | Definir cómo obtiene administración esas URLs. |
| Medios de pago | El modelo mantiene `method` como `varchar` hasta confirmación. | Se documenta como string, sin enum inventado. | Confirmar catálogo si se quiere restringir. |
| Vigencia del apto | La fuente vigente indica que un apto aprobado no vence; la expresión “vigente” puede sugerir otra política. | `APPROVED` habilita ingreso sin fecha de vencimiento. | Confirmar si el negocio cambia a aptos con vencimiento. |
| Convención de paths | El archivo de convenciones muestra ejemplos singulares, mientras el alcance final y el contrato existente usan plural. | Se conservaron recursos plurales y kebab-case para evitar una ruptura total del contrato. | Unificar el documento de convenciones. |
| Figma | El enlace de prototipo no fue accesible desde las integraciones disponibles. | La matriz usa únicamente alcance, trazabilidad, modelo y secuencias. | Revisar pantallas de escritorio y móvil cuando haya una fuente accesible. |

## Alcance de implementación

Esta tarea completa y valida el **contrato**, no los módulos funcionales. En el backend actual solo están implementados y verificados health y la publicación del documento OpenAPI. Autenticación, persistencia, permisos, reglas de negocio y todos los dominios restantes siguen pendientes de implementación real mediante routes/controllers/services/repositories.

# Informe integral de avance

## Proyecto M-TEAM

**Sistema de gestión de gimnasio** · **Corte al 26 de septiembre de 2026**

## Resumen ejecutivo

M-TEAM presenta un núcleo funcional sólido y ya integrado en autenticación, usuarios, administración, pagos, sedes, cronogramas, entrenadores y aptos médicos. Los **principales bloques pendientes son Acceso QR, Eventos y Novedades/Notificaciones**. Para control interno, el avance se estima ponderando los 72 requerimientos funcionales del alcance y diferenciando cobertura de backend y frontend.

| Indicador | Avance | Descripción |
|---|---:|---|
| Backend | **69 %** | Cobertura funcional estimada |
| Frontend | **66 %** | Pantallas y consumo de API |
| Proyecto total | **68 %** | Estimación integral |

## 1. Estado general del proyecto

La siguiente tabla resume el estado por módulo. Los porcentajes de backend y frontend son aproximados y están pensados para visualizar dónde se concentra el trabajo restante.

| Módulo | Estado | Back | Front | Lectura actual |
|---|---|---:|---:|---|
| Usuarios y autenticación | Implementado | 100 % | 95 % | Registro, login, sesión, roles, perfil y contraseñas. |
| Administración de usuarios | Implementado | 95 % | 90 % | Listado, detalle, alta, edición, estado y auditoría. |
| Socios | Implementado | 95 % | 95 % | Perfil, datos de contacto y situación general. |
| Cuota mensual | Avanzado | 90 % | 80 % | Cálculo y estados listos; notificación por cambio pendiente. |
| Pagos | Implementado | 95 % | 90 % | Acreditación, historial, filtros, anulación y reportes. |
| Aptos médicos | Avanzado | 86 % | 86 % | Carga, revisión, historial y archivo privado; APM-06 pendiente. |
| Acceso QR | Pendiente | 0 % | 0 % | Documentado en Swagger, todavía sin implementación integrada. |
| Sedes | Avanzado | 90 % | 85 % | Gestión y consulta; integración de Maps requiere cierre final. |
| Clases | Implementado | 95 % | 90 % | Cronograma, alta/edición/baja y copia semanal; quedan ajustes UX. |
| Entrenadores | Avanzado | 85 % | 70 % | Perfiles y clases cubiertos; comunicaciones dependen de Novedades. |
| Eventos | Pendiente | 0 % | 0 % | Contrato definido, sin módulo real en `develop`. |
| Novedades/Notificaciones | Pendiente | 0 % | 0 % | Modelado y Swagger, pero no implementación real. |
| Panel administrativo | Parcial | 40 % | 70 % | Indicadores principales disponibles; accesos y comunicaciones faltan. |

### Lectura rápida

- El núcleo administrativo y de socios ya permite demostrar flujos reales de negocio.
- El mayor faltante funcional completo es el módulo de Acceso QR.
- Eventos, Novedades y Notificaciones están definidos en el alcance y Swagger, pero todavía deben desarrollarse.

## 2. Requerimientos: implementados y pendientes

### Implementados o con cobertura funcional alta

- **USR-01 a USR-07:** registro, autenticación, sesión, roles, perfiles y estado de cuenta.
- **ADM-01 a ADM-06:** administración de usuarios, cambios de estado, contraseña temporal y auditoría.
- **SOC-01 a SOC-03:** perfil del socio, datos personales/contacto y consulta de situación.
- **CUO-01 a CUO-05:** valor de cuota, historial, vigencia de 30 días, estado y filtros.
- **PAG-01 a PAG-07:** acreditación, previsualización, historial, filtros, anulación, trazabilidad y resumen.
- **APM-01 a APM-05 y APM-07:** carga, estado, período inicial, consulta, revisión, reemplazo tras rechazo e historial.
- **SED-01, SED-02, SED-04, SED-05 y SED-06:** consulta y administración de sedes.
- **CLA-01 a CLA-04:** consulta, gestión y copia del cronograma semanal.
- **ENT-01, ENT-02, ENT-03, ENT-05 y ENT-06:** entrenadores, perfiles, clases y restricciones de rol.
- **PAN-01 y parte de PAN-02/PAN-03:** panel, accesos directos e indicadores disponibles.

### Pendientes o parciales

- **CUO-06:** notificación por cambio del valor de cuota.
- **APM-06:** notificación interna al aprobar o rechazar un apto médico.
- **ACC-01 a ACC-08:** escaneo QR, puntos de acceso, reglas de ingreso, resultados e historial.
- **SED-03:** integración final y verificable de Google Maps/indicaciones.
- **ENT-04:** novedades y notificaciones dirigidas a entrenadores.
- **EVE-01 a EVE-04:** consulta, creación, publicación, cancelación y estados de eventos.
- **NOV-01 a NOV-04:** novedades, audiencias y centro de notificaciones.
- **PAN-04 y parte de PAN-02/PAN-03:** últimos accesos y algunos indicadores dependientes de módulos pendientes.

## 3. Backend, frontend e integración

### Arquitectura de integración

```text
Frontend             API REST           Prisma         PostgreSQL / Supabase
React + Vite  --->    Express + TS  --->  Prisma  --->    + Storage privado
```

**Despliegue:** frontend en Vercel, backend en Render y base/Storage en Supabase. La comunicación usa el cliente REST del frontend contra `/api` y el backend aplica autenticación, autorización, validación y persistencia con Prisma.

### Qué está integrado hoy

- **Autenticación y perfiles:** frontend y backend consumen el mismo contrato.
- **Usuarios y administración:** pantallas administrativas conectadas a endpoints reales.
- **Cuotas y pagos:** flujo de consulta y administración conectado a PostgreSQL.
- **Sedes, entrenadores y cronogramas:** datos reales desde la API; administración de clases operativa.
- **Aptos médicos:** contrato frontend/backend alineado, archivos privados mediante URLs firmadas y bucket Supabase creado.
- **Dashboard admin:** métricas reales para socios, cuotas y aptos pendientes; otros indicadores dependen de módulos futuros.

### Qué falta integrar

- Acceso QR completo (cámara, punto de acceso, validación y logs).
- Eventos.
- Novedades y centro de notificaciones.
- Pruebas E2E completas de todos los módulos sobre Vercel + Render + Supabase.

## 4. Swagger / contrato de API

El archivo OpenAPI actual documenta **60 paths y 78 operaciones**. Se utiliza como contrato objetivo del sistema y se visualiza mediante Swagger UI en `/api/docs` cuando el backend está activo.

| Grupo API | Estado | Alcance |
|---|---|---|
| Health / Auth | Implementado | Salud, registro, login, logout, identidad y cambio de contraseña. |
| Usuarios / Socios | Implementado | CRUD administrativo, perfil, auditoría y membresía. |
| Cuotas / Pagos | Implementado | Precios, pagos, preview, anulación, historial y resumen. |
| Aptos médicos | Implementado | Carga, listado, detalle, archivo firmado y revisión. |
| Sedes | Implementado | Público, administración y estado. |
| Cronograma / Clases | Implementado | Semanas, copia y gestión de clases. |
| Entrenadores | Implementado/avanzado | Listado, perfil y clases asignadas. |
| Access attempts / points | Planificado | Documentado en Swagger, aún sin rutas reales en `backend/src/route`. |
| Eventos | Planificado | Contrato documentado; implementación pendiente. |
| Novedades | Planificado | Contrato documentado; implementación pendiente. |
| Notificaciones | Planificado | Contrato documentado; implementación pendiente. |

## 5. Lectura del Gantt

El cronograma organiza el proyecto desde fines de julio hasta la entrega final del **02/11/2026**. La planificación separa documentación/setup, módulos funcionales, integración general y cierre con testing y despliegue.

| Período | Bloque | Lectura al corte |
|---|---|---|
| Julio–agosto | Alcance, EDT, arquitectura, diagramas, modelo de datos y Figma. | Mayormente completado. |
| 07/09–14/09 | Setup técnico, repositorios, backend, frontend, PostgreSQL/Supabase y dependencias. | Completado o muy avanzado. |
| 11/09–24/09 | Usuarios, administración, cuotas, pagos y aptos médicos. | Núcleo del 60 % prácticamente cubierto. |
| 18/09–25/09 | Acceso QR. | Desfasado: sigue pendiente y pasa a ser prioridad. |
| 22/09–02/10 | Sedes, clases y entrenadores. | Muy avanzado; quedan cierres y ajustes UX. |
| 28/09–12/10 | Eventos, novedades y panel. | Panel parcial; Eventos/Novedades pendientes. |
| 12/10–02/11 | Integración total, QA, despliegue, manuales y presentación. | Trabajo futuro / parcialmente adelantado por Vercel, Render y Supabase. |

### Interpretación

- El equipo adelantó parte del despliegue y de la integración respecto de la secuencia original del Gantt.
- El principal desvío funcional es Acceso QR: estaba previsto antes del parcial y todavía no está implementado.
- Aptos médicos avanzó más de lo que reflejaba el Gantt.

## 6. Control de tiempos

Las cuatro plantillas Excel del equipo comparan el tiempo estimado con el real. Un desvío positivo significa que la actividad llevó más tiempo del previsto; uno negativo indica que llevó menos.

| Integrante | Estimado | Real | Desvío | Variación | Lectura |
|---|---:|---:|---:|---:|---|
| Leandro Callizaya Flores | 55.7 h | 46.5 h | -9.2 h | -16.5 % | Menos tiempo |
| Franco Dalla Via Oliveros | 14.7 h | 17.0 h | +2.3 h | +15.9 % | Más tiempo |
| Lara Frenkel | 40.5 h | 37.2 h | -3.3 h | -8.2 % | Menos tiempo |
| Pablo Cannizzaro | 42.0 h | 41.5 h | -0.5 h | -1.2 % | Casi igual |
| **TOTAL EQUIPO** | **152.9 h** | **142.2 h** | **-10.7 h** | **-7.0 %** | **Menos tiempo** |

## 7. Próximos pasos y conclusión

### Prioridades inmediatas

| # | Prioridad | Resultado esperado |
|---:|---|---|
| 1 | Cerrar el smoke productivo de Aptos Médicos | Verificar variables de Render, carga real al bucket privado, revisión admin y reenvío tras rechazo. |
| 2 | Implementar Acceso QR | Es el bloque funcional completo más importante que todavía está en 0 %. |
| 3 | Cerrar Sedes / Clases / Entrenadores | Ajustes UX, Google Maps y validaciones finales. |
| 4 | Implementar Eventos, Novedades y Notificaciones | Completar EVE-01..04, NOV-01..04 y notificaciones pendientes de cuota/apto. |
| 5 | QA e integración final | Pruebas E2E, compatibilidad móvil, rendimiento, seguridad y documentación final. |

### Conclusión

El proyecto **M-TEAM se encuentra en una etapa de integración avanzada**. El backend tiene una cobertura estimada cercana al 69 %, el frontend al 66 % y el avance funcional total ronda el 68 %. El núcleo necesario para demostrar usuarios, administración, pagos, sedes, clases y aptos médicos está desarrollado, mientras que los principales faltantes son Acceso QR, Eventos y Novedades/Notificaciones.

Respecto del **hito del 60 % del 28/09**, la estimación interna ubica al proyecto por encima del objetivo. Para sostener esa conclusión en la presentación, el porcentaje debe acompañarse con una demostración de los módulos integrados, Swagger y evidencia del despliegue. El Gantt muestra que parte del trabajo de despliegue se adelantó, mientras que QR se desplazó y debe priorizarse en la siguiente etapa.

El **control PSP también es favorable**: el equipo registra 142.2 horas reales frente a 152.9 horas estimadas, una diferencia de -7.0 %. Esto indica que, a nivel acumulado, las estimaciones fueron razonablemente cercanas.

---

*Proyecto M-TEAM · Ingeniería en Informática*

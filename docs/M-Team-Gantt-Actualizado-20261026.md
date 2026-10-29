# M-TEAM — Cronograma de proyecto actualizado

**Fecha de corte:** 26/10/2026  
**Período del cronograma:** 27/07/2026–02/11/2026  
**Base:** Actualización de la planificación original, sin reemplazar la EDT ni las dependencias.

## Estado técnico al corte

La programación funcional avanzó; el cierre depende de evidencias de aceptación, despliegue y documentación.

- **Módulos funcionales:** 7 módulos en desarrollos y correcciones. Implementación mapeada según informe de control.
- **Integración:** 94% de avance de tarea (estimado). No reemplaza E2E publicado, cámara ni Storage.
- **QA y despliegue:** 76% de avance de tarea (estimado). Replanificación de evidencias y validación final.

## Avance por bloque de la EDT original

| Bloque | Avance |
|---|---:|
| 0.1 Documentación y entregables | 85% |
| 0.2 Definición técnica | 98% |
| 1 Usuarios y autenticación | 99% |
| 2 Administración de usuarios | 99% |
| 3 Cuota y pagos | 99% |
| 4 Aptos médicos | 98% |
| 5 Acceso QR | 97% |
| 6 Sedes, clases y entrenadores | 97% |
| 7 Eventos, novedades y panel | 98% |
| 8 Integración general | 94% |
| 9 Testing, QA y despliegue | 76% |

## Entregables y controles próximos

| Entregable | Avance | Observación |
|---|---:|---|
| 8 — Informe de control | 100% | Documento disponible en Drive |
| 9 — Casos + Sonar | 45% | Paquete académico y evidencias pendientes |
| 10 — Despliegue + manual | 20% | Validación y documentación pendientes |
| 11 — Cierre final | 0% | Fecha objetivo: 02/11 |

## Cronograma detallado (130 registros)

**Responsables:** P = Pablo · La = Lara · F = Franco · Le = Leandro.

Los porcentajes reflejan avance técnico estimado del cronograma, **no aceptación formal**. Las barras y dependencias gráficas del PDF se representan aquí mediante fechas, tareas y porcentajes, sin pretender reconstruir relaciones no explicitadas.

### Registros 1–25

| ID | Tarea / EDT | Responsable(s) | Inicio | Fin | Avance |
|---:|---|---|---|---|---:|
| 1 | 0 Gestión del Proyecto y Setup | — | 27/07/26 | 02/11/26 | 87% |
| 2 | 0.1 Documentación y entregables | — | 27/07/26 | 02/11/26 | 85% |
| 3 | 0.1.1 Formación del grupo y elección preliminar de temática | P, La, F, Le | 27/07/26 | 27/07/26 | 100% |
| 4 | 0.1.2 Documento de alcance | P, La, F, Le | 28/07/26 | 31/07/26 | 100% |
| 5 | H-0.1a ENTREGABLE 1 - Documento de Alcance | — | 03/08/26 | 03/08/26 | 100% |
| 6 | 0.1.3 Cronograma + convenciones de nombres + checklist | P, La, F, Le | 04/08/26 | 07/08/26 | 100% |
| 7 | H-0.1b ENTREGABLE 2 - Cronograma, convenciones y checklist | — | 10/08/26 | 10/08/26 | 100% |
| 8 | 0.1.4 Diagrama de arquitectura y componentes | P, F | 11/08/26 | 21/08/26 | 100% |
| 9 | H-0.1c ENTREGABLE 3 - Arquitectura / Componentes | — | 24/08/26 | 24/08/26 | 100% |
| 10 | 0.1.5 Diagrama de clases + modelo de datos + diseño de interfaces | P, La, F, Le | 24/08/26 | 28/08/26 | 100% |
| 11 | H-0.1d ENTREGABLE 4 - Clases, modelo de datos e interfaces | — | 31/08/26 | 31/08/26 | 100% |
| 200 | 0.1.5b Prototipo funcional en Figma + manual de marca | — | 31/08/26 | 04/09/26 | 100% |
| 201 | 0.1.5c Diagrama de secuencias (Clase 5) | — | 03/09/26 | 07/09/26 | 100% |
| 12 | 0.1.6 Informe de avance + cronograma refinado | P, La | 01/09/26 | 04/09/26 | 100% |
| 13 | H-0.1e ENTREGABLE 5 - Informe de avance + cronograma refinado | — | 07/09/26 | 07/09/26 | 100% |
| 202 | 0.1.5d Correcciones de la devolucion del E4 (clases y modelo de datos) | — | 08/09/26 | 08/09/26 | 100% |
| 14 | 0.1.7 Informe de control de avance | F, Le | 29/09/26 | 26/10/26 | 100% |
| 15 | H-0.1f ENTREGABLE 8 - Informe de control de avance | — | 26/10/26 | 26/10/26 | 100% |
| 16 | 0.1.8 Manual técnico + registro de defectos | P, F | 26/10/26 | 30/10/26 | 35% |
| 17 | 0.1.9 Manual de usuario + informe final + exposición | P, La, F, Le | 27/10/26 | 02/11/26 | 10% |
| 203 | 0.1.10 Registro PSP de tiempos y bitacora de avances (continuo) | — | 27/07/26 | 30/10/26 | 90% |
| 18 | 0.2 Definición técnica | — | 07/09/26 | 14/09/26 | 98% |
| 19 | 0.2.1 Repositorio GitHub + estructura de ramas | P | 07/09/26 | 07/09/26 | 100% |
| 20 | 0.2.2 Setup backend Node.js + Express + TypeScript | P | 08/09/26 | 09/09/26 | 100% |
| 21 | 0.2.3 Setup frontend React + Vite + TypeScript | La | 08/09/26 | 09/09/26 | 100% |

### Registros 26–50

| ID | Tarea / EDT | Responsable(s) | Inicio | Fin | Avance |
|---:|---|---|---|---|---:|
| 22 | 0.2.4 PostgreSQL/Supabase + Prisma + Storage | F | 08/09/26 | 10/09/26 | 95% |
| 23 | 0.2.5 Dependencias, variables de entorno y configuración común | Le | 10/09/26 | 10/09/26 | 100% |
| 24 | H-0.2 ENTREGABLE 6 - Repositorio/s GitHub y setup técnico | — | 14/09/26 | 14/09/26 | 100% |
| 25 | 1 Módulo Usuarios y Autenticación | — | 11/09/26 | 30/10/26 | 99% |
| 26 | 1.1 Backend | — | 11/09/26 | 17/09/26 | 99% |
| 27 | 1.1.1 USR-01/02 Registro e inicio de sesión | P | 11/09/26 | 14/09/26 | 100% |
| 28 | 1.1.2 USR-03/04 Logout y recuperación administrativa de contraseña | P | 15/09/26 | 16/09/26 | 100% |
| 29 | 1.1.3 USR-05/07 Roles y restricción de cuentas desactivadas | F | 15/09/26 | 16/09/26 | 100% |
| 30 | 1.1.4 USR-06 + SOC-01/03 Perfil y datos del socio | F | 16/09/26 | 17/09/26 | 98% |
| 31 | 1.2 Frontend | — | 14/09/26 | 18/09/26 | 99% |
| 32 | 1.2.1 Pantallas de registro, login y sesión | La | 14/09/26 | 16/09/26 | 100% |
| 33 | 1.2.2 Perfil del socio + situación general (SOC-02) | La | 17/09/26 | 18/09/26 | 97% |
| 34 | 1.3 Pruebas | — | 18/09/26 | 18/09/26 | 100% |
| 35 | 1.3.1 Pruebas de autenticación, roles y perfiles | P, La | 18/09/26 | 18/09/26 | 100% |
| 36 | H-1 Hito: Módulo Usuarios y Autenticación validado | — | 30/10/26 | 30/10/26 | 100% |
| 37 | 2 Módulo Administración de Usuarios | — | 16/09/26 | 30/10/26 | 99% |
| 38 | 2.1 Backend | — | 16/09/26 | 21/09/26 | 100% |
| 39 | 2.1.1 ADM-01/02 Listado, filtros y detalle de usuario | F | 16/09/26 | 17/09/26 | 100% |
| 40 | 2.1.2 ADM-03/04 Creación, edición y recuperación de acceso | P | 17/09/26 | 18/09/26 | 100% |
| 41 | 2.1.3 ADM-05/06 Activación, desactivación e historial | F | 18/09/26 | 21/09/26 | 100% |
| 42 | 2.2 Frontend | — | 18/09/26 | 21/09/26 | 99% |
| 43 | 2.2.1 Panel administrativo de usuarios | Le | 18/09/26 | 21/09/26 | 99% |
| 44 | 2.3 Pruebas | — | 22/09/26 | 22/09/26 | 100% |
| 45 | 2.3.1 Pruebas de administración y permisos | P, Le | 22/09/26 | 22/09/26 | 100% |
| 46 | H-2 Hito: Módulo Administración de Usuarios validado | — | 30/10/26 | 30/10/26 | 100% |

### Registros 51–75

| ID | Tarea / EDT | Responsable(s) | Inicio | Fin | Avance |
|---:|---|---|---|---|---:|
| 47 | 3 Módulo Cuota Mensual y Pagos | — | 15/09/26 | 30/10/26 | 99% |
| 48 | 3.1 Backend | — | 15/09/26 | 22/09/26 | 99% |
| 49 | 3.1.1 CUO-01..04 Valor, historial y vigencia automática de 30 días | P | 15/09/26 | 17/09/26 | 100% |
| 50 | 3.1.2 CUO-05/06 Estados de cuota y notificación de cambios | P | 17/09/26 | 18/09/26 | 98% |
| 51 | 3.1.3 PAG-01..04 Acreditación, confirmación, historial y filtros | F | 17/09/26 | 21/09/26 | 100% |
| 52 | 3.1.4 PAG-05..07 Anulación, recálculo, trazabilidad y recaudación | F | 21/09/26 | 22/09/26 | 97% |
| 53 | 3.2 Frontend | — | 17/09/26 | 22/09/26 | 99% |
| 54 | 3.2.1 Vista del socio: cuota, vencimiento e historial | La | 17/09/26 | 21/09/26 | 100% |
| 55 | 3.2.2 Panel admin: valor de cuota y pagos | Le | 21/09/26 | 22/09/26 | 98% |
| 56 | 3.3 Pruebas | — | 23/09/26 | 23/09/26 | 100% |
| 57 | 3.3.1 Pruebas de vigencia, pagos, anulaciones y estados | P, F | 23/09/26 | 23/09/26 | 100% |
| 58 | H-3 Hito: Módulo Cuota y Pagos validado | — | 30/10/26 | 30/10/26 | 91% |
| 59 | 4 Módulo Aptos Médicos | — | 16/09/26 | 30/10/26 | 98% |
| 60 | 4.1 Backend | — | 16/09/26 | 23/09/26 | 99% |
| 61 | 4.1.1 APM-01..03 Carga, estado pendiente y consulta | F | 16/09/26 | 18/09/26 | 100% |
| 62 | 4.1.2 APM-04/05 Revisión, aprobación y rechazo | F | 18/09/26 | 21/09/26 | 100% |
| 63 | 4.1.3 APM-06/07 Notificación, reemplazo e historial | P | 22/09/26 | 23/09/26 | 98% |
| 64 | 4.2 Frontend | — | 17/09/26 | 22/09/26 | 99% |
| 65 | 4.2.1 Carga y consulta del apto médico | La | 17/09/26 | 21/09/26 | 99% |
| 66 | 4.2.2 Revisión administrativa de aptos | Le | 21/09/26 | 22/09/26 | 99% |
| 67 | 4.3 Pruebas | — | 23/09/26 | 23/09/26 | 90% |
| 68 | 4.3.1 Pruebas de estados e historial de aptos | F, La | 23/09/26 | 23/09/26 | 90% |
| 69 | H-4 Hito: Módulo Aptos Médicos validado | — | 30/10/26 | 30/10/26 | 90% |
| 70 | H-0.3 ENTREGABLE 7 - Backend con API funcionando + Swagger | — | 21/09/26 | 21/09/26 | 100% |
| 71 | 5 Módulo Accesos mediante QR | — | 18/09/26 | 30/10/26 | 97% |

### Registros 76–100

| ID | Tarea / EDT | Responsable(s) | Inicio | Fin | Avance |
|---:|---|---|---|---|---:|
| 72 | 5.1 Backend | — | 18/09/26 | 24/09/26 | 100% |
| 73 | 5.1.1 ACC-02/03 Punto de acceso + usuario autenticado | P | 18/09/26 | 21/09/26 | 100% |
| 74 | 5.1.2 ACC-04 Validación de cuenta, cuota, apto y período inicial | P | 22/09/26 | 23/09/26 | 100% |
| 75 | 5.1.3 ACC-05..07 Resultado, registro e historial de accesos | F | 23/09/26 | 24/09/26 | 100% |
| 76 | 5.2 Frontend | — | 21/09/26 | 24/09/26 | 96% |
| 77 | 5.2.1 ACC-01 Escáner QR mediante cámara | La | 21/09/26 | 23/09/26 | 96% |
| 78 | 5.2.2 ACC-05/08 Resultado, mensajes y permisos de cámara | Le | 23/09/26 | 24/09/26 | 97% |
| 79 | 5.3 Pruebas | — | 24/09/26 | 24/09/26 | 85% |
| 80 | 5.3.1 Pruebas de acceso permitido/rechazado y gracia de 20 días | P, F | 24/09/26 | 24/09/26 | 85% |
| 81 | H-5 Hito: Módulo Accesos QR validado | — | 30/10/26 | 30/10/26 | 87% |
| 82 | 6 Módulo Sedes, Clases y Entrenadores | — | 22/09/26 | 30/10/26 | 97% |
| 83 | 6.1 Backend | — | 22/09/26 | 29/09/26 | 98% |
| 84 | 6.1.1 SED-01..06 Gestión de sedes y Google Maps | F | 22/09/26 | 24/09/26 | 97% |
| 85 | 6.1.2 ENT-01..06 Perfiles, clases asignadas y restricciones | F | 24/09/26 | 28/09/26 | 95% |
| 86 | 6.1.3 CLA-01..04 Cronograma semanal + copia de semana anterior | P | 24/09/26 | 29/09/26 | 100% |
| 87 | 6.2 Frontend | — | 24/09/26 | 30/09/26 | 96% |
| 88 | 6.2.1 Sedes + Google Maps | Le | 24/09/26 | 28/09/26 | 96% |
| 89 | 6.2.2 Cronograma semanal + vista del entrenador | La | 28/09/26 | 30/09/26 | 97% |
| 90 | 6.3 Pruebas | — | 01/10/26 | 01/10/26 | 88% |
| 91 | 6.3.1 Pruebas de sedes, clases y entrenadores | F, La | 01/10/26 | 01/10/26 | 88% |
| 92 | H-6 Hito: Módulo Sedes, Clases y Entrenadores validado | — | 30/10/26 | 30/10/26 | 90% |
| 93 | 7 Módulo Eventos, Novedades y Panel | — | 28/09/26 | 30/10/26 | 98% |
| 94 | 7.1 Backend | — | 28/09/26 | 06/10/26 | 99% |
| 95 | 7.1.1 EVE-01..04 Consulta, publicación, cancelación y estados | F | 28/09/26 | 29/09/26 | 100% |
| 96 | 7.1.2 NOV-01..04 Novedades y notificaciones internas | P | 29/09/26 | 01/10/26 | 100% |

### Registros 101–125

| ID | Tarea / EDT | Responsable(s) | Inicio | Fin | Avance |
|---:|---|---|---|---|---:|
| 97 | 7.1.3 PAN-01..04 Indicadores de socios, cuotas, aptos, clases y accesos | F | 02/10/26 | 06/10/26 | 97% |
| 98 | 7.2 Frontend | — | 30/09/26 | 08/10/26 | 98% |
| 99 | 7.2.1 Eventos, novedades y centro de notificaciones | La | 30/09/26 | 02/10/26 | 99% |
| 100 | 7.2.2 Panel administrativo e indicadores | La, Le | 06/10/26 | 08/10/26 | 97% |
| 101 | 7.3 Pruebas | — | 09/10/26 | 09/10/26 | 90% |
| 102 | 7.3.1 Pruebas de eventos, notificaciones e indicadores | P, La | 09/10/26 | 09/10/26 | 90% |
| 103 | H-7 Hito: Módulo Eventos, Novedades y Panel validado | — | 30/10/26 | 30/10/26 | 90% |
| 104 | 8 Integración General | — | 23/09/26 | 30/10/26 | 94% |
| 105 | 8.1 Integración FE + BE + BBDD de Usuarios, Cuota, Aptos y QR | P, La, F, Le | 23/09/26 | 29/10/26 | 93% |
| 106 | 8.2 Revisión de funcionalidades integradas y estado del proyecto | P, La, F, Le | 24/09/26 | 24/09/26 | 100% |
| 204 | 8.2b Colchon de estabilizacion y ensayo de demo del Parcial 1 | — | 25/09/26 | 25/09/26 | 90% |
| 107 | H-8a PARCIAL 1 - Integración FE + BE + BBDD / 60 % | — | 28/09/26 | 28/09/26 | 100% |
| 108 | 8.3 Integración completa de todos los módulos | P, La, F, Le | 12/10/26 | 29/10/26 | 91% |
| 109 | 8.4 Diseño responsivo, navegación y manejo global de errores | La, Le | 12/10/26 | 29/10/26 | 97% |
| 110 | H-8b Hito: Integración General validada | — | 30/10/26 | 30/10/26 | 89% |
| 111 | 9 Testing, QA y Despliegue | — | 12/10/26 | 02/11/26 | 76% |
| 112 | 9.1 Testing y calidad | — | 12/10/26 | 30/10/26 | 80% |
| 113 | 9.1.1 Casos y datos de prueba | F, Le | 12/10/26 | 29/10/26 | 70% |
| 114 | 9.1.2 Pruebas unitarias, API e integración | P, F | 15/10/26 | 29/10/26 | 90% |
| 115 | 9.1.3 Automatización de pruebas + Sonar + resultados | P, F | 16/10/26 | 30/10/26 | 82% |
| 116 | H-9a ENTREGABLE 9 - Casos de prueba + automatización + Sonar | — | 30/10/26 | 30/10/26 | 45% |
| 117 | 9.2 Despliegue | — | 19/10/26 | 30/10/26 | 84% |
| 118 | 9.2.1 Supabase producción + Storage | F | 19/10/26 | 28/10/26 | 87% |
| 119 | 9.2.2 Backend en Render/Railway + frontend en Vercel | P, La | 20/10/26 | 29/10/26 | 90% |
| 120 | 9.2.3 Variables, CORS, URL pública, Swagger y validación post-despliegue | P, F, Le | 22/10/26 | 30/10/26 | 75% |

### Registros 126–130

| ID | Tarea / EDT | Responsable(s) | Inicio | Fin | Avance |
|---:|---|---|---|---|---:|
| 121 | H-9b ENTREGABLE 10 - Aplicación desplegada + manual técnico + defectos | — | 30/10/26 | 30/10/26 | 20% |
| 122 | 9.3 Cierre | — | 29/10/26 | 02/11/26 | 9% |
| 123 | 9.3.1 Revisión final de manual, informe y demostración | P, La, F, Le | 29/10/26 | 02/11/26 | 15% |
| 124 | 9.3.2 Ensayo de exposición oral | P, La, F, Le | 30/10/26 | 02/11/26 | 0% |
| 125 | H-9c ENTREGABLE 11 - Manual de usuario + Informe Final + Exposición | — | 02/11/26 | 02/11/26 | 0% |

## Convenciones del gráfico original

- Barra oscura: ejecutado estimado.
- Barra clara: restante.
- Línea gris: plan anterior, si fue reprogramado.
- Línea roja vertical: fecha de corte 26/10/2026.

**Fuente indicada en el PDF:** XML del 26/09 + Drive + GitHub (BE #77, FE #90). Porcentajes técnicos estimados, no aceptación formal.

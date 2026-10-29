# Informe de Control de Avance

**Universidad de Belgrano · Ingeniería en Informática**

ENTREGABLE 8
Proyecto M-Team · Grupo 6
Fecha de corte
26 de octubre de 2026
Integrantes
Pablo Cannizzaro · Lara Frenkel · Franco Dalla Via Oliveros
Leandro Callizaya Flores
Docente: Prof. Julia Monasterio

---

## Síntesis ejecutiva

Al 26 de octubre, el equipo avanzó en los módulos que todavía aparecían pendientes en el corte de septiembre. El Gantt pasó de 0% a 97% en Accesos QR, de 52% a 98% en Aptos Médicos y de 21% a 98% en Eventos, Novedades y Panel. La integración general pasó de 49% a 94%. Estos valores son los porcentajes cargados en el cronograma; no equivalen a una aceptación funcional de los 72 requisitos.

El cierre está concentrado en pruebas, despliegue y documentación. En el Gantt actualizado, Testing, QA y Despliegue figura en 76%; el Entregable 9, en 45%; el Entregable 10, en 20%; y el Entregable 11, en 0%. El informe de control (Entregable 8) registra fecha real de cierre 26/10 y 100%.

Las cuatro bitácoras PSP contienen 108 actividades. La suma de los registros da 225,75 horas reales frente a 238,67 estimadas, una diferencia de 12,92 horas por debajo de lo previsto. Ese resultado describe el esfuerzo cargado en las planillas; no se transforma en un porcentaje de avance.

## Alcance y criterio de lectura

El Documento de Alcance contiene 72 requisitos funcionales distribuidos en 13 grupos. Para este control se compararon el Gantt del 26/09 y su versión guardada al 26/10, las bitácoras PSP y las ramas develop de MTeamBackend y MTeamFrontend. Se usaron como pauta las consignas de las clases 6 y 8: comparar plan y ejecución, documentar desvíos, y separar pruebas unitarias, de integración y E2E.

La presencia de código o de archivos de prueba no demuestra por sí sola que una prueba se haya ejecutado ni que el flujo esté aceptado en el entorno publicado. Por eso este informe no asigna un porcentaje propio a la cobertura funcional.

## 1. Evolución registrada en el Gantt

La comparación se hizo entre el archivo con fecha de estado 26/09 y el XML guardado el 26/10. Los porcentajes de las dos columnas son los que figuran en cada versión del Gantt. El cambio en puntos porcentuales es una resta entre esos valores, no una medición independiente.

| Bloque del cronograma | 26/09 | 26/10 | Cambio |
| --- | --- | --- | --- |
| Gestión del proyecto y setup | 72% | 87% | +15 pp |
| Documentación y entregables | 69% | 85% | +16 pp |
| Definición técnica | 97% | 98% | +1 pp |
| Usuarios y autenticación | 97% | 99% | +2 pp |
| Administración de usuarios | 99% | 99% | 0 pp |
| Cuota mensual y pagos | 92% | 99% | +7 pp |
| Aptos médicos | 52% | 98% | +46 pp |
| Accesos mediante QR | 0% | 97% | +97 pp |
| Sedes, clases y entrenadores | 86% | 97% | +11 pp |
| Eventos, novedades y panel | 21% | 98% | +77 pp |
| Integración general | 49% | 94% | +45 pp |
| Testing, QA y despliegue | 39% | 76% | +37 pp |

## 2. Planificación y ejecución

La siguiente tabla compara la fecha de fin de la planificación del 26/09 con la fecha vigente en el Gantt del 26/10.

| Actividad o entregable | Fin previsto 26/09 | Fin vigente 26/10 | Estado al corte |
| --- | --- | --- | --- |
| Entregable 8 · Informe de control | 05/10 | 26/10 | 100%; cierre real 26/10 (+21 días) |
| Integración general / hito H8b | 15/10 | 30/10 | Bloque 94%; hito 89% (+15 días) |
| Testing y calidad / Entregable 9 | 16/10 / 19/10 | 30/10 | Bloque 80%; E9 45% (+14 / +11 días) |
| Despliegue / Entregable 10 | 23/10 / 26/10 | 30/10 | Bloque 84%; E10 20% (+7 / +4 días) |
| Cierre del proyecto / Entregable 11 | 30/10 / 02/11 | 02/11 | Cierre general +3 días; E11 0%, sin cambio de fecha |

La versión del 26/10 registra algunas fechas reales y confirma el cierre del Entregable 8. No marca tareas críticas ni informa holgura. Por eso se informa la extensión observable del fin general y no se atribuyen días de desvío a una ruta crítica recalculada. El cronograma tampoco documenta una causa única para cada reprogramación.

## 3. Evidencia de repositorios y pruebas

| Área | Evidencia versionada | Qué falta demostrar para el cierre |
| --- | --- | --- |
| Usuarios, administración, cuotas y pagos | Pruebas de rutas, servicios y repositorios en backend; pantallas y pruebas de componentes en frontend. | Matriz de roles y casos límite ejecutados en la versión desplegada; resultado por requisito. |
| Aptos médicos y accesos QR | Pruebas de almacenamiento, estados y permisos en BE; pruebas de escáner, bandeja y pantallas en FE. FE #90 corrige el acceso a cámara para elegir un apto. | Carga y revisión en el entorno final; permisos de archivo; cámara y QR físico probados en dispositivo. |
| Sedes, clases y entrenadores | Pruebas de sedes, cronogramas, clases y restricciones por estado/rol en ambos repositorios. | Contrastar direcciones y Maps reales, horarios y asignaciones con datos de prueba controlados. |
| Eventos, novedades, notificaciones y panel | Pruebas de eventos, audiencias, bandeja de notificaciones y vistas de panel; integración PostgreSQL para notificaciones. | Confirmar destinatarios, estados, deduplicación y resultados visibles en el entorno publicado. |

## 4. Registro de esfuerzo PSP

| Integrante | Actividades | Estimado (h) | Real (h) |  |
| --- | --- | --- | --- | --- |
| Pablo Cannizzaro | 16 | 58,67 | 62,17 | +3,50 |
| Lara Frenkel | 43 | 73,50 | 69,67 |  |
| Leandro Callizaya | 33 | 88,00 | 71,42 | 4,50 |
| Franco Dalla Via Oliveros | 16 | 18,50 | 22,50 | +4,00 |
| Total | 108 | 238,67 | 225,75 | 0,73 |

## 5. Próximos entregables y controles

| Ventana | Trabajo previsto | Criterio de cierre |
| --- | --- | --- |
| 26–27/10 | Completar la matriz de aceptación de los 72 requisitos y asignar responsable/evidencia. | Cada ID queda clasificado como implementado, probado, aceptado o pendiente; con vínculo al PR, prueba o defecto. |
| 27–29/10 | Ejecutar pruebas de integración y E2E de autenticación/roles, pagos, aptos, QR, eventos y notificaciones. | Registrar datos de entrada, pasos, resultado esperado y observado; cubrir casos normales, errores y límites. |
| Hasta 30/10 | Cerrar Entregable 9: casos, automatización, resultados y Sonar. Completar validación técnica del despliegue y Entregable 10. | Resultados de suites vinculados al commit; defectos con pasos, esperado/obtenido y severidad; manual técnico revisado. |
| 31/10–01/11 | Ejecutar regresión de la versión candidata y ensayar la demostración. | Demo reproducible con datos ficticios, criterios de aceptación y alternativa ante fallas del entorno. |
| 02/11 | Entregar manual de usuario, informe final y exposición (Entregable 11). | Paquete versionado, revisión final y evidencia de la demostración. |

## Conclusión

Desde el corte del 26/09, el equipo incorporó en develop trabajo para QR, aptos médicos, eventos, comunicaciones y panel, y amplió la integración. El porcentaje general del Gantt subió de 72% a 87%.

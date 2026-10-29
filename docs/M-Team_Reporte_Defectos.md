# Proyecto de Construcción de Software

> M-TEAM (Gestion de Gimnasio)
>
> Registro de defectos — Entregable 10
>
> Carrera
>
> Ingeniería en Informática
>
> Código de carrera: 502
>
> Año
>
> 3er Año
>
> Docente
>
> Prof. Julia Monasterio
>
> Alumnos

Pablo Cannizzaro  
Lara Frenkel  
Franco Dalla via  
Leandro Callizaya

Reporte de defectos

Análisis estático del frontend y backend · SonarQube / SonarCloud

Actualización del reporte: 29 de octubre de 2026 \| Estado visible de todos los hallazgos: Fixed (corregido)

# Alcance y criterio

Registro elaborado exclusivamente a partir de las siete capturas proporcionadas. Los pasos describen cómo localizar y verificar la alerta en Sonar y el archivo; no implican que se haya reproducido un fallo visible en ejecución. Las capturas no muestran el código exacto ni todos los números de línea. Se respetan las etiquetas de severidad mostradas por la herramienta.

La clasificación “Media” corresponde al indicador Reliability Medium de Sonar; los avisos con etiqueta adicional Maintainability Low se mencionan sin tratarlos como defectos independientes. Los hallazgos repetidos de botones se registran por aparición, aunque cuando falta la ubicación exacta se señala.

# Resumen ejecutivo

La Parte I documenta 25 hallazgos de frontend: 2 de severidad alta y 23 de severidad media. La Parte II registra 17 hallazgos de backend: 8 altos y 9 medios. El total integrado es de 42 hallazgos históricos. Todas las tarjetas muestran «Fixed»; la corrección no fue revalidada independientemente.

# Detalle de defectos

## FE-01 · Almacenamiento del navegador con entrada de usuario sin sanitizar

<img src="M-Team_Reporte_Defectos_assets/media/image16.png" style="width:6.10417in;height:1.02758in" />

| **Archivo**               | src/features/authentication/auth-storage.ts                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Almacenamiento del navegador con entrada de usuario sin sanitizar                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Validar y controlar los datos antes de almacenarlos y recuperarlos del navegador.                                                                        |
| **Resultado obtenido**    | Sonar detectó riesgo de Browser Storage Poisoning por entrada no sanitizada.                                                                             |
| **Severidad**             | Alta                                                                                                                                                     |
| **Estado en Sonar**       | Fixed · Seguridad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 20 min                                                    |

## FE-02 · Ordenamiento alfabético sin comparador local adecuado

<img src="M-Team_Reporte_Defectos_assets/media/image16.png" style="width:6.10417in;height:1.04439in" />

| **Archivo**               | src/features/communications/AdminEventsScreen.tsx                                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento alfabético sin comparador local adecuado                                                                                                    |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Ordenar textos alfabéticamente mediante un comparador basado en String.localeCompare.                                                                    |
| **Resultado obtenido**    | Sonar identificó un ordenamiento que no dependía explícitamente de String.localeCompare.                                                                 |
| **Severidad**             | Alta                                                                                                                                                     |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 10 min                                                                   |

## FE-03 · Promesa asincrónica sin tratamiento explícito

<img src="M-Team_Reporte_Defectos_assets/media/image16.png" style="width:6.10417in;height:1.15974in" />

| **Archivo**               | src/features/authentication/ChangePasswordPage.tsx                                                                                                       |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Promesa asincrónica sin tratamiento explícito                                                                                                            |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Esperar o gestionar explícitamente la promesa y los posibles rechazos.                                                                                   |
| **Resultado obtenido**    | Sonar reportó una promesa sin await, catch, then con rechazo, ni marca void.                                                                             |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Franco Dalla Via Oliveros · esfuerzo estimado: 5 min                                                  |

## FE-04 · Promesa asincrónica sin tratamiento explícito

<img src="M-Team_Reporte_Defectos_assets/media/image16.png" style="width:6.10417in;height:1.11186in" />

| **Archivo**               | src/features/authentication/LoginPage.tsx                                                                                                                |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Promesa asincrónica sin tratamiento explícito                                                                                                            |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Esperar o gestionar explícitamente la promesa y los posibles rechazos.                                                                                   |
| **Resultado obtenido**    | Sonar reportó una promesa sin await, catch, then con rechazo, ni marca void.                                                                             |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Franco Dalla Via Oliveros · Esfuerzo estimado: 5 min                                                  |

## FE-05 · Promesa asincrónica sin tratamiento explícito

<img src="M-Team_Reporte_Defectos_assets/media/image30.png" style="width:6.80208in;height:1.17875in" />

| **Archivo**               | src/features/authentication/RegisterPage.tsx                                                                                                             |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Promesa asincrónica sin tratamiento explícito                                                                                                            |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Esperar o gestionar explícitamente la promesa y los posibles rechazos.                                                                                   |
| **Resultado obtenido**    | Sonar reportó una promesa sin tratamiento explícito.                                                                                                     |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 5 min                                                 |

## FE-06 · Elemento interactivo no nativo sin semántica de accesibilidad

<img src="M-Team_Reporte_Defectos_assets/media/image30.png" style="width:6.80208in;height:1.31522in" />

| **Archivo**               | src/features/communications/AdminEventsScreen.tsx                                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Elemento interactivo no nativo sin semántica de accesibilidad                                                                                            |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Usar un elemento HTML interactivo nativo o incorporar rol y soporte para teclado, mouse, tabulación y tacto.                                             |
| **Resultado obtenido**    | Sonar encontró un elemento no nativo usado de forma interactiva; también clasificó mantenibilidad baja.                                                  |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Accesibilidad / confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                    |

## FE-07 · Elemento interactivo no nativo sin semántica de accesibilidad

<img src="M-Team_Reporte_Defectos_assets/media/image30.png" style="width:6.80208in;height:1.33373in" />

| **Archivo**               | src/features/communications/AdminNewsScreen.tsx                                                                                                          |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Elemento interactivo no nativo sin semántica de accesibilidad                                                                                            |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Usar un elemento HTML interactivo nativo o incorporar rol y soporte para teclado, mouse, tabulación y tacto.                                             |
| **Resultado obtenido**    | Sonar encontró un elemento no nativo usado de forma interactiva; también clasificó mantenibilidad baja.                                                  |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Accesibilidad / confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                    |

## FE-08 · Uso de autoFocus con posible impacto en accesibilidad

<img src="M-Team_Reporte_Defectos_assets/media/image30.png" style="width:6.80208in;height:1.0702in" />

| **Archivo**               | src/features/communications/EventConsultationScreen.tsx                                                                                                  |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Uso de autoFocus con posible impacto en accesibilidad                                                                                                    |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Evitar foco automático injustificado y mantener una navegación accesible.                                                                                |
| **Resultado obtenido**    | Sonar señaló el atributo autoFocus como posible problema de usabilidad y accesibilidad.                                                                  |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Accesibilidad / confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                    |

## FE-09 · Botón sin atributo type explícito

<img src="M-Team_Reporte_Defectos_assets/media/image7.png" style="width:6.80208in;height:1.28397in" />

| **Archivo**               | src/features/communications/EventsScreen.tsx                                                                                                             |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-10 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image7.png" style="width:6.80208in;height:1.1847in" />

| **Archivo**               | src/features/communications/NewsScreen.tsx                                                                                                               |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-11 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image7.png" style="width:6.80208in;height:1.16048in" />

| **Archivo**               | src/features/workspace/AdminBranchesScreen.tsx                                                                                                           |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-12 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image5.png" style="width:6.80208in;height:1.05342in" />

| **Archivo**               | src/features/workspace/AdminPaymentsScreen.tsx                                                                                                           |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-13 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image5.png" style="width:6.80208in;height:0.93032in" />

| **Archivo**               | src/features/workspace/AdminPaymentsScreen.tsx                                                                                                           |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-14 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image5.png" style="width:6.80208in;height:0.97298in" />

| **Archivo**               | src/features/workspace/AdminUsersScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-15 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image15.png" style="width:6.80208in;height:1.08495in" />

| **Archivo**               | src/features/workspace/ProfileEditorCards.tsx                                                                                                            |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-16 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image15.png" style="width:6.80208in;height:0.96256in" />

| **Archivo**               | src/features/workspace/ProfileEditorCards.tsx                                                                                                            |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar el type adecuado del botón para evitar acciones de formulario no deseadas.                                                                      |
| **Resultado obtenido**    | Sonar detectó un elemento button sin atributo type explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 2 min                                                                    |

## FE-17 · tabIndex aplicado a elemento no interactivo<img src="M-Team_Reporte_Defectos_assets/media/image5.png" style="width:6.80208in;height:0.99313in" />

| **Archivo**               | src/features/workspace/AdminUsersScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | tabIndex aplicado a elemento no interactivo                                                                                                              |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Definir tabIndex solo cuando corresponda a un elemento interactivo accesible.                                                                            |
| **Resultado obtenido**    | Sonar detectó tabIndex en un elemento que no es interactivo; también marcó mantenibilidad baja.                                                          |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Accesibilidad / confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                    |

## FE-18 · Promesa asincrónica sin tratamiento explícito<img src="M-Team_Reporte_Defectos_assets/media/image15.png" style="width:6.80208in;height:1.21125in" />

| **Archivo**               | src/features/workspace/RoleWorkspace.tsx                                                                                                                 |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Promesa asincrónica sin tratamiento explícito                                                                                                            |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Gestionar o ignorar explícitamente la promesa según el comportamiento requerido.                                                                         |
| **Resultado obtenido**    | Sonar reportó una promesa sin await o controlador de rechazo.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 5 min                                                 |

## FE-19 · Expresión regular con posible tiempo superlineal<img src="M-Team_Reporte_Defectos_assets/media/image38.png" style="width:5.75in;height:0.90202in" />

| **Archivo**               | src/features/workspace/UserDetailScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Expresión regular con posible tiempo superlineal                                                                                                         |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Usar una expresión regular sin retroceso superlineal con entradas adversas.                                                                              |
| **Resultado obtenido**    | Sonar identificó un patrón susceptible a backtracking de rendimiento superlineal.                                                                        |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Rendimiento / confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 20 min                                                     |

## FE-20 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image38.png" style="width:5.75in;height:0.8037in" />

| **Archivo**               | src/features/workspace/UserDetailScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar type de forma explícita según el propósito de cada botón.                                                                                       |
| **Resultado obtenido**    | Sonar reportó falta del atributo type en un botón.                                                                                                       |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-21 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image38.png" style="width:5.75in;height:0.88119in" />

| **Archivo**               | src/features/workspace/UserDetailScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar type de forma explícita según el propósito de cada botón.                                                                                       |
| **Resultado obtenido**    | Sonar reportó falta del atributo type en un botón.                                                                                                       |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 2 min                                                 |

## FE-22 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image38.png" style="width:5.75in;height:0.81904in" />

| **Archivo**               | src/features/workspace/UserDetailScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar type de forma explícita según el propósito de cada botón.                                                                                       |
| **Resultado obtenido**    | Sonar reportó falta del atributo type en un botón.                                                                                                       |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 2 min                                                                    |

## FE-23 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image38.png" style="width:5.75in;height:0.79237in" />

| **Archivo**               | src/features/workspace/UserDetailScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar type de forma explícita según el propósito de cada botón.                                                                                       |
| **Resultado obtenido**    | Sonar reportó falta del atributo type en un botón.                                                                                                       |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 2 min                                                                    |

## FE-24 · Botón sin atributo type explícito<img src="M-Team_Reporte_Defectos_assets/media/image38.png" style="width:5.75in;height:0.78548in" />

| **Archivo**               | src/features/workspace/UserDetailScreen.tsx                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Botón sin atributo type explícito                                                                                                                        |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Declarar type de forma explícita según el propósito de cada botón.                                                                                       |
| **Resultado obtenido**    | Sonar reportó falta del atributo type en un botón.                                                                                                       |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 2 min                                                                    |

## FE-25 · Promesa asincrónica sin tratamiento explícito<img src="M-Team_Reporte_Defectos_assets/media/image39.png" style="width:5.875in;height:0.96875in" />

| **Archivo**               | src/pages/AuthenticatedHomePage.tsx                                                                                                                      |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Promesa asincrónica sin tratamiento explícito                                                                                                            |
| **Pasos para reproducir** | Abrir el análisis de Sonar del frontend; localizar el archivo y el hallazgo indicado; inspeccionar el fragmento señalado y comprobar la regla reportada. |
| **Resultado esperado**    | Esperar, manejar errores o ignorar explícitamente una promesa.                                                                                           |
| **Resultado obtenido**    | Sonar detectó un llamado asíncrono sin tratamiento explícito.                                                                                            |
| **Severidad**             | Media                                                                                                                                                    |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Sin asignar (Not assigned) · esfuerzo estimado: 5 min                                                 |

# Observaciones y limitaciones

La nueva captura permite ubicar los cinco avisos de botones sin type en src/features/workspace/UserDetailScreen.tsx. Se registran como tarjetas independientes. Las capturas no muestran claves de incidencia ni números de línea, por lo que estos datos deben consultarse en Sonar para completar la trazabilidad.

Para una auditoría de resolución completa sería necesario adjuntar ID/clave de issue de Sonar, línea original, commit de corrección, ejecución de análisis que confirmó Fixed y, cuando corresponda, pruebas funcionales o de accesibilidad.

# Evidencia aportada

Siete capturas de hallazgos SonarCloud/SonarQube del frontend M-Team aportadas para la actualización del 29/10/2026. Los nombres y el estado se transcriben según lo visible; «Not assigned» se registra como «Sin asignar».

# Parte II · Reporte de defectos del backend

Fuente: cuatro capturas de hallazgos de SonarCloud/SonarQube de MTeamBackend aportadas para esta revisión. Se transcriben 17 incidencias distinguibles. Todos los registros visibles muestran «Fixed». Los nombres corresponden a las personas asignadas en Sonar y no acreditan por sí solos quién realizó la corrección. Los pasos permiten localizar y verificar el hallazgo histórico; no presuponen una explotación ni un error reproducido en producción.

## Resumen del backend

| **Hallazgos**               | 17 incidencias: 8 de severidad alta y 9 de severidad media.                                           |
|-----------------------------|-------------------------------------------------------------------------------------------------------|
| **Tipos**                   | 4 de seguridad y 13 de confiabilidad.                                                                 |
| **Estado observado**        | 17 marcadas «Fixed» en las capturas, sin revalidación independiente.                                  |
| Personas asignadas en Sonar | Pablo Cannizzaro: 9; Leandro: 7; LaraFrenkel: 1. La asignación no demuestra autoría de la corrección. |

## BE-01 · Riesgo de falsificación de solicitudes por entrada no sanitizada

<img src="M-Team_Reporte_Defectos_assets/media/image26.png" style="width:6.8in;height:0.91667in" />

| **Archivo**               | backend/scripts/smoke-supabase.mjs                                                                                                                                                                                                                                                                                                                                                 |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Riesgo de falsificación de solicitudes por entrada no sanitizada                                                                                                                                                                                                                                                                                                                   |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/scripts/smoke-supabase.mjs» y la regla «Client-Side Request Forgery via unsanitized user input». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Verificar que la URL o destino de solicitudes construido a partir de entradas externas sea validado antes de ejecutarse.                                                                                                                                                                                                                                                           |
| **Resultado obtenido**    | Sonar identificó un posible riesgo de solicitud hacia destinos no autorizados (Client-Side Request Forgery).                                                                                                                                                                                                                                                                       |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                                                                               |
| **Estado en Sonar**       | Fixed · Seguridad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 20 min                                                                                                                                                                                                                                                                                        |

## BE-02 · Ordenamiento sin comparador basado en localeCompare

<img src="M-Team_Reporte_Defectos_assets/media/image24.png" style="width:6.8in;height:0.81944in" />

| **Archivo**               | backend/scripts/bootstrap-admin.ts                                                                                                                                                                                                                                                                                                                                                          |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento sin comparador basado en localeCompare                                                                                                                                                                                                                                                                                                                                         |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/scripts/bootstrap-admin.ts» y la regla «Provide a compare function that depends on String.localeCompare». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Verificar que el orden alfabético use un comparador dependiente de String.localeCompare.                                                                                                                                                                                                                                                                                                    |
| **Resultado obtenido**    | Sonar detectó ordenamiento sin comparador local adecuado.                                                                                                                                                                                                                                                                                                                                   |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                                                                                        |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 10 min                                                                                                                                                                                                                                                                                             |

## BE-03 · Ordenamiento sin comparador basado en localeCompare

<img src="M-Team_Reporte_Defectos_assets/media/image34.png" style="width:6.8in;height:0.88889in" />

| **Archivo**               | backend/scripts/inspect-database.mjs                                                                                                                                                                                                                                                                                                                                                          |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento sin comparador basado en localeCompare                                                                                                                                                                                                                                                                                                                                           |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/scripts/inspect-database.mjs» y la regla «Provide a compare function that depends on String.localeCompare». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Verificar que el orden de las cadenas sea explícito y consistente mediante String.localeCompare.                                                                                                                                                                                                                                                                                              |
| **Resultado obtenido**    | Sonar detectó un ordenamiento sin el comparador requerido.                                                                                                                                                                                                                                                                                                                                    |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                                                                                          |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 10 min                                                                                                                                                                                                                                                                                               |

## BE-04 · Ordenamiento sin comparador basado en localeCompare

<img src="M-Team_Reporte_Defectos_assets/media/image33.png" style="width:6.8in;height:0.86111in" />

| **Archivo**               | backend/scripts/migrate-test-database.mjs                                                                                                                                                                                                                                                                                                                                                          |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento sin comparador basado en localeCompare                                                                                                                                                                                                                                                                                                                                                |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/scripts/migrate-test-database.mjs» y la regla «Provide a compare function that depends on String.localeCompare». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Verificar que las listas de nombres se ordenen con comparador explícito dependiente de localeCompare.                                                                                                                                                                                                                                                                                              |
| **Resultado obtenido**    | Sonar señaló ausencia de comparador alfabético dependiente de localeCompare.                                                                                                                                                                                                                                                                                                                       |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                                                                                               |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 10 min                                                                                                                                                                                                                                                                                                    |

## BE-05 · Ordenamiento sin comparador basado en localeCompare

<img src="M-Team_Reporte_Defectos_assets/media/image32.png" style="width:6.80208in;height:1.16583in" />

| **Archivo**               | backend/scripts/smoke-supabase.mjs                                                                                                                                                                                                                                                                                                                                                          |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento sin comparador basado en localeCompare                                                                                                                                                                                                                                                                                                                                         |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/scripts/smoke-supabase.mjs» y la regla «Provide a compare function that depends on String.localeCompare». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Comprobar que el ordenamiento sea explícito y use String.localeCompare.                                                                                                                                                                                                                                                                                                                     |
| **Resultado obtenido**    | Sonar señaló un ordenamiento sin comparador explícito basado en String.localeCompare.                                                                                                                                                                                                                                                                                                       |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                                                                                        |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 10 min                                                                                                                                                                                                                                                                                             |

## BE-06 · Ordenamiento sin comparador explícito primer hallazgo<img src="M-Team_Reporte_Defectos_assets/media/image32.png" style="width:6.80208in;height:1.07218in" />

| **Archivo**               | backend/test/integration/supabase/requirements.integration.ts                                                                                                                                                                                                                                                                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento sin comparador explícito (primer hallazgo)                                                                                                                                                                                                                                                                                                                                                                    |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/test/integration/supabase/requirements.integration.ts» y la regla «Provide a compare function to avoid sorting elements alphabetically». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Inspeccionar el primer ordenamiento advertido en el test de integración y verificar si cuenta con función comparadora.                                                                                                                                                                                                                                                                                                     |
| **Resultado obtenido**    | Sonar reportó un primer ordenamiento alfabético sin comparador explícito.                                                                                                                                                                                                                                                                                                                                                  |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 10 min                                                                                                                                                                                                                                                                                                                            |

## BE-07 · Ordenamiento sin comparador explícito segundo hallazgo

## <img src="M-Team_Reporte_Defectos_assets/media/image32.png" style="width:6.80208in;height:0.9295in" />

| **Archivo**               | backend/test/integration/supabase/requirements.integration.ts                                                                                                                                                                                                                                                                                                                                                              |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento sin comparador explícito (segundo hallazgo)                                                                                                                                                                                                                                                                                                                                                                   |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/test/integration/supabase/requirements.integration.ts» y la regla «Provide a compare function to avoid sorting elements alphabetically». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Inspeccionar el segundo ordenamiento advertido del mismo archivo; distinguirlo del primer hallazgo por su ubicación en Sonar.                                                                                                                                                                                                                                                                                              |
| **Resultado obtenido**    | Sonar reportó una segunda incidencia del mismo tipo en el archivo; la captura muestra a Pablo Cannizzaro como persona asignada.                                                                                                                                                                                                                                                                                            |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 10 min                                                                                                                                                                                                                                                                                                                            |

## BE-08 · Ejecución de scripts de ciclo de vida durante la instalación de dependencias<img src="M-Team_Reporte_Defectos_assets/media/image17.png" style="width:6.80208in;height:1.16159in" />

| **Archivo**               | .github/workflows/backend-ci.yml                                                                                                                                                                                                                                                                                                                                                                                |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ejecución de scripts de ciclo de vida durante la instalación de dependencias                                                                                                                                                                                                                                                                                                                                    |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «.github/workflows/backend-ci.yml» y la regla «Omitting --ignore-scripts allows lifecycle scripts to run during package installation». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Revisar en el workflow la instalación de dependencias y comprobar si se evita la ejecución automática de scripts de ciclo de vida no requeridos.                                                                                                                                                                                                                                                                |
| **Resultado obtenido**    | Sonar marcó la ausencia de --ignore-scripts como un riesgo de ejecución de scripts durante la instalación.                                                                                                                                                                                                                                                                                                      |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Estado en Sonar**       | Fixed · Seguridad · Persona asignada en Sonar: LaraFrenkel · esfuerzo estimado: 30 min                                                                                                                                                                                                                                                                                                                          |

## BE-09 · Ejecución de scripts de ciclo de vida en workflow de Sonar<img src="M-Team_Reporte_Defectos_assets/media/image17.png" style="width:6.80208in;height:1.07714in" />

| **Archivo**               | .github/workflows/sonarcloud.yml                                                                                                                                                                                                                                                                                                                                                                                |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ejecución de scripts de ciclo de vida en workflow de Sonar                                                                                                                                                                                                                                                                                                                                                      |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «.github/workflows/sonarcloud.yml» y la regla «Omitting --ignore-scripts allows lifecycle scripts to run during package installation». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Revisar las instrucciones de instalación de dependencias en el workflow de SonarCloud.                                                                                                                                                                                                                                                                                                                          |
| **Resultado obtenido**    | Sonar alertó sobre la posibilidad de ejecutar scripts lifecycle durante la instalación.                                                                                                                                                                                                                                                                                                                         |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Estado en Sonar**       | Fixed · Seguridad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 30 min                                                                                                                                                                                                                                                                                                                              |

## BE-10 · Riesgo de recorrido de rutas API mediante entrada no sanitizada

<img src="M-Team_Reporte_Defectos_assets/media/image17.png" style="width:6.80208in;height:1.23617in" />

| **Archivo**               | backend/scripts/smoke-supabase.mjs                                                                                                                                                                                                                                                                                                                                   |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Riesgo de recorrido de rutas API mediante entrada no sanitizada                                                                                                                                                                                                                                                                                                      |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/scripts/smoke-supabase.mjs» y la regla «API Traversal via unsanitized user input». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Comprobar la validación y restricción de las rutas que el script acepta para emitir solicitudes API.                                                                                                                                                                                                                                                                 |
| **Resultado obtenido**    | Sonar identificó un potencial recorrido de rutas API (API Traversal) causado por entradas no sanitizadas.                                                                                                                                                                                                                                                            |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                                                                                                |
| **Estado en Sonar**       | Fixed · Seguridad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 30 min                                                                                                                                                                                                                                                                          |

## BE-11 · Expresión regular con tiempo de ejecución potencialmente superlineal<img src="M-Team_Reporte_Defectos_assets/media/image17.png" style="width:6.80208in;height:1.10839in" />

| **Archivo**               | backend/scripts/ensure-local-jwt-secret.mjs                                                                                                                                                                                                                                                                                                                                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Expresión regular con tiempo de ejecución potencialmente superlineal                                                                                                                                                                                                                                                                                                                                                                                |
| **Pasos para reproducir** | 1\. Abrir los hallazgos de Sonar del repositorio backend. 2. Ubicar «backend/scripts/ensure-local-jwt-secret.mjs» y la regla «Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking». 3. Examinar la ubicación exacta indicada por Sonar y contrastarla con la regla y el código anterior a la corrección; si ese código ya no está disponible, usar el hallazgo histórico como evidencia. |
| **Resultado esperado**    | Inspeccionar la expresión regular indicada y evaluar entradas sintéticas largas o adversariales para comprobar que no exista retroceso excesivo.                                                                                                                                                                                                                                                                                                    |
| **Resultado obtenido**    | Sonar reportó riesgo de rendimiento por backtracking superlineal en una expresión regular.                                                                                                                                                                                                                                                                                                                                                          |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Pablo Cannizzaro · esfuerzo estimado: 20 min                                                                                                                                                                                                                                                                                                                                                     |

## BE-12 · Ordenamiento sin comparador explícito

<img src="M-Team_Reporte_Defectos_assets/media/image32.png" style="width:6.80208in;height:1.21154in" />

| **Archivo**               | backend/scripts/qase-documentation-sync.mjs                                                                                                                                                                                                                                                                                |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Ordenamiento sin comparador explícito                                                                                                                                                                                                                                                                                      |
| **Pasos para reproducir** | 1\. Abrir los hallazgos históricos del backend en Sonar. 2. Ubicar el archivo y la alerta «Provide a compare function to avoid sorting elements alphabetically.». 3. Consultar la línea y clave del hallazgo para distinguirlo de las demás tarjetas del mismo archivo; contrastar con el código anterior a la corrección. |
| **Resultado esperado**    | Definir un comparador explícito acorde con el tipo de datos y el orden esperado.                                                                                                                                                                                                                                           |
| **Resultado obtenido**    | Sonar detectó un ordenamiento que utiliza el orden alfabético predeterminado sin comparador explícito.                                                                                                                                                                                                                     |
| **Severidad**             | Alta                                                                                                                                                                                                                                                                                                                       |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 10 min                                                                                                                                                                                                                                     |

## BE-13 · Asignación innecesaria de cursor hallazgo 1

<img src="M-Team_Reporte_Defectos_assets/media/image28.png" style="width:6.80208in;height:1.08605in" />

| **Archivo**               | backend/scripts/qase-documentation-sync.mjs                                                                                                                                                                                                                                               |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Asignación innecesaria de cursor hallazgo 1                                                                                                                                                                                                                                               |
| **Pasos para reproducir** | 1\. Abrir los hallazgos históricos del backend en Sonar. 2. Ubicar el archivo y la alerta «Remove this assignment of "cursor".». 3. Consultar la línea y clave del hallazgo para distinguirlo de las demás tarjetas del mismo archivo; contrastar con el código anterior a la corrección. |
| **Resultado esperado**    | Eliminar la asignación innecesaria o utilizar su valor si la lógica lo requiere.                                                                                                                                                                                                          |
| **Resultado obtenido**    | Sonar identificó una asignación de cursor cuyo valor no se utiliza. La captura no muestra la línea ni la clave de la incidencia.                                                                                                                                                          |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                     |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                                                                                                                                                                     |

## BE-14 · Asignación innecesaria de cursor hallazgo 2

<img src="M-Team_Reporte_Defectos_assets/media/image28.png" style="width:6.80208in;height:1.06172in" />

| **Archivo**               | backend/scripts/qase-documentation-sync.mjs                                                                                                                                                                                                                                               |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Asignación innecesaria de cursor hallazgo 2                                                                                                                                                                                                                                               |
| **Pasos para reproducir** | 1\. Abrir los hallazgos históricos del backend en Sonar. 2. Ubicar el archivo y la alerta «Remove this assignment of "cursor".». 3. Consultar la línea y clave del hallazgo para distinguirlo de las demás tarjetas del mismo archivo; contrastar con el código anterior a la corrección. |
| **Resultado esperado**    | Eliminar la asignación innecesaria o utilizar su valor si la lógica lo requiere.                                                                                                                                                                                                          |
| **Resultado obtenido**    | Sonar identificó una asignación de cursor cuyo valor no se utiliza. La captura no muestra la línea ni la clave de la incidencia.                                                                                                                                                          |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                     |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                                                                                                                                                                     |

## BE-15 · Asignación innecesaria de cursor hallazgo 3

<img src="M-Team_Reporte_Defectos_assets/media/image28.png" style="width:6.80208in;height:1.04439in" />

| **Archivo**               | backend/scripts/qase-documentation-sync.mjs                                                                                                                                                                                                                                               |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Asignación innecesaria de cursor hallazgo 3                                                                                                                                                                                                                                               |
| **Pasos para reproducir** | 1\. Abrir los hallazgos históricos del backend en Sonar. 2. Ubicar el archivo y la alerta «Remove this assignment of "cursor".». 3. Consultar la línea y clave del hallazgo para distinguirlo de las demás tarjetas del mismo archivo; contrastar con el código anterior a la corrección. |
| **Resultado esperado**    | Eliminar la asignación innecesaria o utilizar su valor si la lógica lo requiere.                                                                                                                                                                                                          |
| **Resultado obtenido**    | Sonar identificó una asignación de cursor cuyo valor no se utiliza. La captura no muestra la línea ni la clave de la incidencia.                                                                                                                                                          |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                     |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                                                                                                                                                                     |

## BE-16 · Asignación innecesaria de cursor hallazgo 4

<img src="M-Team_Reporte_Defectos_assets/media/image28.png" style="width:6.80208in;height:1.05661in" />

| **Archivo**               | backend/scripts/qase-documentation-sync.mjs                                                                                                                                                                                                                                               |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Asignación innecesaria de cursor hallazgo 4                                                                                                                                                                                                                                               |
| **Pasos para reproducir** | 1\. Abrir los hallazgos históricos del backend en Sonar. 2. Ubicar el archivo y la alerta «Remove this assignment of "cursor".». 3. Consultar la línea y clave del hallazgo para distinguirlo de las demás tarjetas del mismo archivo; contrastar con el código anterior a la corrección. |
| **Resultado esperado**    | Eliminar la asignación innecesaria o utilizar su valor si la lógica lo requiere.                                                                                                                                                                                                          |
| **Resultado obtenido**    | Sonar identificó una asignación de cursor cuyo valor no se utiliza. La captura no muestra la línea ni la clave de la incidencia.                                                                                                                                                          |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                     |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 5 min                                                                                                                                                                                                     |

## BE-17 · Expresión regular con tiempo de ejecución potencialmente superlineal

<img src="M-Team_Reporte_Defectos_assets/media/image28.png" style="width:6.80208in;height:0.93018in" />

| **Archivo**               | backend/scripts/qase-documentation-sync.mjs                                                                                                                                                                                                                                                                                                                           |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Título**                | Expresión regular con tiempo de ejecución potencialmente superlineal                                                                                                                                                                                                                                                                                                  |
| **Pasos para reproducir** | 1\. Abrir los hallazgos históricos del backend en Sonar. 2. Ubicar el archivo y la alerta «Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.». 3. Consultar la línea y clave del hallazgo para distinguirlo de las demás tarjetas del mismo archivo; contrastar con el código anterior a la corrección. |
| **Resultado esperado**    | Simplificar el patrón para evitar retroceso superlineal y verificar su comportamiento con entradas sintéticas largas.                                                                                                                                                                                                                                                 |
| **Resultado obtenido**    | Sonar señaló una expresión regular con riesgo de rendimiento superlineal por backtracking.                                                                                                                                                                                                                                                                            |
| **Severidad**             | Media                                                                                                                                                                                                                                                                                                                                                                 |
| **Estado en Sonar**       | Fixed · Confiabilidad · Persona asignada en Sonar: Leandro · esfuerzo estimado: 20 min                                                                                                                                                                                                                                                                                |

# Síntesis integrada y estado de cierre

| **Frontend**                     | 25 incidencias en la Parte I: 2 de severidad alta y 23 de severidad media.                                                                                                   |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Backend**                      | 17 incidencias documentadas en la Parte II: 8 altas y 9 medias.                                                                                                              |
| **Total registrado**             | 42 hallazgos históricos entre frontend y backend: 10 de severidad alta y 32 de severidad media.                                                                              |
| **Cierre observado**             | La etiqueta «Fixed» refleja el estado visible de Sonar en las capturas; por sí sola no acredita pruebas funcionales, ausencia de nuevas alertas ni despliegue en producción. |
| **Evidencia adicional deseable** | Claves únicas de Sonar, ubicación por línea, fecha de resolución, commit/PR y análisis posterior que confirme el cierre.                                                     |

## Notas metodológicas

Los hallazgos repetidos se conservan cuando aparecen como tarjetas independientes en Sonar, aunque compartan archivo o regla. En especial, requirements.integration.ts presenta dos avisos de ordenamiento de la misma clase; sus líneas no pueden individualizarse mediante el recorte. No se infieren vulnerabilidades explotadas a partir de advertencias de análisis estático.

En el informe se sigue el criterio académico solicitado: título, pasos para reproducir, resultado esperado, resultado obtenido y severidad. El diagnóstico de Sonar se presenta como resultado del análisis estático, distinguiéndolo de los resultados observados en una ejecución real.

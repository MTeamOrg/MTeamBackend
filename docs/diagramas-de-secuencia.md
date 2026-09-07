# Diagramas de secuencia

Estos diagramas documentan las interacciones principales del prototipo de M-Team. Los diagramas representan responsabilidades conceptuales. `WebApp` corresponde a la interfaz web, `API` al backend de M-Team y `Database` a la persistencia del sistema.

## Registro e inicio de sesión

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    title Registro e inicio de sesión
    participant Socio
    participant WebApp
    participant API
    participant Database

    Socio->>+WebApp: Abrir registro
    WebApp-->>-Socio: Mostrar formulario
    Socio->>+WebApp: Enviar datos
    WebApp->>+API: Crear cuenta
    API->>+Database: Guardar socio
    Database-->>-API: Cuenta creada
    API-->>-WebApp: Registro exitoso
    WebApp-->>-Socio: Mostrar inicio de sesión
    Socio->>+WebApp: Enviar credenciales
    WebApp->>+API: Autenticar usuario
    API->>+Database: Consultar usuario
    Database-->>-API: Usuario y estado
    API-->>-WebApp: Sesión iniciada
    WebApp-->>-Socio: Mostrar panel
```

La recuperación automática por correo no forma parte del alcance. Cuando sea necesario restablecer una contraseña, el socio deberá solicitarlo a un administrador.

## Acreditación de un pago

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    title Acreditación de un pago
    participant Administrador
    participant WebApp
    participant API
    participant Database

    Administrador->>+WebApp: Buscar socio
    WebApp->>+API: Consultar socio
    API->>+Database: Obtener pagos
    Database-->>-API: Socio e historial
    API-->>-WebApp: Mostrar resumen
    WebApp-->>-Administrador: Presentar socio
    Administrador->>+WebApp: Ingresar datos del pago
    WebApp->>+API: Solicitar resumen previo
    API->>+Database: Obtener valor vigente de cuota
    Database-->>-API: Valor vigente
    API-->>-WebApp: Devolver resumen y vencimiento calculado
    WebApp-->>-Administrador: Presentar resumen previo
    Administrador->>+WebApp: Confirmar pago
    WebApp->>+API: Registrar y acreditar pago
    API->>+Database: Guardar pago acreditado y trazabilidad
    Database-->>-API: Pago acreditado
    API-->>-WebApp: Pago confirmado
    WebApp-->>-Administrador: Mostrar comprobante
```

La acreditación es una operación administrativa. El resumen previo no se persiste: `Payment` nace con estado `ACCREDITED` cuando el administrador confirma la operación. En ese momento se registran la creación, la confirmación, sus responsables y la vigencia de 30 días. El sistema no incorpora pagos en línea ni planes de membresía.

## Carga y revisión del apto médico

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    title Carga y revisión del apto médico
    participant Socio
    participant WebApp
    participant API
    participant Database
    participant Administrador
    participant Notificaciones

    Socio->>+WebApp: Abrir apto médico
    WebApp-->>-Socio: Mostrar estado actual
    Socio->>+WebApp: Seleccionar archivo
    WebApp->>+API: Cargar certificado
    API->>+Database: Guardar apto pendiente
    Database-->>-API: Carga registrada
    API-->>-WebApp: Estado pendiente
    WebApp-->>-Socio: Confirmar carga
    Administrador->>+WebApp: Abrir revisión
    WebApp->>+API: Consultar apto
    API->>+Database: Obtener certificado
    Database-->>-API: Certificado pendiente
    API-->>-WebApp: Mostrar documento
    WebApp-->>-Administrador: Presentar documento
    Administrador->>+WebApp: Aprobar o rechazar
    WebApp->>+API: Registrar decisión
    API->>+Database: Actualizar estado
    Database-->>-API: Revisión registrada
    API-)Notificaciones: Informar resultado
    API-->>-WebApp: Revisión confirmada
    WebApp-->>-Administrador: Mostrar resultado
```

El resultado de la revisión puede ser aprobado o rechazado con una observación. Cada nueva carga queda pendiente y el historial se conserva.

## Validación de acceso mediante QR

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    title Validación de acceso mediante QR
    participant Usuario
    participant WebApp
    participant API
    participant Database

    Usuario->>+WebApp: Abrir acceso QR
    WebApp-->>-Usuario: Solicitar cámara
    Usuario->>+WebApp: Autorizar cámara
    WebApp-->>-Usuario: Activar escáner
    Usuario->>+WebApp: Escanear QR fijo
    WebApp->>+API: Enviar token del QR
    API->>+Database: Consultar token y usuario
    Database-->>-API: Estados vigentes
    API->>+Database: Registrar intento
    Database-->>-API: Acceso registrado
    API-->>-WebApp: Permitido o rechazado
    WebApp-->>-Usuario: Mostrar resultado
```

El QR pertenece al punto de acceso físico, no al usuario. Un rechazo puede deberse a un QR inválido, una cuenta inactiva, una cuota vencida, un apto no válido o una sede o punto de acceso desactivados.

## Gestión del cronograma semanal

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    title Gestión del cronograma semanal
    participant Administrador
    participant WebApp
    participant API
    participant Database
    participant Notificaciones

    Administrador->>+WebApp: Abrir cronograma
    WebApp->>+API: Consultar semana
    API->>+Database: Obtener clases
    Database-->>-API: Cronograma semanal
    API-->>-WebApp: Mostrar cronograma
    WebApp-->>-Administrador: Presentar cronograma
    Administrador->>+WebApp: Crear o modificar clase
    WebApp->>+API: Validar datos
    API->>+Database: Guardar cambios
    Database-->>-API: Cronograma actualizado
    API-)Notificaciones: Informar cambio
    API-->>-WebApp: Operación exitosa
    WebApp-->>-Administrador: Mostrar cronograma
    Administrador->>+WebApp: Copiar semana anterior
    WebApp->>+API: Solicitar copia
    API->>+Database: Copiar semana anterior y sus clases
    Database-->>-API: Nueva semana creada
    API-->>-WebApp: Copia confirmada
    WebApp-->>-Administrador: Mostrar nueva semana
```

El cronograma es informativo. No incluye reservas, cupos, listas de espera ni asistencia.

## Consulta de notificaciones

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    title Consulta de notificaciones
    participant Usuario
    participant WebApp
    participant API
    participant Database

    Usuario->>+WebApp: Abrir notificaciones
    WebApp->>+API: Consultar notificaciones
    API->>+Database: Obtener notificaciones
    Database-->>-API: Lista y estados
    API-->>-WebApp: Mostrar resultados
    WebApp-->>-Usuario: Presentar notificaciones
    Usuario->>+WebApp: Abrir notificación
    WebApp->>+API: Marcar como leída
    API->>+Database: Actualizar estado
    Database-->>-API: Estado actualizado
    API-->>-WebApp: Confirmar lectura
    WebApp-->>-Usuario: Mostrar detalle
```

Las notificaciones son internas y conservan su historial. El alcance no contempla chat ni mensajería entre usuarios.

## Límites del alcance

Estos flujos no incorporan planes de membresía, pagos en línea, reservas, cupos, listas de espera, asistencia, rutinas, alumnos asignados, evaluaciones, beneficios, referidos, QR personal, chat ni una aplicación móvil nativa.

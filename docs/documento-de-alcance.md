<p align="center">
  <img src="assets/universidad-de-belgrano.jpg" alt="Universidad de Belgrano" width="280" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/ub-logo.png" alt="UB" width="90" />
</p>

# Proyecto de Construcción de Software

## M-TEAM (Gestion de Gimnasio)

**Documento de Alcance — Entregable 1**

| Campo | Información |
| --- | --- |
| Carrera | Ingeniería en Informática |
| Código de carrera | 502 |
| Año | 3er Año |
| Docente | Prof. Julia Monasterio |
| Alumnos | Pablo Cannizzaro<br>Lara Frenkel<br>Franco Dalla via<br>Leandro Callizaya |
| Fecha de entrega | 03/08/2026 |

---

# 1. Introducción y contexto del problema

La administración de algunos gimnasios todavía se realiza mediante herramientas separadas, como planillas de cálculo, documentos físicos y aplicaciones de mensajería. La información de los socios, los pagos de la cuota mensual, los aptos médicos, los horarios de las clases y las novedades del gimnasio puede quedar distribuida en distintos medios, dificultando su consulta, actualización y seguimiento.

Esta falta de integración puede generar errores en el registro de pagos, demoras al verificar si una persona está habilitada para ingresar, pérdida de documentación y dificultades para comunicar cambios en el valor de la cuota o en el cronograma semanal de clases. Además, los socios suelen depender del personal del gimnasio para consultar cuánto deben pagar, cuándo vence su cuota o si su apto médico fue aprobado.

M-Team cuenta actualmente con dos sedes y podría incorporar nuevas ubicaciones en el futuro. Por este motivo, necesita una plataforma centralizada que permita administrar la información de sus socios, entrenadores, clases, sedes y pagos, sin depender de herramientas aisladas ni requerir cambios estructurales cuando el gimnasio se expanda.

## 1.1. Necesidad que resuelve la plataforma

M-Team será una plataforma web desarrollada específicamente para centralizar la gestión del gimnasio y facilitar las principales operaciones de sus socios, entrenadores y administradores.

Todos los socios abonarán una única cuota, denominada “cuota mensual” por el gimnasio. A efectos del sistema, cada pago acreditado por un administrador iniciará una vigencia fija de 30 días desde la fecha y hora de acreditación, sin acumular los días restantes de una vigencia anterior. Desde su perfil, el socio podrá consultar el precio vigente, el último pago, la fecha de vencimiento, los días restantes, el estado de la cuota y su historial. También recibirá avisos internos cuando la cuota esté próxima a vencer, se encuentre vencida o cambie su valor.

La plataforma web permitirá que cada socio cargue una fotografía o archivo de su apto médico para que sea revisado por un administrador. El documento podrá encontrarse pendiente, aprobado o rechazado. Una vez aprobado, permanecerá válido sin fecha de vencimiento.

Los socios y entrenadores autenticados podrán utilizar la cámara de su dispositivo desde la plataforma web para escanear el código QR fijo colocado en un molinete o punto de acceso. El QR identificará la sede y el punto de acceso, mientras que el usuario será identificado mediante su sesión iniciada. El backend validará el estado de la cuenta y, para los socios, la vigencia de la cuota y el apto médico. Durante los primeros 20 días desde la acreditación del primer pago, el socio podrá ingresar sin un apto aprobado.

La plataforma incluirá un cronograma informativo de clases semanales. Los usuarios podrán consultar el día, horario, tipo de actividad, sede y entrenador asignado. Desde el panel administrativo se podrán agregar, modificar o eliminar clases. Cuando el administrador abra por primera vez la semana siguiente y todavía no exista un cronograma, el sistema copiará la distribución de la semana anterior y permitirá modificarla.

Los entrenadores tendrán un perfil informativo visible para los socios, con su nombre, fotografía, especialidad y clases asignadas. Desde su vista privada podrán consultar sus clases y recibir notificaciones.

La plataforma también mostrará las sedes de M-Team mediante tarjetas con su nombre, dirección, horarios e información de contacto. Se integrará la API de Google Maps para mostrar la ubicación. El administrador podrá registrar nuevas sedes, modificar sus datos o desactivarlas cuando sea necesario.

## 1.2. Justificación de la temática frente a los requisitos de la materia

La cátedra requiere el desarrollo de una plataforma con operaciones CRUD y lógica de negocio. M-Team cumple con estas condiciones mediante la gestión de usuarios, socios, entrenadores, pagos, aptos médicos, accesos, clases, sedes, eventos y novedades.

La plataforma no se limita a registrar y mostrar información, sino que debe aplicar reglas específicas. Entre ellas se encuentran el cálculo del vencimiento de la cuota, la actualización automática de su estado, la validación del acceso mediante el escáner de códigos QR, el control de permisos según el rol del usuario y la generación del cronograma de la próxima semana a partir del anterior.

También se utilizarán distintos estados para representar la situación de los elementos principales del sistema. Una cuota podrá encontrarse al día, próxima a vencer o vencida; un apto médico podrá estar pendiente, aprobado o rechazado; y una cuenta de usuario podrá estar activa o desactivada.

El administrador podrá crear, consultar, modificar y desactivar usuarios, entrenadores, clases, sedes y novedades, conservando la información histórica relacionada. Los socios y entrenadores accederán únicamente a las funciones correspondientes a su rol.

La plataforma contará con un frontend web, un backend que expondrá una API REST, una base de datos relacional y una integración externa con Google Maps.

# 2. Objetivos del proyecto

## 2.1. Objetivo general

Desarrollar y desplegar públicamente una plataforma web para M-Team destinada a centralizar la gestión de socios, entrenadores, cuota mensual, pagos, aptos médicos, accesos mediante escaneo de códigos QR, sedes, cronograma semanal de clases, eventos y novedades.

La plataforma contará con vistas diferenciadas para socios, entrenadores y administradores, y será construida mediante una arquitectura de tres capas compuesta por un frontend web, un backend con API REST y una base de datos.

## 2.2. Objetivos específicos

- Centralizar la gestión de socios, entrenadores y cuentas de usuario.

- Administrar el valor de la cuota y acreditar manualmente pagos con una vigencia de 30 días.

- Permitir la carga, revisión y aprobación de aptos médicos.

- Validar los ingresos mediante la cámara del navegador y códigos QR fijos asociados a los puntos de acceso.

- Gestionar sedes, clases, entrenadores, eventos, novedades y notificaciones.

- Implementar una plataforma web responsiva con API REST y base de datos relacional.

# 3. Alcance del sistema

## 3.1. Funcionalidades incluidas

- Usuarios y roles: registro de socios, inicio y cierre de sesión, perfiles, autenticación, autorización y activación o desactivación de cuentas. El sistema contará con los roles socio, entrenador y administrador.

- Socios, cuotas y pagos: gestión de datos personales, una única cuota común, historial de precios, acreditación manual de pagos, vigencia de 30 días desde cada acreditación, historial de operaciones y avisos internos.

- Aptos médicos y accesos: carga y revisión de documentos con estados pendiente, aprobado o rechazado. Durante los primeros 20 días desde la acreditación del primer pago podrá ingresarse sin un apto aprobado. El acceso se solicitará escaneando desde la plataforma web un QR fijo asociado a una sede y punto de acceso.

- Sedes: consulta y administración de las dos sedes actuales, posibilidad de registrar nuevas ubicaciones e integración básica con Google Maps.

- Clases y entrenadores: cronograma semanal informativo, copia de la semana anterior, administración de clases y entrenadores, perfiles públicos y consulta privada de clases asignadas.

- Eventos, novedades y administración: publicación de eventos, novedades y notificaciones internas, junto con un panel para gestionar usuarios, pagos, aptos, accesos, sedes, clases y otros módulos.

## 3.2. Funcionalidades fuera de alcance

Quedan fuera de alcance los diferentes planes de membresía, pagos en línea, facturación fiscal, reservas y cupos de clases, listas de espera, control de asistencia, rutinas, seguimiento personalizado, asignación de entrenadores a socios, aplicación móvil nativa, funcionamiento sin conexión, apertura física de molinetes, chat, videollamadas, nutrición, inteligencia artificial, SMS y notificaciones push.

# 4. Usuarios y stakeholders

## 4.1. Perfiles de usuario identificados

El sistema define tres perfiles de usuario: socio, entrenador y administrador. La distinción entre ellos justifica la implementación de autenticación y autorización, ya que cada perfil tendrá acceso a funcionalidades diferentes. En el caso del socio, algunas operaciones también dependen del estado de su cuenta, de la cuota mensual y del apto médico.

| Perfil | Descripción | Operaciones habilitadas |
| --- | --- | --- |
| Socio | Usuario final del gimnasio M-Team. | Consultar y editar su perfil, ver el estado y vencimiento de la cuota, cargar el apto médico, ver su estado, escanear el QR fijo del punto de acceso desde la plataforma web, consultar las clases semanales, entrenadores, sedes, eventos, novedades y notificaciones. |
| Entrenador | Personal del gimnasio encargado de dictar una o más clases. | Consultar sus datos básicos, ver las clases que tiene asignadas, consultar el día, horario, actividad y sede correspondiente, visualizar eventos y notificaciones, y escanear el QR fijo del punto de acceso desde la plataforma web. |
| Administrador | Responsable de la configuración y gestión operativa de la plataforma. | Gestionar usuarios, socios y entrenadores; activar o desactivar cuentas; registrar pagos; modificar el valor de la cuota; revisar aptos médicos; consultar los accesos permitidos y rechazados mediante QR; administrar sedes, clases, eventos, novedades y notificaciones; asignar entrenadores a clases y consultar indicadores básicos del sistema. |

## 4.2. Stakeholders del proyecto

| Stakeholder | Interés en el proyecto | Nivel de influencia |
| --- | --- | --- |
| Dirección de M-Team | Centralizar la gestión del gimnasio, reducir tareas manuales y disponer de información actualizada sobre socios, pagos, accesos, sedes, clases y documentación. | Alto — define las necesidades del negocio, las reglas generales y las prioridades del sistema. |
| Personal administrativo de M-Team | Contar con una herramienta que facilite el registro de pagos, la revisión de aptos médicos, la administración de usuarios, la actualización de clases y el seguimiento de los ingresos. | Alto — utiliza diariamente el panel administrativo y aporta los requisitos operativos del sistema. |
| Socios de M-Team | Consultar su cuota, vencimientos y apto médico; utilizar el escáner de acceso; y consultar clases, sedes, eventos y novedades sin depender de consultas presenciales o mensajes. | Medio — su experiencia de uso determina la claridad, facilidad y utilidad de la plataforma. |
| Entrenadores de M-Team | Consultar sus clases asignadas, la sede y el horario correspondiente, recibir novedades internas y escanear desde la plataforma web el QR fijo del punto de acceso. | Medio — sus necesidades determinan las funciones disponibles en la vista del entrenador. |
| Equipo de desarrollo y mantenimiento | Diseñar, implementar, desplegar y mantener la plataforma, asegurando su correcto funcionamiento y evolución futura. | Alto — toma las decisiones técnicas y transforma los requerimientos del gimnasio en funcionalidades. |

# 5. Requerimientos funcionales

## 5.1. Gestión de usuarios y autenticación

| ID | Descripción |
| --- | --- |
| USR-01 | El sistema deberá permitir el registro público de socios mediante el ingreso de nombre, apellido, documento, fecha de nacimiento, correo electrónico, teléfono y contraseña. Deberá validar los campos obligatorios y comprobar que el documento y el correo electrónico no estén asociados a otra cuenta. Las cuentas de entrenador y administrador deberán crearse desde el panel administrativo. |
| USR-02 | El sistema deberá permitir que los usuarios registrados inicien sesión mediante su correo electrónico y contraseña. Deberá validar las credenciales, comprobar que la cuenta se encuentre activa y, cuando el acceso no pueda completarse, mostrar un mensaje comprensible sin revelar información sensible. |
| USR-03 | El sistema deberá permitir que los usuarios autenticados cierren su sesión. Al hacerlo, deberá eliminar o invalidar las credenciales almacenadas en el navegador y redirigir al usuario a la pantalla de ingreso, evitando que otra persona acceda desde el mismo dispositivo. |
| USR-04 | El sistema deberá permitir que un usuario que olvidó su contraseña solicite el restablecimiento a un administrador, sin depender de correos automáticos. El administrador podrá asignar una contraseña temporal, que deberá ser modificada después del siguiente inicio de sesión. |
| USR-05 | El sistema deberá permitir que cada usuario autenticado acceda únicamente a las funciones correspondientes a su rol. Deberá diferenciar entre socio, entrenador y administrador, restringiendo las pantallas y operaciones protegidas según sus responsabilidades. |
| USR-06 | El sistema deberá permitir que los usuarios autenticados consulten y modifiquen los datos habilitados de su perfil, como teléfono, fotografía o contraseña. No deberá permitir la modificación directa de campos protegidos, como documento, rol, estado de cuenta o situación administrativa. |
| USR-07 | El sistema deberá impedir que una cuenta desactivada inicie sesión, acceda a funciones privadas o utilice el escáner de acceso. La desactivación no deberá eliminar los datos ni el historial asociado a la cuenta. |

## 5.2. Gestión administrativa de usuarios

| ID | Descripción |
| --- | --- |
| ADM-01 | El sistema deberá permitir que el administrador consulte, busque y filtre el listado de usuarios registrados. El listado deberá mostrar nombre, apellido, documento, correo electrónico, rol y estado, y permitir búsquedas por datos personales y filtros por rol o estado. |
| ADM-02 | El sistema deberá permitir que el administrador acceda al detalle de un usuario para consultar su información personal y administrativa. Para los socios deberá mostrar la cuota, los pagos y el apto médico; para los entrenadores, la especialidad, las sedes y las clases asignadas. |
| ADM-03 | El sistema deberá permitir que el administrador cree cuentas de socio, entrenador y administrador desde el panel administrativo. Deberá validar los campos obligatorios, el documento y el correo electrónico antes de asignar el rol correspondiente. |
| ADM-04 | El sistema deberá permitir que el administrador modifique los datos personales y administrativos de un usuario y restablezca temporalmente su contraseña cuando sea necesario. Deberá validar los cambios y registrar la fecha y el administrador responsable. |
| ADM-05 | El sistema deberá permitir que el administrador active, desactive o reactive una cuenta. La operación deberá solicitar confirmación, podrá incluir un motivo y no deberá eliminar pagos, aptos médicos, accesos, clases ni otros datos históricos. La reactivación no deberá modificar automáticamente la cuota ni el apto médico del socio. |
| ADM-06 | El sistema deberá permitir que el administrador consulte un historial básico de las acciones realizadas sobre una cuenta. El historial deberá indicar cuándo fue creada, modificada, activada o desactivada y quién realizó cada operación, y será únicamente de consulta. |

## 5.3. Gestión de socios

| ID | Descripción |
| --- | --- |
| SOC-01 | El sistema deberá asignar a cada socio un perfil vinculado a su cuenta, en el que se concentre su información personal y administrativa. El perfil deberá incluir nombre, apellido, documento, fecha de nacimiento, correo electrónico, teléfono y contacto de emergencia. |
| SOC-02 | El sistema deberá permitir que el socio autenticado consulte una vista general de su situación para conocer si está habilitado para ingresar y qué acciones tiene pendientes. La vista deberá mostrar el estado de la cuenta, la fecha del último pago acreditado, los días restantes de vigencia de la cuota, el estado del apto médico y, cuando corresponda, los días restantes del período inicial en el que puede ingresar sin un apto aprobado. |
| SOC-03 | El sistema deberá permitir que el socio modifique sus datos de contacto, como el teléfono o el correo electrónico. Deberá comprobar que el nuevo correo no esté asociado a otra cuenta y no permitirá modificar directamente el documento, el rol, el estado de la cuenta ni la situación de la cuota. |

## 5.4. Gestión de la cuota mensual

| ID | Descripción |
| --- | --- |
| CUO-01 | El sistema deberá permitir que el administrador defina el valor vigente de la cuota mensual de M-Team. Se manejará una única cuota común para todos los socios, sin diferenciar planes, categorías, beneficios ni sedes. |
| CUO-02 | El sistema deberá permitir que el administrador registre un nuevo valor de cuota y su fecha de entrada en vigencia. Deberá conservar el historial con el valor anterior, el nuevo valor, las fechas y el administrador responsable. Los cambios de precio no deberán modificar los pagos acreditados previamente. |
| CUO-03 | El sistema deberá permitir que el socio consulte el valor actual de la cuota, la fecha de su último pago acreditado, la fecha de vencimiento y los días restantes de vigencia. |
| CUO-04 | Como sistema, quiero calcular automáticamente la fecha de vencimiento y el estado de la cuota de cada socio, para mantener actualizada su situación administrativa. Cada pago acreditado iniciará una nueva vigencia de 30 días desde la fecha y hora de acreditación, reemplazando el vencimiento anterior sin acumular días restantes. El cálculo deberá realizarse en el backend. |
| CUO-05 | El sistema deberá permitir que el administrador consulte y filtre los socios según el estado de su cuota: al día, próxima a vencer o vencida. Se considerará próxima a vencer cuando resten cinco días o menos de vigencia, y vencida cuando hayan transcurrido los 30 días desde la última acreditación o no exista un pago acreditado. |
| CUO-06 | El sistema deberá notificar al socio cuando aumente el valor de la cuota, informando el nuevo importe y la fecha desde la cual comenzará a aplicarse. |

## 5.5. Gestión de pagos

| ID | Descripción |
| --- | --- |
| PAG-01 | El sistema deberá permitir que el administrador registre y acredite manualmente el pago de la cuota de un socio, generando una nueva vigencia de 30 días. El registro deberá incluir el socio, la fecha y hora de acreditación, el importe, el medio de pago y el número de comprobante cuando corresponda. Antes de confirmar la operación, deberá verificarse que el socio exista. |
| PAG-02 | El sistema deberá mostrar al administrador el valor vigente de la cuota y un resumen de la operación antes de acreditar el pago. El resumen deberá incluir el socio, el importe, el medio de pago y la nueva fecha de vencimiento que se generará al confirmar la acreditación. |
| PAG-03 | El sistema deberá permitir que el socio consulte su propio historial de pagos y que el administrador consulte el historial de cualquier socio. Cada registro deberá mostrar la fecha y hora de acreditación, el importe, el medio de pago, el comprobante, el estado y la fecha de vencimiento generada. Los pagos anulados deberán diferenciarse claramente. |
| PAG-04 | El sistema deberá permitir que el administrador busque y filtre pagos por socio, documento, fecha, medio de pago o estado. |
| PAG-05 | El sistema deberá permitir que el administrador anule un pago acreditado incorrectamente sin eliminar el registro original. La operación deberá solicitar confirmación y exigir un motivo. Después de la anulación, deberá recalcularse la vigencia de la cuota utilizando el último pago acreditado que continúe siendo válido. Si el pago anulado era el primer pago válido del socio, el período inicial de 20 días deberá recalcularse utilizando la acreditación válida más antigua que permanezca registrada. |
| PAG-06 | El sistema deberá conservar la trazabilidad de cada pago, registrando el usuario que lo creó, confirmó o anuló, junto con la fecha y hora de cada acción. |
| PAG-07 | El sistema deberá permitir que el administrador consulte los pagos registrados dentro de un rango de fechas y el importe total acumulado. El cálculo deberá considerar únicamente los pagos confirmados y excluir los anulados. |

## 5.6. Gestión de aptos médicos

| ID | Descripción |
| --- | --- |
| APM-01 | El sistema deberá permitir que el socio cargue desde su perfil una fotografía o archivo digital de su apto médico. Deberá aceptar formatos PDF, JPG o PNG, controlar el tamaño máximo permitido, mostrar una vista previa cuando sea posible y asociar el documento con la cuenta correspondiente. |
| APM-02 | El sistema deberá asignar el estado pendiente a todo apto médico recién cargado hasta que sea revisado por un administrador. Durante los primeros 20 días contados desde la acreditación del primer pago, el socio podrá ingresar aunque todavía no cuente con un apto médico aprobado. |
| APM-03 | El sistema deberá permitir que el socio consulte el estado de su apto médico. La vista deberá mostrar si se encuentra pendiente, aprobado o rechazado, junto con la fecha de carga, las observaciones administrativas y, cuando corresponda, los días restantes del período inicial de 20 días. |
| APM-04 | El sistema deberá permitir que el administrador consulte, busque, filtre y visualice los aptos médicos presentados por socio, documento, estado o fecha de carga. Los archivos solo podrán ser abiertos o descargados por el propio socio y por administradores autorizados. |
| APM-05 | El sistema deberá permitir que el administrador apruebe o rechace un apto médico. El rechazo deberá incluir una observación y cada decisión deberá registrar el administrador responsable y la fecha y hora de la revisión. Una vez aprobado, el apto médico permanecerá válido sin fecha de vencimiento. |
| APM-06 | El sistema deberá enviar una notificación interna al socio cuando su apto médico sea aprobado o rechazado. En caso de rechazo, la notificación deberá incluir la observación registrada por el administrador. |
| APM-07 | El sistema deberá permitir que el socio cargue un nuevo apto médico cuando el anterior haya sido rechazado. Los documentos anteriores deberán conservarse en un historial con sus fechas, estados, observaciones y responsables de revisión. |

## 5.7. Acceso mediante Escáner de código QR

| ID | Descripción |
| --- | --- |
| ACC-01 | El sistema deberá permitir que los socios y entrenadores autenticados utilicen la cámara de su dispositivo desde la plataforma web para escanear el código QR colocado en un molinete o punto de acceso. El navegador deberá solicitar permiso para utilizar la cámara y mostrar instrucciones o errores cuando el código no pueda leerse. |
| ACC-02 | Como sistema, quiero que cada código QR identifique de manera única un punto de acceso y su sede, para conocer desde qué ubicación se solicita el ingreso. El sistema deberá rechazar códigos inexistentes, alterados o asociados a puntos de acceso desactivados. |
| ACC-03 | Como sistema, quiero identificar al usuario mediante su sesión autenticada y comprobar que su cuenta esté activa, para asociar correctamente la solicitud de ingreso sin utilizar el QR como identificación personal. |
| ACC-04 | Como sistema, quiero aplicar las validaciones correspondientes al rol del usuario, para determinar si puede ingresar. Para un socio se verificará que la cuenta esté activa, que la cuota se encuentre dentro de los 30 días de vigencia y que tenga un apto médico aprobado. Durante los primeros 20 días desde la acreditación del primer pago, podrá ingresar aunque no haya presentado el apto médico o este se encuentre pendiente o rechazado. Finalizado ese período, será obligatorio contar con un apto aprobado. Para un entrenador se comprobará que su cuenta esté activa y conserve el rol de entrenador. |
| ACC-05 | El sistema deberá mostrar inmediatamente el resultado del intento de ingreso, indicando acceso permitido o acceso rechazado, junto con la sede y el punto de acceso. Cuando el ingreso sea rechazado, deberá informar el motivo correspondiente, como cuenta desactivada, cuota vencida, apto médico pendiente o rechazado una vez finalizado el período inicial, punto de acceso inválido o sede desactivada. |
| ACC-06 | Como sistema, quiero registrar cada intento de ingreso, para conservar un historial básico. El registro deberá incluir usuario, rol, sede, punto de acceso, fecha, hora, resultado y motivo del rechazo cuando corresponda. |
| ACC-07 | El sistema deberá permitir que el administrador consulte y filtre el historial general de accesos por usuario, sede, fecha, rol y resultado, diferenciando los intentos permitidos de los rechazados. |
| ACC-08 | El sistema deberá mostrar instrucciones claras cuando la cámara no esté disponible o no tenga permisos, para que el usuario pueda corregir el problema y volver a intentar el escaneo del QR físico del punto de acceso. |

## 5.8. Gestión de sedes

| ID | Descripción |
| --- | --- |
| SED-01 | El sistema deberá permitir que los usuarios de M-Team consulten las sedes disponibles mediante tarjetas informativas. Inicialmente se mostrarán las dos sedes actuales y cada tarjeta deberá incluir nombre, imagen, dirección, horarios, teléfono y descripción. |
| SED-02 | El sistema deberá permitir que los usuarios accedan al detalle de una sede para consultar sus datos de contacto, horarios, descripción, ubicación y clases programadas. |
| SED-03 | El sistema deberá permitir que los usuarios visualicen la ubicación de una sede en Google Maps y accedan a las indicaciones de llegada. |
| SED-04 | El sistema deberá permitir que el administrador cree y modifique sedes para incorporar nuevas ubicaciones y mantener actualizada su información. Deberá validar el nombre, la dirección, los horarios, el teléfono, la descripción, la imagen y los datos de Google Maps, evitando nombres o direcciones duplicados. |
| SED-05 | El sistema deberá permitir que el administrador active o desactive una sede. Las sedes desactivadas no deberán mostrarse a socios o entrenadores ni podrán asignarse a nuevas clases, aunque deberán conservar sus datos y relaciones históricas. |
| SED-06 | El sistema deberá permitir que el administrador consulte, busque y filtre todas las sedes, tanto activas como desactivadas, y acceda a sus datos, clases asociadas y operaciones administrativas. |

## 5.9. Cronograma semanal de clases

| ID | Descripción |
| --- | --- |
| CLA-01 | El sistema deberá permitir que los socios y entrenadores consulten el cronograma semanal de clases. Deberá mostrar el tipo de actividad, el día, el horario, la sede y el entrenador asignado cuando corresponda. |
| CLA-02 | El sistema deberá permitir que el administrador cree, modifique o elimine clases de una semana para mantener actualizado el cronograma. Podrá modificar la actividad, el día, el horario, la sede y el entrenador opcional. |
| CLA-03 | Como sistema, quiero impedir que una clase se asocie a una sede desactivada o a un entrenador inactivo, para evitar publicar información que no pueda cumplirse. |
| CLA-04 | El sistema deberá permitir que el administrador prepare el cronograma de la semana siguiente utilizando la semana anterior como base. Si la nueva semana todavía no existe, deberá copiar el cronograma con las fechas correspondientes y permitir agregar, modificar o eliminar clases sin alterar el historial anterior. |

## 5.10. Gestión de entrenadores

| ID | Descripción |
| --- | --- |
| ENT-01 | El sistema deberá permitir que los socios consulten un listado de entrenadores activos. Cada entrenador deberá mostrarse con su nombre, fotografía, especialidad y descripción. |
| ENT-02 | El sistema deberá permitir que el administrador cree y modifique el perfil de un entrenador, registrando sus datos personales, fotografía, especialidad, descripción y sedes en las que trabaja. El correo electrónico y el documento deberán ser únicos. |
| ENT-03 | El sistema deberá permitir que el entrenador autenticado consulte las clases que tiene asignadas, incluyendo el día, el horario, la actividad y la sede en la que debe presentarse. |
| ENT-04 | El sistema deberá permitir que el entrenador consulte las novedades y notificaciones de M-Team relacionadas con clases, eventos, horarios y comunicaciones internas. |
| ENT-05 | El sistema deberá permitir que el administrador busque, consulte, active o desactive entrenadores. La desactivación deberá impedir el inicio de sesión, el acceso al gimnasio y nuevas asignaciones a clases, sin eliminar el historial asociado. |
| ENT-06 | Como sistema, quiero limitar las funciones del entrenador, para impedir que gestione socios, pagos, cuotas, aptos médicos, sedes, eventos o cronogramas. Los entrenadores tampoco podrán ser asignados directamente a socios. |

## 5.11. Gestión de eventos

| ID | Descripción |
| --- | --- |
| EVE-01 | El sistema deberá permitir que los socios y entrenadores consulten los eventos organizados por M-Team. Cada evento deberá mostrar título, descripción, fecha, horario, ubicación, imagen y estado. |
| EVE-02 | El sistema deberá permitir que el administrador cree, modifique, guarde como borrador o publique eventos. Deberá validar el título, la fecha, el horario y la ubicación antes de guardar o publicar la información. |
| EVE-03 | El sistema deberá permitir que el administrador cancele un evento sin eliminarlo, conservando su historial. El evento deberá continuar visible con el estado cancelado y generar una notificación para los usuarios correspondientes. |
| EVE-04 | El sistema deberá diferenciar los eventos próximos, finalizados y cancelados. Deberá ordenarlos por fecha y considerar finalizados aquellos cuya fecha y horario ya hayan transcurrido. |

## 5.12. Gestión de novedades y notificaciones

| ID | Descripción |
| --- | --- |
| NOV-01 | El sistema deberá permitir que los socios y entrenadores consulten un apartado de novedades para conocer cambios de horarios, feriados, tareas de mantenimiento, eventos y otras comunicaciones. Cada publicación deberá mostrar título, contenido, fecha e imagen cuando corresponda. |
| NOV-02 | El sistema deberá permitir que el administrador cree, publique, modifique o desactive novedades. Las publicaciones podrán estar dirigidas a todos los usuarios, solamente a socios o solamente a entrenadores. |
| NOV-03 | El sistema deberá enviar notificaciones internas relacionadas con la cuenta de cada usuario, incluyendo aumentos de cuota, cuotas próximas a vencer o vencidas, resultados de la revisión del apto médico, cambios de clases y cancelaciones de eventos. Cada notificación deberá enviarse únicamente a los usuarios correspondientes y mostrarse dentro de la plataforma. |
| NOV-04 | El sistema deberá permitir que los usuarios consulten sus notificaciones ordenadas desde la más reciente y las marquen como leídas, sin eliminarlas del historial. Cada notificación deberá mostrar título, mensaje, fecha, tipo y estado de lectura. |

## 5.13. Panel administrativo e indicadores

| ID | Descripción |
| --- | --- |
| PAN-01 | El sistema deberá permitir que el administrador acceda a un panel principal con indicadores y accesos directos a los módulos de usuarios, cuotas, pagos, aptos médicos, accesos, clases, sedes, entrenadores, eventos y novedades, centralizando la consulta y gestión de la información. |
| PAN-02 | El sistema deberá mostrar al administrador indicadores sobre socios activos o desactivados, cuotas al día, próximas a vencer o vencidas, aptos médicos pendientes o rechazados y socios que todavía se encuentren dentro del período inicial de 20 días. Cada indicador deberá permitir acceder a los registros relacionados. |
| PAN-03 | El sistema deberá permitir que el administrador consulte las clases de la semana actual y verifique si el cronograma de la semana siguiente fue generado o modificado. |
| PAN-04 | El sistema deberá mostrar al administrador un resumen de los últimos ingresos permitidos y rechazados. Cada registro deberá incluir el usuario, la sede, la fecha, la hora y el resultado del intento de acceso. |

# 6. Requerimientos no funcionales

## 6.1. Rendimiento

| ID | Descripción |
| --- | --- |
| REN-01 | Una vez activos los servicios de alojamiento, las operaciones habituales deberán responder en un máximo aproximado de tres segundos bajo condiciones normales. Las demoras provocadas por el arranque en frío de servicios gratuitos quedarán exceptuadas de este límite. |
| REN-02 | Los listados con una cantidad elevada de registros, como usuarios, pagos, aptos médicos e intentos de ingreso, deberán mantenerse ágiles mediante paginación, filtros o carga por bloques. Las consultas deberán devolver únicamente la información necesaria para cada operación. |
| REN-03 | El sistema deberá admitir el uso simultáneo por parte de varios usuarios sin generar errores, registros duplicados ni inconsistencias en pagos, cuotas, aptos médicos o intentos de ingreso. |
| REN-04 | Las imágenes de perfiles, sedes y eventos deberán utilizar tamaños y formatos adecuados para evitar tiempos de carga innecesarios, especialmente cuando la plataforma sea utilizada desde dispositivos móviles. |

## 6.2. Seguridad

| ID | Descripción |
| --- | --- |
| SEG-01 | La comunicación entre el frontend y el backend deberá realizarse mediante HTTPS. Las contraseñas deberán almacenarse mediante un mecanismo de hash seguro con salt y nunca conservarse ni devolverse en texto plano. |
| SEG-02 | Los mensajes de error deberán ser comprensibles para el usuario sin exponer contraseñas, credenciales, consultas de base de datos, rutas internas ni otros detalles técnicos sensibles. |
| SEG-03 | La información personal, económica y médica deberá ser accesible únicamente según los permisos de cada rol. Las decisiones sobre autenticación, cuota, apto médico y acceso deberán validarse en el backend utilizando la información vigente. |

## 6.3. Usabilidad

| ID | Descripción |
| --- | --- |
| USA-01 | La interfaz deberá presentar una navegación clara, uniforme y adaptada al rol de socio, entrenador o administrador, de manera que cada usuario pueda identificar fácilmente las funciones disponibles. |
| USA-02 | La información prioritaria de cada rol deberá encontrarse visible en la pantalla principal o poder alcanzarse mediante un máximo de dos acciones de navegación. |
| USA-03 | Los formularios, mensajes y confirmaciones deberán utilizar criterios consistentes. Los campos obligatorios, datos incorrectos, acciones rechazadas y operaciones sensibles deberán comunicarse claramente para reducir errores accidentales. |
| USA-04 | La plataforma deberá contar con un diseño web responsivo y mantener una experiencia de uso adecuada desde computadoras, tablets y teléfonos móviles mediante navegadores compatibles. |
| USA-05 | La interfaz deberá mantener una identidad visual coherente con M-Team, utilizando una paleta basada en rojo, negro y tonos de gris, con contraste suficiente. Todo el contenido deberá presentarse en español y utilizar términos comprensibles para los usuarios del gimnasio. |

## 6.4. Disponibilidad

| ID | Descripción |
| --- | --- |
| DIS-01 | La plataforma deberá permanecer accesible mediante una URL pública durante las demostraciones, pruebas y entregas, considerando las posibles limitaciones o interrupciones temporales de los servicios gratuitos utilizados. |
| DIS-02 | Ante fallas temporales del backend, la base de datos o la conexión a internet, la plataforma deberá mantener un comportamiento estable, informar el problema claramente y permitir que el usuario vuelva a intentar la operación sin perder innecesariamente su sesión. |
| DIS-03 | Una falla de Google Maps no deberá impedir la consulta de la información principal de una sede. El sistema deberá continuar mostrando, como mínimo, su nombre, dirección, horarios y datos de contacto. |

## 6.5. Escalabilidad

| ID | Descripción |
| --- | --- |
| ESC-01 | La estructura de la información deberá permitir incorporar nuevas sedes, clases, entrenadores, usuarios y eventos sin requerir un rediseño general del sistema. |

## 6.6. Mantenibilidad y compatibilidad

| ID | Descripción |
| --- | --- |
| MNT-01 | El código deberá respetar convenciones comunes de nombres, estructura y estilo acordadas por el equipo, para facilitar su lectura, revisión y modificación. |
| MNT-02 | El frontend, el backend, la lógica de negocio y el acceso a datos deberán mantenerse separados y organizados en módulos. La información persistente deberá almacenarse en la base de datos y no depender únicamente de datos mantenidos en memoria. |
| MNT-03 | La documentación técnica deberá incluir la API REST mediante Swagger/OpenAPI y un archivo README con la descripción del proyecto, las tecnologías utilizadas y las instrucciones para instalarlo y ejecutarlo localmente. |
| MNT-04 | La plataforma deberá funcionar correctamente en versiones recientes de Google Chrome, Microsoft Edge y Mozilla Firefox, incluyendo el acceso a la cámara cuando el navegador y el dispositivo lo permitan. |

# 7. Arquitectura tecnológica propuesta

M-Team utilizará una arquitectura de tres capas: frontend, backend y base de datos. La plataforma web se comunicará exclusivamente con una API REST, por lo que el frontend no accederá directamente a la base de datos. Se utilizarán tecnologías conocidas por el equipo y servicios gratuitos adecuados para el alcance académico.

## 7.1. Componentes

| Capa | Tecnología propuesta | Justificación |
| --- | --- | --- |
| Frontend | React, Vite y TypeScript | Desarrollar una interfaz web responsiva con vistas para socios, entrenadores y administradores. |
| Backend | Node.js, Express y TypeScript | Exponer la API REST y aplicar las reglas de negocio del sistema. |
| Base de datos | Base de datos PostgreSQL administrada mediante Supabase | Almacenar usuarios, pagos, aptos médicos, sedes, clases, eventos y accesos. |
| Acceso a datos | Prisma ORM | Gestionar el modelo de datos y las consultas a PostgreSQL. |
| Autenticación | JSON Web Tokens y bcrypt | Identificar usuarios, controlar roles y almacenar contraseñas de forma segura. |
| Archivos | Supabase Storage | Almacenar imágenes y documentos de aptos médicos. |
| Mapas | Google Maps | Mostrar ubicaciones e indicaciones de llegada a las sedes. |
| Documentación y pruebas | Swagger, Jest y Supertest | Documentar la API y probar la lógica de negocio y los endpoints principales. |
| Versionado | Git y GitHub | Registrar contribuciones e integrar cambios mediante ramas y pull requests. |
| Despliegue | Vercel, Render y Supabase | Publicar el frontend, el backend, la base de datos y los archivos. Railway podrá utilizarse como alternativa para el backend. |

## 7.2. Organización interna del backend

El backend se organizará en rutas, controladores, servicios, repositorios Prisma y middlewares. Las rutas definirán los endpoints; los controladores recibirán las solicitudes; los servicios aplicarán las reglas de negocio; los repositorios accederán a PostgreSQL; y los middlewares controlarán la autenticación, los roles y los errores.

`Ruta → Controlador → Servicio → Repositorio Prisma → Base de datos`

Esta organización fue elegida por ser sencilla de desarrollar, mantener, probar y explicar. Las tecnologías podrán reemplazarse por alternativas equivalentes si algún servicio gratuito deja de estar disponible, sin modificar la estructura general del sistema.

# 8. Supuestos y restricciones del proyecto

## 8.1. Supuestos

| ID | Descripción |
| --- | --- |
| S-01 | El equipo conservará sus integrantes y cada uno dispondrá de entre seis y ocho horas semanales para planificación, desarrollo, pruebas y documentación. |
| S-02 | Los servicios gratuitos seleccionados permanecerán disponibles durante el cuatrimestre con capacidad suficiente para la demostración académica. |
| S-03 | Los usuarios accederán desde navegadores actualizados, mediante computadoras o dispositivos móviles con conexión a internet y cámara cuando utilicen el escáner QR. |
| S-04 | M-Team proporcionará o autorizará los datos necesarios sobre sus dos sedes, cuota, entrenadores, clases y eventos. Para las pruebas podrán utilizarse datos ficticios. |
| S-05 | Las fechas y condiciones establecidas por la cátedra se mantendrán sin modificaciones importantes. |

## 8.2. Restricciones

| ID | Descripción |
| --- | --- |
| R-01 | El proyecto deberá completarse dentro del cuatrimestre, con entrega y exposición final el 2 de noviembre de 2026, y deberá contar con al menos el 60 % de las funcionalidades integradas para el 28 de septiembre de 2026. |
| R-02 | El equipo tendrá como máximo cuatro integrantes y todos deberán registrar contribuciones efectivas en el repositorio de GitHub. |
| R-03 | El frontend deberá consumir exclusivamente la API REST del backend, documentada mediante Swagger/OpenAPI, sin acceder directamente a la base de datos. |
| R-04 | El desarrollo se realizará de forma iterativa y deberá mantener los registros de tiempo, revisiones personales y defectos requeridos por PSP. |
| R-05 | La plataforma será web, responsiva, estará disponible en español y deberá quedar accesible mediante una URL pública. No se desarrollará una aplicación móvil nativa ni funcionamiento sin conexión. |
| R-06 | La infraestructura se limitará a servicios gratuitos, por lo que podrán existir restricciones de almacenamiento, transferencia o demoras después de períodos de inactividad. |
| R-07 | Los pagos serán registrados y acreditados manualmente por un administrador. No se incluirán pagos en línea, pasarelas de pago ni facturación fiscal. |
| R-08 | El acceso se solicitará escaneando desde la plataforma web un QR fijo asociado a una sede y punto de acceso. El sistema mostrará y registrará el resultado, pero no abrirá físicamente el molinete. |
| R-09 | Las clases serán informativas y no incluirán reservas, cupos, listas de espera ni control de asistencia. |
| R-10 | El proyecto tendrá fines académicos, no contará con presupuesto y utilizará exclusivamente datos e identidad visual autorizados por M-Team o información ficticia. |

### Convenciones de organización y nomenclatura

El proyecto utilizará TypeScript estricto y nombres descriptivos en inglés. Las variables, funciones y métodos se escribirán en camelCase, mientras que las clases, interfaces, tipos, enumeraciones y componentes de React utilizarán PascalCase. Las constantes globales se definirán en UPPER_SNAKE_CASE. Los componentes de React se almacenarán en archivos PascalCase.tsx, mientras que los demás archivos utilizarán kebab-case.

En la base de datos, las tablas se nombrarán en singular y con snake_case, las columnas seguirán el mismo formato, las claves primarias se llamarán id y las claves foráneas utilizarán la forma `<entidad>_id`.

La API REST utilizará rutas en minúsculas, en plural y separadas mediante guiones. El backend se organizará en rutas, controladores, servicios, repositorios, middlewares y validadores, siguiendo el flujo Ruta → Controlador → Servicio → Repositorio Prisma → Base de datos. El frontend se dividirá por módulos funcionales. Se evitarán abreviaturas poco claras, código duplicado, valores fijos sin constantes y archivos con múltiples responsabilidades.

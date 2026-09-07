# 🏋️ M-Team

> Plataforma web para la gestión integral de gimnasios.

M-Team es una plataforma web diseñada para centralizar la administración del gimnasio. Permitirá gestionar socios, entrenadores, pagos, la cuota mensual, aptos médicos, sedes, clases y accesos mediante códigos QR fijos.

## Documentación de la API

La especificación inicial de la API REST se encuentra en
[`backend/docs/openapi.yaml`](./backend/docs/openapi.yaml).

El contrato documenta los endpoints, parámetros, cuerpos, respuestas,
autenticación JWT y permisos necesarios para integrar el frontend con el
backend. Cuando Swagger UI sea incorporado, estará disponible localmente en
`http://localhost:3000/api/docs`.

## ✨ Características

- 👥 Gestión de usuarios con roles (Socio, Entrenador y Administrador).
- 💳 Administración de cuotas mensuales e historial de pagos.
- 📄 Carga, revisión y aprobación de aptos médicos.
- 📷 Control de acceso mediante escaneo de códigos QR.
- 🏢 Gestión de múltiples sedes.
- 📅 Cronograma semanal de clases.
- 🏋️ Administración de entrenadores.
- 📢 Publicación de eventos y novedades.
- 🔔 Sistema de notificaciones internas.
- 📊 Panel administrativo con indicadores y métricas.

---

## 🏗 Arquitectura

M-Team se construirá siguiendo una arquitectura de tres capas:

```
Frontend
    │
 REST API
    │
Backend
    │
Prisma ORM
    │
PostgreSQL
```

Esta separación mantiene una división clara entre la interfaz de usuario, la lógica de negocio y el acceso a los datos. El frontend se comunicará exclusivamente con el backend mediante la API REST.

---

## 🛠 Stack tecnológico

### Frontend

- React
- Vite
- TypeScript

### Backend

- Node.js
- Express
- TypeScript

### Base de datos

- PostgreSQL
- Prisma ORM
- Supabase

### Autenticación

- JSON Web Tokens (JWT)
- bcrypt

### Almacenamiento

- Supabase Storage

### Servicios externos

- Google Maps API

### Testing y documentación

- Swagger / OpenAPI
- Jest
- Supertest

## 📂 Documentación

- [Documento de alcance](./docs/documento-de-alcance.md)
- [Diagrama de clases](./docs/diagrama-de-clases.md)
- [Modelo relacional](./docs/modelo-relacional.md)
- [Matriz de trazabilidad](./docs/matriz-de-trazabilidad.md)
- [Diagrama de arquitectura](./docs/diagrama-arquitectura-m-team.md)
- [Diagramas de secuencia](./docs/diagramas-de-secuencia.md)
- [Estrategia de ambientes](./docs/ambientes.md)
- [Convenciones de nombres](./docs/convenciones-de-nombres-m-team.md)

---

## 🚀 Funcionalidades

- Gestión de usuarios y autenticación.
- Administración de socios y entrenadores.
- Gestión de cuotas y pagos.
- Historial de pagos.
- Gestión de aptos médicos.
- Validación de acceso mediante códigos QR.
- Administración de sedes.
- Cronograma semanal de clases.
- Gestión de eventos.
- Publicación de novedades.
- Notificaciones internas.
- Dashboard administrativo.

## Fuera del alcance actual

El proyecto no incluye:

- Integración con pasarelas de pago.
- Reserva de clases.
- Control de asistencia.
- Aplicación móvil.
- Notificaciones push.
- Planes de membresía.

Estas características no deben incorporarse durante la implementación del alcance vigente.

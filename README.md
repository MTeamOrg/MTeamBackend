# 🏋️ M-Team

> Plataforma web para la gestión integral de gimnasios.

M-Team es una plataforma diseñada para centralizar la administración de gimnasios en una única aplicación web. Permite gestionar socios, entrenadores, pagos, cuotas, aptos médicos, sedes, clases y accesos mediante códigos QR, simplificando las tareas administrativas y mejorando la experiencia tanto del personal como de los usuarios. :contentReference[oaicite:0]{index=0}

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

M-Team está desarrollado siguiendo una arquitectura de tres capas:

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

Esta separación permite mantener una clara división entre la interfaz de usuario, la lógica de negocio y el acceso a los datos. :contentReference[oaicite:1]{index=1}

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

:contentReference[oaicite:2]{index=2}

---

## 📂 Estructura del proyecto

```
m-team/
├── frontend/
├── backend/
├── docs/
└── README.md
```

El backend sigue una arquitectura basada en responsabilidades:

```
Routes
    ↓
Controllers
    ↓
Services
    ↓
Repositories (Prisma)
    ↓
Database
```

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

:contentReference[oaicite:3]{index=3}

---

## 🚧 Roadmap

Entre las funcionalidades previstas para futuras versiones se incluyen:

- Integración con pasarelas de pago.
- Reserva de clases.
- Control de asistencia.
- Aplicación móvil.
- Notificaciones push.
- Planes de membresía.

Estas características aún no forman parte del alcance actual del proyecto. :contentReference[oaicite:4]{index=4}

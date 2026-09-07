# Convenciones de nombres — M-Team

**Regla general:** el código utilizará nombres descriptivos en inglés. Los textos visibles para socios, entrenadores y administradores se presentarán en español.

## Backend (Node.js + Express + TypeScript)

| Elemento | Convención | Ejemplo |
|---|---|---|
| Carpetas | minúsculas, singular | `route/`, `controller/`, `service/`, `repository/`, `middleware/`, `validator/` |
| Archivos TypeScript | kebab-case | `payment-service.ts`, `auth-middleware.ts`, `access-controller.ts` |
| Variables, funciones y métodos | camelCase | `currentUser`, `calculateExpiration()`, `validateAccess()` |
| Clases, interfaces, tipos y enums | PascalCase | `PaymentService`, `UserProfile`, `MedicalCertificateStatus` |
| Constantes globales | UPPER_SNAKE_CASE | `MEMBERSHIP_VALIDITY_DAYS = 30` |
| Booleanos | is/has/can + camelCase | `isActive`, `hasApprovedMedicalCertificate`, `canEnter` |
| Endpoints / rutas REST | minúsculas, singular y kebab-case | `/api/user`, `/api/medical-certificate`, `/api/access-log` |
| Variables de entorno | UPPER_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL` |

## Frontend (React + Vite + TypeScript)

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes React | PascalCase.tsx | `MemberDashboard.tsx`, `MedicalCertificateCard.tsx` |
| Variables y funciones | camelCase | `handleSubmit`, `currentPayment`, `calculateDaysLeft` |
| Hooks | use + PascalCase | `useAuth()`, `useCurrentUser()`, `useNotifications()` |
| Interfaces y tipos | PascalCase | `UserProfile`, `PaymentSummary`, `BranchData` |
| Constantes | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE_MB`, `QR_SCAN_TIMEOUT_MS` |
| Carpetas funcionales | kebab-case | `features/medical-certificates/`, `features/access-control/` |
| Archivos no componentes | kebab-case | `api-client.ts`, `auth-service.ts`, `payment-utils.ts` |
| Booleanos | is/has/can + camelCase | `isLoading`, `hasError`, `canScanQr` |

## Base de datos (PostgreSQL / Prisma)

| Elemento | Convención | Ejemplo |
|---|---|---|
| Tablas PostgreSQL | singular + snake_case | `user`, `payment`, `medical_certificate`, `access_log` |
| Columnas PostgreSQL | snake_case | `created_at`, `user_id`, `accredited_at` |
| Clave primaria | id | `id` |
| Claves foráneas | FK_entidad | `user_id`, `branch_id`, `trainer_id` |
| Modelos Prisma | singular + PascalCase | `User`, `Payment`, `MedicalCertificate`, `AccessLog` |
| Campos Prisma | camelCase | `createdAt`, `userId`, `accreditedAt` |
| Mapeo Prisma ↔ PostgreSQL | `@map` / `@@map` | `createdAt @map("created_at")`, `@@map("medical_certificates")` |
| Enums / estados | PascalCase; valores UPPER_SNAKE_CASE | `MedicalStatus: PENDING, APPROVED, REJECTED` |

## Git / GitHub

| Elemento | Convención | Ejemplo |
|---|---|---|
| Ramas | tipo/descripcion-corta en kebab-case | `feature/medical-certificates`, `fix/payment-expiration`, `docs/deliverable-2` |
| Commits | Conventional Commits | `feat: add QR access validation`, `fix: correct membership expiration`, `docs: update project scope` |
| Pull requests | descriptivo + referencia al módulo/requerimiento | `[APM-05] Approve and reject medical certificates` |
| Tags / versiones | vMAJOR.MINOR.PATCH | `v0.1.0`, `v0.2.0`, `v1.0.0` |

Estas convenciones deberán mantenerse en frontend, backend, base de datos y repositorio para facilitar la lectura, revisión y mantenimiento del proyecto.

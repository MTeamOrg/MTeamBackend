# Estado de implementación de OpenAPI

Fecha de relevamiento: 2026-09-14. Rama base inspeccionada: `origin/develop` (`6316a04`).

## Resumen

| Estado | Cantidad | Significado |
|---|---:|---|
| Implementado y verificado | 2 | La ruta existe en Express y una prueba automatizada comprueba la respuesta. |
| Implementado sin verificar | 0 | No se encontraron rutas funcionales sin cobertura. |
| Contrato pendiente | 73 | La operación está documentada para coordinación, pero Express responde 404. |
| **Total** | **75** | Operaciones con `operationId` único y estado explícito. |

## Operaciones por módulo

| Módulo | Cantidad | Operaciones | Estado |
|---|---:|---|---|
| System | 2 | `getHealth`, `getOpenApiDocument` | Implementadas y verificadas |
| Authentication | 4 | `registerMember`, `login`, `getCurrentIdentity`, `changeOwnPassword` | Pendientes |
| Dashboard | 1 | `getAdminDashboard` | Pendiente |
| Users | 10 | `listUsers`, `createUser`, `getOwnProfile`, `updateOwnProfile`, `replaceOwnPhoto`, `getUser`, `updateUser`, `updateUserStatus`, `assignTemporaryPassword`, `listUserAuditLogs` | Pendientes |
| Members | 2 | `listMembers`, `getOwnMembership` | Pendientes |
| Membership Prices | 3 | `getCurrentMembershipPrice`, `listMembershipPrices`, `createMembershipPrice` | Pendientes |
| Payments | 8 | `listPayments`, `createPayment`, `previewPayment`, `getPaymentsSummary`, `getPayment`, `voidPayment`, `listOwnPayments`, `listMemberPayments` | Pendientes |
| Medical Certificates | 6 | `listOwnMedicalCertificates`, `uploadMedicalCertificate`, `listMedicalCertificates`, `getMedicalCertificate`, `downloadMedicalCertificateFile`, `reviewMedicalCertificate` | Pendientes |
| Access Attempts | 3 | `listAccessAttempts`, `createAccessAttempt`, `getAccessAttempt` | Pendientes |
| Access Points | 4 | `listAccessPoints`, `updateAccessPoint`, `listBranchAccessPoints`, `createBranchAccessPoint` | Pendientes |
| Branches | 5 | `listBranches`, `createBranch`, `getBranch`, `updateBranch`, `updateBranchStatus` | Pendientes |
| Weekly Schedules | 3 | `listWeeklySchedules`, `getWeeklySchedule`, `copyWeeklySchedule` | Pendientes |
| Scheduled Classes | 4 | `createScheduledClass`, `getScheduledClass`, `updateScheduledClass`, `deleteScheduledClass` | Pendientes |
| Trainers | 6 | `listTrainers`, `getOwnTrainerProfile`, `updateOwnTrainerProfile`, `listOwnTrainerClasses`, `getTrainer`, `replaceTrainerBranches` | Pendientes |
| Events | 5 | `listEvents`, `createEvent`, `getEvent`, `updateEvent`, `updateEventStatus` | Pendientes |
| News Posts | 5 | `listNewsPosts`, `createNewsPost`, `getNewsPost`, `updateNewsPost`, `updateNewsPostStatus` | Pendientes |
| Notifications | 4 | `listOwnNotifications`, `markAllOwnNotificationsRead`, `getOwnNotification`, `markOwnNotificationRead` | Pendientes |

## Rutas verificadas

| Método y ruta real | Evidencia |
|---|---|
| `GET /api/health` | `health-route.ts` y prueba de respuesta `{ status, environment }`. |
| `GET /api/docs/openapi.json` | `app.ts` y prueba de OpenAPI 3.1 con path `/health`. |
| `GET /api/docs/` | Integración de Swagger UI cubierta por prueba; es UI, no una operación de negocio adicional. |

La validación falla si una operación marcada como implementada no aparece en las fuentes Express, o si una ruta Express descubierta no está marcada como implementada en OpenAPI. Esta comparación cubre las rutas declaradas directamente con `app.<method>` o `<router>.method` en el diseño actual; deberá evolucionar si se introducen prefijos dinámicos o fábricas de rutas.

# OpenAPI and Express route alignment

Base branch: fix/openapi-route-alignment, from origin/develop at 2566585.

The application mounts apiRouter at /api. The OpenAPI server is
http://localhost:3000/api, so paths in the specification remain relative to
that server prefix. Swagger UI loads backend/docs/openapi.yaml through
backend/src/config/openapi.ts.

## Corrections

| Method | Previously documented | Real route | Correction |
| --- | --- | --- | --- |
| GET | /dashboard | /admin/dashboard/metrics | Replaced the generic operation with the mounted admin metrics operation and its real response fields. |
| GET | /payments/{paymentId} | None | Removed; no single-payment route is mounted. |
| GET | /access-attempts/{attemptId} | None | Removed; the backend only exposes the paginated admin list and QR evaluation operation. |
| GET | /access-points | None | Removed; no access-point router is registered. |
| POST | /access-points | None | Removed; no access-point router is registered. |
| PATCH | /access-points/{accessPointId} | None | Removed; no access-point router is registered. |
| GET | /branches/{branchId}/access-points | None | Removed; no access-point router is registered. |
| POST | /branches/{branchId}/access-points | None | Removed; no access-point router is registered. |
| GET | /scheduled-classes/{classId} | None | Removed; class management exposes POST, PATCH and DELETE only. |
| GET | /trainers/me | None | Removed; no self-profile trainer route is mounted. |
| PATCH | /trainers/me | None | Removed; no self-profile trainer route is mounted. |
| GET | /trainers/me/scheduled-classes | /trainer/classes | Documented the mounted route, trainer-only authorization, optional weekStartsOn query and WeeklySchedule response. |
| GET | /trainers/{trainerId} | None | Removed; the public trainer listing remains /trainers. |
| PUT | /trainers/{trainerId}/branches | /users/{userId}/trainer-branches | Documented the mounted admin route, userId parameter, branchIds validation and AdminUserDetail response. |

The mounted /trainers operation now documents its validated page and limit
query parameters and the actual public trainer list shape. The mounted /users
list also documents its membershipStatus and initialPeriod filters.

## Pending or intentionally not inferred

- The access-point CRUD operations were not reintroduced or implemented. The
  scope requires fixed QR access evaluation (ACC-01 through ACC-07) and the
  current POST /access-attempts operation performs that evaluation, but the
  scope does not require an API for provisioning fixed access points. There is
  no access-point-route.ts and no such router registration.
- A separate payment detail, access-attempt detail, scheduled-class detail, or
  trainer-detail operation is not required by the scope when the existing
  paginated/list or management operations cover the corresponding use case.
- No aliases or new endpoints were added.

## Verification helper

backend/scripts/verify-openapi-routes.mjs statically compares HTTP operations
in backend/src/route/*.ts with paths in the OpenAPI document. It normalizes
Express :param syntax to OpenAPI {param} syntax, checks the /api server
prefix, and ignores request.get("Authorization") because it only recognizes
router objects. Run it with:

cd backend
npm.cmd run routes:verify

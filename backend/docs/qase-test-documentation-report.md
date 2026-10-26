# Informe de documentación de casos Qase

Modo: **dry-run**. La vista previa no crea ni modifica casos; el modo de escritura solo utiliza IDs explícitos del manifiesto.

## Resumen

- Archivos analizados: 90
- Pruebas analizadas: 476
- Documentaciones propuestas: 476
- Casos vinculados por manifiesto: 0
- Casos ambiguos: 0
- Casos sin vínculo Qase: 475
- Casos con ID del manifiesto ausente en Qase: 1
- Casos que requieren revisión humana: 476
- Distribución: unitarias 178, API 85, integración 86, seguridad/autorización 127
- Estado de consulta Qase: not-configured; casos recibidos: 0

## Reglas de seguridad aplicadas

- No se crean casos, suites ni resultados históricos.
- Solo se consideran vinculaciones declaradas en `backend/docs/qase-test-case-manifest.json`.
- Los campos Qase no vacíos se conservan; el PATCH solo puede completar campos vacíos autorizados.
- Los casos ambiguos, sin aserciones o parametrizados quedan señalados para revisión.
- El token nunca se incluye en el JSON, el informe ni los mensajes de error.

## Muestra para revisión humana

### MTEAM-119 — accepts a scheduled price and retains its administrator and effective date

- Localizador: `backend/test/service/membership-price-management.test.ts#membership price management > accepts a scheduled price and retains its administrator and effective date`
- Tipo: unit; vínculo: missing-remote-case.
- Revisión: El ID del manifiesto no apareció en la respuesta de Qase.

**Descripción propuesta**

Verifica «accepts a scheduled price and retains its administrator and effective date» en la funcionalidad cubierta por el bloque «membership price management». Es una prueba unitaria basada en el comportamiento implementado y sus aserciones. No se asigna un requisito de la matriz porque el test no lo identifica explícitamente.

**Precondiciones**

Las dependencias de la unidad bajo prueba están disponibles y el estado inicial se prepara con los datos y dobles declarados en el test. Usa mocks Jest, datos sintéticos locales.

**Pasos**

1. Invocar service.createPrice(). Datos: Datos sintéticos declarados por el test. Esperado: La operación queda disponible para el siguiente paso.
2. Instanciar la unidad bajo prueba con las dependencias declaradas. Esperado: El resultado debe coincidir con las aserciones Jest documentadas a continuación.

**Resultado esperado**

Las verificaciones reales del test son:
- `expect(createMembershipPriceSchema.safeParse(input).success).toBe(true);`
- `expect(await service.createPrice(input, administratorId, idempotencyKey)).toEqual({ ...created, previousAmount: "18000.00" });`
- `expect(createPrice).toHaveBeenCalledWith({`

**Postcondiciones**

El test no declara una postcondición funcional o limpieza específica adicional.

### Sin ID Qase — authenticates the scanner, records its QR token, and omits internal user data

- Localizador: `backend/test/route/access-attempt.test.ts#access attempt routes > authenticates the scanner, records its QR token, and omits internal user data`
- Tipo: security; vínculo: unlinked.
- Revisión: No existe un ID Qase persistido en el manifiesto ni en la declaración del test.

**Descripción propuesta**

Verifica «authenticates the scanner, records its QR token, and omits internal user data» en la funcionalidad cubierta por el bloque «access attempt routes». Es una prueba seguridad/autorización basada en el comportamiento implementado y sus aserciones. No se asigna un requisito de la matriz porque el test no lo identifica explícitamente.

**Precondiciones**

La aplicación Express de prueba, sus rutas y los middlewares declarados en backend/test/route/access-attempt.test.ts están configurados.

**Pasos**

1. Enviar una solicitud HTTP POST a /api/access-attempts con el payload sintético declarado. Esperado: El resultado debe coincidir con las aserciones Jest documentadas a continuación.

**Resultado esperado**

Las verificaciones reales del test son:
- `expect(response.status).toBe(201);`
- `expect(users.findAccessControlUserById).toHaveBeenCalledWith(memberId);`
- `expect(service.create).toHaveBeenCalledWith(memberId, "[dato sintético omitido]");`
- `expect(response.body).toMatchObject({ result: "ALLOWED", branchId, accessPointId });`
- `expect(response.body.user).toBeUndefined();`

**Postcondiciones**

Las aserciones incluyen ausencia de llamadas, datos o efectos secundarios en los puntos que el test verifica.

### Sin ID Qase — reads persisted attempts, applies combined filters and paginates newest first

- Localizador: `backend/test/integration/postgres/access-attempts-list.postgres.test.ts#administrative access-attempt listing (PostgreSQL) > reads persisted attempts, applies combined filters and paginates newest first`
- Tipo: integration; vínculo: unlinked.
- Revisión: No existe un ID Qase persistido en el manifiesto ni en la declaración del test.

**Descripción propuesta**

Verifica «reads persisted attempts, applies combined filters and paginates newest first» en la funcionalidad cubierta por el bloque «administrative access-attempt listing (PostgreSQL)». Es una prueba integración PostgreSQL basada en el comportamiento implementado y sus aserciones. No se asigna un requisito de la matriz porque el test no lo identifica explícitamente.

**Precondiciones**

La prueba utiliza la configuración PostgreSQL de integración y sus fixtures persistentes. Usa user, branch, accessPoint, accessAttempt. La base de datos de prueba debe ser descartable y estar preparada por el flujo de integración.

**Pasos**

1. Enviar una solicitud HTTP GET a /api/access-attempts. Datos: Datos sintéticos declarados por el test. Esperado: La operación queda disponible para el siguiente paso.
2. Enviar una solicitud HTTP GET a /api/access-attempts?limit=1&page=1. Esperado: La operación queda disponible para el siguiente paso.
3. Enviar una solicitud HTTP GET a /api/access-attempts?limit=1&page=2. Esperado: La operación queda disponible para el siguiente paso.
4. Preparar el fixture user. Esperado: La operación queda disponible para el siguiente paso.
5. Preparar el fixture branch. Esperado: La operación queda disponible para el siguiente paso.
6. Preparar el fixture accessPoint. Esperado: La operación queda disponible para el siguiente paso.
7. Preparar el fixture accessAttempt. Esperado: El resultado debe coincidir con las aserciones Jest documentadas a continuación.

**Resultado esperado**

Las verificaciones reales del test son:
- `expect(filtered.status).toBe(200);`
- `expect(filtered.body).toMatchObject({ page: 1, limit: 1, total: 1 });`
- `expect(filtered.body.items).toHaveLength(1);`
- `expect(filtered.body.items[0]).toMatchObject({`
- `expect(firstPage.status).toBe(200);`
- `expect(secondPage.status).toBe(200);`
- `expect(firstPage.body.total).toBe(3);`
- `expect(firstPage.body.items[0].user.id).toBe(trainer.id);`
- `expect(secondPage.body.items[0].user.id).toBe(member.id);`
- `expect(firstPage.body.items[0].attemptedAt > secondPage.body.items[0].attemptedAt).toBe(true);`

**Postcondiciones**

El test no declara una postcondición funcional o limpieza específica adicional.

### Sin ID Qase — allows the required %s role

- Localizador: `backend/test/middleware/authorization-middleware.test.ts#role authorization middleware > allows the required %s role`
- Tipo: security; vínculo: unlinked.
- Revisión: No existe un ID Qase persistido en el manifiesto ni en la declaración del test. El test es parametrizado; revisar si el caso Qase representa la plantilla o cada variante.

**Descripción propuesta**

Verifica «allows the required %s role» en la funcionalidad cubierta por el bloque «role authorization middleware». Es una prueba seguridad/autorización basada en el comportamiento implementado y sus aserciones. No se asigna un requisito de la matriz porque el test no lo identifica explícitamente.

**Precondiciones**

Las dependencias de la unidad bajo prueba están disponibles y el estado inicial se prepara con los datos y dobles declarados en el test.

**Pasos**

1. Enviar una solicitud HTTP POST a /private. Esperado: El resultado debe coincidir con las aserciones Jest documentadas a continuación.

**Resultado esperado**

Las verificaciones reales del test son:
- `expect(response.status).toBe(200);`
- `expect(response.body.role).toBe(role);`

**Postcondiciones**

El test no declara una postcondición funcional o limpieza específica adicional.

### Sin ID Qase — CUO-06 notifies active members only when the price increases

- Localizador: `backend/test/repository/notification-triggers.test.ts#notification triggers > CUO-06 notifies active members only when the price increases`
- Tipo: unit; vínculo: unlinked.
- Revisión: No existe un ID Qase persistido en el manifiesto ni en la declaración del test.

**Descripción propuesta**

Verifica «CUO-06 notifies active members only when the price increases» en la funcionalidad cubierta por el bloque «notification triggers». Es una prueba unitaria basada en el comportamiento implementado y sus aserciones. El código identifica explícitamente el requisito CUO-06.

**Precondiciones**

Las dependencias de la unidad bajo prueba están disponibles y el estado inicial se prepara con los datos y dobles declarados en el test. Usa mocks Jest, datos sintéticos locales.

**Pasos**

1. Instanciar la unidad bajo prueba con las dependencias declaradas. Datos: Datos sintéticos declarados por el test. Esperado: El resultado debe coincidir con las aserciones Jest documentadas a continuación.

**Resultado esperado**

Las verificaciones reales del test son:
- `expect(runTransaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 60_000 });`
- `expect(executeRaw).toHaveBeenCalledTimes(1);`
- `expect(transaction.user.findMany).not.toHaveBeenCalled();`
- `expect(transaction.notification.createMany).not.toHaveBeenCalled();`

**Postcondiciones**

Las aserciones incluyen ausencia de llamadas, datos o efectos secundarios en los puntos que el test verifica.

## Requisitos identificados explícitamente

SED-06, SED-05, NOV-04, NOV-03, CUO-06, APM-06, EVE-03, PAG-03, PAG-04, PAG-07, CLA-02, CLA-03, ENT-04, CLA-01, CLA-04, ADM-01, ADM-05, ADM-06, ADM-02

## Archivos de salida

- `backend/docs/qase-test-documentation-preview.json`: propuesta completa y evidencia detectada.
- `backend/docs/qase-test-case-manifest.json`: vínculo persistente entre un test y un ID existente de Qase.

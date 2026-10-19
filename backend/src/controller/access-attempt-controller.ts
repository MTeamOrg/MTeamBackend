import type { RequestHandler } from "express";
import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { AccessAttemptService } from "../service/access-attempt-service.js";
import { createAccessAttemptSchema, listAccessAttemptsSchema } from "../validator/access-attempt-validator.js";

export class AccessAttemptController {
  constructor(private readonly service: AccessAttemptService) {}

  create: RequestHandler = async (request, response) => {
    const input = createAccessAttemptSchema.safeParse(request.body);
    if (!input.success) throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR, "El código QR no es válido", input.error.flatten());
    const userId = request.authenticatedUser?.id;
    if (!userId) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    const { user: _user, ...attempt } = await this.service.create(userId, input.data.qrToken);
    response.status(201).json(attempt);
  };

  list: RequestHandler = async (request, response) => {
    const query = listAccessAttemptsSchema.safeParse(request.query);
    if (!query.success) throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR, "Los filtros de accesos no son válidos", query.error.flatten());
    response.status(200).json(await this.service.list(query.data));
  };
}

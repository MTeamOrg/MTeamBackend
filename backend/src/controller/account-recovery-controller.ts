import type { RequestHandler } from "express";
import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { AccountRecoveryService, RECOVERY_MESSAGE } from "../service/account-recovery-service.js";
import { requestRecoverySchema, completeRecoverySchema } from "../validator/account-recovery-validator.js";

export class AccountRecoveryController {
  constructor(private readonly service: Pick<AccountRecoveryService, "request" | "complete">) {}
  request: RequestHandler = async (request, response) => {
    const validation = requestRecoverySchema.safeParse(request.body);
    if (!validation.success) throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR, "Ingresá un correo electrónico válido.");
    try { await this.service.request(validation.data.email); }
    catch (error) { this.throwSafeError(error); }
    response.status(202).json({ message: RECOVERY_MESSAGE });
  };
  complete: RequestHandler = async (request, response) => {
    const validation = completeRecoverySchema.safeParse(request.body);
    if (!validation.success) throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR, "Verificá el enlace y usá una contraseña de entre 8 y 72 caracteres.");
    try { await this.service.complete(validation.data.token, validation.data.newPassword); }
    catch (error) { this.throwSafeError(error); }
    response.status(204).send();
  };
  private throwSafeError(error: unknown): never {
    if (error instanceof ApplicationError) throw error;
    // Database exceptions can contain query arguments; do not pass them to the logger.
    throw new ApplicationError(503, ERROR_CODE.SERVICE_UNAVAILABLE, "No pudimos completar la solicitud. Intentá nuevamente más tarde.");
  }
}

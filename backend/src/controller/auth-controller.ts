import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { MemberRegistrationService } from "../service/auth-service.js";
import { registerMemberSchema } from "../validator/register-member-validator.js";

export class AuthController {
  constructor(private readonly authService: MemberRegistrationService) {}

  registerMember: RequestHandler = async (request, response) => {
    const validation = registerMemberSchema.safeParse(request.body);

    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos de registro no son válidos",
        validation.error.flatten(),
      );
    }

    const member = await this.authService.registerMember(validation.data);

    response.status(201).json({
      ...member,
      birthDate: member.birthDate.toISOString().slice(0, 10),
    });
  };
}

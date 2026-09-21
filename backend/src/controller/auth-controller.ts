import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type {
  MemberRegistrationService,
  PasswordManagementService,
  UserLoginService,
} from "../service/auth-service.js";
import { changePasswordSchema } from "../validator/change-password-validator.js";
import { loginSchema } from "../validator/login-validator.js";
import { registerMemberSchema } from "../validator/register-member-validator.js";

export class AuthController {
  constructor(
    private readonly authService: MemberRegistrationService &
      UserLoginService &
      PasswordManagementService,
  ) {}

  logout: RequestHandler = (_request, response) => {
    response.status(204).send();
  };

  changePassword: RequestHandler = async (request, response) => {
    const validation = changePasswordSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos para cambiar la contraseña no son válidos",
        validation.error.flatten(),
      );
    }

    await this.authService.changePassword(
      request.authenticatedUser!.id,
      validation.data,
    );
    response.status(204).send();
  };

  login: RequestHandler = async (request, response) => {
    const validation = loginSchema.safeParse(request.body);

    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos de inicio de sesión no son válidos",
        validation.error.flatten(),
      );
    }

    response.status(200).json(await this.authService.login(validation.data));
  };

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

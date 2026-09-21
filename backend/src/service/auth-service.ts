import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import {
  DuplicateUserError,
  type AuthenticationUser,
  type PasswordRepositoryPort,
  type RegisteredMember,
  type UserConflictField,
  type UserRepositoryPort,
} from "../repository/user-repository.js";
import type { RegisterMemberInput } from "../validator/register-member-validator.js";
import type { ChangePasswordInput } from "../validator/change-password-validator.js";
import type { LoginInput } from "../validator/login-validator.js";
import type { PasswordComparer, PasswordHasher } from "./password-service.js";
import type { TokenIssuer } from "./token-service.js";

const CONFLICT_MESSAGES: Record<UserConflictField, string> = {
  email: "El correo electrónico ya está asociado a una cuenta",
  documentNumber: "El documento ya está asociado a una cuenta",
};

export interface MemberRegistrationService {
  registerMember(input: RegisterMemberInput): Promise<RegisteredMember>;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: Omit<AuthenticationUser, "passwordHash">;
}

export interface UserLoginService {
  login(input: LoginInput): Promise<LoginResponse>;
}

export interface PasswordManagementService {
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
}

export class AuthService
  implements MemberRegistrationService, UserLoginService, PasswordManagementService
{
  constructor(
    private readonly userRepository: UserRepositoryPort & PasswordRepositoryPort,
    private readonly passwordHasher: PasswordHasher & PasswordComparer,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const user = await this.userRepository.findPasswordUserById(userId);
    if (!user) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
    }

    const isCurrentPasswordValid = await this.passwordHasher.compare(
      input.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new ApplicationError(
        400,
        ERROR_CODE.INVALID_CURRENT_PASSWORD,
        "La contraseña actual es incorrecta",
      );
    }

    const isReusedPassword = await this.passwordHasher.compare(
      input.newPassword,
      user.passwordHash,
    );
    if (isReusedPassword) {
      throw new ApplicationError(
        400,
        ERROR_CODE.PASSWORD_REUSE,
        "La contraseña nueva debe ser diferente de la actual",
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.newPassword);
    await this.userRepository.changePassword(userId, passwordHash);
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const user = await this.userRepository.findByEmail(input.email.trim().toLowerCase());

    if (!user || !(await this.passwordHasher.compare(input.password, user.passwordHash))) {
      throw new ApplicationError(
        401,
        ERROR_CODE.INVALID_CREDENTIALS,
        "Correo electrónico o contraseña incorrectos",
      );
    }

    if (user.status !== "ACTIVE") {
      throw new ApplicationError(
        403,
        ERROR_CODE.ACCOUNT_INACTIVE,
        "La cuenta se encuentra inactiva",
      );
    }

    return {
      accessToken: this.tokenIssuer.sign({ id: user.id, role: user.role }),
      tokenType: "Bearer",
      expiresIn: this.tokenIssuer.expiresIn,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        isPasswordChangeRequired: user.isPasswordChangeRequired,
      },
    };
  }

  async registerMember(input: RegisterMemberInput): Promise<RegisteredMember> {
    const email = input.email.trim().toLowerCase();
    const documentNumber = input.documentNumber.replace(/\D/g, "");
    const conflict = await this.userRepository.findConflict(email, documentNumber);

    if (conflict) throw this.createConflictError(conflict);

    const passwordHash = await this.passwordHasher.hash(input.password);

    try {
      return await this.userRepository.createMember({
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        documentNumber,
        birthDate: new Date(`${input.birthDate}T00:00:00.000Z`),
        email,
        phone: input.phone.trim(),
        passwordHash,
        emergencyContactName: input.emergencyContactName?.trim() ?? "",
        emergencyContactPhone: input.emergencyContactPhone?.trim() ?? "",
      });
    } catch (error: unknown) {
      if (error instanceof DuplicateUserError) {
        throw this.createConflictError(error.field);
      }
      throw error;
    }
  }

  private createConflictError(field: UserConflictField): ApplicationError {
    return new ApplicationError(
      409,
      ERROR_CODE.CONFLICT,
      CONFLICT_MESSAGES[field],
      { field },
    );
  }
}

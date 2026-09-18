import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import {
  DuplicateUserError,
  type RegisteredMember,
  type UserConflictField,
  type UserRepositoryPort,
} from "../repository/user-repository.js";
import type { RegisterMemberInput } from "../validator/register-member-validator.js";
import type { PasswordHasher } from "./password-service.js";

const CONFLICT_MESSAGES: Record<UserConflictField, string> = {
  email: "El correo electrónico ya está asociado a una cuenta",
  documentNumber: "El documento ya está asociado a una cuenta",
};

export interface MemberRegistrationService {
  registerMember(input: RegisterMemberInput): Promise<RegisteredMember>;
}

export class AuthService implements MemberRegistrationService {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasher,
  ) {}

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

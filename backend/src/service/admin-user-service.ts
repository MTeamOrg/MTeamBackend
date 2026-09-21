import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { TemporaryPasswordRepositoryPort } from "../repository/user-repository.js";
import type { ResetPasswordInput } from "../validator/reset-password-validator.js";
import type { PasswordHasher } from "./password-service.js";

export interface TemporaryPasswordResetService {
  resetTemporaryPassword(
    userId: string,
    performedById: string,
    input: ResetPasswordInput,
  ): Promise<void>;
}

export class AdminUserService implements TemporaryPasswordResetService {
  constructor(
    private readonly userRepository: TemporaryPasswordRepositoryPort,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async resetTemporaryPassword(
    userId: string,
    performedById: string,
    input: ResetPasswordInput,
  ): Promise<void> {
    const target = await this.userRepository.findPasswordResetTargetById(userId);
    if (!target) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
    }

    const passwordHash = await this.passwordHasher.hash(input.temporaryPassword);
    await this.userRepository.resetTemporaryPassword(
      userId,
      performedById,
      passwordHash,
    );
  }
}

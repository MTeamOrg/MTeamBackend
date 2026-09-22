import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { UserNotFoundError } from "../repository/user-repository.js";
import type {
  AdminUserRepositoryPort,
  TemporaryPasswordRepositoryPort,
  UserAuditLogListResult,
  UserListItem,
  UserListResult,
  UpdateUserStatusData,
} from "../repository/user-repository.js";
import type { ResetPasswordInput } from "../validator/reset-password-validator.js";
import type {
  AdminUserListQueryInput,
  UpdateUserStatusInput,
} from "../validator/admin-user-validator.js";
import type { PasswordHasher } from "./password-service.js";

export interface TemporaryPasswordResetService {
  resetTemporaryPassword(
    userId: string,
    performedById: string,
    input: ResetPasswordInput,
  ): Promise<void>;
}

export interface AdminUserManagementService {
  listUsers(input: AdminUserListQueryInput): Promise<UserListResult>;
  updateUserStatus(
    userId: string,
    performedById: string,
    input: UpdateUserStatusInput,
  ): Promise<UserListItem>;
  listUserAuditLogs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<UserAuditLogListResult>;
}

export class AdminUserService
  implements TemporaryPasswordResetService, AdminUserManagementService
{
  constructor(
    private readonly userRepository: TemporaryPasswordRepositoryPort &
      AdminUserRepositoryPort,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  listUsers(input: AdminUserListQueryInput): Promise<UserListResult> {
    return this.userRepository.listUsers(input);
  }

  async updateUserStatus(
    userId: string,
    performedById: string,
    input: UpdateUserStatusInput,
  ): Promise<UserListItem> {
    const target = await this.userRepository.findUserById(userId);
    if (!target) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
    }
    const data: UpdateUserStatusData = input.reason === undefined
      ? { status: input.status }
      : { status: input.status, reason: input.reason };
    try {
      return await this.userRepository.updateUserStatus(userId, performedById, data);
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
      }
      throw error;
    }
  }

  async listUserAuditLogs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<UserAuditLogListResult> {
    const target = await this.userRepository.findUserById(userId);
    if (!target) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
    }
    return this.userRepository.listUserAuditLogs(userId, page, limit);
  }

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

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import {
  DuplicateUserError,
  UserNotFoundError,
} from "../repository/user-repository.js";
import type {
  AdminUserRepositoryPort,
  AdminUserDetail,
  CreateAdminUserData,
  TemporaryPasswordRepositoryPort,
  UserAuditLogListResult,
  UserListItem,
  UserListResult,
  UpdateAdminUserData,
  UpdateUserStatusData,
} from "../repository/user-repository.js";
import type { ResetPasswordInput } from "../validator/reset-password-validator.js";
import type {
  CreateAdminUserInput,
  AdminUserListQueryInput,
  UpdateAdminUserInput,
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
  getUser(userId: string): Promise<AdminUserDetail>;
  createUser(
    performedById: string,
    input: CreateAdminUserInput,
  ): Promise<AdminUserDetail>;
  updateUser(
    userId: string,
    performedById: string,
    input: UpdateAdminUserInput,
  ): Promise<AdminUserDetail>;
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

  async getUser(userId: string): Promise<AdminUserDetail> {
    const user = await this.userRepository.findAdminUserDetailById(userId);
    if (!user) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
    }
    return user;
  }

  async createUser(
    performedById: string,
    input: CreateAdminUserInput,
  ): Promise<AdminUserDetail> {
    const email = input.email.trim().toLowerCase();
    const documentNumber = input.documentNumber.replace(/\D/g, "");
    const conflict = await this.userRepository.findConflict(email, documentNumber);
    if (conflict) throw this.createConflictError(conflict);

    const passwordHash = await this.passwordHasher.hash(input.password);
    const data: CreateAdminUserData = {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      documentNumber,
      birthDate: new Date(`${input.birthDate}T00:00:00.000Z`),
      email,
      phone: input.phone.trim(),
      passwordHash,
      role: input.role,
    };
    if (input.role === "MEMBER") {
      data.memberProfile = {
        emergencyContactName: input.emergencyContactName?.trim() ?? "",
        emergencyContactPhone: input.emergencyContactPhone?.trim() ?? "",
      };
    }
    if (input.role === "TRAINER") {
      data.trainerProfile = {
        specialty: input.specialty.trim(),
        description: input.description.trim(),
      };
    }

    try {
      return await this.userRepository.createAdminUser(data, performedById);
    } catch (error: unknown) {
      if (error instanceof DuplicateUserError) {
        throw this.createConflictError(error.field);
      }
      throw error;
    }
  }

  async updateUser(
    userId: string,
    performedById: string,
    input: UpdateAdminUserInput,
  ): Promise<AdminUserDetail> {
    const current = await this.getUser(userId);
    const email = input.email === undefined ? undefined : input.email.trim().toLowerCase();
    const documentNumber = input.documentNumber === undefined
      ? undefined
      : input.documentNumber.replace(/\D/g, "");

    if (email !== undefined || documentNumber !== undefined) {
      const conflict = await this.userRepository.findConflictForUpdate(
        email,
        documentNumber,
        userId,
      );
      if (conflict) throw this.createConflictError(conflict);
    }

    const hasMemberFields =
      input.emergencyContactName !== undefined || input.emergencyContactPhone !== undefined;
    const hasTrainerFields = input.specialty !== undefined || input.description !== undefined;
    if (hasMemberFields && current.role !== "MEMBER") {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos de contacto de emergencia solo corresponden a socios",
        { fields: ["emergencyContactName", "emergencyContactPhone"] },
      );
    }
    if (hasTrainerFields && current.role !== "TRAINER") {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "La especialidad y descripción solo corresponden a entrenadores",
        { fields: ["specialty", "description"] },
      );
    }

    const data: UpdateAdminUserData = {};
    if (input.firstName !== undefined) data.firstName = input.firstName.trim();
    if (input.lastName !== undefined) data.lastName = input.lastName.trim();
    if (documentNumber !== undefined) data.documentNumber = documentNumber;
    if (input.birthDate !== undefined) {
      data.birthDate = new Date(`${input.birthDate}T00:00:00.000Z`);
    }
    if (email !== undefined) data.email = email;
    if (input.phone !== undefined) data.phone = input.phone.trim();
    if (input.emergencyContactName !== undefined) {
      data.emergencyContactName = input.emergencyContactName.trim();
    }
    if (input.emergencyContactPhone !== undefined) {
      data.emergencyContactPhone = input.emergencyContactPhone.trim();
    }
    if (input.specialty !== undefined) data.specialty = input.specialty.trim();
    if (input.description !== undefined) data.description = input.description.trim();
    if (input.reason !== undefined) data.reason = input.reason.trim();
    try {
      return await this.userRepository.updateAdminUser(userId, performedById, data);
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
      }
      if (error instanceof DuplicateUserError) {
        throw this.createConflictError(error.field);
      }
      throw error;
    }
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

  private createConflictError(field: "email" | "documentNumber"): ApplicationError {
    return new ApplicationError(
      409,
      ERROR_CODE.CONFLICT,
      field === "email"
        ? "El correo electrónico ya está asociado a una cuenta"
        : "El documento ya está asociado a una cuenta",
      { field },
    );
  }
}

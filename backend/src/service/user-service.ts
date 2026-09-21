import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { UserRole } from "../generated/prisma/client.js";
import {
  DuplicateUserError,
  type OwnProfile,
  type OwnProfileRepositoryPort,
  type RegisteredMember,
  type UpdateOwnProfileData,
} from "../repository/user-repository.js";
import type { AuthenticatedUser } from "../type/authenticated-request.js";
import type { UpdateOwnProfileInput } from "../validator/update-own-profile-validator.js";

export interface OwnProfileService {
  getCurrentIdentity(id: string): Promise<RegisteredMember>;
  getOwnProfile(id: string): Promise<OwnProfile>;
  updateOwnProfile(
    user: AuthenticatedUser,
    input: UpdateOwnProfileInput,
  ): Promise<OwnProfile>;
}

export class UserService implements OwnProfileService {
  constructor(private readonly userRepository: OwnProfileRepositoryPort) {}

  async getCurrentIdentity(id: string): Promise<RegisteredMember> {
    const profile = await this.getOwnProfile(id);
    const { memberProfile: _memberProfile, trainerProfile: _trainerProfile, ...identity } = profile;
    return identity;
  }

  async getOwnProfile(id: string): Promise<OwnProfile> {
    const profile = await this.userRepository.findOwnProfileById(id);
    if (!profile) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
    }
    return profile;
  }

  async updateOwnProfile(
    user: AuthenticatedUser,
    input: UpdateOwnProfileInput,
  ): Promise<OwnProfile> {
    this.validateRoleSpecificFields(user.role, input);
    const data: UpdateOwnProfileData = {};

    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      const ownerId = await this.userRepository.findEmailOwnerId(email);
      if (ownerId && ownerId !== user.id) throw this.createEmailConflict();
      data.email = email;
    }
    if (input.phone !== undefined) data.phone = input.phone.trim();
    if (input.emergencyContactName !== undefined) {
      data.emergencyContactName = input.emergencyContactName.trim();
    }
    if (input.emergencyContactPhone !== undefined) {
      data.emergencyContactPhone = input.emergencyContactPhone.trim();
    }

    try {
      return await this.userRepository.updateOwnProfile(user.id, user.role, data);
    } catch (error: unknown) {
      if (error instanceof DuplicateUserError) throw this.createEmailConflict();
      throw error;
    }
  }

  private validateRoleSpecificFields(
    role: UserRole,
    input: UpdateOwnProfileInput,
  ): void {
    const hasEmergencyContact =
      input.emergencyContactName !== undefined ||
      input.emergencyContactPhone !== undefined;
    if (role !== "MEMBER" && hasEmergencyContact) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "El contacto de emergencia solo corresponde a socios",
        { fields: ["emergencyContactName", "emergencyContactPhone"] },
      );
    }
  }

  private createEmailConflict(): ApplicationError {
    return new ApplicationError(
      409,
      ERROR_CODE.CONFLICT,
      "El correo electrónico ya está asociado a una cuenta",
      { field: "email" },
    );
  }
}

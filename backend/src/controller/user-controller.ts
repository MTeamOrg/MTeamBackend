import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { OwnProfile, RegisteredMember } from "../repository/user-repository.js";
import type { OwnProfileService } from "../service/user-service.js";
import { updateOwnProfileSchema } from "../validator/update-own-profile-validator.js";

function serializeUser<T extends RegisteredMember>(user: T): Omit<T, "birthDate"> & { birthDate: string } {
  return {
    ...user,
    birthDate: user.birthDate.toISOString().slice(0, 10),
  };
}

export class UserController {
  constructor(private readonly userService: OwnProfileService) {}

  getCurrentIdentity: RequestHandler = async (request, response) => {
    const identity = await this.userService.getCurrentIdentity(
      request.authenticatedUser!.id,
    );
    response.status(200).json(serializeUser(identity));
  };

  getOwnProfile: RequestHandler = async (request, response) => {
    const profile: OwnProfile = await this.userService.getOwnProfile(
      request.authenticatedUser!.id,
    );
    response.status(200).json(serializeUser(profile));
  };

  updateOwnProfile: RequestHandler = async (request, response) => {
    const validation = updateOwnProfileSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos del perfil no son válidos",
        validation.error.flatten(),
      );
    }

    const profile = await this.userService.updateOwnProfile(
      request.authenticatedUser!,
      validation.data,
    );
    response.status(200).json(serializeUser(profile));
  };
}

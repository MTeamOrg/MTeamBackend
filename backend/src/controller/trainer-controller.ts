import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { TrainerService } from "../service/trainer-service.js";
import { trainerListQuerySchema } from "../validator/trainer-validator.js";

export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  listTrainers: RequestHandler = async (request, response) => {
    const validation = trainerListQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los parámetros del listado de entrenadores no son válidos",
        validation.error.flatten(),
      );
    }

    response.status(200).json(await this.trainerService.listTrainers(validation.data));
  };
}

import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { ManagedScheduledClass } from "../repository/scheduled-class-repository.js";
import type { ScheduledClassService } from "../service/scheduled-class-service.js";
import {
  createScheduledClassSchema,
  scheduledClassIdParamsSchema,
  updateScheduledClassSchema,
} from "../validator/scheduled-class-validator.js";

function serializeClass(scheduledClass: ManagedScheduledClass) {
  return {
    ...scheduledClass,
    weekStartsOn: scheduledClass.weekStartsOn.toISOString().slice(0, 10),
    startsAt: scheduledClass.startsAt.toISOString(),
  };
}

export class ScheduledClassController {
  constructor(private readonly service: ScheduledClassService) {}

  createClass: RequestHandler = async (request, response) => {
    const validation = createScheduledClassSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los datos de la clase no son válidos", validation.error.flatten());
    }
    const scheduledClass = await this.service.createClass(validation.data);
    response.status(201).json(serializeClass(scheduledClass));
  };

  updateClass: RequestHandler = async (request, response) => {
    const paramsValidation = scheduledClassIdParamsSchema.safeParse(request.params);
    const bodyValidation = updateScheduledClassSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los datos para modificar la clase no son válidos", {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        });
    }
    const scheduledClass = await this.service.updateClass(
      paramsValidation.data.classId, bodyValidation.data,
    );
    response.status(200).json(serializeClass(scheduledClass));
  };

  deleteClass: RequestHandler = async (request, response) => {
    const validation = scheduledClassIdParamsSchema.safeParse(request.params);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "El identificador de la clase no es válido", validation.error.flatten());
    }
    await this.service.deleteClass(validation.data.classId);
    response.status(204).send();
  };
}

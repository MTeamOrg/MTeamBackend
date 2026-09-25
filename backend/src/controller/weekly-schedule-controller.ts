import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { localGymDate, localGymTime } from "../model/scheduled-class-week.js";
import type { WeeklyScheduleView } from "../repository/weekly-schedule-repository.js";
import type { WeeklyScheduleService } from "../service/weekly-schedule-service.js";
import {
  copyWeeklyScheduleSchema,
  weeklyScheduleIdParamsSchema,
  weeklyScheduleQuerySchema,
} from "../validator/weekly-schedule-validator.js";

function serializeSchedule(schedule: WeeklyScheduleView) {
  return {
    id: schedule.id,
    weekStartsOn: schedule.weekStartsOn.toISOString().slice(0, 10),
    classes: schedule.classes.map((scheduledClass) => ({
      id: scheduledClass.id,
      activity: scheduledClass.activity,
      day: localGymDate(scheduledClass.startsAt),
      startsAt: scheduledClass.startsAt.toISOString(),
      startTime: localGymTime(scheduledClass.startsAt).slice(0, 5),
      branch: scheduledClass.branch,
      trainer: scheduledClass.trainer,
    })),
  };
}

export class WeeklyScheduleController {
  constructor(private readonly service: WeeklyScheduleService) {}

  getByWeek: RequestHandler = async (request, response) => {
    const validation = weeklyScheduleQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "La semana solicitada no es válida", validation.error.flatten());
    }
    const schedule = await this.service.getByWeekStartsOn(validation.data.weekStartsOn);
    response.status(200).json(serializeSchedule(schedule));
  };

  getById: RequestHandler = async (request, response) => {
    const validation = weeklyScheduleIdParamsSchema.safeParse(request.params);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "El identificador del cronograma no es válido", validation.error.flatten());
    }
    const schedule = await this.service.getById(validation.data.scheduleId);
    response.status(200).json(serializeSchedule(schedule));
  };

  copy: RequestHandler = async (request, response) => {
    const paramsValidation = weeklyScheduleIdParamsSchema.safeParse(request.params);
    const bodyValidation = copyWeeklyScheduleSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los datos para copiar el cronograma no son válidos", {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        });
    }
    const schedule = await this.service.copySchedule(
      paramsValidation.data.scheduleId,
      bodyValidation.data.weekStartsOn,
    );
    response.status(201).json(serializeSchedule(schedule));
  };
}

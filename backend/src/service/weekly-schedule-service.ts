import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { currentGymWeekStartsOn } from "../model/scheduled-class-week.js";
import {
  BranchAssignmentError,
  HistoricalClassError,
  TrainerAssignmentError,
} from "../repository/scheduled-class-repository.js";
import {
  DestinationWeekAlreadyExistsError,
  PastDestinationWeekError,
  WeeklyScheduleNotFoundError,
  type WeeklyScheduleRepositoryPort,
  type WeeklyScheduleView,
} from "../repository/weekly-schedule-repository.js";

export class WeeklyScheduleService {
  constructor(private readonly repository: WeeklyScheduleRepositoryPort) {}

  getByWeekStartsOn(
    weekStartsOn: string | undefined,
    now = new Date(),
  ): Promise<WeeklyScheduleView> {
    return this.repository.findByWeekStartsOn(
      weekStartsOn ?? currentGymWeekStartsOn(now),
    );
  }

  async getById(id: string): Promise<WeeklyScheduleView> {
    const schedule = await this.repository.findById(id);
    if (!schedule) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El cronograma no existe");
    }
    return schedule;
  }

  async copySchedule(sourceScheduleId: string, destinationWeekStartsOn: string): Promise<WeeklyScheduleView> {
    try {
      return await this.repository.copySchedule(sourceScheduleId, destinationWeekStartsOn, new Date());
    } catch (error: unknown) {
      throw this.toApplicationError(error);
    }
  }

  private toApplicationError(error: unknown): Error {
    if (error instanceof WeeklyScheduleNotFoundError) {
      return new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El cronograma no existe");
    }
    if (error instanceof DestinationWeekAlreadyExistsError) {
      return new ApplicationError(409, ERROR_CODE.CONFLICT,
        "Ya existe un cronograma para la semana de destino");
    }
    if (error instanceof PastDestinationWeekError) {
      return new ApplicationError(409, ERROR_CODE.CONFLICT,
        "No se puede copiar hacia una semana pasada");
    }
    if (error instanceof HistoricalClassError) {
      return new ApplicationError(409, ERROR_CODE.CONFLICT,
        "No se pueden copiar clases que ya comenzaron");
    }
    if (error instanceof BranchAssignmentError) {
      return error.reason === "MISSING"
        ? new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La sede no existe")
        : new ApplicationError(409, ERROR_CODE.CONFLICT, "La sede está desactivada");
    }
    if (error instanceof TrainerAssignmentError) {
      if (error.reason === "MISSING") {
        return new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El entrenador no existe");
      }
      return error.reason === "INVALID"
        ? new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
          "El usuario indicado no es un entrenador")
        : new ApplicationError(409, ERROR_CODE.CONFLICT, "El entrenador está inactivo");
    }
    return error instanceof Error ? error : new Error("Error desconocido");
  }
}

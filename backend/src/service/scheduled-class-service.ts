import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import {
  BranchAssignmentError,
  ClassOutsideWeekError,
  HistoricalClassError,
  ScheduledClassNotFoundError,
  TrainerAssignmentError,
  type ManagedScheduledClass,
  type ScheduledClassRepositoryPort,
} from "../repository/scheduled-class-repository.js";
import type {
  CreateScheduledClassInput,
  UpdateScheduledClassInput,
} from "../validator/scheduled-class-validator.js";

export class ScheduledClassService {
  constructor(private readonly repository: ScheduledClassRepositoryPort) {}

  async createClass(input: CreateScheduledClassInput): Promise<ManagedScheduledClass> {
    try {
      return await this.repository.createClass(input, new Date());
    } catch (error: unknown) {
      throw this.toApplicationError(error);
    }
  }

  async updateClass(id: string, input: UpdateScheduledClassInput): Promise<ManagedScheduledClass> {
    try {
      return await this.repository.updateClass(id, input, new Date());
    } catch (error: unknown) {
      throw this.toApplicationError(error);
    }
  }

  async deleteClass(id: string): Promise<void> {
    try {
      await this.repository.deleteClass(id, new Date());
    } catch (error: unknown) {
      throw this.toApplicationError(error);
    }
  }

  private toApplicationError(error: unknown): Error {
    if (error instanceof ScheduledClassNotFoundError) {
      return new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La clase no existe");
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
    if (error instanceof ClassOutsideWeekError) {
      return new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "La clase debe estar dentro de su semana");
    }
    if (error instanceof HistoricalClassError) {
      return new ApplicationError(409, ERROR_CODE.CONFLICT,
        "No se pueden modificar clases que ya comenzaron");
    }
    return error instanceof Error ? error : new Error("Error desconocido");
  }
}

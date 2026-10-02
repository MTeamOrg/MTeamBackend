import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { UserRole } from "../generated/prisma/client.js";
import {
  EventInvalidStatusError,
  EventNotFoundError,
  type EventRepositoryPort,
} from "../repository/event-repository.js";
import type {
  CreateEventInput,
  EventListQuery,
  EventStatusUpdateInput,
  UpdateEventInput,
} from "../validator/event-validator.js";

export class EventService {
  constructor(private readonly repository: EventRepositoryPort) {}

  list(query: EventListQuery, role: UserRole) {
    return this.repository.list(query, role);
  }

  async get(id: string, role: UserRole) {
    const event = await this.repository.findById(id, role);
    if (!event) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El evento no existe");
    return event;
  }

  create(input: CreateEventInput, administratorId: string) {
    return this.repository.create(input, administratorId);
  }

  async update(id: string, input: UpdateEventInput) {
    try {
      return await this.repository.update(id, input);
    } catch (error: unknown) {
      if (error instanceof EventNotFoundError) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El evento no existe");
      throw error;
    }
  }

  async updateStatus(id: string, input: EventStatusUpdateInput) {
    try {
      return await this.repository.updateStatus(id, input);
    } catch (error: unknown) {
      if (error instanceof EventNotFoundError) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El evento no existe");
      if (error instanceof EventInvalidStatusError) throw new ApplicationError(409, ERROR_CODE.CONFLICT, "El estado del evento no permite esta operación");
      throw error;
    }
  }
}

import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { EventService } from "../service/event-service.js";
import {
  createEventSchema,
  eventIdParamsSchema,
  eventListQuerySchema,
  eventStatusUpdateSchema,
  updateEventSchema,
} from "../validator/event-validator.js";

function serializeEvent(event: Awaited<ReturnType<EventService["get"]>>) {
  return {
    ...event,
    startsAt: event.startsAt.toISOString(),
    displayStatus: event.status === "CANCELLED"
      ? "CANCELLED"
      : event.startsAt.getTime() <= Date.now() ? "FINISHED" : "UPCOMING",
  };
}

export class EventController {
  constructor(private readonly service: EventService) {}

  list: RequestHandler = async (request, response) => {
    const validation = eventListQuerySchema.safeParse(request.query);
    if (!validation.success) throw this.invalid(validation.error.flatten());
    const result = await this.service.list(validation.data, request.authenticatedUser!.role);
    response.status(200).json({ ...result, items: result.items.map(serializeEvent) });
  };

  get: RequestHandler = async (request, response) => {
    const params = eventIdParamsSchema.safeParse(request.params);
    if (!params.success) throw this.invalid(params.error.flatten());
    response.status(200).json(serializeEvent(await this.service.get(params.data.eventId, request.authenticatedUser!.role)));
  };

  create: RequestHandler = async (request, response) => {
    const validation = createEventSchema.safeParse(request.body);
    if (!validation.success) throw this.invalid(validation.error.flatten());
    response.status(201).json(serializeEvent(await this.service.create(validation.data, request.authenticatedUser!.id)));
  };

  update: RequestHandler = async (request, response) => {
    const params = eventIdParamsSchema.safeParse(request.params);
    const body = updateEventSchema.safeParse(request.body);
    if (!params.success || !body.success) throw this.invalid({ params: params.success ? null : params.error.flatten(), body: body.success ? null : body.error.flatten() });
    response.status(200).json(serializeEvent(await this.service.update(params.data.eventId, body.data)));
  };

  updateStatus: RequestHandler = async (request, response) => {
    const params = eventIdParamsSchema.safeParse(request.params);
    const body = eventStatusUpdateSchema.safeParse(request.body);
    if (!params.success || !body.success) throw this.invalid({ params: params.success ? null : params.error.flatten(), body: body.success ? null : body.error.flatten() });
    response.status(200).json(serializeEvent(await this.service.updateStatus(params.data.eventId, body.data)));
  };

  private invalid(details: unknown) {
    return new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR, "Los datos del evento no son válidos", details);
  }
}

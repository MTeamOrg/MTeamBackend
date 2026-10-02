import express, { type RequestHandler } from "express";
import request from "supertest";

import { EventController } from "../../src/controller/event-controller.js";
import { NewsPostController } from "../../src/controller/news-post-controller.js";
import { NotificationController } from "../../src/controller/notification-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createEventRouter } from "../../src/route/event-route.js";
import { createNewsPostRouter } from "../../src/route/news-post-route.js";
import { createNotificationRouter } from "../../src/route/notification-route.js";
import type { EventService } from "../../src/service/event-service.js";
import type { NewsPostService } from "../../src/service/news-post-service.js";
import type { NotificationService } from "../../src/service/notification-service.js";

const adminId = "a69a0192-a9a9-4936-8c79-bc5ff13d8dc2";
const memberId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const event = {
  id: "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84", title: "Torneo", description: "Torneo interno",
  startsAt: new Date("2030-09-01T15:00:00.000Z"), location: "Sede central", imageUrl: "https://example.com/event.jpg",
  status: "PUBLISHED" as const, createdById: adminId,
};
const post = {
  id: "e12101a5-e6ab-43f7-91b3-2b8fbfd67b84", title: "Feriado", content: "La sede permanecerá cerrada.",
  imageUrl: null, audience: "MEMBERS" as const, status: "PUBLISHED" as const,
  publishedAt: new Date("2030-08-01T12:00:00.000Z"), createdById: adminId,
};
const notification = {
  id: "d12101a5-e6ab-43f7-91b3-2b8fbfd67b84", userId: memberId, title: "Apto médico",
  message: "Tu apto fue aprobado.", type: "MEDICAL_CERTIFICATE_REVIEWED" as const,
  createdAt: new Date("2030-08-01T12:00:00.000Z"), readAt: null,
};

function auth(role: UserRole | null): RequestHandler {
  return (request, _response, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    request.authenticatedUser = { id: role === "ADMIN" ? adminId : memberId, role, isPasswordChangeRequired: false };
    next();
  };
}

function setup(role: UserRole | null) {
  const eventService = {
    list: jest.fn().mockResolvedValue({ items: [event], page: 1, limit: 20, total: 1 }),
    get: jest.fn().mockResolvedValue(event), create: jest.fn().mockResolvedValue(event),
    update: jest.fn().mockResolvedValue(event), updateStatus: jest.fn().mockResolvedValue(event),
  } as unknown as EventService;
  const newsService = {
    list: jest.fn().mockResolvedValue({ items: [post], page: 1, limit: 20, total: 1 }),
    get: jest.fn().mockResolvedValue(post), create: jest.fn().mockResolvedValue(post),
    update: jest.fn().mockResolvedValue(post), updateStatus: jest.fn().mockResolvedValue(post),
  } as unknown as NewsPostService;
  const notificationService = {
    listOwn: jest.fn().mockResolvedValue({ items: [notification], page: 1, limit: 20, total: 1 }),
    getOwn: jest.fn().mockResolvedValue(notification), markOwnAsRead: jest.fn().mockResolvedValue(undefined),
    markAllOwnAsRead: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
  const app = express();
  app.use(express.json());
  app.use("/api", createEventRouter(new EventController(eventService), auth(role), requirePasswordChangeCompleted));
  app.use("/api", createNewsPostRouter(new NewsPostController(newsService), auth(role), requirePasswordChangeCompleted));
  app.use("/api", createNotificationRouter(new NotificationController(notificationService), auth(role), requirePasswordChangeCompleted));
  app.use(errorMiddleware);
  return { app, eventService, newsService, notificationService };
}

describe("communications routes", () => {
  test("members can consult events, news and only their own notifications", async () => {
    const { app, eventService, newsService, notificationService } = setup("MEMBER");
    expect((await request(app).get("/api/events")).status).toBe(200);
    expect((await request(app).get("/api/news-posts")).status).toBe(200);
    expect((await request(app).get("/api/notifications")).status).toBe(200);
    expect(notificationService.listOwn).toHaveBeenCalledWith(memberId, { page: 1, limit: 20 });
    expect(eventService.list).toHaveBeenCalledWith({ page: 1, limit: 20 }, "MEMBER");
    expect(newsService.list).toHaveBeenCalledWith({ page: 1, limit: 20 }, "MEMBER");
  });

  test("only administrators can manage events and news", async () => {
    const member = setup("MEMBER");
    expect((await request(member.app).post("/api/events").send({})).status).toBe(403);
    expect((await request(member.app).post("/api/news-posts").send({})).status).toBe(403);
    expect((await request(member.app).patch(`/api/events/${event.id}/status`).send({ status: "CANCELLED" })).status).toBe(403);

    const admin = setup("ADMIN");
    expect((await request(admin.app).post("/api/events").send({ title: "T", description: "D", startsAt: event.startsAt.toISOString(), location: "S", imageUrl: event.imageUrl })).status).toBe(201);
    expect((await request(admin.app).post("/api/news-posts").send({ title: "T", content: "C", audience: "ALL" })).status).toBe(201);
    expect(admin.eventService.create).toHaveBeenCalledWith(expect.objectContaining({ status: "DRAFT" }), adminId);
  });

  test("validates required publication data and protects read operations", async () => {
    const admin = setup("ADMIN");
    expect((await request(admin.app).post("/api/events").send({ title: "Sin fecha" })).status).toBe(400);
    expect((await request(admin.app).post("/api/news-posts").send({ title: "Sin audiencia", content: "C" })).status).toBe(400);
    expect((await request(setup(null).app).get("/api/notifications")).status).toBe(401);
  });

  test("marks one notification as read without accepting another user's id", async () => {
    const { app, notificationService } = setup("MEMBER");
    expect((await request(app).patch(`/api/notifications/${notification.id}/read-status`)).status).toBe(204);
    expect(notificationService.markOwnAsRead).toHaveBeenCalledWith(notification.id, memberId);
  });
});

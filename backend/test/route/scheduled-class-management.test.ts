import express, { type RequestHandler } from "express";
import request from "supertest";

import { ScheduledClassController } from "../../src/controller/scheduled-class-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createScheduledClassRouter } from "../../src/route/scheduled-class-route.js";
import type { ScheduledClassService } from "../../src/service/scheduled-class-service.js";

const classId = "eb3bc849-5234-48a3-b54a-9f9e38608de2";
const branchId = "83cd902e-0475-4c92-943c-129b751dacee";
const trainerId = "e05a6f56-6db7-4be2-8a90-ce63830af177";
const weekStartsOn = "2030-09-02";
const startsAt = "2030-09-02T10:00:00-03:00";
const body = { weekStartsOn, activity: "Yoga", startsAt, branchId, trainerId };
const scheduledClass = {
  id: classId, scheduleId: "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84",
  weekStartsOn: new Date("2030-09-02T00:00:00.000Z"),
  activity: "Yoga", startsAt: new Date("2030-09-02T13:00:00.000Z"),
  branchId, trainerId,
};

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    createClass: jest.fn().mockResolvedValue(scheduledClass),
    updateClass: jest.fn().mockResolvedValue(scheduledClass),
    deleteClass: jest.fn().mockResolvedValue(undefined),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = { id: "212a6da6-063c-44c9-b63c-1d67602cb487",
      role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createScheduledClassRouter(
    new ScheduledClassController(service as unknown as ScheduledClassService),
    authenticate, requirePasswordChangeCompleted));
  app.use(errorMiddleware);
  return { app, service };
}

describe("CLA-02 scheduled class routes", () => {
  test("creates a class and serializes its week and start time", async () => {
    const { app, service } = setup();
    const response = await request(app).post("/api/scheduled-classes").send(body);
    expect(response.status).toBe(201);
    expect(service.createClass).toHaveBeenCalledWith(body);
    expect(response.body).toEqual({ ...scheduledClass,
      weekStartsOn, startsAt: "2030-09-02T13:00:00.000Z" });
  });

  test.each([
    { ...body, weekStartsOn: "2030-09-03" },
    { ...body, startsAt: "2030-09-02T01:00:00Z" },
    { ...body, startsAt: "2030-09-09T00:00:00-03:00" },
    { ...body, startsAt: "2030-09-02T10:00:00" },
    { ...body, branchId: "invalid" },
    { ...body, trainerId: "invalid" },
    { ...body, activity: " " },
    { ...body, extra: "x" },
  ])("rejects invalid creation data %p", async (invalidBody) => {
    const { app, service } = setup();
    expect((await request(app).post("/api/scheduled-classes")
      .send(invalidBody)).status).toBe(400);
    expect(service.createClass).not.toHaveBeenCalled();
  });

  test("updates a class and accepts an unassigned trainer", async () => {
    const { app, service } = setup();
    service.updateClass.mockResolvedValue({ ...scheduledClass, trainerId: null });
    const response = await request(app).patch(`/api/scheduled-classes/${classId}`)
      .send({ activity: "Pilates", trainerId: null });
    expect(response.status).toBe(200);
    expect(service.updateClass).toHaveBeenCalledWith(classId,
      { activity: "Pilates", trainerId: null });
    expect(response.body.trainerId).toBeNull();
  });

  test.each([{}, { trainerId: "invalid" }, { weekStartsOn }, { extra: "x" }])(
    "rejects invalid update body %p", async (invalidBody) => {
      const { app, service } = setup();
      expect((await request(app).patch(`/api/scheduled-classes/${classId}`)
        .send(invalidBody)).status).toBe(400);
      expect(service.updateClass).not.toHaveBeenCalled();
    },
  );

  test("deletes a class with 204 and validates identifiers", async () => {
    const { app, service } = setup();
    expect((await request(app).delete("/api/scheduled-classes/invalid")).status).toBe(400);
    const response = await request(app).delete(`/api/scheduled-classes/${classId}`);
    expect(response.status).toBe(204);
    expect(service.deleteClass).toHaveBeenCalledWith(classId);
  });

  test("propagates a missing class as 404", async () => {
    const { app, service } = setup();
    service.updateClass.mockRejectedValue(new ApplicationError(
      404, ERROR_CODE.NOT_FOUND, "La clase no existe"));
    expect((await request(app).patch(`/api/scheduled-classes/${classId}`)
      .send({ activity: "Pilates" })).status).toBe(404);
  });
});

describe("CLA-02/03 permissions", () => {
  test.each([
    [null, false, 401], ["MEMBER", false, 403], ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("requires an admin for role %s and pending password %s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    expect((await request(app).post("/api/scheduled-classes").send(body)).status)
      .toBe(status);
    expect((await request(app).patch(`/api/scheduled-classes/${classId}`)
      .send({ activity: "Pilates" })).status).toBe(status);
    expect((await request(app).delete(`/api/scheduled-classes/${classId}`)).status)
      .toBe(status);
    expect(service.createClass).not.toHaveBeenCalled();
    expect(service.updateClass).not.toHaveBeenCalled();
    expect(service.deleteClass).not.toHaveBeenCalled();
  });
});

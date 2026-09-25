import express, { type RequestHandler } from "express";
import request from "supertest";

import { WeeklyScheduleController } from "../../src/controller/weekly-schedule-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createWeeklyScheduleRouter } from "../../src/route/weekly-schedule-route.js";
import type { WeeklyScheduleService } from "../../src/service/weekly-schedule-service.js";

const scheduleId = "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84";
const classId = "eb3bc849-5234-48a3-b54a-9f9e38608de2";
const branchId = "83cd902e-0475-4c92-943c-129b751dacee";
const trainerId = "e05a6f56-6db7-4be2-8a90-ce63830af177";
const weekStartsOn = "2030-09-02";

const schedule = {
  id: scheduleId,
  weekStartsOn: new Date(`${weekStartsOn}T00:00:00.000Z`),
  classes: [{
    id: classId,
    activity: "Yoga",
    startsAt: new Date("2030-09-02T13:00:00.000Z"),
    branch: { id: branchId, name: "Centro" },
    trainer: { id: trainerId, firstName: "Ana", lastName: "García" },
  }],
};

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    getByWeekStartsOn: jest.fn().mockResolvedValue(schedule),
    getById: jest.fn().mockResolvedValue(schedule),
    copySchedule: jest.fn().mockResolvedValue(schedule),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    request.authenticatedUser = {
      id: "212a6da6-063c-44c9-b63c-1d67602cb487",
      role,
      isPasswordChangeRequired: passwordChangeRequired,
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createWeeklyScheduleRouter(
    new WeeklyScheduleController(service as unknown as WeeklyScheduleService),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use(errorMiddleware);
  return { app, service };
}

describe("CLA-01 weekly schedule consultation", () => {
  test("consults an existing schedule and serializes the optional trainer", async () => {
    const { app, service } = setup();
    const response = await request(app).get(`/api/weekly-schedules?weekStartsOn=${weekStartsOn}`);
    expect(response.status).toBe(200);
    expect(service.getByWeekStartsOn).toHaveBeenCalledWith(weekStartsOn);
    expect(response.body).toEqual({
      id: scheduleId,
      weekStartsOn,
      classes: [{
        id: classId,
        activity: "Yoga",
        startsAt: "2030-09-02T13:00:00.000Z",
        branch: { id: branchId, name: "Centro" },
        trainer: { id: trainerId, firstName: "Ana", lastName: "García" },
      }],
    });
  });

  test("returns an empty schedule when the week has no classes", async () => {
    const { app, service } = setup();
    service.getByWeekStartsOn.mockResolvedValue({
      id: null,
      weekStartsOn: new Date(`${weekStartsOn}T00:00:00.000Z`),
      classes: [],
    });
    const response = await request(app).get(`/api/weekly-schedules?weekStartsOn=${weekStartsOn}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: null, weekStartsOn, classes: [] });
  });

  test("rejects invalid dates, non-Mondays and missing query dates", async () => {
    const { app, service } = setup();
    for (const query of ["2030-09-03", "2030-02-30", undefined]) {
      const url = query ? `/api/weekly-schedules?weekStartsOn=${query}` : "/api/weekly-schedules";
      expect((await request(app).get(url)).status).toBe(400);
    }
    expect(service.getByWeekStartsOn).not.toHaveBeenCalled();
  });

  test("gets a schedule by identifier", async () => {
    const { app, service } = setup();
    const response = await request(app).get(`/api/weekly-schedules/${scheduleId}`);
    expect(response.status).toBe(200);
    expect(service.getById).toHaveBeenCalledWith(scheduleId);
  });
});

describe("CLA-04 weekly schedule copy permissions", () => {
  test.each([
    [null, false, 401], ["MEMBER", false, 403], ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("allows only an authenticated admin with a changed password: %s/%s", async (
    role, pending, status,
  ) => {
    const { app, service } = setup(role, pending);
    expect((await request(app).post(`/api/weekly-schedules/${scheduleId}/copies`)
      .send({ weekStartsOn: "2030-09-09" })).status).toBe(status);
    expect(service.copySchedule).not.toHaveBeenCalled();
  });

  test("validates the destination week before invoking the service", async () => {
    const { app, service } = setup();
    for (const destination of ["2030-09-10", "2030-02-30"]) {
      expect((await request(app).post(`/api/weekly-schedules/${scheduleId}/copies`)
        .send({ weekStartsOn: destination })).status).toBe(400);
    }
    expect(service.copySchedule).not.toHaveBeenCalled();
  });

  test("copies a schedule for an admin", async () => {
    const { app, service } = setup();
    const response = await request(app).post(`/api/weekly-schedules/${scheduleId}/copies`)
      .send({ weekStartsOn: "2030-09-09" });
    expect(response.status).toBe(201);
    expect(service.copySchedule).toHaveBeenCalledWith(scheduleId, "2030-09-09");
  });
});

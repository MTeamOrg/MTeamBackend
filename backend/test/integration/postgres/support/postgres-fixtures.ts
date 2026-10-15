import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import express from "express";

import { EventController } from "../../../../src/controller/event-controller.js";
import { MedicalCertificateController } from "../../../../src/controller/medical-certificate-controller.js";
import { MembershipPriceController } from "../../../../src/controller/membership-price-controller.js";
import { NotificationController } from "../../../../src/controller/notification-controller.js";
import { ScheduledClassController } from "../../../../src/controller/scheduled-class-controller.js";
import { WeeklyScheduleController } from "../../../../src/controller/weekly-schedule-controller.js";
import { PrismaClient, type UserRole } from "../../../../src/generated/prisma/client.js";
import { createAuthenticationMiddleware } from "../../../../src/middleware/authentication-middleware.js";
import { errorMiddleware } from "../../../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../../../src/middleware/password-change-middleware.js";
import { EventRepository } from "../../../../src/repository/event-repository.js";
import { MedicalCertificateRepository } from "../../../../src/repository/medical-certificate-repository.js";
import { MemberMembershipRepository } from "../../../../src/repository/member-membership-repository.js";
import { MembershipPriceRepository } from "../../../../src/repository/membership-price-repository.js";
import { NotificationRepository } from "../../../../src/repository/notification-repository.js";
import { ScheduledClassRepository } from "../../../../src/repository/scheduled-class-repository.js";
import { UserRepository } from "../../../../src/repository/user-repository.js";
import { WeeklyScheduleRepository } from "../../../../src/repository/weekly-schedule-repository.js";
import { createEventRouter } from "../../../../src/route/event-route.js";
import { createMedicalCertificateRouter } from "../../../../src/route/medical-certificate-route.js";
import { createMembershipPriceRouter } from "../../../../src/route/membership-price-route.js";
import { createNotificationRouter } from "../../../../src/route/notification-route.js";
import { createScheduledClassRouter } from "../../../../src/route/scheduled-class-route.js";
import { createWeeklyScheduleRouter } from "../../../../src/route/weekly-schedule-route.js";
import { EventService } from "../../../../src/service/event-service.js";
import { MedicalCertificateService } from "../../../../src/service/medical-certificate-service.js";
import { MembershipPriceService } from "../../../../src/service/membership-price-service.js";
import { NotificationService } from "../../../../src/service/notification-service.js";
import { ScheduledClassService } from "../../../../src/service/scheduled-class-service.js";
import { TokenService } from "../../../../src/service/token-service.js";
import { WeeklyScheduleService } from "../../../../src/service/weekly-schedule-service.js";

const connectionString = process.env.NOTIFICATION_TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("Set NOTIFICATION_TEST_DATABASE_URL to a disposable local PostgreSQL database before running this integration test.");
}

const parsedConnectionString = new URL(connectionString);
const databaseName = decodeURIComponent(parsedConnectionString.pathname.slice(1)).toLowerCase();
if (!(["localhost", "127.0.0.1"].includes(parsedConnectionString.hostname) && databaseName.includes("test"))) {
  throw new Error("Notification integration tests only accept a loopback PostgreSQL database with 'test' in its name.");
}

export const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const JWT_TEST_SECRET = "postgres-integration-only-secret";
const tokenService = new TokenService(JWT_TEST_SECRET, 3600);

export type TestUser = { id: string; role: UserRole };

/** Stands in for Supabase Storage: the review flow never touches files. */
const unusedStorage = {
  upload: async () => undefined,
  createSignedUrl: async () => "https://storage.example.test/unused",
  remove: async () => undefined,
};

/** Real routers, controllers, services, repositories and authentication; only the process wiring is test-local. */
export function createIntegrationApp(options: { now?: () => Date } = {}) {
  const authenticate = createAuthenticationMiddleware(tokenService, new UserRepository(database));
  const app = express();
  app.use(express.json());
  app.use("/api", createNotificationRouter(
    new NotificationController(new NotificationService(new NotificationRepository(database), options.now)),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createScheduledClassRouter(
    new ScheduledClassController(new ScheduledClassService(new ScheduledClassRepository(database))),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createWeeklyScheduleRouter(
    new WeeklyScheduleController(new WeeklyScheduleService(new WeeklyScheduleRepository(database))),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createEventRouter(
    new EventController(new EventService(new EventRepository(database))),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createMembershipPriceRouter(
    new MembershipPriceController(new MembershipPriceService(new MembershipPriceRepository(database))),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createMedicalCertificateRouter(
    new MedicalCertificateController(new MedicalCertificateService(
      new MedicalCertificateRepository(database),
      new MemberMembershipRepository(database),
      unusedStorage,
    )),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use(errorMiddleware);
  return app;
}

export function bearer(user: TestUser): { Authorization: string } {
  return { Authorization: `Bearer ${tokenService.sign(user)}` };
}

/** Creates disposable rows and removes exactly those rows afterwards (never a blanket delete). */
export function createFixtures() {
  const userIds: string[] = [];
  const branchIds: string[] = [];
  const scheduleIds: string[] = [];
  const classIds: string[] = [];
  const eventIds: string[] = [];
  const priceIds: string[] = [];
  const certificateIds: string[] = [];
  const paymentIds: string[] = [];

  async function user(role: UserRole, overrides: { status?: "ACTIVE" | "INACTIVE"; isPasswordChangeRequired?: boolean } = {}): Promise<TestUser> {
    const unique = randomUUID();
    const created = await database.user.create({
      data: {
        firstName: "Notification",
        lastName: "Integration",
        documentNumber: unique.replaceAll("-", "").slice(0, 28),
        birthDate: new Date("1990-01-01T00:00:00.000Z"),
        email: `${unique}@example.test`,
        phone: "555-0100",
        passwordHash: "test-only-hash",
        role,
        status: overrides.status ?? "ACTIVE",
        isPasswordChangeRequired: overrides.isPasswordChangeRequired ?? false,
        ...(role === "TRAINER" ? {
          trainerProfile: { create: { specialty: "Fitness", description: "PostgreSQL integration fixture" } },
        } : {}),
        ...(role === "MEMBER" ? {
          memberProfile: { create: { emergencyContactName: "Contacto", emergencyContactPhone: "555-0101" } },
        } : {}),
      },
      select: { id: true, role: true },
    });
    userIds.push(created.id);
    return created;
  }

  async function branch(name = `Notification ${randomUUID()}`): Promise<{ id: string; name: string }> {
    const created = await database.branch.create({
      data: {
        name,
        description: "PostgreSQL integration fixture",
        imageUrl: "https://example.test/branch.png",
        address: `Notification test ${randomUUID()}`,
        openingHours: "08:00-20:00",
        phone: "555-0100",
      },
      select: { id: true, name: true },
    });
    branchIds.push(created.id);
    return created;
  }

  async function scheduledClass(input: {
    weekStartsOn: string;
    startsAt: string;
    branchId: string;
    trainerId: string | null;
    activity?: string;
  }): Promise<{ id: string }> {
    const weekStartsOnDate = new Date(`${input.weekStartsOn}T00:00:00.000Z`);
    const schedule = await database.weeklySchedule.upsert({
      where: { weekStartsOn: weekStartsOnDate },
      update: {},
      create: { weekStartsOn: weekStartsOnDate },
      select: { id: true },
    });
    scheduleIds.push(schedule.id);
    const created = await database.scheduledClass.create({
      data: {
        scheduleId: schedule.id,
        branchId: input.branchId,
        trainerId: input.trainerId,
        activity: input.activity ?? "Yoga",
        startsAt: new Date(input.startsAt),
      },
      select: { id: true },
    });
    classIds.push(created.id);
    return created;
  }

  /** Ensures the classes created through the API are also removed afterwards. */
  async function trackClassesOf(branchId: string): Promise<void> {
    const found = await database.scheduledClass.findMany({ where: { branchId }, select: { id: true, scheduleId: true } });
    for (const item of found) {
      if (!classIds.includes(item.id)) classIds.push(item.id);
      if (!scheduleIds.includes(item.scheduleId)) scheduleIds.push(item.scheduleId);
    }
  }

  async function event(adminId: string, status: "DRAFT" | "PUBLISHED" | "CANCELLED", startsAt = "2036-03-04T21:30:00.000Z") {
    const created = await database.event.create({
      data: {
        title: `Torneo ${randomUUID()}`,
        description: "PostgreSQL integration fixture",
        startsAt: new Date(startsAt),
        location: "Sede central",
        imageUrl: "https://example.test/event.png",
        status,
        createdById: adminId,
      },
      select: { id: true, title: true },
    });
    eventIds.push(created.id);
    return created;
  }

  async function price(adminId: string, amount: string, effectiveFrom: string) {
    const created = await database.membershipPrice.create({
      data: { amount, effectiveFrom: new Date(effectiveFrom), createdById: adminId },
      select: { id: true },
    });
    priceIds.push(created.id);
    return created;
  }

  async function trackPricesBy(adminId: string): Promise<void> {
    const found = await database.membershipPrice.findMany({ where: { createdById: adminId }, select: { id: true } });
    for (const item of found) if (!priceIds.includes(item.id)) priceIds.push(item.id);
  }

  async function pendingCertificate(memberId: string) {
    const created = await database.medicalCertificate.create({
      data: { memberId, fileUrl: `${memberId}/fixture.pdf`, status: "PENDING" },
      select: { id: true },
    });
    certificateIds.push(created.id);
    return created;
  }

  async function accreditedPayment(memberId: string, adminId: string, accreditedAt: string, expiresAt: string) {
    const created = await database.payment.create({
      data: {
        memberId,
        amount: "20000.00",
        method: "CASH",
        status: "ACCREDITED",
        createdById: adminId,
        confirmedById: adminId,
        accreditedAt: new Date(accreditedAt),
        expiresAt: new Date(expiresAt),
      },
      select: { id: true },
    });
    paymentIds.push(created.id);
    return created;
  }

  async function cleanup(): Promise<void> {
    if (userIds.length) await database.notification.deleteMany({ where: { userId: { in: userIds } } });
    if (certificateIds.length) await database.medicalCertificate.deleteMany({ where: { id: { in: certificateIds } } });
    if (userIds.length) await database.medicalCertificate.deleteMany({ where: { memberId: { in: userIds } } });
    if (paymentIds.length) await database.payment.deleteMany({ where: { id: { in: paymentIds } } });
    if (priceIds.length) await database.membershipPrice.deleteMany({ where: { id: { in: priceIds } } });
    if (eventIds.length) await database.event.deleteMany({ where: { id: { in: eventIds } } });
    if (classIds.length) await database.scheduledClass.deleteMany({ where: { id: { in: classIds } } });
    if (scheduleIds.length) await database.weeklySchedule.deleteMany({ where: { id: { in: scheduleIds } } });
    if (branchIds.length) await database.branch.deleteMany({ where: { id: { in: branchIds } } });
    if (userIds.length) {
      await database.trainerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await database.memberProfile.deleteMany({ where: { userId: { in: userIds } } });
      await database.user.deleteMany({ where: { id: { in: userIds } } });
    }
    for (const list of [userIds, branchIds, scheduleIds, classIds, eventIds, priceIds, certificateIds, paymentIds]) list.length = 0;
  }

  return { user, branch, scheduledClass, trackClassesOf, event, price, trackPricesBy, pendingCertificate, accreditedPayment, cleanup };
}

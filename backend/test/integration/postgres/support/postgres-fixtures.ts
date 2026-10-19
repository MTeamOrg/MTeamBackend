import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import express from "express";
import jwt from "jsonwebtoken";

import { AdminUserController } from "../../../../src/controller/admin-user-controller.js";
import { AccessAttemptController } from "../../../../src/controller/access-attempt-controller.js";
import { AuthController } from "../../../../src/controller/auth-controller.js";
import { EventController } from "../../../../src/controller/event-controller.js";
import { MedicalCertificateController } from "../../../../src/controller/medical-certificate-controller.js";
import { MembershipPriceController } from "../../../../src/controller/membership-price-controller.js";
import { NewsPostController } from "../../../../src/controller/news-post-controller.js";
import { NotificationController } from "../../../../src/controller/notification-controller.js";
import { PaymentController } from "../../../../src/controller/payment-controller.js";
import { ScheduledClassController } from "../../../../src/controller/scheduled-class-controller.js";
import { WeeklyScheduleController } from "../../../../src/controller/weekly-schedule-controller.js";
import { PrismaClient, type UserRole } from "../../../../src/generated/prisma/client.js";
import { createAuthenticationMiddleware } from "../../../../src/middleware/authentication-middleware.js";
import { errorMiddleware } from "../../../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../../../src/middleware/password-change-middleware.js";
import { EventRepository } from "../../../../src/repository/event-repository.js";
import { AccessAttemptRepository } from "../../../../src/repository/access-attempt-repository.js";
import { MedicalCertificateRepository } from "../../../../src/repository/medical-certificate-repository.js";
import { MemberMembershipRepository } from "../../../../src/repository/member-membership-repository.js";
import { MembershipPriceRepository } from "../../../../src/repository/membership-price-repository.js";
import { NewsPostRepository } from "../../../../src/repository/news-post-repository.js";
import { NotificationRepository } from "../../../../src/repository/notification-repository.js";
import { PaymentRepository } from "../../../../src/repository/payment-repository.js";
import { ScheduledClassRepository } from "../../../../src/repository/scheduled-class-repository.js";
import { UserRepository } from "../../../../src/repository/user-repository.js";
import { WeeklyScheduleRepository } from "../../../../src/repository/weekly-schedule-repository.js";
import { createAdminUserRouter } from "../../../../src/route/admin-user-route.js";
import { createAccessAttemptRouter } from "../../../../src/route/access-attempt-route.js";
import { createAuthRouter, createProtectedAuthRouter } from "../../../../src/route/auth-route.js";
import { createEventRouter } from "../../../../src/route/event-route.js";
import { createMedicalCertificateRouter } from "../../../../src/route/medical-certificate-route.js";
import { createMembershipPriceRouter } from "../../../../src/route/membership-price-route.js";
import { createNewsPostRouter } from "../../../../src/route/news-post-route.js";
import { createNotificationRouter } from "../../../../src/route/notification-route.js";
import { createPaymentRouter } from "../../../../src/route/payment-route.js";
import { createScheduledClassRouter } from "../../../../src/route/scheduled-class-route.js";
import { createWeeklyScheduleRouter } from "../../../../src/route/weekly-schedule-route.js";
import { AdminUserService } from "../../../../src/service/admin-user-service.js";
import { AccessAttemptService } from "../../../../src/service/access-attempt-service.js";
import { AuthService } from "../../../../src/service/auth-service.js";
import { EventService } from "../../../../src/service/event-service.js";
import { MedicalCertificateService } from "../../../../src/service/medical-certificate-service.js";
import { MembershipPriceService } from "../../../../src/service/membership-price-service.js";
import { NewsPostService } from "../../../../src/service/news-post-service.js";
import { NotificationService } from "../../../../src/service/notification-service.js";
import { PaymentService } from "../../../../src/service/payment-service.js";
import { PasswordService } from "../../../../src/service/password-service.js";
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

/** Each call is a separate connection pool, like a freshly started process. */
export function createDatabaseClient(options: { defaultTransactionTimeoutMs?: number } = {}): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    ...(options.defaultTransactionTimeoutMs === undefined
      ? {}
      : { transactionOptions: { timeout: options.defaultTransactionTimeoutMs } }),
  });
}

export const database = createDatabaseClient();
const defaultDatabase = database;

const BULK_EMAIL_SUFFIX = "@fixture-bulk.test";
const JWT_TEST_SECRET = "postgres-integration-only-secret";
const tokenService = new TokenService(JWT_TEST_SECRET, 3600);

export type TestUser = { id: string; role: UserRole; email: string };

/** Stands in for Supabase Storage: the review flow never touches files. */
const unusedStorage = {
  upload: async () => undefined,
  createSignedUrl: async () => "https://storage.example.test/unused",
  remove: async () => undefined,
};

/** Real routers, controllers, services, repositories and authentication; only the process wiring is test-local. */
export function createIntegrationApp(options: { now?: () => Date; database?: PrismaClient } = {}) {
  const database = options.database ?? defaultDatabase;
  const users = new UserRepository(database);
  const passwordService = new PasswordService();
  const authenticate = createAuthenticationMiddleware(tokenService, users);
  const app = express();
  app.use(express.json());
  const authController = new AuthController(new AuthService(users, passwordService, tokenService));
  app.use("/api", createAuthRouter(authController));
  app.use("/api", createProtectedAuthRouter(authController, authenticate));
  app.use("/api", createAdminUserRouter(
    new AdminUserController(new AdminUserService(users, passwordService)),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createAccessAttemptRouter(
    new AccessAttemptController(new AccessAttemptService(new AccessAttemptRepository(database))),
    authenticate,
    requirePasswordChangeCompleted,
    tokenService,
    users,
  ));
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
  app.use("/api", createNewsPostRouter(
    new NewsPostController(new NewsPostService(new NewsPostRepository(database))),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createMembershipPriceRouter(
    new MembershipPriceController(new MembershipPriceService(new MembershipPriceRepository(database))),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use("/api", createPaymentRouter(
    new PaymentController(new PaymentService(new PaymentRepository(database))),
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

/** `sessionVersion` is the one the session was issued with (0 for a session that was never revoked). */
export function bearer(user: TestUser, options: { sessionVersion?: number } = {}): { Authorization: string } {
  return { Authorization: `Bearer ${tokenService.sign({ ...user, sessionVersion: options.sessionVersion })}` };
}

/** A token with the right shape but a wrong secret or an expiry in the past. */
export function untrustedBearer(user: TestUser, options: { secret?: string; expiresInSeconds?: number } = {}): { Authorization: string } {
  const token = jwt.sign({ sub: user.id, role: user.role }, options.secret ?? JWT_TEST_SECRET, {
    algorithm: "HS256",
    expiresIn: options.expiresInSeconds ?? 3600,
  });
  return { Authorization: `Bearer ${token}` };
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
  const accessPointIds: string[] = [];
  const accessLogIds: string[] = [];
  const paymentIds: string[] = [];
  const newsPostIds: string[] = [];
  const bulkRunId = randomUUID().replaceAll("-", "").slice(0, 8);
  let usedBulkMembers = false;

  async function user(role: UserRole, overrides: {
    status?: "ACTIVE" | "INACTIVE";
    isPasswordChangeRequired?: boolean;
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
  } = {}): Promise<TestUser> {
    const unique = randomUUID();
    const created = await database.user.create({
      data: {
        firstName: overrides.firstName ?? "Notification",
        lastName: overrides.lastName ?? "Integration",
        documentNumber: overrides.documentNumber ?? unique.replaceAll("-", "").slice(0, 28),
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
      select: { id: true, role: true, email: true },
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

  async function accessPoint(branchId: string, name = "Ingreso principal"): Promise<{ id: string; name: string }> {
    const created = await database.accessPoint.create({
      data: { branchId, name, qrToken: `fixture-${randomUUID()}` },
      select: { id: true, name: true },
    });
    accessPointIds.push(created.id);
    return created;
  }

  async function accessAttempt(input: {
    userId: string;
    roleAtAttempt: "MEMBER" | "TRAINER";
    branchId?: string | null;
    accessPointId?: string | null;
    result: "ALLOWED" | "DENIED";
    denialReason?: "INVALID_QR" | "INACTIVE_USER" | "INACTIVE_BRANCH" | "INACTIVE_ACCESS_POINT" | "EXPIRED_MEMBERSHIP" | "MEDICAL_CERTIFICATE_REQUIRED" | null;
    attemptedAt: string;
  }): Promise<{ id: string }> {
    const created = await database.accessLog.create({
      data: {
        userId: input.userId,
        roleAtAttempt: input.roleAtAttempt,
        branchId: input.branchId ?? null,
        accessPointId: input.accessPointId ?? null,
        result: input.result,
        denialReason: input.denialReason ?? null,
        attemptedAt: new Date(input.attemptedAt),
      },
      select: { id: true },
    });
    accessLogIds.push(created.id);
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

  /** Ensures events created through the API are also removed afterwards. */
  async function trackEventsBy(adminId: string): Promise<void> {
    const found = await database.event.findMany({ where: { createdById: adminId }, select: { id: true } });
    for (const item of found) if (!eventIds.includes(item.id)) eventIds.push(item.id);
  }

  async function newsPost(
    adminId: string,
    audience: "ALL" | "MEMBERS" | "TRAINERS",
    status: "DRAFT" | "PUBLISHED" | "INACTIVE",
    title = `Novedad ${randomUUID()}`,
  ) {
    const created = await database.newsPost.create({
      data: {
        title,
        content: "PostgreSQL integration fixture",
        audience,
        status,
        publishedAt: status === "DRAFT" ? null : new Date(),
        createdById: adminId,
      },
      select: { id: true, title: true },
    });
    newsPostIds.push(created.id);
    return created;
  }

  /** Ensures news posts created through the API are also removed afterwards. */
  async function trackNewsPostsBy(adminId: string): Promise<void> {
    const found = await database.newsPost.findMany({ where: { createdById: adminId }, select: { id: true } });
    for (const item of found) if (!newsPostIds.includes(item.id)) newsPostIds.push(item.id);
  }

  async function medicalCertificate(memberId: string, input: {
    status?: "PENDING" | "APPROVED" | "REJECTED";
    uploadedAt?: string;
    reviewedById?: string;
    reviewedAt?: string;
    reviewComment?: string;
  } = {}) {
    const created = await database.medicalCertificate.create({
      data: {
        memberId,
        fileUrl: `${memberId}/fixture.pdf`,
        status: input.status ?? "PENDING",
        uploadedAt: input.uploadedAt ? new Date(input.uploadedAt) : new Date(),
        reviewedById: input.reviewedById ?? null,
        reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null,
        reviewComment: input.reviewComment ?? null,
      },
      select: { id: true },
    });
    certificateIds.push(created.id);
    return created;
  }

  async function pendingCertificate(memberId: string) {
    return medicalCertificate(memberId);
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

  /** Many active members at once, created by one SQL statement. Used to check large audiences. */
  async function bulkActiveMembers(count: number): Promise<void> {
    if (!Number.isInteger(count) || count < 1) throw new Error("count must be a positive integer");
    await database.$executeRawUnsafe(`
      INSERT INTO "user" (id, first_name, last_name, document_number, birth_date, email, phone, password_hash, role, status, is_password_change_required, updated_at)
      SELECT gen_random_uuid(), 'Masivo', 'Prueba', 'BULK-${bulkRunId}-' || g, '1990-01-01', 'b' || g || '-${bulkRunId}${BULK_EMAIL_SUFFIX}',
             '555-0100', 'test-only-hash', 'MEMBER', 'ACTIVE', false, now()
      FROM generate_series(1, ${count}) AS g`);
    usedBulkMembers = true;
  }

  async function removeBulkMembers(): Promise<void> {
    if (!usedBulkMembers) return;
    await database.$executeRawUnsafe(`DELETE FROM notification WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE '%${BULK_EMAIL_SUFFIX}')`);
    await database.$executeRawUnsafe(`DELETE FROM "user" WHERE email LIKE '%${BULK_EMAIL_SUFFIX}'`);
    usedBulkMembers = false;
  }

  async function cleanup(): Promise<void> {
    await removeBulkMembers();
    if (accessLogIds.length) await database.accessLog.deleteMany({ where: { id: { in: accessLogIds } } });
    if (accessPointIds.length) await database.accessPoint.deleteMany({ where: { id: { in: accessPointIds } } });
    if (userIds.length) await database.notification.deleteMany({ where: { userId: { in: userIds } } });
    if (certificateIds.length) await database.medicalCertificate.deleteMany({ where: { id: { in: certificateIds } } });
    if (userIds.length) await database.medicalCertificate.deleteMany({ where: { memberId: { in: userIds } } });
    // Payments registered through the API are only known by their member or administrator.
    if (userIds.length) await database.payment.deleteMany({ where: { OR: [{ memberId: { in: userIds } }, { createdById: { in: userIds } }] } });
    if (paymentIds.length) await database.payment.deleteMany({ where: { id: { in: paymentIds } } });
    if (priceIds.length) await database.membershipPrice.deleteMany({ where: { id: { in: priceIds } } });
    if (eventIds.length) await database.event.deleteMany({ where: { id: { in: eventIds } } });
    if (newsPostIds.length) await database.newsPost.deleteMany({ where: { id: { in: newsPostIds } } });
    if (classIds.length) await database.scheduledClass.deleteMany({ where: { id: { in: classIds } } });
    if (scheduleIds.length) await database.weeklySchedule.deleteMany({ where: { id: { in: scheduleIds } } });
    if (branchIds.length) await database.branch.deleteMany({ where: { id: { in: branchIds } } });
    if (userIds.length) {
      await database.userAuditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { performedById: { in: userIds } }] } });
      await database.trainerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await database.memberProfile.deleteMany({ where: { userId: { in: userIds } } });
      await database.user.deleteMany({ where: { id: { in: userIds } } });
    }
    for (const list of [userIds, branchIds, scheduleIds, classIds, eventIds, priceIds, certificateIds, paymentIds, newsPostIds, accessPointIds, accessLogIds]) list.length = 0;
  }

  return {
    user, bulkActiveMembers, branch, accessPoint, accessAttempt, scheduledClass, trackClassesOf, event, trackEventsBy, price, trackPricesBy,
    newsPost, trackNewsPostsBy, medicalCertificate, pendingCertificate, accreditedPayment, cleanup,
  };
}

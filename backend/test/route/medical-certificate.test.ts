import express, { type RequestHandler } from "express";
import request from "supertest";

import { MedicalCertificateController } from "../../src/controller/medical-certificate-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { MAX_MEDICAL_CERTIFICATE_SIZE_BYTES } from "../../src/middleware/medical-certificate-upload-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createMedicalCertificateRouter } from "../../src/route/medical-certificate-route.js";
import type { MedicalCertificateService } from "../../src/service/medical-certificate-service.js";

const certificateId = "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84";
const memberId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const certificate = {
  id: certificateId,
  memberId,
  status: "PENDING",
  uploadedAt: new Date("2030-09-01T12:00:00.000Z"),
  reviewedAt: null,
  reviewComment: null,
  member: { id: memberId, firstName: "Ana", lastName: "Pérez", documentNumber: "123", email: "ana@example.com" },
  reviewedBy: null,
};

function setup(role: UserRole | null = "MEMBER", passwordChangeRequired = false) {
  const service = {
    listOwn: jest.fn().mockResolvedValue({
      items: [certificate], page: 1, limit: 20, total: 1,
      initialMedicalCertificatePeriod: {
        startsAt: new Date("2030-09-01T12:00:00.000Z"),
        expiresAt: new Date("2030-09-21T12:00:00.000Z"),
        daysRemaining: 20, isActive: true,
      },
    }),
    upload: jest.fn().mockResolvedValue(certificate),
    listAdmin: jest.fn().mockResolvedValue({ items: [certificate], page: 1, limit: 20, total: 1 }),
    get: jest.fn().mockResolvedValue(certificate),
    getFile: jest.fn().mockResolvedValue({ signedUrl: "https://signed.example/file", expiresIn: 300 }),
    review: jest.fn().mockResolvedValue(certificate),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    request.authenticatedUser = { id: memberId, role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createMedicalCertificateRouter(
    new MedicalCertificateController(service as unknown as MedicalCertificateService),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use(errorMiddleware);
  return { app, service };
}

describe("medical certificate routes", () => {
  test("lists the member history including the initial period", async () => {
    const { app } = setup();
    const response = await request(app).get("/api/members/me/medical-certificates");
    expect(response.status).toBe(200);
    expect(response.body.items[0]).toEqual(expect.objectContaining({ status: "PENDING" }));
    expect(response.body.initialMedicalCertificatePeriod.isActive).toBe(true);
  });

  test("accepts an allowed PDF and starts it as pending", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .post("/api/members/me/medical-certificates")
      .attach("file", Buffer.from("%PDF-1.7\ncontent"), {
        filename: "certificate.pdf", contentType: "application/pdf",
      });
    expect(response.status).toBe(201);
    expect(service.upload).toHaveBeenCalledWith(memberId, {
      buffer: expect.any(Buffer), mimeType: "application/pdf",
    });
  });

  test.each([
    ["image/jpeg", "certificate.jpg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ["image/png", "certificate.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ])("accepts a valid %s signature", async (contentType, filename, content) => {
    const { app, service } = setup();
    const response = await request(app).post("/api/members/me/medical-certificates")
      .attach("file", content, { filename, contentType });
    expect(response.status).toBe(201);
    expect(service.upload).toHaveBeenCalledWith(memberId, {
      buffer: expect.any(Buffer), mimeType: contentType,
    });
  });

  test("rejects a spoofed PDF signature before storage", async () => {
    const { app, service } = setup();
    const response = await request(app).post("/api/members/me/medical-certificates")
      .attach("file", Buffer.from("not a PDF"), {
        filename: "certificate.pdf", contentType: "application/pdf",
      });
    expect(response.status).toBe(400);
    expect(service.upload).not.toHaveBeenCalled();
  });

  test("accepts 5 MB and rejects a larger file", async () => {
    const { app, service } = setup();
    const atLimit = Buffer.alloc(MAX_MEDICAL_CERTIFICATE_SIZE_BYTES);
    atLimit.write("%PDF-");
    const accepted = await request(app).post("/api/members/me/medical-certificates")
      .attach("file", atLimit, { filename: "certificate.pdf", contentType: "application/pdf" });
    expect(accepted.status).toBe(201);
    expect(service.upload).toHaveBeenCalledTimes(1);

    const tooLarge = Buffer.alloc(MAX_MEDICAL_CERTIFICATE_SIZE_BYTES + 1);
    tooLarge.write("%PDF-");
    const rejected = await request(app).post("/api/members/me/medical-certificates")
      .attach("file", tooLarge, { filename: "certificate.pdf", contentType: "application/pdf" });
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toContain("5 MB");
    expect(service.upload).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["TRAINER", false, 403], ["ADMIN", false, 403], [null, false, 401], ["MEMBER", true, 403],
  ] as const)("protects member upload with role and password policy: %s/%s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    const response = await request(app).post("/api/members/me/medical-certificates")
      .attach("file", Buffer.from("%PDF-1.7"), { filename: "certificate.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(status);
    expect(service.upload).not.toHaveBeenCalled();
  });

  test("rejects an invalid file type and a review without rejection comment", async () => {
    const member = setup("MEMBER");
    expect((await request(member.app).post("/api/members/me/medical-certificates")
      .attach("file", Buffer.from("not-an-image"), { filename: "certificate.txt", contentType: "text/plain" })).status)
      .toBe(400);
    const admin = setup("ADMIN");
    expect((await request(admin.app).patch(`/api/medical-certificates/${certificateId}/review`)
      .send({ status: "REJECTED" })).status).toBe(400);
    expect(admin.service.review).not.toHaveBeenCalled();
  });

  test("allows only administrators to list and review", async () => {
    const member = setup("MEMBER");
    expect((await request(member.app).get("/api/medical-certificates")).status).toBe(403);
    expect((await request(member.app).patch(`/api/medical-certificates/${certificateId}/review`)
      .send({ status: "APPROVED" })).status).toBe(403);

    const admin = setup("ADMIN");
    expect((await request(admin.app).get("/api/medical-certificates?status=PENDING")).status).toBe(200);
    expect((await request(admin.app).patch(`/api/medical-certificates/${certificateId}/review`)
      .send({ status: "REJECTED", reviewComment: "Falta firma" })).status).toBe(200);
    expect(admin.service.review).toHaveBeenCalledWith(
      certificateId, memberId, { status: "REJECTED", reviewComment: "Falta firma" },
    );
  });

  test("returns a temporary signed URL for the owner", async () => {
    const { app, service } = setup("MEMBER");
    const response = await request(app).get(`/api/medical-certificates/${certificateId}/file`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ signedUrl: "https://signed.example/file", expiresIn: 300 });
    expect(service.getFile).toHaveBeenCalledWith(certificateId, expect.objectContaining({ id: memberId }));
  });
});

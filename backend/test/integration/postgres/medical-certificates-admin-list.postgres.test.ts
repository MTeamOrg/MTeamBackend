import request from "supertest";

import { bearer, createFixtures, createIntegrationApp, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();
const app = createIntegrationApp();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("administrative medical-certificate listing (PostgreSQL)", () => {
  test("reads persisted certificates, filters by status, member, search and dates, and paginates", async () => {
    const administrator = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER", {
      firstName: "CertificateFilterUnique",
      lastName: "Member",
      documentNumber: "CERTIFICATE-FILTER-001",
    });
    const otherMember = await fixtures.user("MEMBER", {
      firstName: "CertificateOther",
      lastName: "Member",
      documentNumber: "CERTIFICATE-FILTER-002",
    });

    await fixtures.medicalCertificate(member.id, { status: "PENDING", uploadedAt: "2026-10-10T12:00:00.000Z" });
    await fixtures.medicalCertificate(member.id, { status: "PENDING", uploadedAt: "2026-10-11T12:00:00.000Z" });
    await fixtures.medicalCertificate(otherMember.id, { status: "APPROVED", uploadedAt: "2026-10-10T13:00:00.000Z" });

    const filtered = await request(app).get("/api/medical-certificates")
      .query({
        search: "CertificateFilterUnique",
        memberId: member.id,
        status: "PENDING",
        from: "2026-10-10T00:00:00.000Z",
        to: "2026-10-12T00:00:00.000Z",
        page: 1,
        limit: 1,
      })
      .set(bearer(administrator));

    expect(filtered.status).toBe(200);
    expect(filtered.body).toMatchObject({ page: 1, limit: 1, total: 2 });
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0]).toMatchObject({
      memberId: member.id,
      status: "PENDING",
      member: { firstName: "CertificateFilterUnique", documentNumber: "CERTIFICATE-FILTER-001" },
      uploadedAt: "2026-10-11T12:00:00.000Z",
    });

    const secondPage = await request(app).get("/api/medical-certificates")
      .query({ memberId: member.id, status: "PENDING", page: 2, limit: 1 })
      .set(bearer(administrator));
    expect(secondPage.status).toBe(200);
    expect(secondPage.body).toMatchObject({ page: 2, limit: 1, total: 2 });
    expect(secondPage.body.items[0].uploadedAt).toBe("2026-10-10T12:00:00.000Z");

    const approved = await request(app).get("/api/medical-certificates?status=APPROVED")
      .set(bearer(administrator));
    expect(approved.status).toBe(200);
    expect(approved.body.total).toBe(1);
    expect(approved.body.items[0]).toMatchObject({ memberId: otherMember.id, status: "APPROVED" });
  });
});

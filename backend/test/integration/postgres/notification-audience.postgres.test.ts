import { EventRepository } from "../../../src/repository/event-repository.js";
import { MembershipPriceRepository } from "../../../src/repository/membership-price-repository.js";
import { createDatabaseClient, createFixtures, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();
const AUDIENCE = 4000;
// A client whose default interactive-transaction timeout is far shorter than the time needed to notify the
// whole audience. Announcing to everybody must set its own timeout instead of relying on Prisma's default.
const impatient = createDatabaseClient({ defaultTransactionTimeoutMs: 100 });

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await impatient.$disconnect();
  await database.$disconnect();
});

const noticesFor = (type: "EVENT_CANCELLED" | "MEMBERSHIP_PRICE_CHANGED") =>
  database.notification.count({ where: { type, user: { email: { endsWith: "@fixture-bulk.test" } } } });

describe("announcing to a large audience", () => {
  test(`cancelling a published event notifies ${AUDIENCE} active members without exceeding the transaction timeout`, async () => {
    const admin = await fixtures.user("ADMIN");
    await fixtures.bulkActiveMembers(AUDIENCE);
    const event = await fixtures.event(admin.id, "PUBLISHED");

    const cancelled = await new EventRepository(impatient).updateStatus(event.id, { status: "CANCELLED" });

    expect(cancelled.status).toBe("CANCELLED");
    expect(await noticesFor("EVENT_CANCELLED")).toBe(AUDIENCE);
  });

  test(`registering a higher price saves it and notifies ${AUDIENCE} active members`, async () => {
    const admin = await fixtures.user("ADMIN");
    await fixtures.bulkActiveMembers(AUDIENCE);
    const repository = new MembershipPriceRepository(impatient);

    await repository.createPrice({ amount: "10000", effectiveFrom: new Date("2096-01-01T03:00:00.000Z"), createdById: admin.id });
    const increase = await repository.createPrice({ amount: "12000", effectiveFrom: new Date("2096-02-01T03:00:00.000Z"), createdById: admin.id });
    await fixtures.trackPricesBy(admin.id);

    expect(increase.previousAmount).toBe("10000");
    expect(await database.membershipPrice.count({ where: { id: increase.id } })).toBe(1);
    expect(await noticesFor("MEMBERSHIP_PRICE_CHANGED")).toBe(AUDIENCE);
  });
});

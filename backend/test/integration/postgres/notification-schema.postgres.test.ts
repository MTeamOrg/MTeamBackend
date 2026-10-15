import { randomUUID } from "node:crypto";

import { createFixtures, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

interface ColumnRow {
  column_name: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  character_maximum_length: number | null;
  datetime_precision: number | null;
  column_default: string | null;
}

describe("notification table on the migrated PostgreSQL database", () => {
  test("has the documented columns, types and nullability", async () => {
    const columns = await database.$queryRaw<ColumnRow[]>`
      SELECT column_name, udt_name, is_nullable, character_maximum_length, datetime_precision, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notification'`;
    const byName = Object.fromEntries(columns.map((column) => [column.column_name, column]));

    expect(Object.keys(byName).sort()).toEqual(["created_at", "dedupe_key", "id", "message", "read_at", "title", "type", "user_id"]);
    expect(byName.id).toMatchObject({ udt_name: "uuid", is_nullable: "NO" });
    expect(byName.user_id).toMatchObject({ udt_name: "uuid", is_nullable: "NO" });
    expect(byName.dedupe_key).toMatchObject({ udt_name: "varchar", is_nullable: "YES", character_maximum_length: 255 });
    expect(byName.title).toMatchObject({ udt_name: "varchar", is_nullable: "NO", character_maximum_length: 200 });
    expect(byName.message).toMatchObject({ udt_name: "text", is_nullable: "NO" });
    expect(byName.type).toMatchObject({ udt_name: "NotificationType", is_nullable: "NO" });
    expect(byName.created_at).toMatchObject({ udt_name: "timestamptz", is_nullable: "NO", datetime_precision: 3 });
    expect(byName.created_at?.column_default).toMatch(/CURRENT_TIMESTAMP|now\(\)/i);
    expect(byName.read_at).toMatchObject({ udt_name: "timestamptz", is_nullable: "YES", datetime_precision: 3 });
    expect(byName.read_at?.column_default).toBeNull();
  });

  test("defines exactly the notification types of the scope", async () => {
    const labels = await database.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'NotificationType' ORDER BY e.enumsortorder`;
    expect(labels.map(({ enumlabel }) => enumlabel)).toEqual([
      "MEMBERSHIP_PRICE_CHANGED",
      "MEMBERSHIP_EXPIRING",
      "MEMBERSHIP_EXPIRED",
      "MEDICAL_CERTIFICATE_REVIEWED",
      "CLASS_CHANGED",
      "EVENT_CANCELLED",
      "GENERAL",
    ]);
  });

  test("keeps a unique dedupe key and the index that serves the inbox queries", async () => {
    const indexes = await database.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'notification'`;
    const definitions = Object.fromEntries(indexes.map(({ indexname, indexdef }) => [indexname, indexdef]));

    expect(definitions.notification_pkey).toMatch(/UNIQUE INDEX .* \(id\)/);
    expect(definitions.notification_dedupe_key_key).toMatch(/UNIQUE INDEX .* USING btree \(dedupe_key\)/);
    expect(definitions.notification_user_id_read_at_created_at_idx).toMatch(/USING btree \(user_id, read_at, created_at\)/);
  });

  test("references the user with ON DELETE RESTRICT so the history is never lost", async () => {
    const [foreignKey] = await database.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid = 'public.notification'::regclass AND contype = 'f'`;
    expect(foreignKey?.definition).toBe('FOREIGN KEY (user_id) REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE RESTRICT');
  });

  test("rejects a second notice with the same dedupe key but accepts any number without one", async () => {
    const user = await fixtures.user("MEMBER");
    const dedupeKey = `schema-test:${randomUUID()}`;
    const notice = (key: string | null) => ({ userId: user.id, title: "Aviso", message: "Mensaje", type: "GENERAL" as const, dedupeKey: key });

    await database.notification.create({ data: notice(dedupeKey) });
    await expect(database.notification.create({ data: notice(dedupeKey) })).rejects.toMatchObject({ code: "P2002" });

    await database.notification.create({ data: notice(null) });
    await database.notification.create({ data: notice(null) });
    expect(await database.notification.count({ where: { userId: user.id } })).toBe(3);
  });

  test("rejects a notice for a user that does not exist and values longer than the columns", async () => {
    const user = await fixtures.user("MEMBER");
    await expect(database.notification.create({
      data: { userId: randomUUID(), title: "Aviso", message: "Mensaje", type: "GENERAL" },
    })).rejects.toMatchObject({ code: "P2003" });
    await expect(database.notification.create({
      data: { userId: user.id, title: "x".repeat(201), message: "Mensaje", type: "GENERAL" },
    })).rejects.toMatchObject({ code: "P2000" });
    expect(await database.notification.count({ where: { userId: user.id } })).toBe(0);
  });

  test("does not let a user with notifications be deleted", async () => {
    const user = await fixtures.user("MEMBER");
    await database.notification.create({ data: { userId: user.id, title: "Aviso", message: "Mensaje", type: "GENERAL" } });

    await expect(database.user.delete({ where: { id: user.id } })).rejects.toMatchObject({ code: "P2003" });
    expect(await database.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  test("starts every notice unread and stamps its creation with the database clock", async () => {
    const user = await fixtures.user("MEMBER");
    const before = Date.now();
    const created = await database.notification.create({
      data: { userId: user.id, title: "Aviso", message: "Mensaje", type: "GENERAL" },
    });
    expect(created.readAt).toBeNull();
    expect(Math.abs(created.createdAt.getTime() - before)).toBeLessThan(60_000);
  });
});

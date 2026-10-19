import { resolve } from "node:path";

import { config } from "dotenv";
import { z } from "zod";

import { database, disconnectDatabase } from "../src/config/database.js";
import { PasswordService } from "../src/service/password-service.js";

config({
  path: resolve(process.cwd(), ".env.bootstrap.local"),
  override: false,
  quiet: true,
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  })
  .refine((value) => new Date(`${value}T00:00:00.000Z`) <= new Date());

const bootstrapEnvironmentSchema = z.object({
  BOOTSTRAP_ADMIN_FIRST_NAME: z.string().trim().min(1).max(100),
  BOOTSTRAP_ADMIN_LAST_NAME: z.string().trim().min(1).max(100),
  BOOTSTRAP_ADMIN_DOCUMENT_NUMBER: z.string().trim().min(1).max(30),
  BOOTSTRAP_ADMIN_BIRTH_DATE: isoDate,
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  BOOTSTRAP_ADMIN_PHONE: z.string().trim().min(1).max(30),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(72),
});

class BootstrapConflictError extends Error {}

const validation = bootstrapEnvironmentSchema.safeParse(process.env);
if (!validation.success) {
  const fields = [
    ...new Set(
      validation.error.issues.map((issue) => String(issue.path[0] ?? "unknown")),
    ),
  ].sort();
  console.error(`Invalid or missing local bootstrap variables: ${fields.join(", ")}`);
  process.exit(1);
}

const input = validation.data;
const email = input.BOOTSTRAP_ADMIN_EMAIL;
const documentNumber = input.BOOTSTRAP_ADMIN_DOCUMENT_NUMBER.replace(/\D/g, "");
if (!documentNumber) {
  console.error("BOOTSTRAP_ADMIN_DOCUMENT_NUMBER must contain at least one digit");
  process.exit(1);
}

try {
  const outcome = await database.$transaction(
    async (transaction) => {
      const matchingUsers = await transaction.user.findMany({
        where: { OR: [{ email }, { documentNumber }] },
        select: {
          id: true,
          email: true,
          documentNumber: true,
          role: true,
          status: true,
          isPasswordChangeRequired: true,
        },
      });

      if (matchingUsers.length > 0) {
        const exactAdministrator = matchingUsers.find(
          (user) =>
            user.email === email &&
            user.documentNumber === documentNumber &&
            user.role === "ADMIN",
        );
        if (!exactAdministrator || matchingUsers.length !== 1) {
          throw new BootstrapConflictError(
            "Bootstrap identity conflicts with an existing user; no changes were made",
          );
        }
        if (
          exactAdministrator.status !== "ACTIVE" ||
          exactAdministrator.isPasswordChangeRequired
        ) {
          throw new BootstrapConflictError(
            "The matching administrator is not ready for access; no changes were made",
          );
        }
        return "already-exists" as const;
      }

      const administratorCount = await transaction.user.count({
        where: { role: "ADMIN" },
      });
      if (administratorCount > 0) {
        throw new BootstrapConflictError(
          "An administrator already exists with a different identity; no changes were made",
        );
      }

      const passwordHash = await new PasswordService().hash(
        input.BOOTSTRAP_ADMIN_PASSWORD,
      );
      const administrator = await transaction.user.create({
        data: {
          firstName: input.BOOTSTRAP_ADMIN_FIRST_NAME,
          lastName: input.BOOTSTRAP_ADMIN_LAST_NAME,
          documentNumber,
          birthDate: new Date(`${input.BOOTSTRAP_ADMIN_BIRTH_DATE}T00:00:00.000Z`),
          email,
          phone: input.BOOTSTRAP_ADMIN_PHONE,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          isPasswordChangeRequired: false,
        },
        select: { id: true },
      });
      await transaction.userAuditLog.create({
        data: {
          userId: administrator.id,
          performedById: administrator.id,
          action: "CREATED",
          reason: "Initial administrator bootstrap",
        },
      });

      return "created" as const;
    },
    { isolationLevel: "Serializable" },
  );

  console.log(
    outcome === "created"
      ? "Initial administrator created successfully"
      : "Initial administrator already exists; credentials and data were left unchanged",
  );
} catch (error) {
  if (error instanceof BootstrapConflictError) {
    console.error(error.message);
  } else {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
    console.error(`Administrator bootstrap failed (error code: ${errorCode})`);
  }
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}

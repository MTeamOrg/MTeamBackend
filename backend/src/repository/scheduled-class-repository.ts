import type { PrismaClient, ScheduledClass } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import { belongsToWeek } from "../model/scheduled-class-week.js";
import type {
  CreateScheduledClassInput,
  UpdateScheduledClassInput,
} from "../validator/scheduled-class-validator.js";
import { createNotifications, type NotificationRecipient } from "./notification-repository.js";

export class ScheduledClassNotFoundError extends Error {}
export class BranchAssignmentError extends Error {
  constructor(readonly reason: "MISSING" | "INACTIVE") { super(reason); }
}
export class TrainerAssignmentError extends Error {
  constructor(readonly reason: "MISSING" | "INVALID" | "INACTIVE") { super(reason); }
}
export class ClassOutsideWeekError extends Error {}
export class HistoricalClassError extends Error {}

export interface ManagedScheduledClass extends ScheduledClass {
  weekStartsOn: Date;
}

type ScheduledClassWithWeek = ScheduledClass & { schedule: { weekStartsOn: Date } };

function withWeek(record: ScheduledClassWithWeek): ManagedScheduledClass {
  const { schedule, ...scheduledClass } = record;
  return { ...scheduledClass, weekStartsOn: schedule.weekStartsOn };
}

const scheduleInclude = { schedule: { select: { weekStartsOn: true } } } as const;

export interface ScheduledClassRepositoryPort {
  createClass(input: CreateScheduledClassInput, now: Date): Promise<ManagedScheduledClass>;
  updateClass(id: string, input: UpdateScheduledClassInput, now: Date): Promise<ManagedScheduledClass>;
  deleteClass(id: string, now: Date): Promise<void>;
}

export class ScheduledClassRepository implements ScheduledClassRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  createClass(input: CreateScheduledClassInput, now: Date): Promise<ManagedScheduledClass> {
    return this.database.$transaction(async (transaction) => {
      if (new Date(input.startsAt) <= now) throw new HistoricalClassError();
      await requireActiveBranch(transaction, input.branchId);
      if (input.trainerId) await requireActiveTrainer(transaction, input.trainerId);

      const weekStartsOn = new Date(`${input.weekStartsOn}T00:00:00.000Z`);
      const schedule = await transaction.weeklySchedule.upsert({
        where: { weekStartsOn },
        update: {},
        create: { weekStartsOn },
        select: { id: true },
      });
      const record = await transaction.scheduledClass.create({
        data: {
          scheduleId: schedule.id,
          branchId: input.branchId,
          trainerId: input.trainerId ?? null,
          activity: input.activity,
          startsAt: new Date(input.startsAt),
        },
        include: scheduleInclude,
      });
      await notifyClassChange(transaction, record.id, input.trainerId ?? [], "create", record.activity, record.startsAt, input.branchId);
      return withWeek(record);
    });
  }

  updateClass(id: string, input: UpdateScheduledClassInput, now: Date): Promise<ManagedScheduledClass> {
    return this.database.$transaction(async (transaction) => {
      await this.lockClass(transaction, id);
      const existing = await transaction.scheduledClass.findUnique({
        where: { id }, include: scheduleInclude,
      });
      if (!existing) throw new ScheduledClassNotFoundError();
      if (existing.startsAt <= now) throw new HistoricalClassError();

      if (input.startsAt) {
        const startsAt = new Date(input.startsAt);
        if (startsAt <= now) throw new HistoricalClassError();
        const weekStartsOn = existing.schedule.weekStartsOn.toISOString().slice(0, 10);
        if (!belongsToWeek(weekStartsOn, startsAt)) throw new ClassOutsideWeekError();
      }
      if (input.branchId && input.branchId !== existing.branchId) {
        await requireActiveBranch(transaction, input.branchId);
      }
      if (input.trainerId && input.trainerId !== existing.trainerId) {
        await requireActiveTrainer(transaction, input.trainerId);
      }

      const data: Prisma.ScheduledClassUncheckedUpdateInput = {};
      if (input.activity !== undefined) data.activity = input.activity;
      if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt);
      if (input.branchId !== undefined) data.branchId = input.branchId;
      if (input.trainerId !== undefined) data.trainerId = input.trainerId;
      const updated = await transaction.scheduledClass.update({
        where: { id }, data, include: scheduleInclude,
      });
      const recipients = new Set([existing.trainerId, updated.trainerId].filter((value): value is string => Boolean(value)));
      await notifyClassChange(transaction, updated.id, [...recipients], "update", updated.activity, updated.startsAt, updated.branchId);
      return withWeek(updated);
    });
  }

  deleteClass(id: string, now: Date): Promise<void> {
    return this.database.$transaction(async (transaction) => {
      await this.lockClass(transaction, id);
      const existing = await transaction.scheduledClass.findUnique({
        where: { id }, select: { startsAt: true, trainerId: true },
      });
      if (!existing) throw new ScheduledClassNotFoundError();
      if (existing.startsAt <= now) throw new HistoricalClassError();
      await transaction.scheduledClass.delete({ where: { id } });
      if (existing.trainerId) {
        await notifyClassChange(transaction, id, existing.trainerId, "delete", null, existing.startsAt, null);
      }
      // The weekly schedule and other classes remain in place.
    });
  }

  private async lockClass(transaction: Prisma.TransactionClient, id: string): Promise<void> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM scheduled_class WHERE id = CAST(${id} AS uuid) FOR UPDATE
    `;
    if (rows.length === 0) throw new ScheduledClassNotFoundError();
  }

}

async function notifyClassChange(
  transaction: Prisma.TransactionClient,
  classId: string,
  trainerIds: string | string[],
  action: "create" | "update" | "delete",
  activity: string | null,
  startsAt: Date,
  branchId: string | null,
): Promise<void> {
  const recipients = Array.isArray(trainerIds) ? trainerIds : [trainerIds];
  if (!recipients.length) return;
  const branch = action === "create" && branchId
    ? await transaction.branch.findUnique({ where: { id: branchId }, select: { name: true } })
    : null;
  const fingerprint = `${classId}:${action}:${activity ?? "deleted"}:${startsAt.toISOString()}:${branchId ?? "none"}`;
  const notifications: NotificationRecipient[] = recipients.map((userId) => ({
    userId,
    title: "Cambio en tus clases",
    message: action === "delete"
      ? "Se canceló una clase que tenías asignada."
      : `Se ${action === "create" ? "asignó" : "modificó"} la clase${activity ? ` de ${activity}` : ""} del ${startsAt.toLocaleDateString("es-AR")} a las ${startsAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}${branch ? ` en ${branch.name}` : ""}.`,
    type: "CLASS_CHANGED",
    dedupeKey: `class-changed:${fingerprint}:${userId}`,
  }));
  await createNotifications(transaction, notifications);
}

/** Shared by scheduled-class management and weekly-schedule copying. */
export async function requireActiveBranch(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM branch WHERE id = CAST(${id} AS uuid) FOR SHARE
  `;
  if (rows.length === 0) throw new BranchAssignmentError("MISSING");
  const branch = await transaction.branch.findUnique({ where: { id }, select: { isActive: true } });
  if (!branch?.isActive) throw new BranchAssignmentError("INACTIVE");
}

/** Shared by scheduled-class management and weekly-schedule copying. */
export async function requireActiveTrainer(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "user" WHERE id = CAST(${id} AS uuid) FOR SHARE
  `;
  if (rows.length === 0) throw new TrainerAssignmentError("MISSING");
  const user = await transaction.user.findUnique({
    where: { id },
    select: { role: true, status: true, trainerProfile: { select: { id: true } } },
  });
  if (!user || user.role !== "TRAINER" || !user.trainerProfile) {
    throw new TrainerAssignmentError("INVALID");
  }
  if (user.status !== "ACTIVE") throw new TrainerAssignmentError("INACTIVE");
}

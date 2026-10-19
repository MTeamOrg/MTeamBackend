import { randomUUID } from "node:crypto";
import type { PrismaClient, ScheduledClass } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  classAssignedNotice,
  classCancelledNotice,
  classUnassignedNotice,
  classUpdatedNotice,
  type ClassDetails,
  type NotificationNotice,
} from "../model/notification-message.js";
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
      if (record.trainerId) {
        const branch = await transaction.branch.findUniqueOrThrow({
          where: { id: record.branchId },
          select: { id: true, name: true },
        });
        await notifyClassesAssigned(transaction, [{
          classId: record.id,
          trainerId: record.trainerId,
          activity: record.activity,
          startsAt: record.startsAt,
          branch,
        }]);
      }
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
      if (input.activity !== undefined && input.activity !== existing.activity) data.activity = input.activity;
      if (input.startsAt !== undefined) {
        const startsAt = new Date(input.startsAt);
        if (startsAt.getTime() !== existing.startsAt.getTime()) data.startsAt = startsAt;
      }
      if (input.branchId !== undefined && input.branchId !== existing.branchId) data.branchId = input.branchId;
      if (input.trainerId !== undefined && input.trainerId !== existing.trainerId) data.trainerId = input.trainerId;
      if (Object.keys(data).length === 0) return withWeek(existing);

      const updated = await transaction.scheduledClass.update({
        where: { id }, data, include: scheduleInclude,
      });
      await notifyClassUpdated(transaction, existing, updated);
      return withWeek(updated);
    });
  }

  deleteClass(id: string, now: Date): Promise<void> {
    return this.database.$transaction(async (transaction) => {
      await this.lockClass(transaction, id);
      const existing = await transaction.scheduledClass.findUnique({
        where: { id },
        select: {
          startsAt: true,
          trainerId: true,
          activity: true,
          branch: { select: { id: true, name: true } },
        },
      });
      if (!existing) throw new ScheduledClassNotFoundError();
      if (existing.startsAt <= now) throw new HistoricalClassError();
      await transaction.scheduledClass.delete({ where: { id } });
      if (existing.trainerId) {
        // A class is deleted once, so one deterministic key per class and trainer is enough. It must
        // differ from the key used when the class was assigned, or this notice would be dropped.
        await createNotifications(transaction, [classNotification(
          id,
          "deleted",
          existing.trainerId,
          classCancelledNotice({
            activity: existing.activity,
            startsAt: existing.startsAt,
            branchId: existing.branch.id,
            branchName: existing.branch.name,
          }),
        )]);
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

/**
 * One notification per real change. The key is `class-changed:<class>:<change>:<trainer>` where
 * `<change>` names the event: `created` and `deleted` happen once per class, while every update gets
 * its own identity so an A to B to A to B sequence keeps all three notices. Exact retries of an
 * update never reach this point because the locked row already holds the requested state.
 */
function classNotification(
  classId: string,
  change: string,
  trainerId: string,
  notice: NotificationNotice,
): NotificationRecipient {
  return {
    userId: trainerId,
    ...notice,
    type: "CLASS_CHANGED",
    dedupeKey: `class-changed:${classId}:${change}:${trainerId}`,
  };
}

export interface AssignedClass {
  classId: string;
  trainerId: string;
  activity: string;
  startsAt: Date;
  branch: { id: string; name: string };
}

/** A class that appears with a trainer already assigned (manual creation or weekly copy). */
export async function notifyClassesAssigned(
  transaction: Prisma.TransactionClient,
  assigned: AssignedClass[],
): Promise<void> {
  await createNotifications(transaction, assigned.map((item) => classNotification(
    item.classId,
    "created",
    item.trainerId,
    classAssignedNotice({
      activity: item.activity,
      startsAt: item.startsAt,
      branchId: item.branch.id,
      branchName: item.branch.name,
    }),
  )));
}

async function notifyClassUpdated(
  transaction: Prisma.TransactionClient,
  before: ScheduledClass,
  after: ScheduledClass,
): Promise<void> {
  const branches = await transaction.branch.findMany({
    where: { id: { in: [before.branchId, after.branchId] } },
    select: { id: true, name: true },
  });
  const detailsOf = (record: ScheduledClass): ClassDetails => ({
    activity: record.activity,
    startsAt: record.startsAt,
    branchId: record.branchId,
    branchName: branches.find((branch) => branch.id === record.branchId)?.name ?? "",
  });
  const previous = detailsOf(before);
  const current = detailsOf(after);
  const change = randomUUID();
  const notifications: NotificationRecipient[] = [];

  if (before.trainerId === after.trainerId) {
    if (after.trainerId) {
      notifications.push(classNotification(after.id, change, after.trainerId, classUpdatedNotice(previous, current)));
    }
  } else {
    if (before.trainerId) {
      notifications.push(classNotification(after.id, change, before.trainerId, classUnassignedNotice(previous)));
    }
    if (after.trainerId) {
      notifications.push(classNotification(after.id, change, after.trainerId, classAssignedNotice(current)));
    }
  }
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

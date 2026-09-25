import type { PrismaClient } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  addDays,
  atLocalGymTime,
  currentGymWeekStartsOn,
  daysFromWeekStart,
  gymWeekRange,
  localGymTime,
} from "../model/scheduled-class-week.js";
import {
  HistoricalClassError,
  requireActiveBranch,
  requireActiveTrainer,
} from "./scheduled-class-repository.js";

export class WeeklyScheduleNotFoundError extends Error {}
export class DestinationWeekAlreadyExistsError extends Error {}
export class DestinationWeekMustFollowSourceError extends Error {}
export class PastDestinationWeekError extends Error {}

const weeklyScheduleSelect = {
  id: true,
  weekStartsOn: true,
  classes: {
    orderBy: [
      { startsAt: "asc" },
      { branch: { name: "asc" } },
      { id: "asc" },
    ],
    select: {
      id: true,
      activity: true,
      startsAt: true,
      branch: { select: { id: true, name: true } },
      trainer: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const satisfies Prisma.WeeklyScheduleSelect;

type WeeklyScheduleRecord = Prisma.WeeklyScheduleGetPayload<{
  select: typeof weeklyScheduleSelect;
}>;

export type WeeklyScheduleClass = WeeklyScheduleRecord["classes"][number];

export interface WeeklyScheduleView {
  id: string | null;
  weekStartsOn: Date;
  classes: WeeklyScheduleClass[];
}

function toView(record: WeeklyScheduleRecord): WeeklyScheduleView {
  return record;
}

function publicWeeklyScheduleSelect(weekStartsOn: string) {
  const range = gymWeekRange(weekStartsOn);
  return {
    id: true,
    weekStartsOn: true,
    classes: {
      where: {
        startsAt: { gte: range.startsAt, lt: range.endsAt },
        branch: { is: { isActive: true } },
      },
      orderBy: [
        { startsAt: "asc" as const },
        { branch: { name: "asc" as const } },
        { id: "asc" as const },
      ],
      select: {
        id: true,
        activity: true,
        startsAt: true,
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, firstName: true, lastName: true } },
      },
    },
  } satisfies Prisma.WeeklyScheduleSelect;
}

export interface WeeklyScheduleRepositoryPort {
  findByWeekStartsOn(weekStartsOn: string): Promise<WeeklyScheduleView>;
  findById(id: string): Promise<WeeklyScheduleView | null>;
  copySchedule(
    sourceScheduleId: string,
    destinationWeekStartsOn: string,
    now: Date,
  ): Promise<WeeklyScheduleView>;
}

export class WeeklyScheduleRepository implements WeeklyScheduleRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async findByWeekStartsOn(weekStartsOn: string): Promise<WeeklyScheduleView> {
    const schedule = await this.database.weeklySchedule.findUnique({
      where: { weekStartsOn: new Date(`${weekStartsOn}T00:00:00.000Z`) },
      select: publicWeeklyScheduleSelect(weekStartsOn),
    });
    return schedule
      ? toView(schedule)
      : { id: null, weekStartsOn: new Date(`${weekStartsOn}T00:00:00.000Z`), classes: [] };
  }

  async findById(id: string): Promise<WeeklyScheduleView | null> {
    const schedule = await this.database.weeklySchedule.findUnique({
      where: { id },
      select: { weekStartsOn: true },
    });
    return schedule
      ? this.findByWeekStartsOn(schedule.weekStartsOn.toISOString().slice(0, 10))
      : null;
  }

  async copySchedule(
    sourceScheduleId: string,
    destinationWeekStartsOn: string,
    now: Date,
  ): Promise<WeeklyScheduleView> {
    if (destinationWeekStartsOn < currentGymWeekStartsOn(now)) {
      throw new PastDestinationWeekError();
    }

    const destinationDate = new Date(`${destinationWeekStartsOn}T00:00:00.000Z`);
    try {
      return await this.database.$transaction(async (transaction) => {
        const source = await transaction.weeklySchedule.findUnique({
          where: { id: sourceScheduleId },
          select: weeklyScheduleSelect,
        });
        if (!source) throw new WeeklyScheduleNotFoundError();

        const sourceWeekStartsOn = source.weekStartsOn.toISOString().slice(0, 10);
        if (destinationWeekStartsOn !== addDays(sourceWeekStartsOn, 7)) {
          throw new DestinationWeekMustFollowSourceError();
        }

        const destination = await transaction.weeklySchedule.findUnique({
          where: { weekStartsOn: destinationDate },
          select: { id: true },
        });
        if (destination) throw new DestinationWeekAlreadyExistsError();

        const classes = source.classes.map((scheduledClass) => {
          const dayOffset = daysFromWeekStart(sourceWeekStartsOn, scheduledClass.startsAt);
          const startsAt = atLocalGymTime(
            addDays(destinationWeekStartsOn, dayOffset),
            localGymTime(scheduledClass.startsAt),
          );
          if (startsAt <= now) throw new HistoricalClassError();
          return { scheduledClass, startsAt };
        });

        // Validate every assignment before creating the destination schedule.
        // The same locked checks are used by CLA-02/CLA-03 class management.
        for (const { scheduledClass } of classes) {
          await requireActiveBranch(transaction, scheduledClass.branch.id);
          if (scheduledClass.trainer?.id) {
            await requireActiveTrainer(transaction, scheduledClass.trainer.id);
          }
        }

        const created = await transaction.weeklySchedule.create({
          data: {
            weekStartsOn: destinationDate,
            copiedFromId: source.id,
            classes: {
              create: classes.map(({ scheduledClass, startsAt }) => ({
                activity: scheduledClass.activity,
                startsAt,
                branchId: scheduledClass.branch.id,
                trainerId: scheduledClass.trainer?.id ?? null,
              })),
            },
          },
          select: weeklyScheduleSelect,
        });
        return toView(created);
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DestinationWeekAlreadyExistsError();
      }
      throw error;
    }
  }
}

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import {
  DestinationWeekAlreadyExistsError,
  DestinationWeekMustFollowSourceError,
  PastDestinationWeekError,
  WeeklyScheduleRepository,
} from "../../src/repository/weekly-schedule-repository.js";
import {
  BranchAssignmentError,
  TrainerAssignmentError,
} from "../../src/repository/scheduled-class-repository.js";

const sourceScheduleId = "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84";
const branchId = "83cd902e-0475-4c92-943c-129b751dacee";
const trainerId = "e05a6f56-6db7-4be2-8a90-ce63830af177";
const sourceWeek = new Date("2030-09-02T00:00:00.000Z");
const source = {
  id: sourceScheduleId,
  weekStartsOn: sourceWeek,
  classes: [
    {
      id: "eb3bc849-5234-48a3-b54a-9f9e38608de2",
      activity: "Yoga",
      startsAt: new Date("2030-09-02T13:00:00.000Z"),
      branch: { id: branchId, name: "Centro" },
      trainer: { id: trainerId, firstName: "Ana", lastName: "García" },
    },
    {
      id: "4e7fd5a7-987d-4ec4-9ba7-1159c4b2ab57",
      activity: "Pilates",
      startsAt: new Date("2030-09-05T22:00:00.000Z"),
      branch: { id: branchId, name: "Centro" },
      trainer: null,
    },
  ],
};

function setup() {
  const queryRaw = jest.fn().mockResolvedValue([{ id: branchId }]);
  const branchFindUnique = jest.fn().mockResolvedValue({ isActive: true });
  const userFindUnique = jest.fn().mockResolvedValue({
    role: "TRAINER", status: "ACTIVE", trainerProfile: { id: "profile" },
  });
  const findUnique = jest.fn()
    .mockResolvedValueOnce(source)
    .mockResolvedValueOnce(null);
  const create = jest.fn().mockResolvedValue({
    id: "8e75fbd7-22cf-4e18-8e72-6ee20e0f00ad",
    weekStartsOn: new Date("2030-09-09T00:00:00.000Z"),
    classes: source.classes,
  });
  const transaction = {
    $queryRaw: queryRaw,
    branch: { findUnique: branchFindUnique },
    user: { findUnique: userFindUnique },
    weeklySchedule: { findUnique, create },
  };
  const database = {
    $transaction: jest.fn().mockImplementation((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction)),
  } as unknown as PrismaClient;
  return { repository: new WeeklyScheduleRepository(database), findUnique, create,
    queryRaw, branchFindUnique, userFindUnique, transaction, database };
}

describe("CLA-01 weekly schedule repository", () => {
  test("filters the exact local week and active branches with stable relational ordering", async () => {
    const classes = [
      source.classes[0],
      source.classes[1],
    ];
    const findUnique = jest.fn().mockResolvedValue({
      id: sourceScheduleId,
      weekStartsOn: sourceWeek,
      classes,
    });
    const database = { weeklySchedule: { findUnique } } as unknown as PrismaClient;

    const result = await new WeeklyScheduleRepository(database)
      .findByWeekStartsOn("2030-09-02");

    expect(findUnique).toHaveBeenCalledWith({
      where: { weekStartsOn: sourceWeek },
      select: {
        id: true,
        weekStartsOn: true,
        classes: {
          where: {
            startsAt: {
              gte: new Date("2030-09-02T03:00:00.000Z"),
              lt: new Date("2030-09-09T03:00:00.000Z"),
            },
            branch: { is: { isActive: true } },
          },
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
      },
    });
    expect(result.classes[0]!.trainer).toEqual(source.classes[0]!.trainer);
    expect(result.classes[1]!.trainer).toBeNull();
  });

  test("returns an empty schedule for a week that does not exist", async () => {
    const database = {
      weeklySchedule: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    const result = await new WeeklyScheduleRepository(database).findByWeekStartsOn("2030-09-09");
    expect(result).toEqual({
      id: null,
      weekStartsOn: new Date("2030-09-09T00:00:00.000Z"),
      classes: [],
    });
  });

  test("applies the same public visibility when consulting by schedule id", async () => {
    const findUnique = jest.fn().mockResolvedValue({ weekStartsOn: sourceWeek });
    const database = { weeklySchedule: { findUnique } } as unknown as PrismaClient;
    const repository = new WeeklyScheduleRepository(database);
    const findByWeekStartsOn = jest.spyOn(repository, "findByWeekStartsOn")
      .mockResolvedValue(source);

    await expect(repository.findById(sourceScheduleId)).resolves.toEqual(source);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: sourceScheduleId },
      select: { weekStartsOn: true },
    });
    expect(findByWeekStartsOn).toHaveBeenCalledWith("2030-09-02");
  });
});

describe("CLA-04 weekly schedule repository", () => {
  test("copies only to the next week, shifts seven days and preserves all class data", async () => {
    const { repository, create, findUnique } = setup();
    const result = await repository.copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    );
    expect(result.weekStartsOn).toEqual(new Date("2030-09-09T00:00:00.000Z"));
    expect(findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: sourceScheduleId },
    }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          copiedFromId: sourceScheduleId,
          classes: {
            create: [
              expect.objectContaining({
                activity: "Yoga", branchId, trainerId,
                startsAt: new Date("2030-09-09T13:00:00.000Z"),
              }),
              expect.objectContaining({
                activity: "Pilates", branchId, trainerId: null,
                startsAt: new Date("2030-09-12T22:00:00.000Z"),
              }),
            ],
          },
        }),
      }),
    );
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.anything() }));
    expect(create.mock.calls[0]![0].select.classes.orderBy).toEqual([
      { startsAt: "asc" }, { branch: { name: "asc" } }, { id: "asc" },
    ]);
  });

  test("rejects a destination that is not exactly the following Monday", async () => {
    const state = setup();
    await expect(state.repository.copySchedule(
      sourceScheduleId, "2030-09-16", new Date("2029-01-01T12:00:00.000Z"),
    )).rejects.toBeInstanceOf(DestinationWeekMustFollowSourceError);
    expect(state.findUnique).toHaveBeenCalledTimes(1);
    expect(state.create).not.toHaveBeenCalled();
  });

  test("rejects an existing destination before creating anything", async () => {
    const state = setup();
    state.findUnique.mockReset().mockResolvedValueOnce(source).mockResolvedValueOnce({ id: "existing" });
    await expect(state.repository.copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    )).rejects.toBeInstanceOf(DestinationWeekAlreadyExistsError);
    expect(state.create).not.toHaveBeenCalled();
  });

  test("rejects a past destination before opening a transaction", async () => {
    const state = setup();
    await expect(state.repository.copySchedule(
      sourceScheduleId, "2029-01-01", new Date("2030-01-02T12:00:00.000Z"),
    )).rejects.toBeInstanceOf(PastDestinationWeekError);
    expect(state.findUnique).not.toHaveBeenCalled();
  });

  test("validates every assignment before creating the destination atomically", async () => {
    const state = setup();
    state.queryRaw
      .mockResolvedValueOnce([{ id: branchId }])
      .mockResolvedValueOnce([{ id: trainerId }])
      .mockResolvedValueOnce([]);
    await expect(state.repository.copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    )).rejects.toBeInstanceOf(BranchAssignmentError);
    expect(state.create).not.toHaveBeenCalled();
  });

  test("rejects an inactive branch and rolls back before creating the destination", async () => {
    const state = setup();
    state.branchFindUnique.mockResolvedValueOnce({ isActive: false });
    await expect(state.repository.copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    )).rejects.toEqual(expect.objectContaining({ reason: "INACTIVE" }));
    expect(state.create).not.toHaveBeenCalled();
  });

  test("rejects an inactive trainer and rolls back the complete copy", async () => {
    const state = setup();
    state.userFindUnique.mockResolvedValueOnce({
      role: "TRAINER", status: "INACTIVE", trainerProfile: { id: "profile" },
    });
    await expect(state.repository.copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    )).rejects.toBeInstanceOf(TrainerAssignmentError);
    expect(state.create).not.toHaveBeenCalled();
  });

  test("creates an empty destination when the source week has no classes", async () => {
    const state = setup();
    state.findUnique.mockReset()
      .mockResolvedValueOnce({ ...source, classes: [] })
      .mockResolvedValueOnce(null);
    await state.repository.copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    );
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ classes: { create: [] } }),
    }));
  });

  test("maps the unique-week race to an idempotent conflict without a second copy", async () => {
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError("duplicate week", {
      code: "P2002", clientVersion: "7.10.0",
    });
    const database = {
      $transaction: jest.fn().mockRejectedValue(uniqueConflict),
    } as unknown as PrismaClient;
    await expect(new WeeklyScheduleRepository(database).copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    )).rejects.toBeInstanceOf(DestinationWeekAlreadyExistsError);
  });
});

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  DestinationWeekAlreadyExistsError,
  PastDestinationWeekError,
  WeeklyScheduleRepository,
} from "../../src/repository/weekly-schedule-repository.js";
import { BranchAssignmentError } from "../../src/repository/scheduled-class-repository.js";

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
    queryRaw, userFindUnique };
}

describe("CLA-01 weekly schedule repository", () => {
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
});

describe("CLA-04 weekly schedule repository", () => {
  test("copies classes, adjusts dates, preserves the source and keeps optional trainers", async () => {
    const { repository, create, findUnique } = setup();
    const result = await repository.copySchedule(
      sourceScheduleId, "2030-09-09", new Date("2029-01-01T12:00:00.000Z"),
    );
    expect(result.weekStartsOn).toEqual(new Date("2030-09-09T00:00:00.000Z"));
    expect(findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: sourceScheduleId },
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
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
        }),
      }));
    expect(findUnique).toHaveBeenCalledTimes(2);
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
});

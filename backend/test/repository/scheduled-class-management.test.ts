import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  BranchAssignmentError,
  ClassOutsideWeekError,
  HistoricalClassError,
  ScheduledClassNotFoundError,
  ScheduledClassRepository,
  TrainerAssignmentError,
} from "../../src/repository/scheduled-class-repository.js";

const classId = "eb3bc849-5234-48a3-b54a-9f9e38608de2";
const branchId = "83cd902e-0475-4c92-943c-129b751dacee";
const otherBranchId = "34ef4014-f949-464c-9ac9-8ebde5d9aba4";
const trainerId = "e05a6f56-6db7-4be2-8a90-ce63830af177";
const now = new Date("2029-09-01T12:00:00.000Z");
const weekStartsOn = new Date("2030-09-02T00:00:00.000Z");
const input = {
  weekStartsOn: "2030-09-02", activity: "Yoga",
  startsAt: "2030-09-02T10:00:00-03:00", branchId, trainerId,
};
const record = {
  id: classId, scheduleId: "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84",
  branchId, trainerId, activity: "Yoga",
  startsAt: new Date("2030-09-02T13:00:00.000Z"),
  schedule: { weekStartsOn },
};

function setup() {
  const queryRaw = jest.fn().mockResolvedValue([{ id: branchId }]);
  const branchFindUnique = jest.fn().mockResolvedValue({ isActive: true });
  const userFindUnique = jest.fn().mockResolvedValue({
    role: "TRAINER", status: "ACTIVE", trainerProfile: { id: "profile" },
  });
  const upsert = jest.fn().mockResolvedValue({ id: record.scheduleId });
  const create = jest.fn().mockResolvedValue(record);
  const findUnique = jest.fn().mockResolvedValue(record);
  const update = jest.fn().mockResolvedValue(record);
  const deleteClass = jest.fn().mockResolvedValue(record);
  const transaction = {
    $queryRaw: queryRaw,
    branch: { findUnique: branchFindUnique },
    user: { findUnique: userFindUnique },
    weeklySchedule: { upsert },
    scheduledClass: { create, findUnique, update, delete: deleteClass },
  };
  const database = {
    $transaction: jest.fn().mockImplementation((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction)),
  } as unknown as PrismaClient;
  return { repository: new ScheduledClassRepository(database), queryRaw, branchFindUnique,
    userFindUnique, upsert, create, findUnique, update, deleteClass };
}

describe("CLA-02 weekly class persistence", () => {
  test("creates the first weekly schedule and class atomically", async () => {
    const { repository, upsert, create, queryRaw } = setup();
    const result = await repository.createClass(input, now);
    expect(result).toEqual({
      id: classId, scheduleId: record.scheduleId, branchId, trainerId,
      activity: "Yoga", startsAt: record.startsAt, weekStartsOn,
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { weekStartsOn }, update: {}, create: { weekStartsOn }, select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        scheduleId: record.scheduleId, branchId, trainerId,
        activity: "Yoga", startsAt: record.startsAt,
      },
      include: { schedule: { select: { weekStartsOn: true } } },
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.calls[0][0].join(" ")).toContain("FROM branch");
    expect(queryRaw.mock.calls[1][0].join(" ")).toContain('FROM "user"');
  });

  test("creates a class without a trainer", async () => {
    const { repository, userFindUnique, create, queryRaw } = setup();
    await repository.createClass({ ...input, trainerId: null }, now);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ trainerId: null }),
    }));
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  test("keeps a class in its existing week when editing its time", async () => {
    const { repository, update } = setup();
    await expect(repository.updateClass(classId,
      { startsAt: "2030-09-09T00:00:00-03:00" }, now))
      .rejects.toBeInstanceOf(ClassOutsideWeekError);
    expect(update).not.toHaveBeenCalled();

    await repository.updateClass(classId, { startsAt: "2030-09-08T23:59:00-03:00" }, now);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { startsAt: new Date("2030-09-09T02:59:00.000Z") },
    }));
  });

  test("can unassign a trainer without checking another trainer", async () => {
    const { repository, update, userFindUnique, queryRaw } = setup();
    await repository.updateClass(classId, { trainerId: null }, now);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { trainerId: null } }));
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  test("deletes a future class but never deletes its weekly schedule", async () => {
    const { repository, findUnique, deleteClass } = setup();
    findUnique.mockResolvedValue({ startsAt: record.startsAt });
    await repository.deleteClass(classId, now);
    expect(deleteClass).toHaveBeenCalledWith({ where: { id: classId } });
  });

  test("preserves classes that already started", async () => {
    const { repository, update, deleteClass } = setup();
    const afterClass = new Date("2030-09-02T14:00:00.000Z");
    await expect(repository.updateClass(classId, { activity: "Pilates" }, afterClass))
      .rejects.toBeInstanceOf(HistoricalClassError);
    await expect(repository.deleteClass(classId, afterClass))
      .rejects.toBeInstanceOf(HistoricalClassError);
    expect(update).not.toHaveBeenCalled();
    expect(deleteClass).not.toHaveBeenCalled();
  });

  test("does not create or reschedule a class into the past", async () => {
    const { repository, upsert, create, update } = setup();
    const afterClass = new Date("2030-09-02T14:00:00.000Z");
    await expect(repository.createClass(input, afterClass))
      .rejects.toBeInstanceOf(HistoricalClassError);
    await expect(repository.updateClass(classId,
      { startsAt: "2029-08-31T10:00:00-03:00" }, now))
      .rejects.toBeInstanceOf(HistoricalClassError);
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test("returns not found when the class row cannot be locked", async () => {
    const { repository, queryRaw } = setup();
    queryRaw.mockResolvedValue([]);
    await expect(repository.deleteClass(classId, now))
      .rejects.toBeInstanceOf(ScheduledClassNotFoundError);
  });
});

describe("CLA-03 assignment guards", () => {
  test("rejects an inactive branch before creating a schedule or class", async () => {
    const { repository, branchFindUnique, upsert, create } = setup();
    branchFindUnique.mockResolvedValue({ isActive: false });
    await expect(repository.createClass(input, now)).rejects.toMatchObject({
      reason: "INACTIVE",
    });
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("rejects a missing branch and inactive, non-trainer or missing trainers", async () => {
    const missingBranch = setup();
    missingBranch.queryRaw.mockResolvedValue([]);
    await expect(missingBranch.repository.createClass(input, now))
      .rejects.toMatchObject({ reason: "MISSING" });

    const inactive = setup();
    inactive.userFindUnique.mockResolvedValue({
      role: "TRAINER", status: "INACTIVE", trainerProfile: { id: "profile" },
    });
    await expect(inactive.repository.createClass(input, now))
      .rejects.toMatchObject({ reason: "INACTIVE" });

    const wrongRole = setup();
    wrongRole.userFindUnique.mockResolvedValue({
      role: "MEMBER", status: "ACTIVE", trainerProfile: null,
    });
    await expect(wrongRole.repository.createClass(input, now))
      .rejects.toBeInstanceOf(TrainerAssignmentError);

    const missingTrainer = setup();
    missingTrainer.queryRaw.mockResolvedValueOnce([{ id: branchId }]).mockResolvedValueOnce([]);
    await expect(missingTrainer.repository.createClass(input, now))
      .rejects.toMatchObject({ reason: "MISSING" });
  });

  test("checks a changed branch and trainer, but does not reassign unchanged relations", async () => {
    const changedBranch = setup();
    changedBranch.branchFindUnique.mockResolvedValue({ isActive: false });
    await expect(changedBranch.repository.updateClass(classId,
      { branchId: otherBranchId }, now)).rejects.toBeInstanceOf(BranchAssignmentError);
    expect(changedBranch.update).not.toHaveBeenCalled();

    const changedTrainer = setup();
    changedTrainer.userFindUnique.mockResolvedValue({
      role: "TRAINER", status: "INACTIVE", trainerProfile: { id: "profile" },
    });
    await expect(changedTrainer.repository.updateClass(classId,
      { trainerId: "34ef4014-f949-464c-9ac9-8ebde5d9aba4" }, now))
      .rejects.toBeInstanceOf(TrainerAssignmentError);
    expect(changedTrainer.update).not.toHaveBeenCalled();

    const unchanged = setup();
    await unchanged.repository.updateClass(classId, { activity: "Pilates" }, now);
    expect(unchanged.branchFindUnique).not.toHaveBeenCalled();
    expect(unchanged.userFindUnique).not.toHaveBeenCalled();
  });

  test("notices deactivation while waiting for the branch lock", async () => {
    const { repository, queryRaw, branchFindUnique, upsert, create } = setup();
    let releaseLock!: (value: Array<{ id: string }>) => void;
    queryRaw.mockImplementationOnce(() => new Promise((resolve) => { releaseLock = resolve; }));
    const pending = repository.createClass(input, now);
    branchFindUnique.mockResolvedValue({ isActive: false });
    releaseLock([{ id: branchId }]);
    await expect(pending).rejects.toMatchObject({ reason: "INACTIVE" });
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("notices trainer deactivation while waiting for the user lock", async () => {
    const { repository, queryRaw, userFindUnique, upsert, create } = setup();
    let releaseLock!: (value: Array<{ id: string }>) => void;
    let lockReached!: () => void;
    const waitingForLock = new Promise<void>((resolve) => { lockReached = resolve; });
    queryRaw.mockResolvedValueOnce([{ id: branchId }]).mockImplementationOnce(() => {
      lockReached();
      return new Promise((resolve) => { releaseLock = resolve; });
    });
    const pending = repository.createClass(input, now);
    await waitingForLock;
    userFindUnique.mockResolvedValue({
      role: "TRAINER", status: "INACTIVE", trainerProfile: { id: "profile" },
    });
    releaseLock([{ id: trainerId }]);
    await expect(pending).rejects.toMatchObject({ reason: "INACTIVE" });
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

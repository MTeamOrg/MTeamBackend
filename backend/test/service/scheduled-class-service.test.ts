import {
  BranchAssignmentError,
  ClassOutsideWeekError,
  HistoricalClassError,
  ScheduledClassNotFoundError,
  TrainerAssignmentError,
  type ScheduledClassRepositoryPort,
} from "../../src/repository/scheduled-class-repository.js";
import { ScheduledClassService } from "../../src/service/scheduled-class-service.js";

const classId = "eb3bc849-5234-48a3-b54a-9f9e38608de2";

test.each([
  [new ScheduledClassNotFoundError(), 404],
  [new BranchAssignmentError("MISSING"), 404],
  [new BranchAssignmentError("INACTIVE"), 409],
  [new TrainerAssignmentError("MISSING"), 404],
  [new TrainerAssignmentError("INVALID"), 400],
  [new TrainerAssignmentError("INACTIVE"), 409],
  [new ClassOutsideWeekError(), 400],
  [new HistoricalClassError(), 409],
] as const)("maps %p to HTTP %s", async (error, statusCode) => {
  const repository = {
    updateClass: jest.fn().mockRejectedValue(error),
  } as unknown as ScheduledClassRepositoryPort;
  const service = new ScheduledClassService(repository);
  await expect(service.updateClass(classId, { activity: "Yoga" }))
    .rejects.toMatchObject({ statusCode });
});

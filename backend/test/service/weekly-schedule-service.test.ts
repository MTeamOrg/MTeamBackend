import type { WeeklyScheduleRepositoryPort } from "../../src/repository/weekly-schedule-repository.js";
import {
  DestinationWeekAlreadyExistsError,
  DestinationWeekMustFollowSourceError,
} from "../../src/repository/weekly-schedule-repository.js";
import { ApplicationError } from "../../src/error/application-error.js";
import {
  BranchAssignmentError,
  TrainerAssignmentError,
} from "../../src/repository/scheduled-class-repository.js";
import { WeeklyScheduleService } from "../../src/service/weekly-schedule-service.js";

describe("CLA-01 weekly schedule service", () => {
  test("passes an explicitly requested Monday to the repository", async () => {
    const findByWeekStartsOn = jest.fn().mockResolvedValue({
      id: null,
      weekStartsOn: new Date("2030-09-02T00:00:00.000Z"),
      classes: [],
    });
    const repository = { findByWeekStartsOn } as unknown as WeeklyScheduleRepositoryPort;

    await new WeeklyScheduleService(repository).getByWeekStartsOn("2030-09-02");

    expect(findByWeekStartsOn).toHaveBeenCalledWith("2030-09-02");
  });

  test("defaults to the current Monday in Buenos Aires", async () => {
    const findByWeekStartsOn = jest.fn().mockResolvedValue({
      id: null,
      weekStartsOn: new Date("2030-09-09T00:00:00.000Z"),
      classes: [],
    });
    const repository = { findByWeekStartsOn } as unknown as WeeklyScheduleRepositoryPort;

    await new WeeklyScheduleService(repository).getByWeekStartsOn(
      undefined,
      new Date("2030-09-09T03:00:00.000Z"),
    );

    expect(findByWeekStartsOn).toHaveBeenCalledWith("2030-09-09");
  });
});

describe("CLA-04 weekly schedule service", () => {
  test("passes source, destination and the operation time to the repository", async () => {
    const copied = {
      id: "8e75fbd7-22cf-4e18-8e72-6ee20e0f00ad",
      weekStartsOn: new Date("2030-09-09T00:00:00.000Z"),
      classes: [],
    };
    const copySchedule = jest.fn().mockResolvedValue(copied);
    const repository = { copySchedule } as unknown as WeeklyScheduleRepositoryPort;
    const now = new Date("2030-09-01T12:00:00.000Z");

    await expect(new WeeklyScheduleService(repository).copySchedule(
      "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84", "2030-09-09", now,
    )).resolves.toEqual(copied);
    expect(copySchedule).toHaveBeenCalledWith(
      "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84", "2030-09-09", now,
    );
  });

  test.each([
    [new DestinationWeekMustFollowSourceError(), 400, "VALIDATION_ERROR"],
    [new DestinationWeekAlreadyExistsError(), 409, "CONFLICT"],
    [new BranchAssignmentError("INACTIVE"), 409, "CONFLICT"],
    [new TrainerAssignmentError("INACTIVE"), 409, "CONFLICT"],
  ])("maps copy-domain failures to documented API errors", async (failure, statusCode, code) => {
    const repository = {
      copySchedule: jest.fn().mockRejectedValue(failure),
    } as unknown as WeeklyScheduleRepositoryPort;

    await expect(new WeeklyScheduleService(repository).copySchedule(
      "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84", "2030-09-09",
    )).rejects.toEqual(expect.objectContaining<ApplicationError>({ statusCode, code }));
  });
});

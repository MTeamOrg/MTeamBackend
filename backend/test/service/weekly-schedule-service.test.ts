import type { WeeklyScheduleRepositoryPort } from "../../src/repository/weekly-schedule-repository.js";
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

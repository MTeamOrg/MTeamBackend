import {
  belongsToWeek,
  currentGymWeekStartsOn,
  gymWeekRange,
  isMonday,
} from "../../src/model/scheduled-class-week.js";

test("uses Monday-to-Monday calendar dates in Buenos Aires", () => {
  const weekStartsOn = "2030-09-02";
  expect(isMonday(weekStartsOn)).toBe(true);
  expect(isMonday("2030-09-03")).toBe(false);
  expect(belongsToWeek(weekStartsOn, new Date("2030-09-02T02:59:59.000Z")))
    .toBe(false);
  expect(belongsToWeek(weekStartsOn, new Date("2030-09-02T03:00:00.000Z")))
    .toBe(true);
  expect(belongsToWeek(weekStartsOn, new Date("2030-09-09T02:59:59.000Z")))
    .toBe(true);
  expect(belongsToWeek(weekStartsOn, new Date("2030-09-09T03:00:00.000Z")))
    .toBe(false);
});

test("builds exact Monday boundaries in Buenos Aires", () => {
  expect(gymWeekRange("2030-09-02")).toEqual({
    startsAt: new Date("2030-09-02T03:00:00.000Z"),
    endsAt: new Date("2030-09-09T03:00:00.000Z"),
  });
});

test("selects the current Buenos Aires week around the Sunday boundary", () => {
  expect(currentGymWeekStartsOn(new Date("2030-09-09T02:59:59.999Z")))
    .toBe("2030-09-02");
  expect(currentGymWeekStartsOn(new Date("2030-09-09T03:00:00.000Z")))
    .toBe("2030-09-09");
});

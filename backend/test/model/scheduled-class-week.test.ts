import {
  belongsToWeek,
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

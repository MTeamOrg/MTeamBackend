const GYM_TIME_ZONE = "America/Argentina/Buenos_Aires";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const localDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GYM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const localTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GYM_TIME_ZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
});

export function localGymDate(instant: Date): string {
  const parts = localDateFormatter.formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isMonday(isoDate: string): boolean {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay() === 1;
}

export function belongsToWeek(weekStartsOn: string, startsAt: Date): boolean {
  const nextWeekStartsOn = new Date(
    new Date(`${weekStartsOn}T00:00:00.000Z`).getTime() + 7 * MILLISECONDS_PER_DAY,
  ).toISOString().slice(0, 10);
  const classDate = localGymDate(startsAt);
  return classDate >= weekStartsOn && classDate < nextWeekStartsOn;
}

export function addDays(isoDate: string, days: number): string {
  return new Date(
    new Date(`${isoDate}T00:00:00.000Z`).getTime() + days * MILLISECONDS_PER_DAY,
  ).toISOString().slice(0, 10);
}

export function daysFromWeekStart(weekStartsOn: string, startsAt: Date): number {
  const start = new Date(`${weekStartsOn}T00:00:00.000Z`).getTime();
  const classDate = new Date(`${localGymDate(startsAt)}T00:00:00.000Z`).getTime();
  return Math.round((classDate - start) / MILLISECONDS_PER_DAY);
}

export function localGymTime(instant: Date): string {
  const parts = localTimeFormatter.formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get("hour")}:${get("minute")}:${get("second")}.${get("fractionalSecond")}`;
}

/** Buenos Aires has used UTC-03:00 for the schedule domain. */
export function atLocalGymTime(isoDate: string, time: string): Date {
  return new Date(`${isoDate}T${time}-03:00`);
}

export function currentGymWeekStartsOn(now: Date): string {
  const today = localGymDate(now);
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  return addDays(today, day === 0 ? -6 : 1 - day);
}

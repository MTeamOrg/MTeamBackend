const GYM_TIME_ZONE = "America/Argentina/Buenos_Aires";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const localDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GYM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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

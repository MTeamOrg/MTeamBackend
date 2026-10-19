import {
  classAssignedNotice,
  classCancelledNotice,
  classUnassignedNotice,
  classUpdatedNotice,
  eventCancelledNotice,
  formatGymDate,
  formatGymDateTime,
  formatGymTime,
  formatPesos,
  medicalCertificateReviewedNotice,
  membershipExpiredNotice,
  membershipExpiringNotice,
  membershipPriceIncreasedNotice,
  type ClassDetails,
} from "../../src/model/notification-message.js";

const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe("Buenos Aires date and time in notification texts", () => {
  test.each([
    ["the last second before midnight", "2036-03-04T02:59:59.999Z", "03/03/2036", "23:59"],
    ["midnight", "2036-03-04T03:00:00.000Z", "04/03/2036", "00:00"],
    ["the end of a month", "2036-04-01T02:30:00.000Z", "31/03/2036", "23:30"],
    ["the end of a year", "2037-01-01T02:59:00.000Z", "31/12/2036", "23:59"],
    ["the start of a year", "2037-01-01T03:00:00.000Z", "01/01/2037", "00:00"],
    ["a leap day", "2036-03-01T02:30:00.000Z", "29/02/2036", "23:30"],
    ["noon", "2036-06-15T15:00:00.000Z", "15/06/2036", "12:00"],
  ])("renders %s", (_label, instant, date, time) => {
    expect(formatGymDate(new Date(instant))).toBe(date);
    expect(formatGymTime(new Date(instant))).toBe(time);
    expect(formatGymDateTime(new Date(instant))).toBe(`${date} a las ${time}`);
  });

  test.each(["UTC", "Asia/Tokyo", "Pacific/Kiritimati", "America/Los_Angeles", "America/Argentina/Buenos_Aires"])(
    "does not depend on the time zone of the server (%s)",
    (timeZone) => {
      process.env.TZ = timeZone;
      const instant = new Date("2036-03-04T02:30:00.000Z");
      expect(formatGymDateTime(instant)).toBe("03/03/2036 a las 23:30");
    },
  );

  test("always uses 24-hour time", () => {
    expect(formatGymTime(new Date("2036-06-15T22:05:00.000Z"))).toBe("19:05");
    expect(formatGymTime(new Date("2036-06-15T03:05:00.000Z"))).toBe("00:05");
  });
});

describe("amounts in Argentine pesos", () => {
  test.each([
    [25000.5, "$ 25.000,50"],
    ["20000.00", "$ 20.000,00"],
    ["1234567.8", "$ 1.234.567,80"],
    [0.5, "$ 0,50"],
  ])("formats %s", (amount, expected) => {
    expect(formatPesos(amount)).toBe(expected);
    expect(formatPesos(amount)).not.toContain(" ");
  });
});

const yoga: ClassDetails = {
  activity: "Yoga",
  startsAt: new Date("2036-03-04T02:30:00.000Z"),
  branchId: "branch-centro",
  branchName: "Sede Centro",
};

describe("class notices", () => {
  test("assignment, removal and cancellation name the class, day, time and branch", () => {
    expect(classAssignedNotice(yoga)).toEqual({
      title: "Clase asignada",
      message: "Se te asignó la clase de Yoga el 03/03/2036 a las 23:30 en Sede Centro.",
    });
    expect(classUnassignedNotice(yoga)).toEqual({
      title: "Clase reasignada",
      message: "Ya no tenés asignada la clase de Yoga del 03/03/2036 a las 23:30 en Sede Centro.",
    });
    expect(classCancelledNotice(yoga)).toEqual({
      title: "Clase cancelada",
      message: "Se canceló la clase de Yoga del 03/03/2036 a las 23:30 en Sede Centro.",
    });
  });

  test("an update lists only what really changed", () => {
    const later = { ...yoga, startsAt: new Date("2036-03-04T13:00:00.000Z") };
    expect(classUpdatedNotice(yoga, later).message)
      .toBe("Se modificó la clase de Yoga: el horario cambió del 03/03/2036 a las 23:30 al 04/03/2036 a las 10:00.");

    const elsewhere = { ...yoga, branchId: "branch-norte", branchName: "Sede Norte" };
    expect(classUpdatedNotice(yoga, elsewhere).message)
      .toBe("Se modificó la clase de Yoga: la sede cambió de Sede Centro a Sede Norte.");

    const everything = {
      activity: "Pilates",
      startsAt: later.startsAt,
      branchId: elsewhere.branchId,
      branchName: elsewhere.branchName,
    };
    expect(classUpdatedNotice(yoga, everything)).toEqual({
      title: "Clase modificada",
      message: "Se modificó la clase de Pilates: la actividad cambió de Yoga a Pilates; el horario cambió del 03/03/2036 a las 23:30 al 04/03/2036 a las 10:00; la sede cambió de Sede Centro a Sede Norte.",
    });
  });
});

describe("other notices", () => {
  test("event cancellation", () => {
    expect(eventCancelledNotice({ title: "Torneo", startsAt: new Date("2036-03-04T02:30:00.000Z") })).toEqual({
      title: "Evento cancelado",
      message: 'Se canceló el evento "Torneo" previsto para el 03/03/2036 a las 23:30.',
    });
  });

  test("price increase states the new amount and the date it starts to apply", () => {
    expect(membershipPriceIncreasedNotice({ amount: "25000.00", effectiveFrom: new Date("2036-04-01T03:00:00.000Z") })).toEqual({
      title: "Aumento de cuota",
      message: "La cuota mensual pasa a ser de $ 25.000,00 desde el 01/04/2036.",
    });
  });

  test("fee notices state the expiry or its absence", () => {
    expect(membershipExpiringNotice(new Date("2037-01-01T02:59:00.000Z"))).toEqual({
      title: "Cuota próxima a vencer",
      message: "Tu cuota vence el 31/12/2036 a las 23:59.",
    });
    expect(membershipExpiredNotice(new Date("2036-03-02T15:00:00.000Z")).message)
      .toBe("Tu cuota venció el 02/03/2036 a las 12:00. Acercate a una sede de M-Team para abonarla: un administrador acreditará el pago y renovará tu acceso.");
    expect(membershipExpiredNotice(null)).toEqual({
      title: "Cuota vencida",
      message: "Todavía no tenés un pago acreditado, por eso tu cuota figura como vencida. Acercate a una sede de M-Team para abonarla: un administrador acreditará el pago y habilitará tu acceso.",
    });
  });

  test("an expired fee never asks the member to register a payment, which only an administrator can credit (R-07)", () => {
    for (const expiresAt of [null, new Date("2036-03-02T15:00:00.000Z")]) {
      expect(membershipExpiredNotice(expiresAt).message).not.toMatch(/Registr[aá] /);
      expect(membershipExpiredNotice(expiresAt).message).toContain("un administrador acreditará el pago");
    }
    // A member who never paid is not told that something "expired" or must be "renewed".
    expect(membershipExpiredNotice(null).message).not.toMatch(/venci[óo] el|renovar/);
  });

  test("medical certificate result includes the observation only when it was rejected", () => {
    expect(medicalCertificateReviewedNotice("APPROVED", "ignored")).toEqual({
      title: "Apto médico aprobado",
      message: "Tu apto médico fue aprobado por un administrador.",
    });
    expect(medicalCertificateReviewedNotice("REJECTED", "  Falta firma  ").message)
      .toBe("Tu apto médico fue rechazado. Observación: Falta firma");
    expect(medicalCertificateReviewedNotice("REJECTED", "   ").message).toBe("Tu apto médico fue rechazado.");
    expect(medicalCertificateReviewedNotice("REJECTED", undefined).message).toBe("Tu apto médico fue rechazado.");
  });
});

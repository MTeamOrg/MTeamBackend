import { GYM_TIME_ZONE } from "./scheduled-class-week.js";

/**
 * Texts of the internal notifications. Dates are always rendered in Buenos Aires time so the
 * persisted message does not depend on the time zone of the server that happens to run the API.
 */
export interface NotificationNotice {
  title: string;
  message: string;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: GYM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: GYM_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const pesosFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatGymDate(instant: Date): string {
  return dateFormatter.format(instant);
}

export function formatGymTime(instant: Date): string {
  return timeFormatter.format(instant);
}

/** "03/03/2036 a las 23:30" */
export function formatGymDateTime(instant: Date): string {
  return `${formatGymDate(instant)} a las ${formatGymTime(instant)}`;
}

/** "$ 25.000,50" (a plain space, not a non-breaking one, so stored texts stay simple). */
export function formatPesos(amount: number | string): string {
  return pesosFormatter.format(Number(amount)).replaceAll(" ", " ");
}

export interface ClassDetails {
  activity: string;
  startsAt: Date;
  branchId: string;
  branchName: string;
}

export function classAssignedNotice(details: ClassDetails): NotificationNotice {
  return {
    title: "Clase asignada",
    message: `Se te asignó la clase de ${details.activity} el ${formatGymDateTime(details.startsAt)} en ${details.branchName}.`,
  };
}

export function classUnassignedNotice(details: ClassDetails): NotificationNotice {
  return {
    title: "Clase reasignada",
    message: `Ya no tenés asignada la clase de ${details.activity} del ${formatGymDateTime(details.startsAt)} en ${details.branchName}.`,
  };
}

export function classCancelledNotice(details: ClassDetails): NotificationNotice {
  return {
    title: "Clase cancelada",
    message: `Se canceló la clase de ${details.activity} del ${formatGymDateTime(details.startsAt)} en ${details.branchName}.`,
  };
}

/** For the trainer who keeps the class: says exactly what changed. */
export function classUpdatedNotice(before: ClassDetails, after: ClassDetails): NotificationNotice {
  const changes: string[] = [];
  if (before.activity !== after.activity) {
    changes.push(`la actividad cambió de ${before.activity} a ${after.activity}`);
  }
  if (before.startsAt.getTime() !== after.startsAt.getTime()) {
    changes.push(`el horario cambió del ${formatGymDateTime(before.startsAt)} al ${formatGymDateTime(after.startsAt)}`);
  }
  if (before.branchId !== after.branchId) {
    changes.push(`la sede cambió de ${before.branchName} a ${after.branchName}`);
  }
  return {
    title: "Clase modificada",
    message: `Se modificó la clase de ${after.activity}: ${changes.join("; ")}.`,
  };
}

export function eventCancelledNotice(event: { title: string; startsAt: Date }): NotificationNotice {
  return {
    title: "Evento cancelado",
    message: `Se canceló el evento "${event.title}" previsto para el ${formatGymDateTime(event.startsAt)}.`,
  };
}

export function membershipPriceIncreasedNotice(price: { amount: number | string; effectiveFrom: Date }): NotificationNotice {
  return {
    title: "Aumento de cuota",
    message: `La cuota mensual pasa a ser de ${formatPesos(price.amount)} desde el ${formatGymDate(price.effectiveFrom)}.`,
  };
}

export function membershipExpiringNotice(expiresAt: Date): NotificationNotice {
  return {
    title: "Cuota próxima a vencer",
    message: `Tu cuota vence el ${formatGymDateTime(expiresAt)}.`,
  };
}

export function membershipExpiredNotice(expiresAt: Date | null): NotificationNotice {
  return {
    title: "Cuota vencida",
    message: expiresAt
      ? `Tu cuota venció el ${formatGymDateTime(expiresAt)}. Registrá un nuevo pago para mantener tu acceso.`
      : "Tu cuota se encuentra vencida. Registrá un nuevo pago para mantener tu acceso.",
  };
}

export function medicalCertificateReviewedNotice(
  status: "APPROVED" | "REJECTED",
  reviewComment: string | null | undefined,
): NotificationNotice {
  const comment = reviewComment?.trim();
  return status === "APPROVED"
    ? { title: "Apto médico aprobado", message: "Tu apto médico fue aprobado por un administrador." }
    : {
      title: "Apto médico rechazado",
      message: `Tu apto médico fue rechazado.${comment ? ` Observación: ${comment}` : ""}`,
    };
}

import { z } from "zod";

import { belongsToWeek, isMonday } from "../model/scheduled-class-week.js";

const activitySchema = z.string().trim().min(1).max(150);
const startsAtSchema = z.iso.datetime({ offset: true });

export const createScheduledClassSchema = z.strictObject({
  weekStartsOn: z.iso.date().refine(isMonday, "La semana debe comenzar un lunes"),
  activity: activitySchema,
  startsAt: startsAtSchema,
  branchId: z.uuid(),
  trainerId: z.uuid().nullable().optional(),
}).refine(
  (value) => belongsToWeek(value.weekStartsOn, new Date(value.startsAt)),
  { path: ["startsAt"], message: "La clase debe estar dentro de la semana indicada" },
);

export const updateScheduledClassSchema = z.strictObject({
  activity: activitySchema.optional(),
  startsAt: startsAtSchema.optional(),
  branchId: z.uuid().optional(),
  trainerId: z.uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Debe indicar al menos un campo para modificar",
});

export const scheduledClassIdParamsSchema = z.strictObject({ classId: z.uuid() });

export type CreateScheduledClassInput = z.infer<typeof createScheduledClassSchema>;
export type UpdateScheduledClassInput = z.infer<typeof updateScheduledClassSchema>;

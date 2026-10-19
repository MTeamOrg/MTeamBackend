import { z } from "zod";

import { isMonday } from "../model/scheduled-class-week.js";

const weekStartsOnSchema = z.iso.date().refine(isMonday, "La semana debe comenzar un lunes");

export const weeklyScheduleQuerySchema = z.strictObject({
  weekStartsOn: weekStartsOnSchema.optional(),
});

export const weeklyScheduleIdParamsSchema = z.strictObject({ scheduleId: z.uuid() });

export const copyWeeklyScheduleSchema = z.strictObject({
  weekStartsOn: weekStartsOnSchema,
});

export type WeeklyScheduleQuery = z.infer<typeof weeklyScheduleQuerySchema>;
export type CopyWeeklyScheduleInput = z.infer<typeof copyWeeklyScheduleSchema>;

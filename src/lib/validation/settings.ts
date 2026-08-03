import { z } from "zod";

export const settingsSchema = z.object({
  sex: z.enum(["MALE", "FEMALE"]).nullable().optional(),
  birthYear: z.coerce.number().int().min(1900).max(2020).nullable().optional(),
  heightCm: z.coerce.number().int().min(100).max(250).nullable().optional(),
  activityLevel: z
    .enum(["SEDENTARY", "LIGHT", "MODERATE", "HIGH", "ATHLETE"])
    .optional(),
  goal: z.enum(["LOSE", "MAINTAIN", "GAIN"]).optional(),
  kcalTarget: z.coerce.number().int().min(800).max(6000).optional(),
  proteinTargetG: z.coerce.number().int().min(0).max(600).nullable().optional(),
  fatTargetG: z.coerce.number().int().min(0).max(400).nullable().optional(),
  carbsTargetG: z.coerce.number().int().min(0).max(900).nullable().optional(),
  weightGoalKg: z.coerce.number().min(30).max(250).optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

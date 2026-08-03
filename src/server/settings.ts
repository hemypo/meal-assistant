import { prisma } from "@/lib/db";
import {
  ACTIVITY_LABELS,
  defaultMacros,
  estimateCalories,
  type CalorieEstimate,
} from "@/lib/nutrition";
import { runTask } from "@/lib/ai/tasks";
import type { SettingsInput } from "@/lib/validation/settings";
import type {
  ActivityLevel,
  NutritionGoal,
  Sex,
} from "@/generated/prisma/enums";

export type SettingsDTO = {
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  kcalTarget: number;
  proteinTargetG: number | null;
  fatTargetG: number | null;
  carbsTargetG: number | null;
  weightGoalKg: number;
  /** Latest logged weight — the calculation needs it, the form does not edit it. */
  currentWeightKg: number | null;
  /** null when the profile is incomplete. */
  estimate: CalorieEstimate | null;
};

const num = (v: { toString(): string }) => Number(v.toString());

async function loadLatestWeight(userId: string): Promise<number | null> {
  const row = await prisma.weightEntry.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { weightKg: true },
  });
  return row ? num(row.weightKg) : null;
}

export async function getSettings(userId: string): Promise<SettingsDTO | null> {
  const [user, currentWeightKg] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    loadLatestWeight(userId),
  ]);
  if (!user) return null;

  const estimate = estimateCalories(
    {
      sex: user.sex,
      birthYear: user.birthYear,
      heightCm: user.heightCm,
      weightKg: currentWeightKg,
      activityLevel: user.activityLevel,
      goal: user.goal,
    },
    new Date().getUTCFullYear(),
  );

  return {
    sex: user.sex,
    birthYear: user.birthYear,
    heightCm: user.heightCm,
    activityLevel: user.activityLevel,
    goal: user.goal,
    kcalTarget: user.kcalTarget,
    proteinTargetG: user.proteinTargetG,
    fatTargetG: user.fatTargetG,
    carbsTargetG: user.carbsTargetG,
    weightGoalKg: num(user.weightGoalKg),
    currentWeightKg,
    estimate,
  };
}

export async function updateSettings(
  userId: string,
  input: SettingsInput,
): Promise<SettingsDTO | null> {
  await prisma.user.update({ where: { id: userId }, data: input });
  return getSettings(userId);
}

export type NutritionPlan = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  summary: string;
  tips: string[];
  /** True when Gemini was unavailable and the deterministic split was used. */
  fallback: boolean;
};

/**
 * Builds a nutrition plan for the user.
 *
 * The calorie number is computed, never asked of the model. Gemini only
 * writes the explanation and proposes the macro split — and if it is
 * unavailable, or returns macros that do not add up to the target, the
 * deterministic split is used instead. The user always gets a usable plan.
 */
export async function buildNutritionPlan(
  userId: string,
): Promise<NutritionPlan | null> {
  const settings = await getSettings(userId);
  if (!settings?.estimate || settings.currentWeightKg === null) return null;

  const kcal = settings.estimate.recommendedKcal;
  const safe = defaultMacros(kcal, settings.goal);

  try {
    const result = await runTask("explain_nutrition", {
      kcal,
      goal: settings.goal,
      activity: ACTIVITY_LABELS[settings.activityLevel],
      weightKg: settings.currentWeightKg,
      goalWeightKg: settings.weightGoalKg,
    });

    // Trust the model's wording, verify its arithmetic: if the split does not
    // reconstruct the target within 5%, keep the computed one.
    const modelKcal =
      result.proteinG * 4 + result.fatG * 9 + result.carbsG * 4;
    const drifted = Math.abs(modelKcal - kcal) > kcal * 0.05;

    return {
      kcal,
      proteinG: drifted ? safe.proteinG : result.proteinG,
      fatG: drifted ? safe.fatG : result.fatG,
      carbsG: drifted ? safe.carbsG : result.carbsG,
      summary: result.summary,
      tips: result.tips,
      fallback: drifted,
    };
  } catch {
    return {
      kcal,
      ...safe,
      summary:
        "Норма рассчитана по формуле Миффлина—Сан Жеора с учётом вашей активности и цели.",
      tips: [],
      fallback: true,
    };
  }
}

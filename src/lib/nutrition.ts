import type {
  ActivityLevel,
  NutritionGoal,
  Sex,
} from "@/generated/prisma/enums";

/**
 * Daily calorie needs, computed — not guessed by an LLM.
 *
 * Mifflin-St Jeor is the standard clinical estimator and is plain arithmetic,
 * so it is deterministic, instant, free and unit-testable. Gemini is used only
 * to *explain* the result and propose a macro split (see the `explain_nutrition`
 * task), which is judgement and language rather than sums.
 *
 * These are population estimates, not medical advice — the UI says so, and the
 * user can always override the number.
 */

/** Standard TDEE multipliers. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  HIGH: 1.725,
  ATHLETE: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  SEDENTARY: "Сидячий образ жизни",
  LIGHT: "Лёгкая активность (1–3 раза в неделю)",
  MODERATE: "Умеренная (3–5 раз в неделю)",
  HIGH: "Высокая (6–7 раз в неделю)",
  ATHLETE: "Очень высокая (спорт, физический труд)",
};

/** −15% to lose, +10% to gain — conservative, sustainable rates. */
export const GOAL_ADJUSTMENTS: Record<NutritionGoal, number> = {
  LOSE: -0.15,
  MAINTAIN: 0,
  GAIN: 0.1,
};

export const GOAL_LABELS: Record<NutritionGoal, string> = {
  LOSE: "Снизить вес",
  MAINTAIN: "Поддерживать вес",
  GAIN: "Набрать вес",
};

export const SEX_LABELS: Record<Sex, string> = {
  MALE: "Мужской",
  FEMALE: "Женский",
};

export type NutritionProfile = {
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
};

export type CalorieEstimate = {
  bmr: number;
  tdee: number;
  /** TDEE adjusted for the goal — the recommended daily intake. */
  recommendedKcal: number;
  /** Never below this floor, whatever the maths says. */
  clampedToFloor: boolean;
};

/**
 * Health floor. A deficit that drops below roughly 1200/1500 kcal is not
 * something this app should ever recommend, so the goal adjustment is clamped.
 */
const FLOOR_KCAL: Record<Sex, number> = { FEMALE: 1200, MALE: 1500 };

/**
 * Returns null when the profile is incomplete — the caller shows a prompt to
 * fill it in rather than inventing a number from missing data.
 */
export function estimateCalories(
  profile: NutritionProfile,
  currentYear: number,
): CalorieEstimate | null {
  const { sex, birthYear, heightCm, weightKg, activityLevel, goal } = profile;
  if (!sex || !birthYear || !heightCm || !weightKg) return null;

  const age = currentYear - birthYear;
  if (age < 10 || age > 120) return null;

  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = Math.round(sex === "MALE" ? base + 5 : base - 161);

  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);

  const adjusted = Math.round(tdee * (1 + GOAL_ADJUSTMENTS[goal]));
  const floor = FLOOR_KCAL[sex];
  const recommendedKcal = Math.max(adjusted, floor);

  return {
    bmr,
    tdee,
    recommendedKcal,
    clampedToFloor: adjusted < floor,
  };
}

/**
 * A sane default macro split so the user is never left with calories but no
 * Б/Ж/У. The AI task can refine it; this guarantees a usable answer without
 * an AI call, and is what we fall back to if Gemini is unavailable.
 */
export function defaultMacros(
  kcal: number,
  goal: NutritionGoal,
): { proteinG: number; fatG: number; carbsG: number } {
  // Protein higher when cutting (preserves muscle), fat steady at ~30%.
  const proteinShare = goal === "LOSE" ? 0.3 : goal === "GAIN" ? 0.25 : 0.25;
  const fatShare = 0.3;

  const proteinG = Math.round((kcal * proteinShare) / 4);
  const fatG = Math.round((kcal * fatShare) / 9);
  const carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);

  return { proteinG, fatG, carbsG: Math.max(0, carbsG) };
}

import { describe, expect, it } from "vitest";
import { defaultMacros, estimateCalories } from "./nutrition";

const base = {
  sex: "MALE" as const,
  birthYear: 1994,
  heightCm: 180,
  weightKg: 80,
  activityLevel: "MODERATE" as const,
  goal: "MAINTAIN" as const,
};

describe("Mifflin-St Jeor", () => {
  it("matches the published formula for men", () => {
    // 10*80 + 6.25*180 - 5*32 + 5 = 800 + 1125 - 160 + 5 = 1770
    const result = estimateCalories(base, 2026);
    expect(result?.bmr).toBe(1770);
  });

  it("matches the published formula for women", () => {
    // same body, female: 800 + 1125 - 160 - 161 = 1604
    const result = estimateCalories({ ...base, sex: "FEMALE" }, 2026);
    expect(result?.bmr).toBe(1604);
  });

  it("applies the activity multiplier to reach TDEE", () => {
    // 1770 * 1.55 = 2743.5 -> 2744
    expect(estimateCalories(base, 2026)?.tdee).toBe(2744);
  });

  it("cuts 15% to lose and adds 10% to gain", () => {
    const lose = estimateCalories({ ...base, goal: "LOSE" }, 2026);
    const gain = estimateCalories({ ...base, goal: "GAIN" }, 2026);

    expect(lose?.recommendedKcal).toBe(Math.round(2744 * 0.85)); // 2332
    expect(gain?.recommendedKcal).toBe(Math.round(2744 * 1.1)); // 3018
  });

  it("never recommends below the health floor", () => {
    // Tiny, sedentary, cutting — the raw maths would go under 1200.
    const result = estimateCalories(
      {
        sex: "FEMALE",
        birthYear: 1960,
        heightCm: 150,
        weightKg: 45,
        activityLevel: "SEDENTARY",
        goal: "LOSE",
      },
      2026,
    );

    expect(result?.recommendedKcal).toBe(1200);
    expect(result?.clampedToFloor).toBe(true);
  });
});

describe("incomplete profiles", () => {
  it("returns null rather than inventing a number", () => {
    expect(estimateCalories({ ...base, heightCm: null }, 2026)).toBeNull();
    expect(estimateCalories({ ...base, weightKg: null }, 2026)).toBeNull();
    expect(estimateCalories({ ...base, sex: null }, 2026)).toBeNull();
    expect(estimateCalories({ ...base, birthYear: null }, 2026)).toBeNull();
  });

  it("rejects an implausible age", () => {
    expect(estimateCalories({ ...base, birthYear: 1800 }, 2026)).toBeNull();
    expect(estimateCalories({ ...base, birthYear: 2025 }, 2026)).toBeNull();
  });
});

describe("macro split", () => {
  it("splits calories into Б/Ж/У that add back up", () => {
    const { proteinG, fatG, carbsG } = defaultMacros(2000, "MAINTAIN");
    const kcal = proteinG * 4 + fatG * 9 + carbsG * 4;

    // Rounding to whole grams can drift a few kcal; anything more is a bug.
    expect(Math.abs(kcal - 2000)).toBeLessThanOrEqual(5);
  });

  it("raises protein when cutting", () => {
    const lose = defaultMacros(2000, "LOSE");
    const maintain = defaultMacros(2000, "MAINTAIN");

    expect(lose.proteinG).toBeGreaterThan(maintain.proteinG);
  });

  it("never returns negative carbs on a very low target", () => {
    expect(defaultMacros(800, "LOSE").carbsG).toBeGreaterThanOrEqual(0);
  });
});

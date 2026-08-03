"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  SEX_LABELS,
} from "@/lib/nutrition";
import type { SettingsDTO, NutritionPlan } from "@/server/settings";

const ru = (n: number) => String(n).replace(".", ",");

export function SettingsView() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [plan, setPlan] = useState<NutritionPlan>();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<SettingsDTO> => {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("Не удалось загрузить настройки");
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Не удалось сохранить");
      return body as SettingsDTO;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["settings"], next);
      queryClient.invalidateQueries({ queryKey: ["weights"] });
      toast("Настройки сохранены");
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : "Не удалось сохранить"),
  });

  const buildPlan = useMutation({
    mutationFn: async (): Promise<NutritionPlan> => {
      const r = await fetch("/api/settings/plan", { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Не удалось построить план");
      return body;
    },
    onSuccess: (result) => setPlan(result),
    onError: (e) =>
      toast(e instanceof Error ? e.message : "Не удалось построить план"),
  });

  const applyPlan = () => {
    if (!plan) return;
    save.mutate({
      kcalTarget: plan.kcal,
      proteinTargetG: plan.proteinG,
      fatTargetG: plan.fatG,
      carbsTargetG: plan.carbsG,
    });
  };

  if (isLoading || !settings) {
    return (
      <>
        <ScreenHeader
          kicker="06 · Профиль"
          title="Настройки"
          subtitle="Загружаем…"
        />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </>
    );
  }

  const estimate = settings.estimate;
  const profileComplete = estimate !== null;

  return (
    <>
      <ScreenHeader
        kicker="06 · Профиль"
        title="Настройки"
        subtitle={
          profileComplete
            ? `Норма ${settings.kcalTarget} ккал в день`
            : "Заполните профиль, чтобы рассчитать норму"
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          {/* ---- profile ---- */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-1 text-[18px] font-bold">Мои данные</h2>
            <p className="mb-4 text-[13px] font-medium text-muted-foreground">
              По ним рассчитывается суточная норма калорий.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                id="sex"
                label="Пол"
                value={settings.sex ?? ""}
                onChange={(e) =>
                  save.mutate({ sex: e.target.value || null })
                }
              >
                <option value="">не указан</option>
                {(["MALE", "FEMALE"] as const).map((s) => (
                  <option key={s} value={s}>
                    {SEX_LABELS[s]}
                  </option>
                ))}
              </Select>

              <Field
                id="birthYear"
                label="Год рождения"
                inputMode="numeric"
                placeholder="1994"
                defaultValue={settings.birthYear ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  save.mutate({ birthYear: v === "" ? null : Number(v) });
                }}
              />

              <Field
                id="heightCm"
                label="Рост, см"
                inputMode="numeric"
                placeholder="180"
                defaultValue={settings.heightCm ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  save.mutate({ heightCm: v === "" ? null : Number(v) });
                }}
              />

              <Field
                id="weightGoalKg"
                label="Целевой вес, кг"
                inputMode="decimal"
                defaultValue={ru(settings.weightGoalKg)}
                onBlur={(e) =>
                  save.mutate({
                    weightGoalKg: Number(e.target.value.replace(",", ".")),
                  })
                }
              />

              <Select
                id="activityLevel"
                label="Активность"
                className="sm:col-span-2"
                value={settings.activityLevel}
                onChange={(e) => save.mutate({ activityLevel: e.target.value })}
              >
                {(
                  ["SEDENTARY", "LIGHT", "MODERATE", "HIGH", "ATHLETE"] as const
                ).map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_LABELS[a]}
                  </option>
                ))}
              </Select>

              <Select
                id="goal"
                label="Цель"
                className="sm:col-span-2"
                value={settings.goal}
                onChange={(e) => save.mutate({ goal: e.target.value })}
              >
                {(["LOSE", "MAINTAIN", "GAIN"] as const).map((g) => (
                  <option key={g} value={g}>
                    {GOAL_LABELS[g]}
                  </option>
                ))}
              </Select>
            </div>

            <p className="tabular mt-4 border-t border-border pt-3 text-[13px] font-medium text-muted-foreground">
              Текущий вес берётся из раздела «Вес»:{" "}
              <span className="font-bold text-foreground">
                {settings.currentWeightKg !== null
                  ? `${ru(settings.currentWeightKg)} кг`
                  : "ещё не записан"}
              </span>
            </p>
          </section>

          {/* ---- targets ---- */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-1 text-[18px] font-bold">Мои нормы</h2>
            <p className="mb-4 text-[13px] font-medium text-muted-foreground">
              Эти значения используются в кольце дня и при подборе рецептов.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                id="kcalTarget"
                label="Ккал в день"
                inputMode="numeric"
                defaultValue={settings.kcalTarget}
                onBlur={(e) =>
                  save.mutate({ kcalTarget: Number(e.target.value) })
                }
              />
              <Field
                id="proteinTargetG"
                label="Белки, г"
                inputMode="numeric"
                defaultValue={settings.proteinTargetG ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  save.mutate({ proteinTargetG: v === "" ? null : Number(v) });
                }}
              />
              <Field
                id="fatTargetG"
                label="Жиры, г"
                inputMode="numeric"
                defaultValue={settings.fatTargetG ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  save.mutate({ fatTargetG: v === "" ? null : Number(v) });
                }}
              />
              <Field
                id="carbsTargetG"
                label="Углеводы, г"
                inputMode="numeric"
                defaultValue={settings.carbsTargetG ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  save.mutate({ carbsTargetG: v === "" ? null : Number(v) });
                }}
              />
            </div>
          </section>
        </div>

        {/* ---- calculation + AI plan ---- */}
        <div className="flex flex-col gap-6">
          {profileComplete ? (
            <>
              <div className="grid gap-4">
                <StatCard
                  label="Рекомендуемая норма"
                  value={`${estimate.recommendedKcal} ккал`}
                  delta={`обмен покоя ${estimate.bmr} · расход ${estimate.tdee} ккал`}
                />
              </div>

              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="mb-1 text-[18px] font-bold">Персональный план</h2>
                <p className="mb-4 text-[13px] font-medium text-muted-foreground">
                  Норма считается по формуле Миффлина—Сан Жеора. ИИ объясняет
                  её и предлагает разбивку Б/Ж/У.
                </p>

                <Button
                  type="button"
                  onClick={() => buildPlan.mutate()}
                  disabled={buildPlan.isPending}
                  className="w-full"
                >
                  {buildPlan.isPending ? (
                    <>
                      <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                      Gemini думает…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-[18px] w-[18px]" aria-hidden />
                      Построить план
                    </>
                  )}
                </Button>

                {plan && (
                  <div className="mt-4 flex flex-col gap-3">
                    <p className="text-[13px] font-medium leading-relaxed">
                      {plan.summary}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="tabular rounded-full bg-[var(--kcal-soft)] px-3 py-1.5 text-[13px] font-bold text-[var(--kcal)]">
                        К {plan.kcal}
                      </span>
                      <span className="tabular rounded-full bg-[var(--protein-soft)] px-3 py-1.5 text-[13px] font-bold text-[var(--protein-strong)]">
                        Б {plan.proteinG}
                      </span>
                      <span className="tabular rounded-full bg-[var(--fat-soft)] px-3 py-1.5 text-[13px] font-bold text-[var(--fat-strong)]">
                        Ж {plan.fatG}
                      </span>
                      <span className="tabular rounded-full bg-[var(--carbs-soft)] px-3 py-1.5 text-[13px] font-bold text-[var(--carbs-strong)]">
                        У {plan.carbsG}
                      </span>
                    </div>

                    {plan.tips.length > 0 && (
                      <ul className="flex flex-col gap-1.5">
                        {plan.tips.map((tip) => (
                          <li
                            key={tip}
                            className="text-[13px] font-medium text-muted-foreground"
                          >
                            • {tip}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button
                      variant="tonal"
                      type="button"
                      onClick={applyPlan}
                      disabled={save.isPending}
                    >
                      Применить как мои нормы
                    </Button>
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="mb-2 text-[18px] font-bold">Норма не рассчитана</h2>
              <p className="text-[13px] font-medium text-muted-foreground">
                Укажите пол, год рождения и рост, а также запишите текущий вес в
                разделе «Вес» — после этого норма посчитается автоматически.
              </p>
            </section>
          )}

          <p className="flex items-start gap-2 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] font-medium text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Расчёт — усреднённая оценка, а не медицинская рекомендация. При
            заболеваниях, беременности или сомнениях обсудите норму с врачом.
            Любое значение можно изменить вручную.
          </p>
        </div>
      </div>
    </>
  );
}

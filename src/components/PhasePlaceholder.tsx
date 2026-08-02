import type { LucideIcon } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";

/**
 * Honest "not built yet" surface for modules that land in later phases.
 * Names the phase rather than pretending the feature is coming "soon".
 */
export function PhasePlaceholder({
  kicker,
  title,
  phase,
  icon: Icon,
}: {
  kicker: string;
  title: string;
  phase: string;
  icon: LucideIcon;
}) {
  return (
    <>
      <ScreenHeader kicker={kicker} title={title} subtitle="Раздел ещё не построен" />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-soft">
        <div className="flex h-15 w-15 items-center justify-center rounded-full bg-muted p-4">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-[15px] font-bold">Появится в {phase}</p>
        <p className="max-w-80 text-[13px] font-medium text-muted-foreground">
          Сейчас работает раздел «Запасы». Остальные модули подключаются по
          плану разработки, фаза за фазой.
        </p>
      </div>
    </>
  );
}

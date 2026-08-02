import { BarChart3 } from "lucide-react";
import { PhasePlaceholder } from "@/components/PhasePlaceholder";

export default function FinancePage() {
  return (
    <PhasePlaceholder
      kicker="04 · Деньги"
      title="Финансы"
      phase="фазе 5"
      icon={BarChart3}
    />
  );
}

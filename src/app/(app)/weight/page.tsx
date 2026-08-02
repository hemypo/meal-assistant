import { Scale } from "lucide-react";
import { PhasePlaceholder } from "@/components/PhasePlaceholder";

export default function WeightPage() {
  return (
    <PhasePlaceholder
      kicker="05 · Здоровье"
      title="Вес"
      phase="фазе 5"
      icon={Scale}
    />
  );
}

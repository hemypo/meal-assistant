import { ChefHat } from "lucide-react";
import { PhasePlaceholder } from "@/components/PhasePlaceholder";

export default function MenuPage() {
  return (
    <PhasePlaceholder
      kicker="02 · Меню"
      title="Рацион"
      phase="фазе 3"
      icon={ChefHat}
    />
  );
}

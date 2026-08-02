import { Receipt } from "lucide-react";
import { PhasePlaceholder } from "@/components/PhasePlaceholder";

export default function ReceiptsPage() {
  return (
    <PhasePlaceholder
      kicker="03 · Покупки"
      title="Чеки"
      phase="фазе 4"
      icon={Receipt}
    />
  );
}

import type { LucideIcon } from "lucide-react";

/** MASTER.md §5 EmptyState — every list and pane has one. */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-15 w-15 items-center justify-center rounded-full bg-muted p-4">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      <p className="max-w-60 text-[13px] font-medium text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

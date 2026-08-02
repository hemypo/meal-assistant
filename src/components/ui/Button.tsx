import { cn } from "@/lib/utils";

type Variant = "primary" | "tonal" | "ghost";

const VARIANTS: Record<Variant, string> = {
  // Filled CTAs use --primary-foreground, never white-on-bright (MASTER.md §3.1).
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-strong disabled:opacity-50",
  tonal: "bg-muted text-foreground hover:bg-border disabled:opacity-50",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-bold",
        "cursor-pointer transition-all duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        "active:scale-[0.97] disabled:cursor-default disabled:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

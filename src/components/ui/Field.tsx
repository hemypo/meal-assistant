import { cn } from "@/lib/utils";

/**
 * Label is always visible — placeholder is never the only label (MASTER.md §5).
 * This is the template for all single-row add forms (WeightEntryForm rule).
 */
export function Field({
  label,
  error,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(
          "rounded-[10px] bg-muted px-3.5 py-2.5 text-base font-semibold text-foreground",
          "border border-transparent placeholder:font-medium placeholder:text-muted-foreground",
          "transition-all duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          "focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring",
          error && "border-destructive",
        )}
        {...props}
      />
      {error && (
        <p id={describedBy} className="text-[13px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  className,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          "cursor-pointer rounded-[10px] bg-muted px-3.5 py-2.5 text-base font-semibold text-foreground",
          "border border-transparent transition-all duration-[160ms]",
          "focus:bg-card focus:outline-2 focus:outline-offset-2 focus:outline-ring",
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

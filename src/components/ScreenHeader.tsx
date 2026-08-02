/** MASTER.md §5 ScreenHeader: kicker + H1 + one-line subtitle, action on the right. */
export function ScreenHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {kicker}
        </p>
        <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] lg:text-[40px]">
          {title}
        </h1>
        <p className="tabular mt-1 text-sm font-medium text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {action}
    </header>
  );
}

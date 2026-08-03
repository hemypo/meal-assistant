/** Reserves the screen-header + content shape so navigation doesn't shift. */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Загружаем раздел</span>
      <div className="mb-[30px]">
        <div className="mb-2 h-3 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-10 w-56 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}

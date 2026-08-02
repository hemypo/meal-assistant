import { Utensils } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="animate-screen-enter w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Utensils className="h-5 w-5 text-primary-foreground" aria-hidden />
          </div>
          <div className="text-center">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
              Провизия
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
              кухня под контролем
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          {children}
        </div>
      </div>
    </main>
  );
}

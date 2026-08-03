import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex h-15 w-15 items-center justify-center rounded-full bg-muted p-4">
        <Compass className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-[22px] font-extrabold">Страница не найдена</h1>
      <p className="max-w-80 text-[13px] font-medium text-muted-foreground">
        Такого раздела нет. Вернитесь к запасам — оттуда доступно всё остальное.
      </p>
      <Link
        href="/inventory"
        className="mt-1 cursor-pointer rounded-2xl bg-primary px-5 py-3 text-[15px] font-bold text-primary-foreground transition-colors duration-[160ms] hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        К запасам
      </Link>
    </main>
  );
}

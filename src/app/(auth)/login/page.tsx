import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <>
      <h2 className="mb-1 text-[22px] font-extrabold leading-tight">Вход</h2>
      <p className="mb-6 text-sm font-medium text-muted-foreground">
        Введите email и пароль, чтобы продолжить.
      </p>
      <LoginForm />
      <p className="mt-5 text-center text-[13px] font-medium text-muted-foreground">
        Нет аккаунта?{" "}
        <Link
          href="/register"
          className="cursor-pointer font-bold text-primary hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </>
  );
}

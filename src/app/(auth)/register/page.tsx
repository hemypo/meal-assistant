import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <>
      <h2 className="mb-1 text-[22px] font-extrabold leading-tight">
        Регистрация
      </h2>
      <p className="mb-6 text-sm font-medium text-muted-foreground">
        Приложение рассчитано на одного пользователя — регистрация открыта
        только для разрешённого адреса.
      </p>
      <RegisterForm />
      <p className="mt-5 text-center text-[13px] font-medium text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link
          href="/login"
          className="cursor-pointer font-bold text-primary hover:underline"
        >
          Войти
        </Link>
      </p>
    </>
  );
}

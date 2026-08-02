import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email("Введите корректный email").trim().toLowerCase(),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

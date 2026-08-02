import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the Auth.js config: no Prisma, no argon2.
 * `middleware.ts` imports this; `auth.ts` extends it with the Credentials provider.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

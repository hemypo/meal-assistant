import { cleanupOrphanRecipes } from "@/server/cleanup";

/**
 * Vercel cron target. There is no user session on a cron request, so the route
 * is gated on CRON_SECRET instead — otherwise anyone could trigger deletions
 * by hitting the URL.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the
 * variable is set on the project.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Fail closed: with no secret configured the endpoint is disabled entirely,
  // rather than silently becoming a public delete button.
  if (!secret) {
    return Response.json({ error: "Cron is not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }

  const deleted = await cleanupOrphanRecipes();
  return Response.json({ deleted });
}

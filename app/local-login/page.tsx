import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LocalLoginForm from "@/components/auth/LocalLoginForm";

/**
 * /local-login — local portal username/password sign-in (no Microsoft Entra).
 * A separate page so the Microsoft login at /login is completely untouched.
 * Access levels: viewer (Dashboard) / analyst (+ Analytics) / admin (+ Settings).
 */
export default async function LocalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const { error, code, callbackUrl } = await searchParams;

  // Already signed in? Go straight to the portal.
  if (session?.user) redirect("/dashboard");

  return <LocalLoginForm error={error} code={code} callbackUrl={callbackUrl} />;
}

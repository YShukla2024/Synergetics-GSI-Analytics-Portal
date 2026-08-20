import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "@/components/auth/LoginForm";

/**
 * /login — Microsoft Entra ID sign-in page.
 * Server shell: reads the session and any Auth.js error, then hands off to the
 * client LoginForm which starts the OAuth redirect.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const { error, code, callbackUrl } = await searchParams;

  // Already signed in? Go straight to the portal.
  if (session?.user) redirect("/dashboard");

  return <LoginForm error={error} code={code} callbackUrl={callbackUrl} />;
}

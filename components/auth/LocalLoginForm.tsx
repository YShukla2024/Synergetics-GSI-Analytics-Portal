"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Loader2, AlertCircle, User, Lock, KeyRound, ShieldCheck, ArrowLeft } from "lucide-react";

/**
 * Error codes returned by the local-credentials provider — each mapped to a
 * clear, client-safe message.
 */
const LOCAL_ERRORS: Record<string, string> = {
  invalid_credentials:
    "Incorrect username or password. Check your details and try again.",
  config_error:
    "Local portal sign-in is not configured. Ask your administrator to set up accounts in local-users.json.",
};

const FALLBACK_ERROR = "Sign-in failed. Please try again.";

export default function LocalLoginForm({
  error,
  code,
  callbackUrl,
}: {
  error?: string;
  code?: string;
  callbackUrl?: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const target =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/dashboard";

  function message(codeValue?: string): string {
    return LOCAL_ERRORS[codeValue ?? ""] ?? FALLBACK_ERROR;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!username.trim() || !password) {
      setFormError("Enter your username and password.");
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      const result = await signIn("local-credentials", {
        username: username.trim(),
        password,
        redirect: false,
        callbackUrl: target,
      });
      if (result?.error) {
        setFormError(
          result.error === "CredentialsSignin" ? message(result.code) : FALLBACK_ERROR
        );
        setLoading(false);
        return;
      }
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      setLoading(false);
    } catch {
      setLoading(false);
      setFormError(FALLBACK_ERROR);
    }
  }

  const serverError = error ? message(code) : null;
  const shownError = formError ?? serverError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-[#C94A7B] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div aria-hidden className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-primary-light/25 blur-3xl" />
      <div aria-hidden className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

      <div className="relative w-full max-w-sm bg-white rounded-card border border-surface-border shadow-elevated p-7 space-y-5">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-display uppercase tracking-wide text-lg font-semibold text-ink">
            GSI Analytics Portal
          </h1>
          <p className="text-sm text-ink-subtle mt-1 leading-relaxed">
            Synergetics Information Technology Services India Pvt Ltd
          </p>
        </div>

        {shownError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-status-danger/30 bg-status-danger/5 px-3 py-2.5 text-sm text-status-danger"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{shownError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="local-username" className="block text-xs font-medium text-ink-subtle mb-1">
              Username
            </label>
            <div className="relative">
              <User
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-disabled"
                aria-hidden
              />
              <input
                id="local-username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="e.g. viewer"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-surface-border bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="local-password" className="block text-xs font-medium text-ink-subtle mb-1">
              Password
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-disabled"
                aria-hidden
              />
              <input
                id="local-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-surface-border bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <KeyRound size={15} />
            )}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="border-t border-surface-border pt-3 space-y-2">
          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-xs text-ink-subtle hover:text-primary transition-colors"
          >
            <ArrowLeft size={13} />
            Sign in with your Microsoft work account instead
          </Link>
          <p className="flex items-center justify-center gap-1 text-[11px] text-ink-disabled text-center">
            <ShieldCheck size={12} />
            Access levels: Viewer · Analyst · Administrator
          </p>
        </div>
      </div>
    </div>
  );
}

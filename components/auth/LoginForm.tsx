"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import {
  ShieldCheck,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  KeyRound,
} from "lucide-react";

/**
 * Error codes returned by the Credentials provider (?error=CredentialsSignin
 * &code=<code>) — each mapped to a clear, client-safe message.
 */
const CREDENTIAL_ERRORS: Record<string, string> = {
  invalid_credentials:
    "Incorrect email or password. Check your details and try again.",
  mfa_required:
    "Your account requires additional verification (multi-factor authentication / conditional access), which the email + password form cannot complete. Use the Microsoft SSO option below instead.",
  account_blocked:
    "Your account is locked or disabled. Contact your administrator, or sign in with Microsoft SSO.",
  password_expired:
    "Your password has expired. Reset it by signing in with Microsoft SSO, then contact your administrator if needed.",
  consent_required:
    "Sign-in succeeded, but a required permission is missing on the app registration. Contact your administrator, or sign in with Microsoft SSO.",
  config_error:
    "Sign-in could not be completed because of a configuration issue. Contact your administrator, or use “Continue with Microsoft SSO”.",
};

/** Generic fallback shown when no specific error code matches. */
const FALLBACK_ERROR =
  "Sign-in failed. Please try again, or use “Continue with Microsoft SSO”.";

/** Maps Auth.js error codes (passed as /login?error=<code>) to readable text. */
const OAUTH_ERRORS: Record<string, string> = {
  Configuration:
    "There is a problem with the authentication configuration, or your browser did not keep the sign-in security cookies. If you see this in the embedded Preview, sign in from a regular browser window (Chrome or Edge) instead.",
  AccessDenied: "Access denied — you do not have permission to sign in.",
  OAuthSignin: "Could not start the Microsoft sign-in flow. Please try again.",
  OAuthCallback: "Microsoft Entra ID returned an error. Please try again.",
  OAuthCreateAccount: "We could not create your session. Please try again.",
  CredentialsSignin: "", // handled via `code` — see credentialMessage below
};

/** Generic fallback shown when no specific OAuth error code matches. */
const OAUTH_FALLBACK = "Something went wrong. Please try again.";

const EASE = "easeOut";

export default function LoginForm({
  error,
  code,
  callbackUrl,
}: {
  error?: string;
  code?: string;
  callbackUrl?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Email/password form is hidden until the sign-in button is clicked.
  // If we landed with an error (?error=…&code=…), open it directly so the
  // message is shown next to the fields.
  const [showForm, setShowForm] = useState(() => Boolean(error));

  // Only allow relative callback URLs to avoid open redirects.
  const target =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/dashboard";

  /** Picks the message for a credentials failure (code-first, then generic). */
  function credentialMessage(codeValue?: string): string {
    return CREDENTIAL_ERRORS[codeValue ?? ""] ?? FALLBACK_ERROR;
  }

  /** Picks the message for an OAuth/Auth.js error code. */
  function oauthMessage(key?: string): string {
    return key ? (OAUTH_ERRORS[key] ?? OAUTH_FALLBACK) : OAUTH_FALLBACK;
  }

  async function handlePasswordSignIn(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setFormError("Enter your work email and password.");
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: target,
      });
      if (result?.error) {
        // Credentials failures come back as error="CredentialsSignin" with a
        // specific `code`; anything else falls through to the generic copy.
        setFormError(
          result.error === "CredentialsSignin"
            ? credentialMessage(result.code)
            : oauthMessage(result.error)
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
      setFormError(OAUTH_FALLBACK);
    }
  }

  async function handleSsoSignIn() {
    if (loading) return;
    setLoading(true);
    try {
      // Redirects to Microsoft Entra ID; on success the user returns to
      // /dashboard (or the originally requested page) with a secure session.
      await signIn("microsoft-entra-id", { callbackUrl: target });
    } catch {
      setLoading(false);
    }
  }

  // Server-side error surfaced via the URL (?error=…&code=…).
  const serverError =
    error === "CredentialsSignin"
      ? credentialMessage(code)
      : error
        ? oauthMessage(error)
        : null;
  const message = formError ?? serverError;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white flex flex-col">
        {/* Decorative accent bar */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="h-1.5 w-full origin-left bg-gradient-to-r from-primary-dark via-primary to-accent"
          aria-hidden
        />

        <div className="flex flex-1">
          {/* Left: decorative GSI × Synergetics branding panel */}
          <div className="relative hidden lg:block lg:w-[55%] xl:w-[58%] overflow-hidden bg-primary-dark">
            <img
              src="/login-hero.jpg"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[#4A1230]/95 via-[#A52759]/70 to-[#A52759]/30"
            />
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div aria-hidden className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-primary-light/20 blur-3xl" />
            <div aria-hidden className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
              className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14"
            >
              {/* Headline + tagline */}
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
                  className="font-display uppercase tracking-wide text-4xl xl:text-5xl font-semibold text-white leading-tight"
                >
                  Microsoft GSI Delivery Intelligence
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
                  className="mt-4 max-w-md text-sm xl:text-base text-white/85 leading-relaxed"
                >
                  The executive delivery portal for GSI, powered by Synergetics — sign in with
                  your Microsoft work account to view your dashboards and reports.
                </motion.p>
              </div>

              {/* Mid-hero photos */}
              <div className="flex items-center justify-between gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
                  className="w-52 xl:w-60"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                    className="rotate-[1.5deg] rounded-card overflow-hidden ring-1 ring-white/30 shadow-elevated"
                  >
                    <img
                      src="/login-office.jpg"
                      alt="Modern office workspace"
                      className="h-32 xl:h-36 w-full object-cover"
                    />
                  </motion.div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.42, ease: EASE }}
                  className="w-52 xl:w-60"
                >
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
                    className="rotate-[-2deg] rounded-card overflow-hidden ring-1 ring-white/30 shadow-elevated"
                  >
                    <img
                      src="/login-team.jpg"
                      alt="Team collaborating on laptops"
                      className="h-32 xl:h-36 w-full object-cover"
                    />
                  </motion.div>
                </motion.div>
              </div>

              {/* Floating image collage + attribution */}
              <div className="space-y-5">
                <div className="flex items-end justify-between gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.45, ease: EASE }}
                    className="w-36 xl:w-44"
                  >
                    <motion.div
                      animate={{ y: [0, -9, 0] }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                      className="rotate-[-3deg] rounded-card overflow-hidden ring-1 ring-white/30 shadow-elevated"
                    >
                      <img
                        src="/login-analytics.jpg"
                        alt="Analytics dashboard with live delivery charts on a laptop"
                        className="h-24 xl:h-28 w-full object-cover"
                      />
                    </motion.div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.52, ease: EASE }}
                    className="w-36 xl:w-44 translate-y-4"
                  >
                    <motion.div
                      animate={{ y: [0, -7, 0] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                      className="rotate-[2deg] rounded-card overflow-hidden ring-1 ring-white/30 shadow-elevated"
                    >
                      <img
                        src="/login-training.jpg"
                        alt="Instructor-led training session"
                        className="h-24 xl:h-28 w-full object-cover"
                      />
                    </motion.div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.59, ease: EASE }}
                    className="w-32 xl:w-40 translate-y-8"
                  >
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                      className="rotate-[-1.5deg] rounded-card overflow-hidden ring-1 ring-white/30 shadow-elevated"
                    >
                      <img
                        src="/login-meeting.jpg"
                        alt="Team collaboration session"
                        className="h-20 xl:h-24 w-full object-cover"
                      />
                    </motion.div>
                  </motion.div>
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.65, ease: EASE }}
                  className="text-xs text-white/60 leading-relaxed"
                >
                  Real-time data
                  <br />
                  © {new Date().getFullYear()} Synergetics Information Technology Services India Pvt Ltd
                </motion.p>
              </div>
            </motion.div>
          </div>

          {/* Right: sign-in */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
            className="flex flex-1 flex-col items-center justify-center px-6 py-12"
          >
            <div className="flex flex-col items-center">
              <motion.img
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.22, ease: EASE }}
                src="/synergetics-logo.png"
                alt="Synergetics Information Technology Services India Pvt Ltd"
                className="h-14 w-auto object-contain mb-4"
              />
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.3, ease: EASE }}
                className="font-display uppercase tracking-wide text-lg font-semibold text-ink"
              >
                GSI Analytics Portal
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.38, ease: EASE }}
                className="text-sm text-ink-subtle mt-1"
              >
                Synergetics Information Technology Services India Pvt Ltd
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.46, ease: EASE }}
              className="w-full max-w-sm mt-8 bg-white border border-surface-border rounded-card shadow-card p-6 space-y-4"
            >
              {message && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-status-danger/30 bg-status-danger/5 px-3 py-2.5 text-sm text-status-danger"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              {!showForm ? (
                <>
                  <p className="text-sm text-ink-subtle text-center leading-relaxed">
                    Sign in with your Microsoft work account to access the executive
                    dashboard, analytics, and delivery reports.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setShowForm(true);
                    }}
                    disabled={loading}
                    className="w-full h-10 rounded-md border border-surface-border bg-white text-sm font-medium text-ink flex items-center justify-center gap-2 hover:bg-surface-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <ShieldCheck size={15} className="text-primary" />
                    Continue with Microsoft SSO
                  </button>
                </>
              ) : (
                <form onSubmit={handlePasswordSignIn} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-ink-subtle mb-1"
                    >
                      Work email
                    </label>
                    <div className="relative">
                      <Mail
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-disabled"
                        aria-hidden
                      />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        placeholder="you@synergetics.co.in"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-10 rounded-md border border-surface-border bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-xs font-medium text-ink-subtle mb-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-disabled"
                        aria-hidden
                      />
                      <input
                        id="password"
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

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPassword("");
                        setFormError(null);
                        setShowForm(false);
                      }}
                      className="text-ink-disabled hover:text-ink transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSsoSignIn}
                      disabled={loading}
                      className="text-primary hover:text-primary-dark font-medium transition-colors"
                    >
                      Sign in with Microsoft SSO instead
                    </button>
                  </div>
                </form>
              )}

              <p className="text-[11px] text-ink-disabled text-center pt-1">
                Use your Microsoft work account · protected by Microsoft Entra ID
              </p>

              <div className="border-t border-surface-border pt-3">
                <Link
                  href="/local-login"
                  className="flex items-center justify-center gap-1 text-[11px] text-ink-subtle hover:text-primary transition-colors"
                >
                  Portal access? Sign in with a local account
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}

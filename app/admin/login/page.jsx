"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Mail, KeyRound, AlertCircle } from "lucide-react";
import { firebaseReady, getClientAuth, signInWithEmailAndPassword } from "@/lib/firebaseClient";

/**
 * Admin auth — deliberately separate from the student login flow and NOT
 * linked from anywhere in the student-facing UI.
 *
 * `/admin/*` routes are protected by `middleware.js` (checks a signed
 * session cookie on every request, before any admin page renders). This
 * page mints that cookie via real Firebase Auth now — no more
 * placeholder: `signInWithEmailAndPassword` runs client-side, the
 * resulting ID token is verified server-side in
 * `app/api/admin/session/route.js`, and the `admin: true` custom claim
 * (set once per admin by `scripts/seedAdmin.mjs`) is checked before the
 * session cookie is issued. A real Firebase login that ISN'T an admin
 * still gets rejected.
 *
 * Still open for later hardening:
 *   - Rate limiting / exponential backoff on repeated failed attempts,
 *     enforced server-side (App Check + the API route, not client JS).
 *   - Consider requiring 2FA (TOTP) for admin accounts given they control
 *     grading and answer keys for 500+ students.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const auth = getClientAuth();
    signInWithEmailAndPassword(auth, email, password)
      .then((credential) => credential.user.getIdToken())
      .then((idToken) =>
        fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        })
      )
      .then(async (res) => {
        if (!res.ok) throw new Error();
        router.push("/admin/dashboard");
      })
      .catch(() => {
        // Same generic message whether the Firebase sign-in failed, the
        // account isn't an admin, or the session route rejected it —
        // never reveal which step failed.
        setError("ইমেইল বা পাসওয়ার্ড সঠিক নয়।");
      })
      .finally(() => setLoading(false));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm rounded-xl2 bg-ink-900 p-6 shadow-card border border-ink-800"
      >
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-marigold-500/15">
            <ShieldCheck className="text-marigold-400" size={22} />
          </div>
        </div>
        <h1 className="font-display text-lg font-semibold text-center text-white">Admin Access</h1>
        <p className="mt-1 text-center text-xs text-ink-400">Restricted — authorized administrators only</p>

        {!firebaseReady && (
          <p className="mt-4 rounded-lg bg-marigold-500/10 px-3 py-2 text-center text-[11px] text-marigold-400">
            Firebase isn't configured yet — finish <code className="font-mono">FIREBASE-SETUP.md</code> and run{" "}
            <code className="font-mono">scripts/seedAdmin.mjs</code> before an admin account can sign in here.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-100">Email</span>
            <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5">
              <Mail size={16} className="text-ink-400 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-ink-600"
                placeholder="admin@sustadmissionprep.com"
                autoComplete="off"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-100">Password</span>
            <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5">
              <KeyRound size={16} className="text-ink-400 shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none"
                autoComplete="off"
                required
              />
            </div>
          </label>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger" role="alert">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !firebaseReady}
            className="w-full rounded-lg bg-marigold-500 py-2.5 text-sm font-semibold text-ink-950 transition active:scale-[0.98] disabled:opacity-40"
          >
            {loading ? "যাচাই করা হচ্ছে..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-[10px] text-ink-600">
          All access attempts are logged. Unauthorized use is prohibited.
        </p>
      </motion.div>
    </main>
  );
}

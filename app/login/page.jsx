"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, KeyRound } from "lucide-react";
import Mascot from "@/components/Mascot";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";
import { firebaseReady, getClientAuth, signInWithCustomToken } from "@/lib/firebaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!/^01[3-9]\d{8}$/.test(mobile)) {
      setError("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01812345678)।");
      return;
    }
    if (!/^\d{6}$/.test(studentId)) {
      setError("Student ID অবশ্যই ৬ ডিজিটের হতে হবে।");
      return;
    }

    setLoading(true);

    // Once FIREBASE-SETUP.md is done (.env.local has real values),
    // firebaseReady flips to true automatically and this switches from
    // the Phase 1 mock straight to real Firebase Auth — no other code
    // changes needed anywhere else in the app.
    if (firebaseReady) {
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, studentId }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "লগইন ব্যর্থ হয়েছে।");
          const auth = getClientAuth();
          await signInWithCustomToken(auth, data.token);
          router.push("/dashboard");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
      return;
    }

    // Phase 1 mock fallback — no backend configured yet.
    setTimeout(() => {
      setLoading(false);
      router.push("/dashboard");
    }, 600);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 dark:bg-ink-950 px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm rounded-xl2 bg-white dark:bg-ink-900 p-6 shadow-card border border-ink-100 dark:border-ink-800"
      >
        <div className="mb-5 flex justify-center">
          <Mascot mood="idle" size="lg" />
        </div>

        <h1 className="font-display text-xl font-semibold text-center text-ink-900 dark:text-white">
          Free exam for SUST
        </h1>
        <p className="mt-1 text-center text-sm text-ink-400" lang="bn">
          তোমার student ID দিয়ে লগইন করো
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">
              Mobile Number(11 digits)
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2.5">
              <Phone size={16} className="text-ink-400 shrink-0" />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="01XXXXXXXXX"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.trim())}
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
                maxLength={11}
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">
              Student ID (6 digits)
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2.5">
              <KeyRound size={16} className="text-ink-400 shrink-0" />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="••••••"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.trim())}
                className="w-full bg-transparent text-sm outline-none tracking-widest placeholder:text-ink-400"
                maxLength={6}
                required
              />
            </div>
          </label>

          {error && (
            <p className="text-xs text-danger" role="alert" lang="bn">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink-800 dark:bg-marigold-500 py-2.5 text-sm font-semibold text-white dark:text-ink-950 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-400" lang="bn">
          new here? <a href="/login" className="font-semibold text-marigold-600 dark:text-marigold-400">এখানে রেজিস্টার করো</a>।
          আইডি হারিয়ে গেলে অ্যাডমিনের সাথে যোগাযোগ করো।
        </p>
      </motion.div>

      <Footer />
    </main>
  );
}

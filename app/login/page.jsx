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
  const isMaintenance =false;
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
 if (isMaintenance) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-ink-950 p-4 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-amber-500/30 bg-ink-900 p-8 shadow-2xl">
          <span className="text-5xl">🛠️</span>
          <h1 className="text-2xl font-bold text-white">রক্ষণাবেক্ষণ কাজ চলছে</h1>
          <p className="text-sm text-ink-300" lang="bn">
            মেধা তালিকা ও সিস্টেম আপডেটের কাজ চলছে। সাময়িকভাবে লগইন সেবা বন্ধ রাখা হয়েছে।
          </p>
          <p className="text-xs text-amber-400 font-medium">
            খুব শীঘ্রই সেবা আবার স্বাভাবিক হবে।
          </p>
        </div>
      </main>
    );
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

       <div className="mt-6 space-y-3">
          {/* Mobile-Optimized Register Card */}
          <a
            href="/register"
            className="flex w-full items-center justify-between rounded-xl border border-marigold-500/40 bg-marigold-500/10 px-4 py-3.5 transition active:scale-[0.97] active:bg-marigold-500/20"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marigold-500 text-lg text-ink-950 shadow-sm">
                ✨
              </span>
              <div className="text-left">
                <p className="text-sm font-bold text-ink-900 dark:text-white">
                  New Registration
                </p>
                <p className="text-xs text-ink-500 dark:text-ink-400" lang="bn">
                  New student? Register now
                </p>
              </div>
            </div>
            <span className="text-base font-bold text-marigold-600 dark:text-marigold-400">
              →
            </span>
          </a>

          {/* Mobile-Optimized Recover ID Card */}
          <a
            href="/recover"
            className="flex w-full items-center justify-between rounded-xl border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/60 px-4 py-3.5 transition active:scale-[0.97] active:bg-ink-100 dark:active:bg-ink-800"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-200 dark:bg-ink-800 text-lg text-ink-800 dark:text-white">
                🔎
              </span>
              <div className="text-left">
                <p className="text-sm font-bold text-ink-900 dark:text-white">
                  Recover Student ID
                </p>
                <p className="text-xs text-ink-500 dark:text-ink-400" lang="bn">
                  Forgot your student ID? Find it here
                </p>
              </div>
            </div>
            <span className="text-base font-bold text-ink-400">
              →
            </span>
          </a>
        </div>
        
      </motion.div>

      <Footer />
    </main>
  );
}

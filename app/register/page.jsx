"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import Mascot from "@/components/Mascot";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState("");
  const [unitPermission, setUnitPermission] = useState("");
  const [track, setTrack] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedId, setGeneratedId] = useState("");
  const [copied, setCopied] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const needsTrack = unitPermission === "B_ONLY" || unitPermission === "BOTH";

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !college.trim()) {
      setError("নাম ও কলেজের নাম দাও।");
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      setError("সঠিক ১১ ডিজিটের মোবাইল নম্বর দাও।");
      return;
    }
    if (!unitPermission) {
      setError("ইউনিট পারমিশন বাছাই করো।");
      return;
    }
    if (needsTrack && !track) {
      setError("B-Unit এর জন্য তোমার গ্রুপ বাছাই করো।");
      return;
    }

    setLoading(true);
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, college, unitPermission, track: needsTrack ? track : null }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "রেজিস্ট্রেশন ব্যর্থ হয়েছে।");
        setGeneratedId(data.generatedId);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function copyId() {
    navigator.clipboard?.writeText(generatedId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
function handleGoogleFormLookup(e) {
    e.preventDefault();
    setSearchError("");

    if (!/^01[3-9]\d{8}$/.test(searchPhone)) {
      setSearchError("সঠিক ১১ ডিজিটের মোবাইল নম্বর দাও।");
      return;
    }

    setSearchLoading(true);
    
    
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-RDGntWVMPk08Ihgh-W51SoYKXRJmoVhDMFLct8HreKZV3qZOP7gU-gMlMIW2p15kpw/exec";

    fetch(`${APPS_SCRIPT_URL}?phone=${searchPhone}`)
      .then(async (res) => {
        const data = await res.json();
        if (data.success && data.studentId) {
          setGeneratedId(data.studentId); 
        } else {
         
          throw new Error(data.message || "আইডি পাওয়া যায়নি।"); 
        }
      })
      .catch((err) => setSearchError(err.message))
      .finally(() => setSearchLoading(false));
  }
  // Success screen — the ID is shown here ONCE, same rule as the admin
  // bulk-uploader. There's no "look it up again" page anywhere.
  if (generatedId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 dark:bg-ink-950 px-4 py-8 text-center">
        <Mascot mood="celebrate" size="lg" />
        <h1 className="mt-4 font-display text-lg font-semibold text-ink-900 dark:text-white">
          রেজিস্ট্রেশন সম্পন্ন হয়েছে!
        </h1>
        <p className="mt-1 max-w-xs text-xs text-ink-400" lang="bn">
          এটাই তোমার Student ID — এখনই সংরক্ষণ করো (স্ক্রিনশট নাও বা লিখে রাখো)।
          এটা আর কখনো দেখানো হবে না — হারিয়ে গেলে অ্যাডমিনের কাছ থেকে নতুন
          আইডি নিতে হবে।
        </p>

        <div className="mt-5 flex items-center gap-2 rounded-xl2 border-2 border-marigold-500 bg-white dark:bg-ink-900 px-6 py-4 shadow-card">
          <span className="font-mono text-3xl font-bold tracking-widest text-ink-900 dark:text-white">
            {generatedId}
          </span>
          <button
            onClick={copyId}
            aria-label="copy"
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-ink-100 dark:border-ink-700 text-ink-400"
          >
            {copied ? <CheckCircle2 size={16} className="text-success" /> : <Copy size={16} />}
          </button>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="mt-6 rounded-lg bg-ink-900 dark:bg-marigold-500 px-6 py-2.5 text-sm font-semibold text-white dark:text-ink-950"
        >
          Login Now
        </button>
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
        <div className="mb-4 flex justify-center">
          <Mascot mood="idle" size="lg" />
        </div>
        <h1 className="font-display text-xl font-semibold text-center text-ink-900 dark:text-white">
          New Registration
        </h1>
        <p className="mt-1 text-center text-sm text-ink-400" lang="bn">
          Fill in your details to get a Student ID. This ID is shown only once, so make sure to save it.
        </p>
        <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-center text-xs text-ink-500 dark:border-ink-800 dark:bg-ink-950/50 dark:text-ink-400" lang="bn">
          <p className="mt-4 font-bold text-red-700 dark:text-red-600">
           ☠️আইডি পাওয়ার পর অবশ্যই স্ক্রিনশট নিয়ে রাখবে।⚠️ 
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">নাম</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2.5 text-sm outline-none"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">মোবাইল নম্বর</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.trim())}
              maxLength={11}
              className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2.5 text-sm outline-none"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">কলেজের নাম</span>
            <input
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2.5 text-sm outline-none"
              required
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">ইউনিট পারমিশন</span>
            <div className="flex gap-2">
              {[
                { key: "A_ONLY", label: "A-Unit" },
                { key: "B_ONLY", label: "B-Unit" },
                { key: "BOTH", label: "উভয়" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUnitPermission(key)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-xs font-semibold",
                    unitPermission === key
                      ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                      : "border-ink-100 dark:border-ink-700 text-ink-600 dark:text-ink-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {needsTrack && (
            <div>
              <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">
                তোমার গ্রুপ (B-Unit)
              </span>
              <div className="flex gap-2">
                {[
                  { key: "science", label: "Science" },
                  { key: "humanities_commerce", label: "Humanities" },
                  { key: "humanities_commerce", label: "Business" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTrack(key)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-xs font-semibold",
                      track === key
                        ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                        : "border-ink-100 dark:border-ink-700 text-ink-600 dark:text-ink-100"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger" role="alert">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink-800 dark:bg-marigold-500 py-2.5 text-sm font-semibold text-white dark:text-ink-950 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "generating..." : "Get your Student ID"}
          </button>
        </form>
     
        <div className="mt-6 border-t border-ink-100 pt-5 dark:border-ink-800">
          <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-center text-xs text-ink-500 dark:border-ink-800 dark:bg-ink-950/50 dark:text-ink-400" lang="bn">
          <h2  className="mt-4 font-bold text-center text-red-700 dark:text-red-600">
            স্টুডেন্ট আইডি উদ্ধার কেন্দ্র! 
          </h2>
           <p className="mt-4 font-bold text-marigold-400 dark:text-marigold-200"> স্টুডেন্ট আইডি হারিয়ে গেলে এখানে ফোন নাম্বার দিয়ে আইডি খুজে নেও।</p>
           </div>
          <form onSubmit={handleGoogleFormLookup} className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">
                মোবাইল নম্বর
              </span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="01XXXXXXXXX"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value.trim())}
                maxLength={11}
                className="w-full rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-sm outline-none dark:border-ink-700 dark:bg-ink-950"
                required
              />
            </label>

            {searchError && (
              <p className="flex items-center gap-1.5 text-xs text-danger" role="alert">
                <AlertCircle size={13} /> {searchError}
              </p>
            )}

            <button
              type="submit"
              disabled={searchLoading}
              className="w-full rounded-lg border border-ink-200 bg-transparent py-2 text-xs font-semibold text-ink-800 transition hover:bg-ink-50 dark:border-ink-700 dark:text-white dark:hover:bg-ink-800 disabled:opacity-60"
            >
              {searchLoading ? "Searching..." : "Get your Student ID "}
            </button>
          </form>
        </div>
{/* অ্যাডমিন কন্টাক্ট সেকশন */}
<div className="mt-3 text-center">
  <p className="text-xs text-ink-600 dark:text-ink-400 mb-2 font-medium">
    কোনো সমস্যা হলে অ্যাডমিনের সাথে যোগাযোগ করো:
  </p>
  <div className="flex items-center justify-center gap-2 text-xs flex-wrap">
    {/* WhatsApp Link */}
    <a
      href="https://wa.me/+8801572906297" 
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium inline-flex items-center gap-1 transition"
    >
      WhatsApp
    </a>

    {/* Telegram Link */}
    <a
      href="https://t.me/j619966" 
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-600 text-white font-medium inline-flex items-center gap-1 transition"
    >
      Telegram
    </a>

    {/* Call Link */}
    <a
      href="tel:01572906297" 
      className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-800 text-white font-medium inline-flex items-center gap-1 transition"
    >
      Call
    </a>
  </div>
</div>
        <p className="mt-4 text-center text-xs text-ink-400" lang="bn">
          আগে থেকে আইডি আছে?{" "}
          <a href="/login" className="font-semibold text-marigold-600 dark:text-marigold-400">লগইন করো</a>
        </p>
      </motion.div>

      <Footer />
    </main>
  );
}
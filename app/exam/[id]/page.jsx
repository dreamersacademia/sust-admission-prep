"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, AlertTriangle, X, Lock, Hourglass } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import Mascot from "@/components/Mascot";
import { fetchExamById, fetchQuestionsForExam, submitExam as submitExamRequest, startExamAttempt, checkAttempted, syncAnswersToServer } from "@/lib/dataLayer";
import { formatCountdown, cn, haptic } from "@/lib/utils";
import { examStatus, msUntil, formatDuration } from "@/lib/timeWindow";

// How long a tapped answer stays changeable before it locks for good.
const ANSWER_LOCK_DELAY_MS = 1500;

export default function ExamEnginePage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPracticeMode = searchParams.get("mode") === "practice";

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchExamById(id), fetchQuestionsForExam(id)])
      .then(([examData, questionsData]) => {
        if (cancelled) return;
        setExam(examData);
        setQuestions(questionsData);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => { cancelled = true; };
  }, [id]);

  const isWindowed = !!(exam?.startAt && exam?.endAt);
  const isLiveType = isWindowed && !isPracticeMode;
  const status = exam ? examStatus(exam) : null;
  const alreadyLocked = exam ? isLiveType && checkAttempted(id, exam) : false;

  useEffect(() => {
    if (alreadyLocked) router.replace(`/result/${id}`);
  }, [alreadyLocked, id, router]);

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (status !== "not_started") return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

const [serverDriftMs] = useState(0);
const [examEndAt, setExamEndAt] = useState(null); // was a ref — see fix note below
const [remainingMs, setRemainingMs] = useState(0);
const [startError, setStartError] = useState("");

// Opens (or resumes) the attempt with an IMMUTABLE deadline. This is
// what stops "close the tab, reopen, get a fresh timer" — see
// startExamAttempt's comment in lib/dataLayer.js. Practice mode skips
// this entirely (unlimited, no deadline to protect).
//
// FIX: examEndAt used to be a ref. Setting a ref doesn't trigger a
// re-render, so the interval-setup effect below (which only re-runs when
// its OWN dependencies change) never re-ran once the deadline actually
// arrived from startExamAttempt's async response — the timer would set
// remainingMs exactly once and then sit frozen forever, since no interval
// was ever created. Making it real state fixes this: setting it causes a
// re-render, and it's now a dependency of the interval effect, so the
// interval reliably gets created the moment the deadline is known.
useEffect(() => {
  if (!exam || status === "not_started" || status === "ended") return;

  if (!isLiveType) {
    // Practice / non-windowed exam — plain client-side timer is fine,
    // nothing to protect against reopening.
    const deadline = Date.now() + (exam.durationMinutes || 60) * 60 * 1000;
    setExamEndAt(deadline);
    setRemainingMs(Math.max(0, deadline - Date.now()));
    return;
  }

  startExamAttempt(id, { durationMinutes: exam.durationMinutes, windowEndAt: exam.endAt })
    .then(({ deadline }) => {
      setExamEndAt(deadline);
      setRemainingMs(Math.max(0, deadline - Date.now()));
    })
    .catch((err) => {
      if (err.message === "Already submitted") {
        router.replace(`/result/${id}`);
      } else {
        setStartError(err.message || "পরীক্ষা শুরু করতে সমস্যা হয়েছে।");
      }
    });
}, [exam, status, isLiveType, id, router]);

useEffect(() => {
  if (status === "not_started" || !examEndAt) return;
  const tick = setInterval(() => {
    const correctedNow = Date.now() + serverDriftMs;
    setRemainingMs(Math.max(0, examEndAt - correctedNow));
  }, 1000);
  return () => clearInterval(tick);
}, [serverDriftMs, status, examEndAt]);

  const [answers, setAnswers] = useState({});
  const [pending, setPending] = useState(null);
  const [locked, setLocked] = useState({});
  const lockTimers = useRef({});

  const [saveState, setSaveState] = useState("saved");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function goOffline() { setIsOffline(true); setSaveState("offline"); }
    function goOnline() {
      setIsOffline(false);
      setSaveState("saving");
      setTimeout(() => setSaveState("saved"), 700);
    }
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const persistDraft = useCallback((questionId, optionIndex) => {
    if (typeof window === "undefined") return;
    const key = `autosave:${id}`;
    const draft = JSON.parse(localStorage.getItem(key) || "{}");
    draft[questionId] = optionIndex;
    localStorage.setItem(key, JSON.stringify(draft));
    // Best-effort server backup — see syncAnswersToServer's comment for
    // why this matters even though localStorage already has it: a dead
    // connection at the deadline means localStorage is USELESS for
    // grading (the server can't read the student's disk), so this is
    // what actually protects a student who loses connectivity right at
    // the end from losing credit for everything they'd already locked in.
    if (isLiveType) syncAnswersToServer(id, draft);
  }, [id, isLiveType]);

  const chooseOption = useCallback(
    (questionId, optionIndex) => {
      if (locked[questionId]) return;
      if (lockTimers.current[questionId]) clearTimeout(lockTimers.current[questionId]);
      setPending({ questionId, optionIndex });
      setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
      haptic(8);

      lockTimers.current[questionId] = setTimeout(() => {
        setLocked((prev) => ({ ...prev, [questionId]: true }));
        setPending(null);
        persistDraft(questionId, optionIndex);
        haptic([6, 30, 6]);
        if (!isOffline) {
          setSaveState("saving");
          setTimeout(() => setSaveState("saved"), 400);
        }
      }, ANSWER_LOCK_DELAY_MS);
    },
    [locked, isOffline, persistDraft]
  );

  useEffect(() => {
    return () => Object.values(lockTimers.current).forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!isPracticeMode || typeof window === "undefined") return;
    const draft = JSON.parse(localStorage.getItem(`autosave:${id}`) || "{}");
    if (Object.keys(draft).length) {
      setAnswers(draft);
      setLocked(Object.fromEntries(Object.keys(draft).map((k) => [k, true])));
    }
  }, [id, isPracticeMode]);

  const [showTabSwitchAlert, setShowTabSwitchAlert] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((c) => c + 1);
        setShowTabSwitchAlert(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const [showExitModal, setShowExitModal] = useState(false);
  useEffect(() => {
    function handleBeforeUnload(e) { e.preventDefault(); e.returnValue = ""; }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const answeredCount = Object.keys(answers).length;

  const submitExam = useCallback(() => {
    setSubmitting(true);
    submitExamRequest(id, { answers, isPractice: isPracticeMode || exam?.type === "practice" })
      .then(() => {
        if (typeof window !== "undefined") localStorage.removeItem(`autosave:${id}`);
        if (isPracticeMode || exam?.type === "practice") {
          router.push(`/result/${id}?mode=practice&justSubmitted=1`);
        } else {
          router.push(`/result/${id}?justSubmitted=1`);
        }
      })
      .catch((err) => {
        setSubmitting(false);
        alert(err.message || "জমা দিতে সমস্যা হয়েছে, আবার চেষ্টা করো।");
      });
  }, [answers, id, isPracticeMode, exam, router]);

  useEffect(() => {
    if (status === "in_window" && examEndAt && remainingMs === 0) submitExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, status]);

  if (loadError) return <p className="p-6 text-center text-sm text-danger">{loadError}</p>;
  if (!exam || !questions) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }
  if (alreadyLocked) return null; // redirecting

  if (isLiveType && status === "not_started") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <Hourglass className="text-ink-400" size={28} />
        <h1 className="font-display text-base font-semibold" lang="bn">এখনো শুরু হয়নি</h1>
        <p className="text-xs text-ink-400" lang="bn">
          এই লাইভ পরীক্ষাটি শুরু হবে আরও {formatDuration(msUntil(exam.startAt, nowTick))} পরে।
        </p>
        <button onClick={() => router.push("/dashboard")} className="mt-2 rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2 text-xs font-semibold">
          ড্যাশবোর্ডে ফিরে যাও
        </button>
      </main>
    );
  }

  if (isLiveType && status === "ended") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <Mascot mood="blocking" size="lg" message="এই লাইভ উইন্ডো শেষ হয়ে গেছে।" />
        <p className="max-w-xs text-xs text-ink-400" lang="bn">তবে চিন্তা নেই — আর্কাইভ থেকে এটা প্র্যাকটিস হিসেবে দিতে পারবে।</p>
        <button onClick={() => router.push("/dashboard")} className="mt-2 rounded-lg bg-ink-900 dark:bg-marigold-500 px-4 py-2 text-xs font-semibold text-white dark:text-ink-950">
          আর্কাইভে যাও
        </button>
      </main>
    );
  }

  const isLowTime = remainingMs < 5 * 60 * 1000;

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-24">
      <header className="sticky top-0 z-20 border-b border-ink-100 dark:border-ink-800 bg-white/95 dark:bg-ink-900/95 backdrop-blur px-4 py-3">
        {startError && (
          <p className="mb-2 rounded-lg bg-danger/10 px-3 py-1.5 text-center text-[11px] text-danger">{startError}</p>
        )}
        <div className="flex items-center justify-between">
          <button onClick={() => setShowExitModal(true)} className="text-xs font-medium text-ink-400"><X size={18} /></button>
          <div className="text-center">
            <div className={cn("font-display text-lg font-bold tabular-nums", isLowTime ? "text-danger animate-pulse" : "text-ink-900 dark:text-white")}>
              {formatCountdown(remainingMs)}
            </div>
            {isPracticeMode && (
              <span className="text-[10px] font-semibold text-marigold-600 dark:text-marigold-400">প্র্যাকটিস মোড — মেরিটে যুক্ত হবে না</span>
            )}
          </div>
          <SaveIndicator state={saveState} />
        </div>
        <p className="mt-1 text-center text-[11px] text-ink-400">{answeredCount}/{questions.length} উত্তর দেওয়া হয়েছে</p>
      </header>

      {isOffline && (
        <div className="flex items-center justify-center gap-1.5 bg-danger/10 py-1.5 text-[11px] font-medium text-danger">
          <WifiOff size={12} /> অফলাইন — উত্তর ডিভাইসে সেভ হচ্ছে, নেট ফিরলে সিঙ্ক হবে
        </div>
      )}

      <div className="space-y-4 px-4 py-4">
        {questions.map((q, idx) => {
          const isLockedQ = !!locked[q.id];
          const isPendingQ = pending?.questionId === q.id;
          return (
            <div key={q.id} className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-marigold-600 dark:text-marigold-400">প্রশ্ন {idx + 1} · {q.subject}</p>
                {isLockedQ && <span className="flex items-center gap-1 text-[10px] font-medium text-ink-400"><Lock size={10} /> লকড</span>}
                {isPendingQ && <span className="text-[10px] font-medium text-marigold-600 dark:text-marigold-400">লক হচ্ছে...</span>}
              </div>
              <MathRenderer text={q.text} className="text-sm text-ink-900 dark:text-white" />
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected = answers[q.id] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => chooseOption(q.id, oi)}
                      disabled={isLockedQ && !isSelected}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                        isSelected && isLockedQ && "border-marigold-500 bg-marigold-500/10 font-semibold opacity-90",
                        isSelected && !isLockedQ && "border-marigold-400 bg-marigold-500/5 font-semibold ring-2 ring-marigold-400/40",
                        !isSelected && "border-ink-100 dark:border-ink-700",
                        isLockedQ && !isSelected && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]", isSelected ? "border-marigold-500 bg-marigold-500 text-white" : "border-ink-300 text-ink-400")}>
                        {isSelected && isLockedQ ? <Lock size={10} /> : String.fromCharCode(65 + oi)}
                      </span>
                      <MathRenderer text={opt} className="text-sm" />
                    </button>
                  );
                })}
              </div>
              {isPendingQ && (
                <p className="mt-2 text-[10px] text-ink-400" lang="bn">
                  ভুল করে ট্যাপ করেছো? এখনই অন্য অপশনে ট্যাপ করো — {(ANSWER_LOCK_DELAY_MS / 1000).toFixed(1)} সেকেন্ড পর এটা স্থায়ীভাবে লক হয়ে যাবে।
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 px-4 py-3">
        <button onClick={() => setShowSubmitConfirm(true)} className="w-full rounded-lg bg-ink-900 dark:bg-marigold-500 py-3 text-sm font-semibold text-white dark:text-ink-950">
          পরীক্ষা জমা দাও
        </button>
      </div>

      <Modal open={showTabSwitchAlert} onClose={() => setShowTabSwitchAlert(false)}>
        <div className="flex flex-col items-center text-center">
          <AlertTriangle className="mb-2 text-danger" size={28} />
          <Mascot mood="blocking" />
          <p className="mt-3 text-xs text-ink-400" lang="bn">ট্যাব পরিবর্তন রেকর্ড হয়েছে ({tabSwitchCount}বার)। বারবার হলে অ্যাডমিন রিভিউ করবে।</p>
          <button onClick={() => setShowTabSwitchAlert(false)} className="mt-4 w-full rounded-lg bg-ink-900 dark:bg-marigold-500 py-2 text-sm font-semibold text-white dark:text-ink-950">পরীক্ষায় ফিরে যাও</button>
        </div>
      </Modal>

      <Modal open={showExitModal} onClose={() => setShowExitModal(false)}>
        <div className="flex flex-col items-center text-center">
          <Mascot mood="blocking" />
          <h3 className="mt-3 font-display text-sm font-semibold" lang="bn">এখনই বের হতে চাও?</h3>
          <p className="mt-1 text-xs text-ink-400" lang="bn">
            {isPracticeMode
              ? "প্র্যাকটিস মোড থেকে বের হলে অগ্রগতি হারিয়ে যাবে — পরে আবার শুরু করতে পারবে।"
              : "পরীক্ষা এখনও চলছে। বের হয়ে গেলে অসম্পূর্ণ উত্তর নিয়েই সময় শেষে জমা হয়ে যাবে — এটা একবারই জমা দেওয়া যাবে, পরে আর ঢোকা যাবে না।"}
          </p>
          <div className="mt-4 flex w-full gap-2">
            <button onClick={() => setShowExitModal(false)} className="flex-1 rounded-lg border border-ink-200 dark:border-ink-700 py-2 text-sm font-semibold">থাকো</button>
            <button onClick={() => router.push("/dashboard")} className="flex-1 rounded-lg bg-danger py-2 text-sm font-semibold text-white">বের হও</button>
          </div>
        </div>
      </Modal>

      <Modal open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)}>
        <div className="flex flex-col items-center text-center">
          <Mascot mood="submitting" />
          <p className="mt-3 text-xs text-ink-400" lang="bn">
            {answeredCount}/{questions.length} প্রশ্নের উত্তর দিয়েছো। {isPracticeMode ? "প্র্যাকটিস রেজাল্ট সাথে সাথে দেখতে পাবে।" : "জমা দেওয়ার পর আর কখনো এই পরীক্ষার পেজে ফেরা যাবে না।"}
          </p>
          <div className="mt-4 flex w-full gap-2">
            <button onClick={() => setShowSubmitConfirm(false)} className="flex-1 rounded-lg border border-ink-200 dark:border-ink-700 py-2 text-sm font-semibold">আরেকটু দেখি</button>
            <button onClick={submitExam} disabled={submitting} className="flex-1 rounded-lg bg-ink-900 dark:bg-marigold-500 py-2 text-sm font-semibold text-white dark:text-ink-950 disabled:opacity-60">
              {submitting ? "জমা হচ্ছে..." : "জমা দাও"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function SaveIndicator({ state }) {
  const map = {
    saved: { label: "সেভ হয়েছে", color: "text-success" },
    saving: { label: "সেভ হচ্ছে...", color: "text-marigold-600" },
    offline: { label: "অফলাইন", color: "text-danger" },
  };
  const s = map[state] || map.saved;
  return <span className={cn("text-[10px] font-medium", s.color)}>{s.label}</span>;
}

function Modal({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/50 px-4 pb-4 sm:pb-0" onClick={onClose}>
          <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl2 bg-white dark:bg-ink-900 p-5 shadow-card">
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

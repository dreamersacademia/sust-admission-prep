"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Lock, Trophy, LockKeyhole } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import Mascot from "@/components/Mascot";
import { fetchExamById, fetchQuestionsForExam, submitGuestExam } from "@/lib/dataLayer";
import { formatCountdown, cn, moodForScore } from "@/lib/utils";
import { examStatus } from "@/lib/timeWindow";

const ANSWER_LOCK_DELAY_MS = 1500;

export default function PublicExamPage() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchExamById(id)
      .then((examData) => {
        if (cancelled) return;
        setExam(examData);
        if (!examData?.isPublic) return [];
        return fetchQuestionsForExam(id);
      })
      .then((qs) => !cancelled && qs && setQuestions(qs))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => { cancelled = true; };
  }, [id]);

  const [guestName, setGuestName] = useState("");
  const [guestCollege, setGuestCollege] = useState("");
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const [pending, setPending] = useState(null);
  const lockTimers = useRef({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);

  const examEndAt = useMemo(
    () => Date.now() + (exam?.durationMinutes || 60) * 60 * 1000,
    [exam]
  );
  const [remainingMs, setRemainingMs] = useState(examEndAt - Date.now());

  useEffect(() => {
    if (!started) return;
    const tick = setInterval(() => setRemainingMs(Math.max(0, examEndAt - Date.now())), 1000);
    return () => clearInterval(tick);
  }, [started, examEndAt]);

  const chooseOption = useCallback((questionId, optionIndex) => {
    if (locked[questionId]) return;
    if (lockTimers.current[questionId]) clearTimeout(lockTimers.current[questionId]);
    setPending({ questionId, optionIndex });
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    lockTimers.current[questionId] = setTimeout(() => {
      setLocked((prev) => ({ ...prev, [questionId]: true }));
      setPending(null);
    }, ANSWER_LOCK_DELAY_MS);
  }, [locked]);

  useEffect(() => () => Object.values(lockTimers.current).forEach(clearTimeout), []);

  const windowStillOpen = exam ? examStatus(exam) === "in_window" : false;

  function handleSubmit() {
    setSubmitting(true);
    submitGuestExam(id, { guestName, guestCollege, answers })
      .then((res) => {
        setScoreResult(res);
        setSubmitted(true);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setSubmitting(false));
  }

  if (loadError) return <p className="p-6 text-center text-sm text-danger">{loadError}</p>;
  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }
  if (!exam.isPublic) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <Lock className="text-ink-400" size={28} />
        <p className="text-sm text-ink-400" lang="bn">এই পরীক্ষাটি পাবলিক লিংকের জন্য উন্মুক্ত নয়।</p>
      </main>
    );
  }

 if (submitted && scoreResult) {
    const displayScore = scoreResult.netScore ?? scoreResult.correctCount;
    const scorePct = scoreResult.total ? Math.round((displayScore / scoreResult.total) * 100) : 0;
    const formattedScore = Number.isInteger(displayScore) ? displayScore : displayScore.toFixed(2);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <Mascot mood={moodForScore(scorePct)} size="lg" />
        <h1 className="font-display text-base font-semibold" lang="bn">জমা হয়েছে, ধন্যবাদ {guestName}!</h1>
        <p className="font-display text-3xl font-bold text-ink-900 dark:text-white">
          {formattedScore}<span className="text-lg text-ink-400">/{scoreResult.total}</span>
        </p>
        {scoreResult.wrongCount !== undefined && (
          <p className="text-[11px] text-ink-400" lang="bn">
            সঠিক {scoreResult.correctCount} · ভুল {scoreResult.wrongCount} · স্কিপ {scoreResult.skippedCount}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-ink-400" lang="bn"><Trophy size={14} /> তোমার নাম ও {guestCollege} মেরিট লিস্টে যুক্ত হয়েছে</p>
        <p className="max-w-xs text-[11px] text-ink-400" lang="bn">
          {windowStillOpen
            ? "বিস্তারিত সমাধান ও পূর্ণ মেরিট লিস্ট পরীক্ষার সময় শেষ হওয়ার পর প্রকাশ করা হবে।"
            : "সম্পূর্ণ মেরিট লিস্ট শীঘ্রই আমাদের Facebook ও Telegram-এ প্রকাশ করা হবে।"}
        </p>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <Mascot mood="idle" size="lg" />
        <h1 className="font-display text-lg font-semibold" lang="bn">{exam.title}</h1>
        <p className="text-xs text-ink-400" lang="bn">গেস্ট হিসেবে অংশ নিচ্ছো — লিডারবোর্ডে দেখাতে তোমার নাম ও কলেজ দাও।</p>
        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="তোমার নাম"
          className="w-full max-w-xs rounded-lg border border-ink-100 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2.5 text-sm outline-none" />
        <input value={guestCollege} onChange={(e) => setGuestCollege(e.target.value)} placeholder="তোমার কলেজের নাম (মেরিট লিস্টে দেখাবে)"
          className="w-full max-w-xs rounded-lg border border-ink-100 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2.5 text-sm outline-none" />
        <button disabled={!guestName.trim() || !guestCollege.trim() || !questions} onClick={() => setStarted(true)}
          className="w-full max-w-xs rounded-lg bg-ink-900 dark:bg-marigold-500 py-2.5 text-sm font-semibold text-white dark:text-ink-950 disabled:opacity-50">
          {questions ? "Start Exam" : "Loading..."}
        </button>
      </main>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-24">
      <header className="sticky top-0 z-20 border-b border-ink-100 dark:border-ink-800 bg-white/95 dark:bg-ink-900/95 backdrop-blur px-4 py-3 text-center">
        <p className="text-[11px] text-ink-400" lang="bn">গেস্ট মোড · {guestName}</p>
        <div className="font-display text-lg font-bold tabular-nums text-ink-900 dark:text-white">{formatCountdown(remainingMs)}</div>
        <p className="text-[11px] text-ink-400">{answeredCount}/{questions.length} উত্তর দেওয়া হয়েছে</p>
      </header>

      <div className="space-y-4 px-4 py-4">
        {questions.map((q, idx) => {
          const isLockedQ = !!locked[q.id];
          const isPendingQ = pending?.questionId === q.id;
          return (
            <div key={q.id} className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-marigold-600 dark:text-marigold-400">প্রশ্ন {idx + 1}</p>
                {isLockedQ && <span className="flex items-center gap-1 text-[10px] font-medium text-ink-400"><LockKeyhole size={10} /> Locked</span>}
                {isPendingQ && <span className="text-[10px] font-medium text-marigold-600 dark:text-marigold-400">লক হচ্ছে...</span>}
              </div>
              <MathRenderer text={q.text} className="text-sm" />
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
                        {isSelected && isLockedQ ? <LockKeyhole size={10} /> : String.fromCharCode(65 + oi)}
                      </span>
                      <MathRenderer text={opt} className="text-sm" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 px-4 py-3">
        <button onClick={handleSubmit} disabled={submitting} className="w-full rounded-lg bg-ink-900 dark:bg-marigold-500 py-3 text-sm font-semibold text-white dark:text-ink-950 disabled:opacity-60">
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { PlayCircle, ExternalLink, CheckCircle2, XCircle, Trophy, GraduationCap } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import Mascot from "@/components/Mascot";
import { fetchExamById, fetchExamResult, fetchCurrentStudent } from "@/lib/dataLayer";
import { cn, moodForScore } from "@/lib/utils";

export default function ResultPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get("justSubmitted") === "1";
  const isPracticeMode = searchParams.get("mode") === "practice";
  const [student, setStudent] = useState(null);

  const [exam, setExam] = useState(null);
  const [result, setResult] = useState(null); // null = loading, undefined = no attempt found
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchExamById(id), fetchExamResult(id, { isPractice: isPracticeMode }), fetchCurrentStudent()])
      .then(([examData, resultData, studentData]) => {
        if (cancelled) return;
        setExam(examData);
        setResult(resultData === null ? undefined : resultData);
        setStudent(studentData);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => { cancelled = true; };
  }, [id, isPracticeMode]);

  const [revealed, setRevealed] = useState(!justSubmitted);

  if (loadError) return <p className="p-6 text-center text-sm text-danger">{loadError}</p>;
  if (!exam || result === null || !student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }

  if (!result) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <Mascot mood="idle" message="এখনো এই পরীক্ষাটি দাওনি।" ctaLabel="Back to dashboard" onCta={() => router.push("/dashboard")} />
      </main>
    );
  }

const {
    correctCount, wrongCount, skippedCount, netScore, negativeMarking = 0,
    total, answers = {}, questions = [], merit = [], stats = {}, detailsLocked,
  } = result;
  const displayScore = netScore ?? correctCount;
  const scorePct = total ? Math.round((displayScore / total) * 100) : 0;
  const mood = moodForScore(scorePct);
  const formattedScore = Number.isInteger(displayScore) ? displayScore : displayScore.toFixed(2);
  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-16">
      <header className="border-b border-ink-100 dark:border-ink-800 px-4 py-4 text-center">
        <h1 className="font-display text-sm font-semibold text-ink-900 dark:text-white">{exam.title}</h1>
        {isPracticeMode && (
          <p className="mt-0.5 text-[11px] font-semibold text-marigold-600 dark:text-marigold-400">প্র্যাকটিস রেজাল্ট — মেরিটে যুক্ত হয়নি</p>
        )}
      </header>

      {!revealed ? (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <Mascot mood="suspense" size="lg" ctaLabel="রেজাল্ট দেখো" onCta={() => setRevealed(true)} />
        </div>
      ) : (
        <>
          <section className="px-4 py-6 text-center">
            <Mascot mood={mood} size="lg" ctaLabel="Back to dashboard" onCta={() => router.push("/dashboard")} />
            <p className="mt-4 font-display text-3xl font-bold text-ink-900 dark:text-white">
              {formattedScore}<span className="text-lg text-ink-400">/{total}</span>
            </p>
            <p className="text-xs text-ink-400">Your score — {scorePct}%</p>
            {(wrongCount !== null && wrongCount !== undefined) && (
              <p className="mt-1 text-[11px] text-ink-400" lang="bn">
                Correct {correctCount} · Wrong {wrongCount} · Skipped {skippedCount}
                {negativeMarking > 0 && ` · Negative marking: -${negativeMarking}/Wrong`}
              </p>
            )}
          </section>

          {detailsLocked ? (
            <section className="px-6 py-10 text-center">
              <p className="text-xs text-ink-400" lang="bn">
                বিস্তারিত সমাধান, ভিডিও ব্যাখ্যা ও মেরিট লিস্ট — লাইভ পরীক্ষার সময় শেষ হওয়ার পর, সবার জন্য একসাথে আনলক হবে।
              </p>
            </section>
          ) : (
            <>
              {merit.length > 0 && (
                <section className="mx-4 mb-4 rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
                  <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Trophy size={15} className="text-marigold-500" /> Merit list
                  </h2>
                  <p className="mb-3 text-[10px] text-ink-400" lang="bn">
                    Merit list for this exam — top {merit.length} scorers, including guest participants.
                  </p>
                  <div className="space-y-1.5">
                    {merit.map((row) => {
                      const isMe = !row.isGuest && row.name === student.name;
                      return (
                        <div key={row.rank} className={cn("flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs", isMe ? "bg-marigold-500/10 font-semibold" : "bg-ink-50 dark:bg-ink-950")}>
                          <span className="flex items-center gap-2">
                            <span className="w-6 shrink-0 text-ink-400">#{row.rank}</span>
                            <span>{row.name}</span>
                            {row.college && (
                              <span className="flex items-center gap-1 text-[10px] text-ink-400">
                                <GraduationCap size={11} /> {row.college}
                                {row.isGuest && " (guest)"}
                              </span>
                            )}
                          </span>
                          <span className="font-semibold">{row.score}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="space-y-3 px-4">
                {questions.map((q, idx) => {
                  const yourAnswer = answers[q.id];
                  const isCorrect = yourAnswer === q.correctIndex;
                  const qStats = stats[q.id];
                  return (
                    <div key={q.id} className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-marigold-600 dark:text-marigold-400">প্রশ্ন {idx + 1} · {q.subject}</p>
                        {isCorrect ? <CheckCircle2 size={16} className="shrink-0 text-success" /> : <XCircle size={16} className="shrink-0 text-danger" />}
                      </div>
                      <MathRenderer text={q.text} className="mt-1 text-sm" />
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((opt, oi) => {
                          const pct = qStats?.optionPercentages?.[oi];
                          return (
                            <div key={oi} className={cn("relative overflow-hidden rounded-lg border px-2.5 py-1.5 text-xs", oi === q.correctIndex && "border-success bg-success/10 font-semibold", oi === yourAnswer && oi !== q.correctIndex && "border-danger bg-danger/10")}>
                              {qStats && (
                                <div className="absolute inset-y-0 left-0 bg-ink-900/5 dark:bg-white/5" style={{ width: `${pct || 0}%` }} />
                              )}
                              <div className="relative flex items-center justify-between gap-2">
                                <MathRenderer text={opt} />
                                {qStats && <span className="shrink-0 text-[10px] text-ink-400">{pct}%</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {qStats && (
                        <p className="mt-2 text-[10px] text-ink-400" lang="bn">
                          মোট {qStats.totalAttempts} জনের মধ্যে — সঠিক {qStats.correctCount}, ভুল {qStats.wrongCount}, স্কিপ {qStats.skippedCount}
                        </p>
                      )}

                      {/* Two separate explanation options, as designed:
                          a direct external link to the solve video (opens
                          real YouTube, not embedded in-app), and the text
                          explanation as its own labeled block. */}
                      <div className="mt-2 space-y-2">
                        {q.videoUrl && (
                          <a
                            href={q.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-marigold-500/10 px-2.5 py-2 text-xs font-semibold text-marigold-600 dark:text-marigold-400"
                          >
                            <PlayCircle size={14} /> ভিডিও সমাধান দেখো (YouTube-এ )
                            <ExternalLink size={11} className="ml-auto opacity-60" />
                          </a>
                        )}
                        <div className="rounded-lg bg-ink-50 dark:bg-ink-950 p-2.5 text-xs text-ink-600 dark:text-ink-100">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">টেক্সট ব্যাখ্যা</p>
                          <MathRenderer text={q.explanation} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
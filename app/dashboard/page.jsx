"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Archive, CalendarClock, Dumbbell, Clock, Lock, Hourglass, RotateCcw } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Mascot from "@/components/Mascot";
import { fetchAllExams, fetchCurrentStudent, checkAttempted } from "@/lib/dataLayer";
import { getPracticeResult } from "@/lib/attemptStore";
import { examStatus, msUntil, formatDuration } from "@/lib/timeWindow";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "live", label: "লাইভ পরীক্ষা", icon: Radio },
  { key: "archive", label: "আর্কাইভ", icon: Archive },
  { key: "upcoming", label: "আসন্ন", icon: CalendarClock },
  { key: "practice", label: "প্র্যাকটিস", icon: Dumbbell },
];

// Classifies an exam into the tab it belongs in RIGHT NOW — live/upcoming
// windows shift exams automatically as time passes and as attempts happen,
// rather than relying on a static "type" that would go stale.
function classify(exam, nowMs, attempted) {
  if (exam.type === "practice") return "practice";
  if (!exam.startAt || !exam.endAt) return exam.type; // safety fallback

  const status = examStatus(exam, nowMs);
  if (status === "not_started") return "upcoming";
  if (status === "in_window") return attempted ? "archive" : "live";
  return "archive"; // ended — attempted or missed, either way it's archive now
}

export default function DashboardPage() {
  const [student, setStudent] = useState(null); // null = loading
  const [allExams, setAllExams] = useState(null); // null = loading
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([fetchCurrentStudent(), fetchAllExams()])
      .then(([studentData, examsData]) => {
        setStudent(studentData);
        setAllExams(examsData);
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  const availableUnits = useMemo(() => {
    if (!student) return ["A", "B"];
    if (student.unitPermission === "A_ONLY") return ["A"];
    if (student.unitPermission === "B_ONLY") return ["B"];
    return ["A", "B"];
  }, [student]);

  const [unit, setUnit] = useState("A");
  useEffect(() => {
    if (student) setUnit(availableUnits[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  const [activeTab, setActiveTab] = useState("live");
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const exams = (allExams || []).filter((e) => {
    if (e.unit && e.unit !== unit) return false;
    if (unit === "B" && student?.track !== "science" && e.track === "science") return false;
    const attempted = checkAttempted(e.id, e);
    return classify(e, nowMs, attempted) === activeTab;
  });

  if (loadError) {
    return <p className="p-6 text-center text-sm text-danger">{loadError}</p>;
  }
  if (!student || allExams === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-16">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 dark:border-ink-800 bg-ink-50/90 dark:bg-ink-950/90 backdrop-blur px-4 py-3">
        <div>
          <p className="font-display text-sm font-semibold text-ink-900 dark:text-white">{student.name}</p>
          <p className="text-xs text-ink-400">ID: {student.id}</p>
        </div>
        <ThemeToggle />
      </header>

      <section className="px-4 pt-4">
        <div className="flex items-center justify-center">
          <Mascot mood="idle" size="sm" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {["A", "B"].map((u) => {
            const enabled = availableUnits.includes(u);
            return (
              <button
                key={u}
                disabled={!enabled}
                onClick={() => setUnit(u)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl2 border py-3 text-sm font-semibold transition",
                  unit === u
                    ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                    : "border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-100",
                  !enabled && "opacity-40 cursor-not-allowed"
                )}
              >
                {!enabled && <Lock size={14} />}
                {u}-Unit
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium transition",
                activeTab === key ? "bg-ink-900 text-white dark:bg-ink-800" : "text-ink-400 hover:bg-white dark:hover:bg-ink-900"
              )}
            >
              <Icon size={16} />
              <span lang="bn">{label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + unit}
            initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 space-y-3"
            >
              {exams.length === 0 && (
                <p className="mt-8 text-center text-sm text-ink-400" lang="bn">এই মুহূর্তে এখানে কোনো পরীক্ষা নেই।</p>
              )}
              {exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} nowMs={nowMs} />
              ))}
            </motion.div>
          </AnimatePresence>
      </section>
    </main>
  );
}

function ExamCard({ exam, nowMs }) {
  const isPracticeType = exam.type === "practice";
  const isWindowed = !!(exam.startAt && exam.endAt);
  const attempted = checkAttempted(exam.id, exam);
  const practiceResult = getPracticeResult(exam.id);
  const status = isWindowed ? examStatus(exam, nowMs) : null;

  const isUpcoming = isWindowed && status === "not_started" && !attempted;
  const isLiveActive = isWindowed && status === "in_window" && !attempted;
  const isMissed = isWindowed && status === "ended" && !attempted;
  const isArchivedAttempted = isWindowed && attempted; // ended OR attempted-while-in-window

  return (
    <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-marigold-600 dark:text-marigold-400">
            {exam.subject || exam.scope}
          </p>
          <h3 className="font-display text-sm font-semibold text-ink-900 dark:text-white">{exam.title}</h3>
        </div>
        {isLiveActive && (
          <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" /> LIVE
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-ink-400">
        <span className="flex items-center gap-1"><Clock size={12} /> {exam.durationMinutes} মিনিট</span>
        <span>{exam.questionCount} প্রশ্ন · {exam.totalMarks} নম্বর</span>
      </div>

      {isUpcoming && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-400" lang="bn">
          <Hourglass size={13} /> শুরু হবে আরও {formatDuration(msUntil(exam.startAt, nowMs))} পরে
        </p>
      )}

      {isLiveActive && (
        <Link href={`/exam/${exam.id}`} className="mt-3 block rounded-lg bg-ink-900 dark:bg-marigold-500 py-2 text-center text-xs font-semibold text-white dark:text-ink-950">
          পরীক্ষা দিন
        </Link>
      )}

      {isArchivedAttempted && (
        <div className="mt-3 space-y-2">
          <Link href={`/result/${exam.id}`} className="block rounded-lg bg-ink-900 dark:bg-marigold-500 py-2 text-center text-xs font-semibold text-white dark:text-ink-950">
            ফলাফল {exam.meritRank ? `· র‍্যাংক #${exam.meritRank}` : ""}
          </Link>
          <Link href={`/exam/${exam.id}?mode=practice`} className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 dark:border-ink-700 py-2 text-center text-xs font-semibold text-ink-600 dark:text-ink-100">
            <RotateCcw size={13} /> পুনরায় প্র্যাকটিস করো
          </Link>
        </div>
      )}

      {isMissed && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-ink-400" lang="bn">
            তুমি এই পরীক্ষাটি মিস করেছো — প্র্যাকটিস হিসেবে দিতে পারবে (মেরিট লিস্টে যুক্ত হবে না)।
          </p>
          <Link href={`/exam/${exam.id}?mode=practice`} className="block rounded-lg bg-ink-900 dark:bg-marigold-500 py-2 text-center text-xs font-semibold text-white dark:text-ink-950">
            {practiceResult ? "আবার প্র্যাকটিস দিন" : "প্র্যাকটিস হিসেবে পরীক্ষা দিন"}
          </Link>
          {practiceResult && (
            <Link href={`/result/${exam.id}?mode=practice`} className="block rounded-lg border border-ink-200 dark:border-ink-700 py-2 text-center text-xs font-semibold text-ink-600 dark:text-ink-100">
              ফলাফল
            </Link>
          )}
        </div>
      )}

      {isPracticeType && (
        <div className="mt-3 space-y-2">
          <Link href={`/exam/${exam.id}?mode=practice`} className="block rounded-lg bg-ink-900 dark:bg-marigold-500 py-2 text-center text-xs font-semibold text-white dark:text-ink-950">
            {practiceResult ? "আবার পরীক্ষা দিন" : "পরীক্ষা দিন"}
          </Link>
          {practiceResult && (
            <Link href={`/result/${exam.id}?mode=practice`} className="block rounded-lg border border-ink-200 dark:border-ink-700 py-2 text-center text-xs font-semibold text-ink-600 dark:text-ink-100">
              ফলাফল
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, CheckSquare, Square } from "lucide-react";
import { fetchAllExams } from "@/lib/dataLayer";
import { cn } from "@/lib/utils";

export default function CloneExamPage() {
  const router = useRouter();
  const [exams, setExams] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("B");
  const [type, setType] = useState("live");
  const [scope, setScope] = useState("subject");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [negativeMarking, setNegativeMarking] = useState(0);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [hasSubjectChoice, setHasSubjectChoice] = useState(false);
  const [choiceLabelA, setChoiceLabelA] = useState("Biology");
  const [choiceLabelB, setChoiceLabelB] = useState("English");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchAllExams().then(setExams).catch(() => setExams([]));
  }, []);

  function toggleSelect(id) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const selectedExams = (exams || []).filter((e) => selectedIds.includes(e.id));
  const totalSourceQuestions = selectedExams.reduce((sum, e) => sum + (e.questionCount || 0), 0);

  function handleClone() {
    if (selectedIds.length === 0) {
      setError("অন্তত একটা এক্সাম বাছাই করো।");
      return;
    }
    if (!title.trim()) {
      setError("নতুন এক্সামের নাম দাও।");
      return;
    }
    setError("");
    setSaving(true);

    fetch("/api/admin/exams/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceExamIds: selectedIds,
        title,
        unit,
        type,
        scope,
        durationMinutes: Number(durationMinutes),
        negativeMarking: Number(negativeMarking) || 0,
        startAt: type === "live" && startAt ? new Date(startAt).toISOString() : null,
        endAt: type === "live" && endAt ? new Date(endAt).toISOString() : null,
        isPublic,
        hasSubjectChoice,
        choiceLabelA,
        choiceLabelB,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "ক্লোন করতে সমস্যা হয়েছে।");
        setResult(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  }

  if (!exams) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }

  if (result) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <h1 className="font-display text-lg font-semibold text-ink-900 dark:text-white">
          নতুন এক্সাম তৈরি হয়েছে — {result.questionCount}টি প্রশ্ন
        </h1>
        <Link
          href={`/admin/exams/${result.examId}/questions`}
          className="rounded-lg bg-ink-900 dark:bg-marigold-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-ink-950"
        >
          প্রশ্ন রিভিউ/এডিট করো
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-20">
      <header className="border-b border-ink-100 dark:border-ink-800 px-4 py-4">
        <h1 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink-900 dark:text-white">
          <Copy size={16} /> এক্সাম ক্লোন / কম্বাইন করো
        </h1>
        <p className="mt-1 text-xs text-ink-400" lang="bn">
          একাধিক এক্সাম বাছাই করলে সব সাবজেক্টের প্রশ্ন মিলিয়ে একটা নতুন উইকলি এক্সাম তৈরি হবে।
        </p>
      </header>

      <section className="space-y-4 px-4 py-5">
        <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <h2 className="mb-2 text-sm font-semibold">সোর্স এক্সাম বাছাই করো</h2>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {exams.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleSelect(e.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs",
                  selectedIds.includes(e.id)
                    ? "border-marigold-500 bg-marigold-500/10"
                    : "border-ink-100 dark:border-ink-700"
                )}
              >
                {selectedIds.includes(e.id) ? (
                  <CheckSquare size={14} className="shrink-0 text-marigold-500" />
                ) : (
                  <Square size={14} className="shrink-0 text-ink-400" />
                )}
                <span className="flex-1">{e.title}</span>
                <span className="shrink-0 text-ink-400">Unit {e.unit} · {e.questionCount || 0}টি প্রশ্ন</span>
              </button>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <p className="mt-2 text-[11px] font-medium text-marigold-600 dark:text-marigold-400">
              মোট {totalSourceQuestions}টি প্রশ্ন কপি হবে ({selectedIds.length}টি এক্সাম থেকে)
            </p>
          )}
        </div>

        <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold">নতুন এক্সামের তথ্য</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="নতুন এক্সামের নাম, যেমন: B-Unit Weekly Model Test - 03"
            className="mb-2 w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
          />

          <div className="flex gap-2">
            {["A", "B"].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-sm font-semibold",
                  unit === u
                    ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                    : "border-ink-100 dark:border-ink-700"
                )}
              >
                {u}-Unit
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            {[
              { key: "practice", label: "Practice (unlimited)" },
              { key: "live", label: "Live (scheduled, one-time)" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-semibold",
                  type === key
                    ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                    : "border-ink-100 dark:border-ink-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {type === "live" && (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">Starts</span>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">Ends</span>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-ink-600 dark:text-ink-100">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Open a public guest link for this exam
              </label>
            </div>
          )}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">Duration (minutes)</span>
            <input
              type="number"
              min={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">নেগেটিভ মার্কিং (প্রতি ভুল উত্তরে কর্তন)</span>
            <div className="flex gap-2">
              {[0, 0.25, 0.5, 1].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setNegativeMarking(val)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs font-semibold",
                    Number(negativeMarking) === val
                      ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                      : "border-ink-100 dark:border-ink-700"
                  )}
                >
                  {val === 0 ? "নেই" : `-${val}`}
                </button>
              ))}
            </div>
          </label>

          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-ink-600 dark:text-ink-100">
            <input type="checkbox" checked={hasSubjectChoice} onChange={(e) => setHasSubjectChoice(e.target.checked)} />
            এই এক্সামে সাবজেক্ট চয়েস আছে (যেমন Biology বনাম English)
          </label>
          {hasSubjectChoice && (
            <div className="mt-2 flex gap-2">
              <input
                value={choiceLabelA}
                onChange={(e) => setChoiceLabelA(e.target.value)}
                placeholder="গ্রুপ A লেবেল"
                className="flex-1 rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
              />
              <input
                value={choiceLabelB}
                onChange={(e) => setChoiceLabelB(e.target.value)}
                placeholder="গ্রুপ B লেবেল"
                className="flex-1 rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          onClick={handleClone}
          disabled={saving}
          className="w-full rounded-lg bg-ink-900 dark:bg-marigold-500 py-3 text-sm font-semibold text-white dark:text-ink-950 disabled:opacity-60"
        >
          {saving ? "তৈরি হচ্ছে..." : "ক্লোন করে নতুন এক্সাম তৈরি করো"}
        </button>
      </section>
    </main>
  );
}
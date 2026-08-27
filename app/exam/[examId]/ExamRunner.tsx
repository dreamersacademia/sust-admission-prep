'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import KatexText from '@/components/KatexText';
import Timer from '@/components/Timer';
import { seededShuffle, getOrCreateSessionSeed } from '@/lib/shuffle';
import ResultView from './ResultView';

type Question = {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
};

type ExamData = {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  shuffleQuestions: boolean;
  questions: Question[];
};

type Answers = Record<string, 'A' | 'B' | 'C' | 'D'>;

export default function ExamRunner({ exam }: { exam: ExamData }) {
  const seed = useRef(getOrCreateSessionSeed());
  const [studentName, setStudentName] = useState('');
  const [studentRoll, setStudentRoll] = useState('');
  const [started, setStarted] = useState(false);
  const [questions] = useState<Question[]>(() =>
    exam.shuffleQuestions ? seededShuffle(exam.questions, seed.current) : exam.questions
  );
  const [answers, setAnswers] = useState<Answers>({});
  const [current, setCurrent] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  // --- Anti-cheat: discourage copy/right-click/text-selection during exam ---
  useEffect(() => {
    if (!started) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    const onVisibility = () => {
      if (document.hidden) setTabSwitchCount((c) => c + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [started]);

  // Warn before accidental navigation/close mid-exam
  useEffect(() => {
    if (!started || submittedRef.current) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [started]);

  const handleStart = () => {
    if (studentName.trim().length < 2) return;
    // One attempt per browser tab session
    const guardKey = `sust_attempted_${exam.id}`;
    if (sessionStorage.getItem(guardKey)) {
      alert('আপনি ইতিমধ্যে এই পরীক্ষা সম্পন্ন করেছেন।');
      return;
    }
    startTimeRef.current = Date.now();
    setStarted(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const selectAnswer = (qid: string, option: 'A' | 'B' | 'C' | 'D') => {
    setAnswers((prev) => ({ ...prev, [qid]: option }));
  };

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    const timeTakenSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: exam.id,
          studentName,
          studentRoll,
          answers,
          timeTakenSeconds,
          tabSwitchCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      sessionStorage.setItem(`sust_attempted_${exam.id}`, '1');
      setResult(data);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (err) {
      alert('জমা দেওয়ার সময় সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [answers, exam.id, studentName, studentRoll, tabSwitchCount]);

  if (result) {
    return <ResultView exam={exam} questions={questions} result={result} />;
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-line bg-white p-6">
        <h2 className="font-display text-xl font-semibold text-ink">{exam.title}</h2>
        <p className="mt-1 text-sm text-ink/60">{exam.subject} · {exam.durationMinutes} মিনিট</p>
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-md border border-line px-3 py-2 font-body focus:border-signal focus:outline-none"
            placeholder="আপনার নাম"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-line px-3 py-2 font-body focus:border-signal focus:outline-none"
            placeholder="রোল / আইডি (ঐচ্ছিক)"
            value={studentRoll}
            onChange={(e) => setStudentRoll(e.target.value)}
          />
        </div>
        <p className="mt-3 text-xs text-ink/50">
          শুরু করার পর টাইমার চলবে; ট্যাব পরিবর্তন লগ করা হবে এবং সময় শেষ হলে
          স্বয়ংক্রিয়ভাবে জমা হবে।
        </p>
        <button
          onClick={handleStart}
          disabled={studentName.trim().length < 2}
          className="mt-4 w-full rounded-md bg-signal px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          পরীক্ষা শুরু করুন
        </button>
      </div>
    );
  }

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-ink/60">
          প্রশ্ন {current + 1} / {questions.length} · উত্তর দেওয়া হয়েছে {answeredCount}
        </div>
        <Timer totalSeconds={exam.durationMinutes * 60} onExpire={handleSubmit} />
      </div>

      <div className="rounded-lg border border-line bg-white p-5 select-none">
        <div className="font-display text-base text-ink">
          <KatexText content={q.text} />
        </div>
        <div className="mt-4 space-y-2">
          {(['A', 'B', 'C', 'D'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => selectAnswer(q.id, opt)}
              className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition ${
                answers[q.id] === opt
                  ? 'border-signal bg-signal/10'
                  : 'border-line hover:bg-parchment/60'
              }`}
            >
              <span className="mt-0.5 font-mono text-xs font-semibold text-ink/50">{opt}</span>
              <span className="font-body text-sm text-ink">
                <KatexText content={q[`option${opt}` as const]} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="rounded-md border border-line px-4 py-2 text-sm disabled:opacity-30"
        >
          পূর্ববর্তী
        </button>
        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="rounded-md bg-ink px-4 py-2 text-sm text-white"
          >
            পরবর্তী
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-alert px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'জমা হচ্ছে...' : 'পরীক্ষা জমা দিন'}
          </button>
        )}
      </div>

      {/* Question palette for quick jump */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            className={`h-8 w-8 rounded text-xs font-mono ${
              answers[qq.id]
                ? 'bg-signal text-white'
                : i === current
                ? 'border border-signal text-signal'
                : 'border border-line text-ink/50'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

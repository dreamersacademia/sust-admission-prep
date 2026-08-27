'use client';

import KatexText from '@/components/KatexText';
import Link from 'next/link';

type Question = {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

type ResultItem = {
  questionId: string;
  chosen: 'A' | 'B' | 'C' | 'D' | null;
  correctOption: string;
  isCorrect: boolean;
  negativeMarks: number;
  explanation: string | null;
  videoUrl: string | null;
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function ResultView({
  exam,
  questions,
  result,
}: {
  exam: { id: string; title: string };
  questions: Question[];
  result: { score: number; totalMarks: number; timeTakenSeconds: number; results: ResultItem[] };
}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const mins = Math.floor(result.timeTakenSeconds / 60);
  const secs = result.timeTakenSeconds % 60;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg border border-line bg-white p-6 text-center">
        <p className="text-sm text-ink/60">{exam.title}</p>
        <p className="mt-2 font-display text-4xl font-bold text-signal">
          {fmt(result.score)} / {fmt(result.totalMarks)}
        </p>
        <p className="mt-1 text-sm text-ink/60">
          সময় লেগেছে: {mins} মিনিট {secs} সেকেন্ড
        </p>
        <Link
          href={`/merit/${exam.id}`}
          className="mt-4 inline-block rounded-md bg-ink px-4 py-2 text-sm text-white"
        >
          মেধাতালিকা দেখুন
        </Link>
      </div>

      <div className="space-y-4">
        {result.results.map((r, i) => {
          const q = byId.get(r.questionId);
          if (!q) return null;
          return (
            <div
              key={r.questionId}
              className={`rounded-lg border p-4 ${
                r.isCorrect ? 'border-signal/40 bg-signal/5' : 'border-alert/40 bg-alert/5'
              }`}
            >
              <p className="text-xs font-semibold text-ink/50">
                প্রশ্ন {i + 1}
                {!r.isCorrect && r.chosen && r.negativeMarks > 0 && (
                  <span className="ml-2 font-normal text-alert">
                    (−{fmt(r.negativeMarks)} মার্কস কর্তন)
                  </span>
                )}
              </p>
              <div className="mt-1 font-body text-sm text-ink">
                <KatexText content={q.text} />
              </div>
              <div className="mt-2 space-y-1 text-sm">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                  <div
                    key={opt}
                    className={`rounded px-2 py-1 ${
                      opt === r.correctOption
                        ? 'bg-signal/20 font-semibold'
                        : opt === r.chosen
                        ? 'bg-alert/20'
                        : ''
                    }`}
                  >
                    <span className="font-mono text-xs text-ink/50 mr-1">{opt}.</span>
                    <KatexText content={q[`option${opt}` as const]} />
                  </div>
                ))}
              </div>
              {r.explanation && (
                <div className="mt-3 border-t border-line/60 pt-2 text-sm text-ink/80">
                  <span className="font-semibold">ব্যাখ্যা: </span>
                  <KatexText content={r.explanation} />
                </div>
              )}
              {r.videoUrl && (
                <a
                  href={r.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-alert underline"
                >
                  ভিডিও সমাধান দেখুন ▶
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

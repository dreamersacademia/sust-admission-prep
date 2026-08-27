import Link from 'next/link';
export const dynamic = 'force-dynamic';

export default async function HomePage() { 
  const exams :any[] =[];

  return (
    <main className="min-h-screen bg-parchment px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-ink">
          SUST ভর্তি প্রস্তুতি — ফ্রি মডেল টেস্ট
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          একটি পরীক্ষা বেছে নিন, উত্তর দিন, তাৎক্ষণিক ফলাফল ও মেধাতালিকা দেখুন।
        </p>

        <div className="mt-6 space-y-3">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between rounded-lg border border-line bg-white p-4"
            >
              <div>
                <p className="font-display font-semibold text-ink">{exam.title}</p>
                <p className="text-xs text-ink/50">
                  {exam.subject} · {exam._count.questions} প্রশ্ন · {exam.durationMinutes} মিনিট ·{' '}
                  {exam._count.submissions} জন অংশ নিয়েছে
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/merit/${exam.id}`}
                  className="rounded-md border border-line px-3 py-1.5 text-sm"
                >
                  মেধাতালিকা
                </Link>
                <Link
                  href={`/exam/${exam.id}`}
                  className="rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-white"
                >
                  পরীক্ষা দিন
                </Link>
              </div>
            </div>
          ))}
          {exams.length === 0 && (
            <p className="text-sm text-ink/50">
              এখনো কোনো পরীক্ষা যোগ করা হয়নি। `prisma/seed.ts` চালিয়ে নমুনা যোগ করুন।
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

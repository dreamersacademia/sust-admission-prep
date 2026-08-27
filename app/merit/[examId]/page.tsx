import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import MeritTable from '@/components/MeritTable';

export const dynamic = 'force-dynamic'; // always show fresh rankings
export const revalidate = 0;

export default async function MeritPage({ params }: { params: { examId: string } }) {
  const exam = await prisma.exam.findUnique({ where: { id: params.examId } });
  if (!exam) notFound();

  // Highest score first, then fastest time as tiebreak
  const submissions = await prisma.submission.findMany({
    where: { examId: params.examId },
    orderBy: [{ score: 'desc' }, { timeTakenSeconds: 'asc' }],
    take: 200,
  });

  return (
    <main className="min-h-screen bg-parchment px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-ink">মেধাতালিকা</h1>
        <p className="mt-1 text-sm text-ink/60">{exam.title}</p>
        <div className="mt-4">
          <MeritTable rows={submissions} />
        </div>
      </div>
    </main>
  );
}

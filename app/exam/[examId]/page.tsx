import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ExamRunner from './ExamRunner';

export const dynamic = 'force-dynamic';

export default async function ExamPage({ params }: { params: { examId: string } }) {
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  if (!exam || !exam.isActive) notFound();

  // Strip answer-revealing fields server-side before handing to the client
  // component — same rule as the API route, applied here too since this
  // is what actually renders the page.
  const safeExam = {
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    durationMinutes: exam.durationMinutes,
    shuffleQuestions: exam.shuffleQuestions,
    questions: exam.questions.map((q) => ({
      id: q.id,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      marks: q.marks,
    })),
  };

  return (
    <main className="min-h-screen bg-parchment px-4 py-6">
      <ExamRunner exam={safeExam} />
    </main>
  );
}

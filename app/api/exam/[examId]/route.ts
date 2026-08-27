import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { examId: string } }
) {
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  if (!exam || !exam.isActive) {
    return NextResponse.json({ error: 'Exam not found or inactive' }, { status: 404 });
  }

  // CRITICAL: never send correctOption / explanation / videoUrl before submission,
  // or a student can just read the network tab to see answers.
  const safeQuestions = exam.questions.map((q) => ({
    id: q.id,
    text: q.text,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    marks: q.marks,
  }));

  return NextResponse.json({
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    durationMinutes: exam.durationMinutes,
    shuffleQuestions: exam.shuffleQuestions,
    questions: safeQuestions,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type SubmitBody = {
  examId: string;
  studentName: string;
  studentRoll?: string;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  timeTakenSeconds: number;
  tabSwitchCount?: number;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SubmitBody;

  if (!body.examId || !body.studentName || !body.answers) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (body.studentName.trim().length < 2) {
    return NextResponse.json({ error: 'Invalid student name' }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: body.examId },
    include: { questions: true },
  });
  if (!exam || !exam.isActive) {
    return NextResponse.json({ error: 'Exam not found or inactive' }, { status: 404 });
  }

  // Clamp reported time to the exam duration so a tampered client value
  // can't win the "fastest time" tiebreak.
  const maxSeconds = exam.durationMinutes * 60 + 15; // small grace for network latency
  const timeTakenSeconds = Math.min(Math.max(0, body.timeTakenSeconds || 0), maxSeconds);

  // Score is computed here, from the DB's correctOption — never trust a
  // client-submitted score. Negative marking: a wrong (answered) response
  // deducts q.negativeMarks; a skipped question is never penalized.
  let score = 0;
  let totalMarks = 0;
  const results = exam.questions.map((q) => {
    totalMarks += q.marks;
    const chosen = body.answers[q.id];
    const answered = chosen !== undefined && chosen !== null;
    const isCorrect = answered && chosen === q.correctOption;

    if (isCorrect) {
      score += q.marks;
    } else if (answered) {
      score -= q.negativeMarks;
    }

    return {
      questionId: q.id,
      chosen: chosen ?? null,
      correctOption: q.correctOption,
      isCorrect,
      negativeMarks: q.negativeMarks,
      explanation: q.explanation,
      videoUrl: q.videoUrl,
    };
  });

  // Floor at 0 — most SUST-style tests don't let negative marking push a
  // student's total below zero. Flip this off if your exam wants it to.
  score = Math.max(0, Math.round(score * 100) / 100);

  const submission = await prisma.submission.create({
    data: {
      examId: exam.id,
      studentName: body.studentName.trim().slice(0, 100),
      studentRoll: body.studentRoll?.trim().slice(0, 50) || null,
      score,
      totalMarks,
      timeTakenSeconds,
      answers: body.answers,
      tabSwitchCount: body.tabSwitchCount ?? 0,
    },
  });

  return NextResponse.json({
    submissionId: submission.id,
    score,
    totalMarks,
    timeTakenSeconds,
    results, // now safe to reveal — exam attempt is over
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { examId: string } }
) {
  const submissions = await prisma.submission.findMany({
    where: { examId: params.examId },
    orderBy: [{ score: 'desc' }, { timeTakenSeconds: 'asc' }],
    take: 200,
    select: {
      id: true,
      studentName: true,
      studentRoll: true,
      score: true,
      totalMarks: true,
      timeTakenSeconds: true,
      submittedAt: true,
    },
  });
  return NextResponse.json({ submissions });
}

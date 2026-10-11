import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * POST /api/exam/[id]/start
 * Body: { subjectChoice? } — "A" or "B", only meaningful when the exam
 * has hasSubjectChoice: true.
 *
 * Locks TWO things on first open, in the same transaction: the deadline
 * (already existed) and — new — the student's subject choice.
 *
 * On resume (attempt already exists, still in_progress), the ORIGINAL
 * locked choice is returned — whatever this call sends is ignored,
 * exactly like the deadline already works.
 *
 * IMPORTANT: this is also called with NO subjectChoice at all, as a
 * silent "resume probe" from the client — before showing the Biology/
 * English picker, the frontend calls this once to check whether an
 * attempt already exists. That's why the "subjectChoice must be A or B"
 * validation below lives INSIDE the transaction and only fires when
 * we're creating a brand-new attempt — a resume must never be rejected
 * just because this particular call didn't resend the choice.
 */
export async function POST(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = params.id;
  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

  const body = await request.json().catch(() => ({}));
  const requestedChoice = body.subjectChoice === "A" || body.subjectChoice === "B" ? body.subjectChoice : null;

  const isWindowed = exam.startAt && exam.endAt;
  const windowEndMs = isWindowed ? exam.endAt.toMillis() : Infinity;

  if (isWindowed) {
    const now = Date.now();
    if (now < exam.startAt.toMillis()) {
      return NextResponse.json({ error: "Exam has not started yet" }, { status: 403 });
    }
  }

  const attemptRef = adminDb.collection("attempts").doc(`${decoded.uid}_${examId}`);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(attemptRef);

      if (snap.exists) {
        const data = snap.data();
        if (data.status === "submitted") {
          throw new Error("ALREADY_SUBMITTED");
        }
        // Resuming — ignore whatever this call sent, hand back the lock.
        return { startedAt: data.startedAt, deadline: data.deadline, subjectChoice: data.subjectChoice || null };
      }

      // Only a brand-new attempt needs a valid choice — and only when the
      // exam actually has one.
      if (exam.hasSubjectChoice && !requestedChoice) {
        throw new Error("SUBJECT_CHOICE_REQUIRED");
      }

      const now = Date.now();
      const deadline = Math.min(now + (exam.durationMinutes || 60) * 60 * 1000, windowEndMs);
      const subjectChoice = exam.hasSubjectChoice ? requestedChoice : null;

      tx.set(attemptRef, {
        studentAuthUid: decoded.uid,
        examId,
        isPractice: false,
        status: "in_progress",
        startedAt: now,
        deadline,
        subjectChoice,
        answers: {},
        tabSwitchCount: 0,
      });

      return { startedAt: now, deadline, subjectChoice };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err.message === "ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
    if (err.message === "SUBJECT_CHOICE_REQUIRED") {
      return NextResponse.json({ error: "SUBJECT_CHOICE_REQUIRED" }, { status: 409 });
    }
    throw err;
  }
}
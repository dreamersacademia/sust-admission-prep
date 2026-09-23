import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { resolveSession, canEditSubject } from "@/lib/server/sessionRole";

async function loadQuestionAndCheckPermission(request, examId, qId) {
  const session = await resolveSession(request);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const examRef = adminDb.collection("exams").doc(examId);
  const [examSnap, qSnap] = await Promise.all([
    examRef.get(),
    examRef.collection("questions").doc(qId).get(),
  ]);
  if (!examSnap.exists || !qSnap.exists) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const exam = examSnap.data();
  const question = qSnap.data();

  // Permission is checked against the QUESTION's own subject, fetched
  // fresh from Firestore — a moderator who was once permitted for
  // Physics can't edit a Chemistry question just because they know its
  // ID, and if a subject was reassigned since the question was added,
  // this reflects that immediately.
  if (!canEditSubject(session, exam.unit, question.subject)) {
    return {
      error: NextResponse.json(
        { error: `You don't have permission to edit ${question.subject} questions for Unit ${exam.unit}` },
        { status: 403 }
      ),
    };
  }

  return { session, examRef, qRef: examRef.collection("questions").doc(qId), exam, question };
}

/**
 * PATCH /api/admin/exams/[id]/questions/[qId]
 * Body: any subset of { text, options, correctIndex, explanation, videoUrl, choiceGroup }
 * Edits ONE question in place — never touches order, never touches any
 * other question, never touches exam metadata.
 */
export async function PATCH(request, { params }) {
  const result = await loadQuestionAndCheckPermission(request, params.id, params.qId);
  if (result.error) return result.error;
  const { qRef, exam } = result;

  const body = await request.json();
  const patch = {};
  if (body.text !== undefined) patch.text = body.text;
  if (body.options !== undefined) patch.options = body.options;
  if (body.correctIndex !== undefined) patch.correctIndex = body.correctIndex === null ? null : body.correctIndex;
  if (body.explanation !== undefined) patch.explanation = body.explanation || "";
  if (body.videoUrl !== undefined) patch.videoUrl = body.videoUrl || null;
  if (body.choiceGroup !== undefined) {
    patch.choiceGroup = exam.hasSubjectChoice && (body.choiceGroup === "A" || body.choiceGroup === "B") ? body.choiceGroup : null;
  }
  patch.updatedAt = new Date();

  await qRef.set(patch, { merge: true });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/exams/[id]/questions/[qId]
 * Removes ONE question and decrements the exam's totals — does NOT
 * renumber other questions' `order` (gaps in order are harmless, every
 * reader sorts by order value, not by contiguity).
 */
export async function DELETE(request, { params }) {
  const result = await loadQuestionAndCheckPermission(request, params.id, params.qId);
  if (result.error) return result.error;
  const { qRef, examRef, exam } = result;

  await adminDb.runTransaction(async (tx) => {
    tx.delete(qRef);
    tx.update(examRef, {
      questionCount: Math.max(0, (exam.questionCount || 1) - 1),
      totalMarks: Math.max(0, (exam.totalMarks || 1) - 1),
    });
  });

  return NextResponse.json({ ok: true });
}
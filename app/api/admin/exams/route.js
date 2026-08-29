import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";

/**
 * POST /api/admin/exams
 * Body: { examId?, title, unit, track, subject, scope, type, isPublic,
 *         startAt?, endAt?, durationMinutes, questions: [...] }
 *
 * `examId` omitted → create. Provided → full replace of that exam's
 * metadata AND its entire question set — matches "editable anytime" from
 * the spec. Editing a question set atomically (delete-old, write-new in
 * one batch) means there's never a moment where the exam has a mix of
 * old and new questions if the request fails partway.
 *
 * ⚠️ Not yet handled here, called out rather than silently skipped:
 * editing an exam that's CURRENTLY live (students actively answering)
 * changes questions out from under them mid-exam. The spec asked for
 * "editable anytime," but this route doesn't yet add the extra
 * confirmation step that should exist for that specific case — worth
 * doing before this ships, not a launch blocker for everything else.
 */
export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    examId,
    title,
    unit,
    track = null,
    subject = null,
    scope,
    type,
    isPublic = false,
    startAt = null,
    endAt = null,
    durationMinutes,
    negativeMarking = 0,
    questions = [],
  } = body;

  if (!title || !unit || !type) {
    return NextResponse.json({ error: "title, unit, and type are required" }, { status: 400 });
  }

  const examRef = examId
    ? adminDb.collection("exams").doc(examId)
    : adminDb.collection("exams").doc();

  const examData = {
    title,
    unit,
    track,
    subject,
    scope,
    type,
    isPublic,
    startAt: startAt ? new Date(startAt) : null,
    endAt: endAt ? new Date(endAt) : null,
    durationMinutes,
    negativeMarking:Number(negativeMarking) || 0,
    totalMarks: questions.length,
    questionCount: questions.length,
    status: "published",
    updatedAt: new Date(),
    updatedBy: session.email,
  };

  const batch = adminDb.batch();
  batch.set(examRef, examData, { merge: true });

  // Replace the question set atomically: clear what's there, write what
  // was submitted. Cheap enough for exam-sized question counts (tens to
  // low hundreds) — no need for a more elaborate diff.
  const existingQuestionsSnap = await examRef.collection("questions").get();
  existingQuestionsSnap.docs.forEach((doc) => batch.delete(doc.ref));

  questions.forEach((q) => {
    const qRef = examRef.collection("questions").doc();
    batch.set(qRef, {
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      videoUrl: q.videoUrl || null,
      subject: q.subject || subject,
    });
  });

  await batch.commit();

  return NextResponse.json({ examId: examRef.id });
}

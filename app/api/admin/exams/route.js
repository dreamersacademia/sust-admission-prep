import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";

/**
 * POST /api/admin/exams
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
    hasSubjectChoice = false,
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
    negativeMarking: Number(negativeMarking) || 0,
    status: "published",
    updatedAt: new Date(),
    updatedBy: session.email,
  };

  const batch = adminDb.batch();

 
  if (!examId && questions.length > 0) {
    questions.forEach((q, index) => {
    const qRef = examRef.collection("questions").doc();
    batch.set(qRef, {
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      videoUrl: q.videoUrl || null,
      subject: q.subject || subject,
      // null/"" = common, shown to every student regardless of branch.
      // "A"/"B" = only shown to students who picked that branch — see
      // app/api/exam/[id]/questions/route.js for the filtering.
      choiceGroup: hasSubjectChoice && (q.choiceGroup === "A" || q.choiceGroup === "B") ? q.choiceGroup : null,
      // THE shuffle-on-edit fix: Firestore's own write order isn't
      // preserved on read, so every reader (edit form, student exam,
      // result page) now sorts by this instead — see their .sort() calls.
      order: index,
    });
  });
    examData.nextQuestionOrder = questions.length;
  }
if (!examId) {
    examData.createdAt = new Date();
}
  batch.set(examRef, examData, { merge: true });

  await batch.commit();

  return NextResponse.json({ examId: examRef.id });
}
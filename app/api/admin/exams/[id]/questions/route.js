import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { resolveSession, canEditSubject } from "@/lib/server/sessionRole";

/**
 * GET /api/admin/exams/[id]/questions?subject=Physics
 *
 * Admin (no ?subject) sees everything. A moderator sees only subjects
 * they actually have permission for on this exam's unit — even if they
 * pass a subject they DON'T have via the query param, it's silently
 * excluded rather than trusted, since this list is also what confirms
 * to a moderator what's already been added by someone else.
 */
export async function GET(request, { params }) {
  const session = await resolveSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examSnap = await adminDb.collection("exams").doc(params.id).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

  const requestedSubject = new URL(request.url).searchParams.get("subject");

  const questionsSnap = await adminDb.collection("exams").doc(params.id).collection("questions").get();
  let questions = questionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (session.role === "moderator") {
    const allowedSubjects = new Set(
      session.permissions.filter((p) => p.unit === exam.unit).map((p) => p.subject)
    );
    questions = questions.filter((q) => allowedSubjects.has(q.subject));
  }
  if (requestedSubject) {
    questions = questions.filter((q) => q.subject === requestedSubject);
  }

  return NextResponse.json({ exam: { id: examSnap.id, ...exam }, questions });
}

/**
 * POST /api/admin/exams/[id]/questions
 * Body: { subject, text, options, correctIndex, explanation, videoUrl, choiceGroup }
 *
 * Adds exactly one question. This is THE fix for the "last save wins,
 * wipes everyone else's work" problem — every add is its own atomic
 * transaction against a per-exam order counter, so two moderators (or
 * you and a moderator) hitting "add" in the same second never collide,
 * never overwrite each other, and never need to coordinate timing.
 */
export async function POST(request, { params }) {
  const session = await resolveSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examRef = adminDb.collection("exams").doc(params.id);
  const examSnap = await examRef.get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

  const body = await request.json();
  const { subject, text, options, correctIndex, explanation, videoUrl, choiceGroup } = body;

  if (!subject || !text || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "subject, text, and at least 2 options are required" }, { status: 400 });
  }

  // THE actual permission boundary — checked against the real exam's
  // unit (never trust a unit value from the request body) and this
  // session's real, Firestore-sourced permissions.
  if (!canEditSubject(session, exam.unit, subject)) {
    return NextResponse.json(
      { error: `You don't have permission to add ${subject} questions for Unit ${exam.unit}` },
      { status: 403 }
    );
  }

  const safeChoiceGroup = exam.hasSubjectChoice && (choiceGroup === "A" || choiceGroup === "B") ? choiceGroup : null;

  const newQuestionId = await adminDb.runTransaction(async (tx) => {
    const freshExamSnap = await tx.get(examRef);
    const nextOrder = freshExamSnap.data().nextQuestionOrder ?? 0;

    const qRef = examRef.collection("questions").doc();
    tx.set(qRef, {
      subject,
      text,
      options,
      correctIndex: correctIndex === null || correctIndex === undefined ? null : correctIndex,
      explanation: explanation || "",
      videoUrl: videoUrl || null,
      choiceGroup: safeChoiceGroup,
      order: nextOrder,
      addedBy: session.email,
      addedAt: new Date(),
    });
    tx.update(examRef, {
      nextQuestionOrder: nextOrder + 1,
      questionCount: (freshExamSnap.data().questionCount || 0) + 1,
      totalMarks: (freshExamSnap.data().totalMarks || 0) + 1,
    });
    return qRef.id;
  });

  return NextResponse.json({ questionId: newQuestionId });
}
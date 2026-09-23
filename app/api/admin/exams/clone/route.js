import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";

/**
 * POST /api/admin/exams/clone
 * Body: {
 *   sourceExamIds: [id1, id2, ...],   // one = "duplicate this exam",
 *                                     // several = "combine into a weekly exam"
 *   title, unit, type, scope, isPublic,
 *   startAt, endAt, durationMinutes, negativeMarking,
 *   hasSubjectChoice, choiceLabelA, choiceLabelB
 * }
 *
 * Copies every question from each source exam into a new exam,
 * preserving each question's `subject` tag — so per-subject counts and
 * result-page stats keep working exactly as they do on any other exam.
 * After cloning, fine-tune the result the normal way: add, edit, or
 * delete individual questions via /admin/exams/[id]/questions, same as
 * any exam a moderator built directly.
 *
 * This is the actual answer to "moderators maintain daily single-subject
 * pools, admin assembles a weekly exam out of them": clone Physics'
 * daily exam + Chemistry's + Higher Math's + Biology's into one new
 * "Weekly Model Test — Science" exam, prune/adjust, publish. Cloning
 * just Physics alone (one source ID) is the "duplicate and tweak" case
 * — same route, same logic, just nothing to combine.
 */
export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    sourceExamIds = [],
    title, unit, type, scope, isPublic = false,
    startAt = null, endAt = null, durationMinutes,
    negativeMarking = 0,
    hasSubjectChoice = false, choiceLabelA = "", choiceLabelB = "",
  } = body;

  if (!Array.isArray(sourceExamIds) || sourceExamIds.length === 0) {
    return NextResponse.json({ error: "অন্তত একটা সোর্স এক্সাম বাছাই করো।" }, { status: 400 });
  }
  if (!title || !unit || !type) {
    return NextResponse.json({ error: "title, unit, type আবশ্যক।" }, { status: 400 });
  }

  // Pull every source exam's questions, each in its own stored order,
  // one source fully before the next — combining Physics+Chemistry+
  // HigherMath+Biology gives all of Physics first, then all of
  // Chemistry, etc. Easy to re-order (or delete) individual questions
  // afterward via the question manager if you want them interleaved.
  const allCloned = [];
  for (const sourceId of sourceExamIds) {
    const qSnap = await adminDb.collection("exams").doc(sourceId).collection("questions").get();
    const qs = qSnap.docs
      .map((d) => d.data())
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    allCloned.push(...qs);
  }

  if (allCloned.length === 0) {
    return NextResponse.json({ error: "বাছাই করা এক্সাম(গুলোতে) কোনো প্রশ্ন পাওয়া যায়নি।" }, { status: 400 });
  }

  const examRef = adminDb.collection("exams").doc();
  const batch = adminDb.batch();

  batch.set(examRef, {
    title,
    unit,
    type,
    scope,
    isPublic,
    startAt: startAt ? new Date(startAt) : null,
    endAt: endAt ? new Date(endAt) : null,
    durationMinutes,
    negativeMarking: Number(negativeMarking) || 0,
    hasSubjectChoice: !!hasSubjectChoice,
    choiceLabelA: hasSubjectChoice ? choiceLabelA : null,
    choiceLabelB: hasSubjectChoice ? choiceLabelB : null,
    totalMarks: allCloned.length,
    questionCount: allCloned.length,
    nextQuestionOrder: allCloned.length, // so the question manager's next add continues the sequence
    status: "published",
    clonedFrom: sourceExamIds,
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedBy: session.email,
  });

  allCloned.forEach((q, index) => {
    const qRef = examRef.collection("questions").doc();
    batch.set(qRef, {
      subject: q.subject || null,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex ?? null,
      explanation: q.explanation || "",
      videoUrl: q.videoUrl || null,
      // Only kept if the NEW exam also has subject choice enabled —
      // otherwise a leftover "A"/"B" tag would silently hide the
      // question from every student (see the questions route's filter).
      choiceGroup: hasSubjectChoice && (q.choiceGroup === "A" || q.choiceGroup === "B") ? q.choiceGroup : null,
      order: index,
    });
  });

  await batch.commit();

  return NextResponse.json({ examId: examRef.id, questionCount: allCloned.length });
}
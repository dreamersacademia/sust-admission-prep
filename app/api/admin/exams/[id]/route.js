import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";

/**
 * GET /api/admin/exams/[id]
 *
 * Returns the exam PLUS its full questions (including correctIndex,
 * explanation, videoUrl) — for the "edit an existing exam" dropdown in
 * the admin dashboard. This is intentionally a different route from the
 * student-facing GET /api/exam/[id]/questions, which strips exactly
 * those fields — reusing that one here would have been a shortcut into
 * accidentally building an admin feature on top of a student-safe
 * endpoint that's the wrong shape for it.
 */
export async function GET(request, { params }) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examSnap = await adminDb.collection("exams").doc(params.id).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const exam = examSnap.data();

  const questionsSnap = await adminDb.collection("exams").doc(params.id).collection("questions").get();
  const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({
    exam: {
      id: examSnap.id,
      ...exam,
      startAt: exam.startAt ? exam.startAt.toDate().toISOString() : null,
      endAt: exam.endAt ? exam.endAt.toDate().toISOString() : null,
    },
    questions,
  });
}

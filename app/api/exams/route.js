import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";
import { finalizeIfOverdue } from "@/lib/server/examFinalize";

/**
 * GET /api/exams
 * Powers the dashboard's four tabs. Metadata only — never questions.
 * When the caller is authenticated, attaches `attempted: boolean` per
 * exam so the dashboard doesn't need a separate round-trip per card to
 * know whether to show "পরীক্ষা দিন" vs "ফলাফল".
 */
export async function GET(request) {
  const decoded = await verifyRequest(request); // may be null — that's OK here

  let query = adminDb.collection("exams");
  if (!decoded) {
    query = query.where("isPublic", "==", true);
  }

  const snap = await query.get();

  let attemptedIds = new Set();
  if (decoded) {
    // Finalize any attempt whose deadline has quietly passed (dead
    // connection, closed tab) BEFORE computing what's still open — this
    // is why a submitted/overdue live exam can no longer reappear after
    // a refresh: it's locked here, not just hidden by client state.
    const inProgressSnap = await adminDb
      .collection("attempts")
      .where("studentAuthUid", "==", decoded.uid)
      .where("status", "==", "in_progress")
      .get();
    await Promise.all(
      inProgressSnap.docs.map((d) => finalizeIfOverdue(d.data().examId, decoded.uid))
    );

    const attemptsSnap = await adminDb
      .collection("attempts")
      .where("studentAuthUid", "==", decoded.uid)
      .where("status", "==", "submitted")
      .get();
    attemptedIds = new Set(attemptsSnap.docs.map((d) => d.data().examId));
  }

  const exams = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      startAt: data.startAt ? data.startAt.toDate().toISOString() : null,
      endAt: data.endAt ? data.endAt.toDate().toISOString() : null,
      attempted: attemptedIds.has(d.id),
    };
  });

  return NextResponse.json({ exams });
}

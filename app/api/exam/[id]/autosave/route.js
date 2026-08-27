import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * POST /api/exam/[id]/autosave
 * Body: { answers: { [questionId]: optionIndex } }
 *
 * Called after every answer LOCK in app/exam/[id]/page.jsx (not every
 * tap — no need to hammer this on the 1.5s undo window). This is what
 * makes finalizeIfOverdue's grading meaningful: without it, a dead
 * connection right at the deadline would mean the server has ZERO
 * answers to grade with, even if the student had genuinely locked in 90
 * of 100 questions. With it, the server is never more than one lock-cycle
 * behind reality.
 *
 * Silently no-ops (200, does nothing) once the attempt is already
 * submitted or past its deadline — a late autosave call racing the
 * deadline should never resurrect or extend an attempt, only
 * finalizeIfOverdue's transaction gets to decide that.
 */
export async function POST(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { answers = {} } = await request.json();
  const attemptRef = adminDb.collection("attempts").doc(`${decoded.uid}_${params.id}`);

  const snap = await attemptRef.get();
  if (!snap.exists || snap.data().status !== "in_progress") {
    return NextResponse.json({ ok: true, synced: false });
  }
  if (snap.data().deadline && Date.now() >= snap.data().deadline) {
    return NextResponse.json({ ok: true, synced: false });
  }

  await attemptRef.set({ answers }, { merge: true });
  return NextResponse.json({ ok: true, synced: true });
}

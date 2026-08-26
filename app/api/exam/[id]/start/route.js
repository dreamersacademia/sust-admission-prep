import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * POST /api/exam/[id]/start
 *
 * This is the piece that was still missing from the "one submission, no
 * bypass" guarantee: until now, the exam page computed its own deadline
 * client-side as `Date.now() + duration`, recalculated every time the
 * page loaded. That means closing the tab and reopening it gave a
 * strictly later `Date.now()`, which pushed the deadline forward — a
 * free time extension, not a security bypass exactly, but not "one
 * continuous attempt" either.
 *
 * The rule this route enforces, inside a transaction so it's race-safe:
 *   - First open of a live exam → create the attempt doc with
 *     `status: "in_progress"`, `startedAt: now`, and a `deadline` that's
 *     fixed at creation time (min of personal duration and the exam
 *     window's close). This is the ONLY place `deadline` is ever set.
 *   - Any later open, before submission → return the SAME `startedAt`/
 *     `deadline` that was already stored. Resuming after an accidental
 *     tab close works fine; resuming does NOT reset the clock.
 *   - Open after `status: "submitted"` → 409, same as every other
 *     already-submitted check in this codebase.
 *
 * Practice attempts don't call this at all (see lib/dataLayer.js) —
 * unlimited retakes are the whole point there, so there's nothing to
 * lock.
 */
export async function POST(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = params.id;
  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

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
        // Resuming — return the ORIGINAL deadline, never a new one.
        return { startedAt: data.startedAt, deadline: data.deadline };
      }

      const now = Date.now();
      const deadline = Math.min(now + (exam.durationMinutes || 60) * 60 * 1000, windowEndMs);

      tx.set(attemptRef, {
        studentAuthUid: decoded.uid,
        examId,
        isPractice: false,
        status: "in_progress",
        startedAt: now,
        deadline,
        answers: {},
        tabSwitchCount: 0,
      });

      return { startedAt: now, deadline };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err.message === "ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
    throw err;
  }
}

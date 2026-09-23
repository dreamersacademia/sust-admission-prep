import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { resolveSession } from "@/lib/server/sessionRole";

/**
 * GET /api/moderator/exams
 *
 * A moderator only ever sees exams for units they have at least one
 * subject permission in — a Physics-only moderator never sees B-Unit
 * exams in their picker at all, regardless of what subject they'd
 * request within one.
 */
export async function GET(request) {
  const session = await resolveSession(request);
  if (!session || session.role !== "moderator") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedUnits = [...new Set(session.permissions.map((p) => p.unit))];
  if (allowedUnits.length === 0) return NextResponse.json({ exams: [] });

  const snap = await adminDb
    .collection("exams")
    .where("unit", "in", allowedUnits) // max 30 values — fine, only "A"/"B" exist
    .get();

const exams = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        unit: data.unit,
        type: data.type,
        hasSubjectChoice: !!data.hasSubjectChoice,
        choiceLabelA: data.choiceLabelA || null,
        choiceLabelB: data.choiceLabelB || null,
        startAt: data.startAt ? data.startAt.toDate().toISOString() : null,
        endAt: data.endAt ? data.endAt.toDate().toISOString() : null,
        questionCount: data.questionCount || 0,
        _createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
      };
    })
    // Same fix as the main exam list — newest first, consistently, not
    // sorted by start time (which left practice exams with no schedule
    // bunched arbitrarily at one end).
    .sort((a, b) => b._createdAtMs - a._createdAtMs)
    .map(({ _createdAtMs, ...rest }) => rest);

  return NextResponse.json({ exams, permissions: session.permissions });
}
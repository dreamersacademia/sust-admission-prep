import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";
import { finalizeIfOverdue } from "@/lib/server/examFinalize";

export async function GET(request, { params }) {
  const decoded = await verifyRequest(request);

  const snap = await adminDb.collection("exams").doc(params.id).get();
  if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = snap.data();
  if (!decoded && !data.isPublic) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let attempted = false;
  if (decoded) {
    await finalizeIfOverdue(params.id, decoded.uid);
    const attemptSnap = await adminDb.collection("attempts").doc(`${decoded.uid}_${params.id}`).get();
    attempted = attemptSnap.exists && attemptSnap.data().status === "submitted";
  }

  return NextResponse.json({
    exam: {
      id: snap.id,
      ...data,
      startAt: data.startAt ? data.startAt.toDate().toISOString() : null,
      endAt: data.endAt ? data.endAt.toDate().toISOString() : null,
      attempted,
    },
  });
}

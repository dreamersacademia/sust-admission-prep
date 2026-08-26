"use client";

/**
 * Phase 2 note: all of these compare against `Date.now()`, i.e. the
 * DEVICE clock. For the exam engine's countdown that's already flagged as
 * a server-drift problem. For these gating checks (has the exam started /
 * ended yet) it's a bigger issue — a student could set their clock back to
 * open an upcoming exam early, or forward to dodge the live window. Phase 2
 * must gate access via a Cloud Function / API route that checks the
 * exam's start/end against server time before returning question data at
 * all, not just hide the UI client-side.
 */

export function examStatus(exam, nowMs = Date.now()) {
  if (!exam.startAt || !exam.endAt) return exam.type; // practice exams have no window
  const start = new Date(exam.startAt).getTime();
  const end = new Date(exam.endAt).getTime();
  if (nowMs < start) return "not_started";
  if (nowMs >= start && nowMs < end) return "in_window";
  return "ended";
}

export function msUntil(dateStr, nowMs = Date.now()) {
  return Math.max(0, new Date(dateStr).getTime() - nowMs);
}

export function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} দিন ${hours} ঘন্টা`;
  if (hours > 0) return `${hours} ঘন্টা ${minutes} মিনিট`;
  return `${minutes} মিনিট`;
}

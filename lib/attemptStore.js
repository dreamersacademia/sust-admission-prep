"use client";

/**
 * MOCK attempt tracking (localStorage) for Phase 1 demo purposes only.
 *
 * ⚠️ Phase 2 requirement: this MUST move server-side. A localStorage lock
 * only stops an honest browser — it does not stop someone clearing storage,
 * using a different browser, or calling the page directly. The real
 * enforcement has to be:
 *   1. `attempts/{studentId}_{examId}` doc created with a Firestore
 *      transaction the FIRST time a live exam is opened (not submitted) —
 *      so even a browser crash mid-exam can't be reopened.
 *   2. Firestore security rules deny any client read/write to that doc
 *      after `status == "submitted"`.
 *   3. The exam page's server component checks that doc before rendering
 *      questions at all — a direct URL hit gets redirected to /result
 *      before any question data is ever sent to the browser.
 *
 * "Practice" attempts intentionally do NOT go through this lock — they're
 * unlimited by design (chapter practice, and missed-live-as-practice).
 */

const PREFIX = "attempt:";

export function getAttempt(examId) {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PREFIX + examId);
  return raw ? JSON.parse(raw) : null;
}

export function hasAttempted(examId) {
  return !!getAttempt(examId);
}

/**
 * Locks an exam attempt permanently (live exams, and the one official
 * attempt on any exam that carries a merit list). Once written, the exam
 * page must never render the question UI for this examId again.
 */
export function lockAttempt(examId, { answers, correctCount, total }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    PREFIX + examId,
    JSON.stringify({
      submittedAt: Date.now(),
      answers,
      correctCount,
      total,
      locked: true,
    })
  );
  // The in-progress answer draft is separate from the locked attempt —
  // clear it so a stale draft can never be resumed into a "new" attempt.
  localStorage.removeItem("autosave:" + examId);
  localStorage.removeItem("startedAt:" + examId);
}

/**
 * Practice-mode result: saved for convenience (so "ফলাফল" works after
 * a practice attempt) but NEVER blocks a retake, and is overwritten by the
 * next attempt — no permanent lock.
 */
export function savePracticeResult(examId, { answers, correctCount, total }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "practice:" + examId,
    JSON.stringify({ submittedAt: Date.now(), answers, correctCount, total })
  );
}

export function getPracticeResult(examId) {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("practice:" + examId);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Mock-mode mirror of POST /api/exam/[id]/start — same immutable-deadline
 * rule (see that route's comment for the full rationale), just backed by
 * localStorage instead of a Firestore transaction. First call sets the
 * deadline; every later call for the same examId returns the SAME
 * deadline, so reopening a closed tab can't grant extra time.
 */
export function getOrCreateStartTime(examId, durationMinutes, windowEndAtIso) {
  if (typeof window === "undefined") return { startedAt: Date.now(), deadline: Date.now() };
  const key = "startedAt:" + examId;
  const windowEndMs = windowEndAtIso ? new Date(windowEndAtIso).getTime() : Infinity;

  const existing = localStorage.getItem(key);
  if (existing) {
    const startedAt = Number(existing);
    return { startedAt, deadline: Math.min(startedAt + durationMinutes * 60000, windowEndMs) };
  }

  const startedAt = Date.now();
  localStorage.setItem(key, String(startedAt));
  return { startedAt, deadline: Math.min(startedAt + durationMinutes * 60000, windowEndMs) };
}

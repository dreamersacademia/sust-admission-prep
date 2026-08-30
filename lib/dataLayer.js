"use client";

import { firebaseReady, getClientAuth, waitForAuthUser } from "@/lib/firebaseClient";
import { getAllExams, getExamById, getQuestionsForExam, getCurrentStudent, getMeritList } from "@/lib/mockData";
import { hasAttempted, lockAttempt, savePracticeResult, getPracticeResult, getAttempt, getOrCreateStartTime } from "@/lib/attemptStore";
import { examStatus } from "@/lib/timeWindow";

/**
 * This file is the single place every page goes through for exam data —
 * it's what makes "mockData vs real backend" a one-line flip
 * (`firebaseReady`) instead of a per-page decision. Every function
 * returns the same shape either way, so a page never needs to know which
 * branch actually ran.
 */

async function authHeaders() {
  if (!firebaseReady) return {};
  const auth = getClientAuth();
  // THE bug fix: don't read auth.currentUser directly — it's null for a
  // moment after every page refresh even when the user IS logged in,
  // because Firebase restores the session asynchronously. Reading it too
  // early silently falls through to the unauthenticated code path,
  // which is exactly what made a submitted live exam reappear: the
  // dashboard's refetch went out with no auth header, hit /api/exams'
  // "no token → public exams only, no attempted flag" branch, and the
  // exam came back looking untaken.
  const user = await waitForAuthUser(auth);
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(await authHeaders()), ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${url}`);
  return data;
}

export async function fetchAllExams() {
  if (!firebaseReady) return getAllExams();
  const { exams } = await apiFetch("/api/exams");
  return exams;
}

export async function fetchExamById(id) {
  if (!firebaseReady) return getExamById(id);
  const { exam } = await apiFetch(`/api/exam/${id}`);
  return exam;
}

// Sanitized (no answer key) — for the live exam-taking screen. Pass
// isPractice: true when fetching for a practice retake — the mock
// fallback doesn't care (unlimited either way), but the real API route
// needs it to correctly skip the one-time-attempt gate for a retake of
// an exam you've already officially completed.
export async function fetchQuestionsForExam(id, { isPractice } = {}) {
  if (!firebaseReady) return getQuestionsForExam(id);
  const qs = isPractice ? "?mode=practice" : "";
  const { questions } = await apiFetch(`/api/exam/${id}/questions${qs}`);
  return questions;
}

export async function submitExam(id, { answers, isPractice }) {
  if (!firebaseReady) {
    // Mock fallback mirrors what the real route computes, using the mock
    // question bank so the score is still meaningful in the demo.
    const questions = getQuestionsForExam(id);
    const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const total = questions.length;
    if (isPractice) savePracticeResult(id, { answers, correctCount, total });
    else lockAttempt(id, { answers, correctCount, total });
    return { correctCount, total };
  }
  return apiFetch(`/api/exam/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers, isPractice }),
  });
}

// Opens (or resumes) an official attempt with an immutable deadline — see
// app/api/exam/[id]/start/route.js and lib/attemptStore.js's
// getOrCreateStartTime for why this exists: without it, closing and
// reopening a live exam tab silently grants extra time. Only called for
// non-practice windowed exams (see app/exam/[id]/page.jsx).
export async function startExamAttempt(id, { durationMinutes, windowEndAt }) {
  if (!firebaseReady) {
    return getOrCreateStartTime(id, durationMinutes, windowEndAt);
  }
  return apiFetch(`/api/exam/${id}/start`, { method: "POST" });
}

export async function submitGuestExam(id, { guestName, guestCollege, answers }) {
  if (!firebaseReady) {
    const questions = getQuestionsForExam(id);
    const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    return { correctCount, total: questions.length };
  }
  return apiFetch(`/api/exam/${id}/guest-submit`, {
    method: "POST",
    body: JSON.stringify({ guestName, guestCollege, answers }),
  });
}

export async function fetchExamResult(id, { isPractice } = {}) {
  if (!firebaseReady) {
    const exam = getExamById(id);
    const officialAttempt = getAttempt(id) || (exam?.attempted ? { correctCount: exam.score, total: exam.totalMarks, answers: {} } : null);
    const attempt = isPractice ? getPracticeResult(id) : officialAttempt;
    if (!attempt) return null;

    const countsTowardMerit = !isPractice && exam?.type !== "practice";
    const isWindowed = !!(exam?.startAt && exam?.endAt);
    const stillOpen = isWindowed && countsTowardMerit && examStatus(exam) === "in_window";
    // Mirrors the real route: a practice retake of an exam you've
    // already officially completed is score-only — the full breakdown
    // permanently lives under the official result instead.
    const practiceAfterOfficial = isPractice && !!officialAttempt;

    if (stillOpen || practiceAfterOfficial) {
      return { correctCount: attempt.correctCount, total: attempt.total, detailsLocked: true };
    }

    return {
      correctCount: attempt.correctCount,
      total: attempt.total,
      answers: attempt.answers,
      questions: getQuestionsForExam(id),
      merit: countsTowardMerit ? getMeritList(id) : [],
      stats: countsTowardMerit ? mockStatsFor(id) : {},
      detailsLocked: false,
    };
  }
  const qs = isPractice ? "?mode=practice" : "";
  try {
    return await apiFetch(`/api/exam/${id}/result${qs}`);
  } catch {
    return null;
  }
}

// Demo-only synthetic per-question stats — the mock data model has no
// real cross-student attempts to aggregate, so this fabricates plausible
// numbers (correct answer weighted higher) purely so the UI isn't empty
// in mock mode. The real numbers come from getOrPublishAnalytics in
// app/api/exam/[id]/result/route.js once Firebase is wired up.
function mockStatsFor(id) {
  const questions = getQuestionsForExam(id);
  const stats = {};
  for (const q of questions) {
    const raw = q.options.map((_, i) => (i === q.correctIndex ? 40 + Math.random() * 20 : Math.random() * 20));
    const sum = raw.reduce((a, b) => a + b, 0);
    const optionPercentages = raw.map((v) => Math.round((v / sum) * 90)); // leave ~10% for "skipped"
    stats[q.id] = {
      totalAttempts: 120,
      correctCount: Math.round(1.2 * (optionPercentages[q.correctIndex] || 0)),
      wrongCount: Math.round(120 * (1 - (optionPercentages[q.correctIndex] || 0) / 100) * 0.85),
      skippedCount: Math.round(120 * 0.1),
      optionPercentages,
    };
  }
  return stats;
}

export function checkAttempted(id, exam) {
  if (!firebaseReady) return exam?.attempted || hasAttempted(id);
  return !!exam?.attempted; // the API already computed this per-user
}

export async function fetchCurrentStudent() {
  if (!firebaseReady) return getCurrentStudent();
  const { student } = await apiFetch("/api/me");
  return student;
}

// Fire-and-forget sync of in-progress answers to the server — see
// app/api/exam/[id]/autosave/route.js for why this exists (it's what
// finalizeIfOverdue grades with if the connection dies right at the
// deadline). Best-effort on purpose: a failed autosave shouldn't
// interrupt the student mid-exam, it just means that particular lock
// isn't backed up yet — the next successful one catches up.
export async function syncAnswersToServer(examId, answers) {
  if (!firebaseReady) return;
  try {
    await apiFetch(`/api/exam/${examId}/autosave`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  } catch {
    // best-effort — ignore
  }
}

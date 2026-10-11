"use client";

import { firebaseReady, getClientAuth, waitForAuthUser } from "@/lib/firebaseClient";
import { getAllExams, getExamById, getQuestionsForExam, getCurrentStudent, getMeritList } from "@/lib/mockData";
import { hasAttempted, lockAttempt, savePracticeResult, getPracticeResult, getAttempt, getOrCreateStartTime } from "@/lib/attemptStore";
import { examStatus } from "@/lib/timeWindow";

async function authHeaders() {
  if (!firebaseReady) return {};
  const auth = getClientAuth();
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

// subjectChoice ("A" | "B" | undefined) — for an exam with hasSubjectChoice,
// forwarded as a query param. The real API route only trusts this for
// PRACTICE sessions; official sessions always use the choice locked in the
// attempt doc at /start, regardless of what's passed here.
export async function fetchQuestionsForExam(id, { isPractice, subjectChoice } = {}) {
  if (!firebaseReady) return getQuestionsForExam(id);
  const params = new URLSearchParams();
  if (isPractice) params.set("mode", "practice");
  if (subjectChoice) params.set("subjectChoice", subjectChoice);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const { questions } = await apiFetch(`/api/exam/${id}/questions${qs}`);
  return questions;
}

// subjectChoice only matters for PRACTICE grading (no persistent lock to
// read from). Official submissions are graded server-side against the
// locked attempt doc, so this value is ignored there.
export async function submitExam(id, { answers, isPractice, subjectChoice }) {
  if (!firebaseReady) {
    const questions = getQuestionsForExam(id);
    const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const total = questions.length;
    if (isPractice) savePracticeResult(id, { answers, correctCount, total });
    else lockAttempt(id, { answers, correctCount, total });
    return { correctCount, total };
  }
  return apiFetch(`/api/exam/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers, isPractice, subjectChoice }),
  });
}

// Opens (or resumes) an official attempt with an immutable deadline — see
// app/api/exam/[id]/start/route.js and lib/attemptStore.js's
// getOrCreateStartTime for why this exists: without it, closing and
// reopening a live exam tab silently grants extra time. Only called for
// non-practice windowed exams (see app/exam/[id]/page.jsx).
//
// subjectChoice ("A" | "B" | undefined): for a choice exam, the FIRST call
// (no attempt exists yet) must include this to create+lock the attempt.
// Calling with it omitted is used as a "resume probe" — if an attempt
// already exists, the server just returns its locked deadline/choice; if
// none exists and the exam needs a choice, it throws "SUBJECT_CHOICE_REQUIRED".
export async function startExamAttempt(id, { durationMinutes, windowEndAt, subjectChoice } = {}) {
  if (!firebaseReady) {
    return getOrCreateStartTime(id, durationMinutes, windowEndAt);
  }
  return apiFetch(`/api/exam/${id}/start`, {
    method: "POST",
    body: JSON.stringify({ durationMinutes, subjectChoice }),
  });
}

export async function submitGuestExam(id, { guestName, guestCollege, answers, subjectChoice }) {
  if (!firebaseReady) {
    const questions = getQuestionsForExam(id);
    const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    return { correctCount, total: questions.length };
  }
  return apiFetch(`/api/exam/${id}/guest-submit`, {
    method: "POST",
    body: JSON.stringify({ guestName, guestCollege, answers, subjectChoice }),
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

function mockStatsFor(id) {
  const questions = getQuestionsForExam(id);
  const stats = {};
  for (const q of questions) {
    const raw = q.options.map((_, i) => (i === q.correctIndex ? 40 + Math.random() * 20 : Math.random() * 20));
    const sum = raw.reduce((a, b) => a + b, 0);
    const optionPercentages = raw.map((v) => Math.round((v / sum) * 90));
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
  return !!exam?.attempted;
}

export async function fetchCurrentStudent() {
  if (!firebaseReady) return getCurrentStudent();
  const { student } = await apiFetch("/api/me");
  return student;
}

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
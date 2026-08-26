"use client";

import { firebaseReady, getClientAuth } from "@/lib/firebaseClient";
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
  const user = auth?.currentUser;
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

// Sanitized (no answer key) — for the live exam-taking screen.
export async function fetchQuestionsForExam(id) {
  if (!firebaseReady) return getQuestionsForExam(id);
  const { questions } = await apiFetch(`/api/exam/${id}/questions`);
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
    const attempt = isPractice
      ? getPracticeResult(id)
      : getAttempt(id) || (exam?.attempted ? { correctCount: exam.score, total: exam.totalMarks, answers: {} } : null);
    if (!attempt) return null;

    const countsTowardMerit = !isPractice && exam?.type !== "practice";
    const isWindowed = !!(exam?.startAt && exam?.endAt);
    const stillOpen = isWindowed && countsTowardMerit && examStatus(exam) === "in_window";

    if (stillOpen) {
      return { correctCount: attempt.correctCount, total: attempt.total, detailsLocked: true };
    }

    return {
      correctCount: attempt.correctCount,
      total: attempt.total,
      answers: attempt.answers,
      questions: getQuestionsForExam(id),
      merit: countsTowardMerit ? getMeritList(id) : [],
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

export function checkAttempted(id, exam) {
  if (!firebaseReady) return exam?.attempted || hasAttempted(id);
  return !!exam?.attempted; // the API already computed this per-user
}

export { getCurrentStudent };

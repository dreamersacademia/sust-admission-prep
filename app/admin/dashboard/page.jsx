"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Upload, Eye, ShieldCheck, FilePenLine, LogOut, Trophy } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import { fetchAllExams } from "@/lib/dataLayer";
import { firebaseReady } from "@/lib/firebaseClient";
import { cn } from "@/lib/utils";

const emptyQuestion = () => ({
  id: crypto.randomUUID(),
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
});

export default function AdminDashboardPage() {
  const router = useRouter();
  const [existingExams, setExistingExams] = useState([]);
  const [editingExamId, setEditingExamId] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [unit, setUnit] = useState("A");
  const [examType, setExamType] = useState("practice"); // "practice" | "live"
  const [negativeMarking, setNegativeMarking] = useState(0); 
  const [scope, setScope] = useState("chapter");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [previewChecked, setPreviewChecked] = useState(false); // has "Preview" been clicked at least once
  const [uploadResults, setUploadResults] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [resetIds, setResetIds] = useState(false);

  // Real exam list once Firebase is wired up (fetchAllExams goes through
  // the same firebaseReady branch every student page uses) — previously
  // this dropdown always showed the Phase 1 mock exams regardless of
  // what had actually been published to Firestore.
  useEffect(() => {
    fetchAllExams().then(setExistingExams).catch(() => setExistingExams([]));
  }, []);

  // Exams are editable anytime — loading one pulls its current questions
  // (full, including answer keys — via the admin-only endpoint, not the
  // student-facing sanitized one) into the same editor used to create
  // new ones. Not yet added: an extra confirmation step for editing an
  // exam that's CURRENTLY live (see app/api/admin/exams/route.js's note).
  function loadExamForEditing(examId) {
    setEditingExamId(examId);
    if (!examId) {
      setExamTitle("");
      setUnit("A");
      setExamType("practice");
      setScope("chapter");
      setDurationMinutes(30);
      setNegativeMarking(0.25);
      setStartAt("");
      setEndAt("");
      setIsPublic(false);
      setQuestions([emptyQuestion()]);
      return;
    }

    if (!firebaseReady) {
      const exam = existingExams.find((e) => e.id === examId);
      applyExamToForm(exam, exam?.questions || []);
      return;
    }

    fetch(`/api/admin/exams/${examId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        applyExamToForm(data.exam, data.questions);
      })
      .catch(() => applyExamToForm(null, []));
  }

  function applyExamToForm(exam, qs) {
    setExamTitle(exam?.title || "");
    setUnit(exam?.unit || "A");
    setExamType(exam?.type || "practice");
    setScope(exam?.scope || "chapter");
    setDurationMinutes(exam?.durationMinutes || 30);
    setNegativeMarking(exam?.negativeMarking || 0);
    setStartAt(exam?.startAt ? exam.startAt.slice(0, 16) : "");
    setEndAt(exam?.endAt ? exam.endAt.slice(0, 16) : "");
    setIsPublic(exam?.isPublic || false);
    setQuestions(
      qs.length
        ? qs.map((q) => ({
            id: q.id,
            text: q.text,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            videoUrl: q.videoUrl || "",
          }))
        : [emptyQuestion()]
    );
  }

  function updateQuestion(id, patch) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function updateOption(qId, index, value) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) }
          : q
      )
    );
  }

  function logout() {
    fetch("/api/admin/session", { method: "DELETE" }).finally(() => router.push("/admin/login"));
  }

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishedId, setPublishedId] = useState("");

  function publishExam() {
    setPublishing(true);
    setPublishError("");
    fetch("/api/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId: editingExamId || undefined,
        title: examTitle,
        unit,
        type: examType,
        scope,
        durationMinutes: Number(durationMinutes),
        negativeMarking: Number(negativeMarking) || 0,
        startAt: examType === "live" && startAt ? new Date(startAt).toISOString() : null,
        endAt: examType === "live" && endAt ? new Date(endAt).toISOString() : null,
        isPublic,
        questions,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Publish failed");
        setPublishedId(data.examId);
      })
      .catch((err) => setPublishError(err.message))
      .finally(() => setPublishing(false));
  }

  function uploadStudents() {
    setUploading(true);
    setUploadError("");
    setUploadResults(null);
    fetch("/api/admin/students/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: csvPreview, resetIds }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setUploadResults(data.results);
      })
      .catch((err) => setUploadError(err.message))
      .finally(() => setUploading(false));
  }

  function parseCsv(text) {
    // Accepts EITHER a header line ("phone,name,group") followed by data,
    // OR bare data lines with no header at all — detected by checking
    // whether the first line's first field looks like a real phone
    // number. Previously this always consumed line 1 as a header, so a
    // single data-only line (no header) silently parsed to zero rows —
    // the button looked broken but was actually just discarding your
    // only line as a "header."
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return [];

    const looksLikeDataRow = /^01[3-9]\d{8}/.test(lines[0].split(",")[0].trim());
    const cols = ["phone", "name", "group", "college", "track"];
    const rows = looksLikeDataRow ? lines : lines.slice(1);

    return rows.map((row) => {
      const values = row.split(",").map((v) => v.trim());
      return Object.fromEntries(cols.map((c, i) => [c, values[i]]));
    });
  }

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-16">
      <header className="border-b border-ink-100 dark:border-ink-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-marigold-600 dark:text-marigold-400" />
            <h1 className="font-display text-base font-semibold text-ink-900 dark:text-white">
              Admin — Exam Creator
            </h1>
          </div>
          <button onClick={logout} className="flex items-center gap-1 text-xs font-medium text-ink-400">
            <LogOut size={14} /> Logout
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-400">
          Grading, answer keys, and question data are write-only from here in
          Phase 2 — never exposed to students via client-readable Firestore.
          Real access to this page is gated by <code className="font-mono">/admin/login</code> + an
          admin custom claim, enforced server-side, not by this page itself.
        </p>
      </header>

      <section className="space-y-4 px-4 py-5">
        {/* Load an existing exam to edit — exams are editable anytime */}
        <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <FilePenLine size={15} /> Create new, or edit an existing exam
          </h2>
          <select
            value={editingExamId}
            onChange={(e) => loadExamForEditing(e.target.value)}
            className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
          >
            <option value="">+ New exam</option>
            {existingExams.map((e) => (
              <option key={e.id} value={e.id}>{e.title} ({e.type})</option>
            ))}
          </select>

          {editingExamId && (
            <Link
              href={`/admin/results/${editingExamId}`}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-ink-100 dark:border-ink-700 py-2 text-xs font-semibold text-ink-600 dark:text-ink-100"
            >
              <Trophy size={13} /> View results & merit for this exam
            </Link>
          )}
        </div>

        {/* Exam meta */}
        <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold">Exam details</h2>
          <input
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            placeholder="Exam title, e.g. A-Unit Full Model Test - 05"
            className="mb-2 w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-2">
            {["A", "B"].map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-sm font-semibold",
                  unit === u
                    ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                    : "border-ink-100 dark:border-ink-700"
                )}
              >
                {u}-Unit
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            {[
              { key: "practice", label: "Practice (unlimited)" },
              { key: "live", label: "Live (scheduled, one-time)" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setExamType(key)}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-semibold",
                  examType === key
                    ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                    : "border-ink-100 dark:border-ink-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {examType === "live" && (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">Starts</span>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">Ends</span>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-ink-600 dark:text-ink-100">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Open a public guest link for this exam
              </label>
            </div>
          )}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">Duration (minutes)</span>
            <input
              type="number"
              min={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">
              নেগেটিভ মার্কিং (প্রতি ভুল উত্তরে কর্তন)
            </span>
            <div className="flex gap-2">
              {[0, 0.25, 0.5, 1].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setNegativeMarking(val)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs font-semibold",
                    Number(negativeMarking) === val
                      ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                      : "border-ink-100 dark:border-ink-700"
                  )}
                >
                  {val === 0 ? "নেই" : `-${val}`}
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.05"
              min={0}
              value={negativeMarking}
              onChange={(e) => setNegativeMarking(e.target.value)}
              placeholder="কাস্টম মান"
              className="mt-1.5 w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
            />
            <p className="mt-1 text-[10px] text-ink-400" lang="bn">
              যেমন 0.25 মানে প্রতিটি ভুল উত্তরে ০.২৫ নম্বর কাটা যাবে। স্কিপ করা প্রশ্নে কোনো কর্তন নেই। ০ দিলে নেগেটিভ মার্কিং বন্ধ থাকবে।
            </p>
          </label>
        </div>

        {/* Live LaTeX question editor */}
        <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold">Questions</h2>
          <div className="space-y-5">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-lg border border-ink-100 dark:border-ink-700 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-400">
                    প্রশ্ন {idx + 1}
                  </span>
                  <button
                    onClick={() =>
                      setQuestions((qs) => qs.filter((x) => x.id !== q.id))
                    }
                    className="text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <textarea
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  placeholder="Question text — wrap LaTeX in $...$ e.g. $a = v/t$"
                  rows={2}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
                />

                {/* Live preview — renders exactly what students will see */}
                {q.text && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-ink-50 dark:bg-ink-950 p-2.5 text-xs">
                    <Eye size={12} className="mt-0.5 shrink-0 text-ink-400" />
                    <MathRenderer text={q.text} />
                  </div>
                )}

                <div className="mt-2 space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctIndex === oi}
                        onChange={() => updateQuestion(q.id, { correctIndex: oi })}
                      />
                      <input
                        value={opt}
                        onChange={(e) => updateOption(q.id, oi, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        className="flex-1 rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-1.5 text-sm outline-none"
                      />
                    </div>
                  ))}
                </div>

                <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  ব্যাখ্যার অপশন ১ — টেক্সট
                </p>
                <textarea
                  value={q.explanation}
                  onChange={(e) =>
                    updateQuestion(q.id, { explanation: e.target.value })
                  }
                  placeholder="Explanation (shown after results unlock)"
                  rows={2}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
                />

                <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  ব্যাখ্যার অপশন ২ — ভিডিও সমাধান (YouTube link)
                </p>
                <input
                  value={q.videoUrl || ""}
                  onChange={(e) => updateQuestion(q.id, { videoUrl: e.target.value })}
                  placeholder="https://youtu.be/... — ছাত্ররা ট্যাপ করলে সরাসরি YouTube-এ চলে যাবে"
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
            className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-marigold-600 dark:text-marigold-400"
          >
            <Plus size={16} /> প্রশ্ন যোগ করো
          </button>
        </div>

        {/* Bulk student CSV uploader */}
        <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <h2 className="mb-1 text-sm font-semibold">Bulk student upload</h2>
          <p className="mb-3 text-[11px] text-ink-400">
            CSV columns: <code className="font-mono">phone,name,group,college,track</code>
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"phone,name,group,college,track\n01812345678,Tahmid Rahman,A_ONLY,Notre Dame College,science"}
            rows={4}
            className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 font-mono text-xs outline-none"
          />
          <button
            onClick={() => {
              setCsvPreview(parseCsv(csvText));
              setPreviewChecked(true);
            }}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-ink-100 dark:border-ink-700 px-3 py-1.5 text-xs font-semibold"
          >
            <Upload size={14} /> Preview parsed rows
          </button>

          {previewChecked && csvPreview.length === 0 && (
            <p className="mt-2 text-xs text-danger">
              No valid rows found — check each line has a phone number
              starting with 01 (e.g. <code className="font-mono">01812345678,Name,A_ONLY,College Name,science</code>). `track` only matters for B-Unit students (science / humanities / commerce) — leave it blank for A-Unit-only rows.
            </p>
          )}

          {csvPreview.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-ink-100 dark:border-ink-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 dark:bg-ink-950">
                  <tr>
                    {Object.keys(csvPreview[0]).map((col) => (
                      <th key={col} className="px-2 py-1.5 font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((row, i) => (
                    <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-2 py-1.5">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] text-ink-400">
            Upload writes real Firestore records — each Student ID is
            generated and hashed server-side; the plain ID is shown below
            exactly once, for you to distribute. There's no "look it up
            again" feature by design (see the code comment in{" "}
            <code className="font-mono">bulk/route.js</code>) — a lost ID
            means reissuing one with the checkbox below, not recovering
            the old one.
          </p>

          <label className="mt-2 flex items-center gap-2 text-[11px] font-medium text-ink-600 dark:text-ink-100">
            <input type="checkbox" checked={resetIds} onChange={(e) => setResetIds(e.target.checked)} />
            Reset the Student ID for phone numbers already registered (use this to reissue a lost ID)
          </label>

          {csvPreview.length > 0 && (
            <button
              onClick={uploadStudents}
              disabled={uploading}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-ink-900 dark:bg-marigold-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-ink-950 disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload to database"}
            </button>
          )}

          {uploadError && (
            <p className="mt-2 text-xs text-danger">{uploadError}</p>
          )}

          {uploadResults && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-marigold-500/30 bg-marigold-500/5">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Phone</th>
                    <th className="px-2 py-1.5 font-semibold">Name</th>
                    <th className="px-2 py-1.5 font-semibold">College</th>
                    <th className="px-2 py-1.5 font-semibold">Status</th>
                    <th className="px-2 py-1.5 font-semibold">Student ID</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResults.map((r, i) => (
                    <tr key={i} className="border-t border-marigold-500/20">
                      <td className="px-2 py-1.5">{r.phone}</td>
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5">{r.college || "—"}</td>
                      <td className="px-2 py-1.5">
                        {r.status === "exists" ? (
                          <span className="text-ink-400">already registered</span>
                        ) : r.status === "id-reset" ? (
                          <span className="text-marigold-600 dark:text-marigold-400">ID reset</span>
                        ) : r.status === "skipped" ? (
                          <span className="text-danger">{r.reason}</span>
                        ) : (
                          <span className="text-success">created</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-mono font-semibold">{r.generatedId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <button
          onClick={publishExam}
          disabled={publishing || !examTitle || questions.length === 0}
          className="w-full rounded-lg bg-ink-900 dark:bg-marigold-500 py-3 text-sm font-semibold text-white dark:text-ink-950 disabled:opacity-60"
        >
          {publishing ? "Publishing..." : editingExamId ? "Save changes" : "Publish exam"}
        </button>
        {publishError && <p className="text-center text-xs text-danger">{publishError}</p>}
        {publishedId && (
          <p className="text-center text-xs text-success">
            Published — exam ID <code className="font-mono">{publishedId}</code>
          </p>
        )}
      </section>
    </main>
  );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, LogOut, Pencil, X, Check } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import { cn } from "@/lib/utils";

const emptyDraft = () => ({
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  videoUrl: "",
  choiceGroup: "",
});

export default function ModeratorDashboardPage() {
  const router = useRouter();
  const [exams, setExams] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState(null); // null = adding new
  const [saving, setSaving] = useState(false);

  const selectedExam = exams?.find((e) => e.id === selectedExamId) || null;
  const subjectsForExam = selectedExam
    ? permissions.filter((p) => p.unit === selectedExam.unit).map((p) => p.subject)
    : [];

  useEffect(() => {
    fetch("/api/moderator/exams")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "লোড করতে সমস্যা হয়েছে।");
        setExams(data.exams);
        setPermissions(data.permissions || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadQuestions = useCallback(() => {
    if (!selectedExamId || !selectedSubject) return;
    setLoadingQuestions(true);
    fetch(`/api/admin/exams/${selectedExamId}/questions?subject=${encodeURIComponent(selectedSubject)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "লোড করতে সমস্যা হয়েছে।");
        setQuestions(data.questions);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingQuestions(false));
  }, [selectedExamId, selectedSubject]);

  useEffect(() => {
    setQuestions([]);
    setDraft(emptyDraft());
    setEditingId(null);
    loadQuestions();
  }, [loadQuestions]);

  function startEdit(q) {
    setEditingId(q.id);
    setDraft({
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || "",
      videoUrl: q.videoUrl || "",
      choiceGroup: q.choiceGroup || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function saveQuestion() {
    if (!draft.text.trim() || draft.options.some((o) => !o.trim())) {
      setError("প্রশ্ন ও সব অপশন পূরণ করো।");
      return;
    }
    setError("");
    setSaving(true);

    const payload = {
      subject: selectedSubject,
      text: draft.text,
      options: draft.options,
      correctIndex: draft.correctIndex,
      explanation: draft.explanation,
      videoUrl: draft.videoUrl,
      choiceGroup: draft.choiceGroup || null,
    };

    const request = editingId
      ? fetch(`/api/admin/exams/${selectedExamId}/questions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : fetch(`/api/admin/exams/${selectedExamId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    request
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "সেভ করতে সমস্যা হয়েছে।");
        cancelEdit();
        loadQuestions();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  }

  function deleteQuestion(qId) {
    if (!confirm("এই প্রশ্নটি মুছে ফেলতে চাও?")) return;
    fetch(`/api/admin/exams/${selectedExamId}/questions/${qId}`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "মুছতে সমস্যা হয়েছে।");
        loadQuestions();
      })
      .catch((err) => setError(err.message));
  }

  function handleLogout() {
    fetch("/api/moderator/session", { method: "DELETE" }).finally(() => router.push("/moderator/login"));
  }

  if (!exams) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-20">
      <header className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 px-4 py-4">
        <h1 className="font-display text-base font-semibold text-ink-900 dark:text-white">Moderator — প্রশ্ন যোগ করো</h1>
        <button onClick={handleLogout} className="flex items-center gap-1 text-xs font-medium text-ink-400">
          <LogOut size={14} /> Logout
        </button>
      </header>

      <section className="space-y-4 px-4 py-5">
        <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">এক্সাম বাছাই করো</span>
            <select
              value={selectedExamId}
              onChange={(e) => { setSelectedExamId(e.target.value); setSelectedSubject(""); }}
              className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
            >
              <option value="">— বাছাই করো —</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>{e.title} (Unit {e.unit}, {e.type})</option>
              ))}
            </select>
          </label>

          {selectedExam && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-100">তোমার সাবজেক্ট</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
              >
                <option value="">— বাছাই করো —</option>
                {subjectsForExam.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}

          {selectedExam?.hasSubjectChoice && selectedSubject && (
            <p className="mt-2 text-[11px] text-ink-400" lang="bn">
              এই এক্সামে সাবজেক্ট চয়েস আছে — {selectedExam.choiceLabelA} = গ্রুপ A, {selectedExam.choiceLabelB} = গ্রুপ B।
              তোমার সাবজেক্ট যদি কমন (সবাই দেখবে) হয়, "কমন" রাখো।
            </p>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        {selectedExamId && selectedSubject && (
          <>
            {/* Add / edit form */}
            <div className="rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                {editingId ? <><Pencil size={14} /> প্রশ্ন এডিট করো</> : <><Plus size={14} /> নতুন প্রশ্ন যোগ করো</>}
              </h2>

              <textarea
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                placeholder="প্রশ্ন লেখো — LaTeX এর জন্য $...$ ব্যবহার করো, যেমন $a = v/t$"
                rows={2}
                className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
              />

              {draft.text && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-ink-50 dark:bg-ink-950 p-2.5 text-xs">
                  <Eye size={12} className="mt-0.5 shrink-0 text-ink-400" />
                  <MathRenderer text={draft.text} />
                </div>
              )}

              <div className="mt-2 space-y-1.5">
                {draft.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-option"
                      checked={draft.correctIndex === oi}
                      onChange={() => setDraft((d) => ({ ...d, correctIndex: oi }))}
                    />
                    <input
                      value={opt}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === oi ? e.target.value : o)) }))
                      }
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      className="flex-1 rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-1.5 text-sm outline-none"
                    />
                  </div>
                ))}
              </div>

              <label className="mt-2 flex items-center gap-2 text-[11px] font-medium text-ink-600 dark:text-ink-100">
                <input
                  type="radio"
                  name="correct-option"
                  checked={draft.correctIndex === null}
                  onChange={() => setDraft((d) => ({ ...d, correctIndex: null }))}
                />
                ট্র্যাপ প্রশ্ন — কোনো সঠিক উত্তর নেই
              </label>

              <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-400">ব্যাখ্যা — টেক্সট</p>
              <textarea
                value={draft.explanation}
                onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
              />

              <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">ব্যাখ্যা — ভিডিও লিংক (ঐচ্ছিক)</p>
              <input
                value={draft.videoUrl}
                onChange={(e) => setDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                placeholder="https://youtu.be/..."
                className="w-full rounded-lg border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 px-3 py-2 text-sm outline-none"
              />

              {selectedExam?.hasSubjectChoice && (
                <div className="mt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">এই প্রশ্ন কাদের জন্য?</p>
                  <div className="flex gap-2">
                    {[
                      { key: "", label: "কমন (সবাই)" },
                      { key: "A", label: selectedExam.choiceLabelA || "গ্রুপ A" },
                      { key: "B", label: selectedExam.choiceLabelB || "গ্রুপ B" },
                    ].map(({ key, label }) => (
                      <button
                        key={key || "common"}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, choiceGroup: key }))}
                        className={cn(
                          "flex-1 rounded-lg border py-1.5 text-[11px] font-semibold",
                          draft.choiceGroup === key
                            ? "border-marigold-500 bg-ink-900 text-white dark:bg-marigold-500 dark:text-ink-950"
                            : "border-ink-100 dark:border-ink-700"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={saveQuestion}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-900 dark:bg-marigold-500 py-2 text-sm font-semibold text-white dark:text-ink-950 disabled:opacity-60"
                >
                  <Check size={14} /> {saving ? "সেভ হচ্ছে..." : editingId ? "আপডেট করো" : "যোগ করো"}
                </button>
                {editingId && (
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 rounded-lg border border-ink-100 dark:border-ink-700 px-4 py-2 text-sm font-semibold"
                  >
                    <X size={14} /> বাতিল
                  </button>
                )}
              </div>
            </div>

            {/* Existing questions for this subject */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink-900 dark:text-white">
                {selectedSubject}-এর প্রশ্নসমূহ {loadingQuestions ? "" : `(${questions.length}টি)`}
              </h2>
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <div key={q.id} className="rounded-lg border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold text-marigold-600 dark:text-marigold-400">প্রশ্ন {idx + 1}</p>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(q)} className="text-ink-400"><Pencil size={13} /></button>
                        <button onClick={() => deleteQuestion(q.id)} className="text-danger"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <MathRenderer text={q.text} className="mt-1 text-sm" />
                  </div>
                ))}
                {!loadingQuestions && questions.length === 0 && (
                  <p className="py-4 text-center text-xs text-ink-400">এখনো কোনো প্রশ্ন যোগ করা হয়নি।</p>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
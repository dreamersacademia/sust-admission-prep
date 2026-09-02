"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy, Download, CheckCircle2, Info } from "lucide-react";

const COLUMNS = ["name", "mobile", "college", "unitPermission", "track", "registeredVia", "createdAt"];
const HEADERS = ["Name", "Mobile", "College", "Unit Permission", "Track", "Registered Via", "Registered At"];

export default function AdminStudentsPage() {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/students/export")
      .then(async (res) => {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.error || `Failed to load (status ${res.status})`);
        setStudents(data.students);
      })
      .catch((err) => setError(err.message));
  }, []);

  function toRows() {
    return (students || []).map((s) => COLUMNS.map((c) => s[c] ?? ""));
  }

  // Tab-separated, not comma-separated — pasting TSV directly into
  // Google Sheets auto-splits it into columns natively, no import
  // dialog needed. This is the "copy and drop into a Sheet" workflow.
  function copyForSheets() {
    const tsv = [HEADERS, ...toRows()].map((row) => row.join("\t")).join("\n");
    navigator.clipboard?.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCsv() {
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [HEADERS, ...toRows()].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="p-6 text-center text-sm text-danger">{error}</p>;
  if (!students) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-16">
      <header className="border-b border-ink-100 dark:border-ink-800 px-4 py-4">
        <h1 className="font-display text-base font-semibold text-ink-900 dark:text-white">রেজিস্টার্ড স্টুডেন্ট তালিকা</h1>
        <p className="text-xs text-ink-400">{students.length} জন নিবন্ধিত</p>
      </header>

      <section className="px-4 py-5">
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-marigold-500/10 p-3 text-xs text-marigold-700 dark:text-marigold-300">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p lang="bn">
            Student ID এখানে থাকবে না — সেটা হ্যাশ করে রাখা হয়, পাসওয়ার্ডের মতোই, তাই কখনো ফিরিয়ে দেখা যায় না।
            আইডি হারালে বাল্ক আপলোডে "Reset ID" ব্যবহার করে নতুন আইডি ইস্যু করো।
          </p>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={copyForSheets}
            className="flex items-center gap-1.5 rounded-lg bg-ink-900 dark:bg-marigold-500 px-3 py-2 text-xs font-semibold text-white dark:text-ink-950"
          >
            {copied ? <CheckCircle2 size={14} /> : <ClipboardCopy size={14} />}
            {copied ? "কপি হয়েছে!" : "কপি করো (Google Sheets-এ পেস্ট করো)"}
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 rounded-lg border border-ink-100 dark:border-ink-700 px-3 py-2 text-xs font-semibold text-ink-600 dark:text-ink-100"
          >
            <Download size={14} /> CSV ডাউনলোড
          </button>
        </div>

        {students.length === 0 ? (
          <p className="text-center text-xs text-ink-400">এখনো কোনো স্টুডেন্ট নিবন্ধিত হয়নি।</p>
        ) : (
          <div className="overflow-x-auto rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 dark:bg-ink-950">
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                    {COLUMNS.map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-2">{s[c] || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
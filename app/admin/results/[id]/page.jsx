"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Trophy, Download, GraduationCap } from "lucide-react";

export default function AdminResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/exams/${id}/analytics`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function downloadPdf() {
    setGenerating(true);
    try {
      // Dynamically imported so the ~200KB PDF library only ever loads
      // for the one admin who clicks this button, not in every student's
      // page bundle.
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(data.exam.title, 14, 16);
      doc.setFontSize(10);
      doc.text(`Unit ${data.exam.unit} · Total marks: ${data.exam.totalMarks}`, 14, 22);

      autoTable(doc, {
        startY: 28,
        head: [["Rank", "Name", "College", "Score"]],
        body: data.merit.map((row) => [
          row.rank,
          row.name,
          row.isGuest ? `${row.college || "—"} (guest)` : row.college || "—",
          row.score,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [26, 32, 80] },
      });

      doc.save(`${data.exam.title.replace(/[^\w]+/g, "-")}-results.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  if (error) return <p className="p-6 text-center text-sm text-danger">{error}</p>;
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-marigold-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ink-50 dark:bg-ink-950 pb-16">
      <header className="border-b border-ink-100 dark:border-ink-800 px-4 py-4">
        <h1 className="font-display text-base font-semibold text-ink-900 dark:text-white">{data.exam.title}</h1>
        <p className="text-xs text-ink-400">Unit {data.exam.unit} · {data.merit.length} submissions</p>
      </header>

      <section className="px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 dark:text-white">
            <Trophy size={15} className="text-marigold-500" /> Merit list
          </h2>
          <button
            onClick={downloadPdf}
            disabled={generating || data.merit.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-ink-900 dark:bg-marigold-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-ink-950 disabled:opacity-50"
          >
            <Download size={13} /> {generating ? "Generating..." : "Download PDF"}
          </button>
        </div>

        {data.merit.length === 0 ? (
          <p className="text-center text-xs text-ink-400">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl2 border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 dark:bg-ink-950">
                <tr>
                  <th className="px-3 py-2 font-semibold">Rank</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">College</th>
                  <th className="px-3 py-2 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.merit.map((row) => (
                  <tr key={row.rank} className="border-t border-ink-100 dark:border-ink-800">
                    <td className="px-3 py-2">{row.rank}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1">
                        <GraduationCap size={12} className="text-ink-400" />
                        {row.college || "—"}
                        {row.isGuest && <span className="text-ink-400">(guest)</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {Object.keys(data.stats || {}).length > 0 && (
          <p className="mt-4 text-[11px] text-ink-400" lang="bn">
            প্রতি প্রশ্নের বিস্তারিত স্ট্যাটস (কে কোন অপশন দিয়েছে) স্টুডেন্টদের রেজাল্ট পেজেই এখন দেখা যায় — এখানে শুধু মেরিট লিস্ট ও PDF এক্সপোর্ট।
          </p>
        )}
      </section>
    </main>
  );
}
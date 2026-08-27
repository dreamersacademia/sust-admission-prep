type Row = {
  id: string;
  studentName: string;
  studentRoll: string | null;
  score: number;
  totalMarks: number;
  timeTakenSeconds: number;
  submittedAt: Date;
};

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function MeritTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full text-left font-body text-sm">
        <thead>
          <tr className="border-b border-line bg-parchment/60 text-ink">
            <th className="px-3 py-2 font-semibold">মেধাক্রম</th>
            <th className="px-3 py-2 font-semibold">নাম</th>
            <th className="px-3 py-2 font-semibold">রোল</th>
            <th className="px-3 py-2 font-semibold text-right">স্কোর</th>
            <th className="px-3 py-2 font-semibold text-right">সময়</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className={`border-b border-line/60 last:border-0 ${
                i < 3 ? 'bg-signal/5 font-semibold' : ''
              }`}
            >
              <td className="px-3 py-2">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </td>
              <td className="px-3 py-2">{row.studentName}</td>
              <td className="px-3 py-2 text-ink/60">{row.studentRoll ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatScore(row.score)}/{formatScore(row.totalMarks)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink/60">
                {formatDuration(row.timeTakenSeconds)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-ink/50">
                এখনো কেউ পরীক্ষা দেয়নি।
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const rows = [
  { metric: "Upfront Cost", reservesit: "$1,799 one-time", opentable: "$0", resy: "$0" },
  { metric: "Monthly Fee", reservesit: "$0 (or $15 hosted)", opentable: "$249-$699+", resy: "$249-$899+" },
  { metric: "Per-Cover Fee", reservesit: "$0", opentable: "$1-$1.50", resy: "$0.99-$1.50" },
  { metric: "Year 1 Cost", reservesit: "$1,799", opentable: "$3,500+", resy: "$3,000+" },
  { metric: "Year 2 Cost", reservesit: "$0", opentable: "$3,500+", resy: "$3,000+" },
  { metric: "Data Ownership", reservesit: "You own your data", opentable: "Platform-controlled", resy: "Platform-controlled" },
  { metric: "Self-Host Option", reservesit: "Yes", opentable: "No", resy: "No" },
];

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[720px] w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Metric</th>
            <th className="px-4 py-3">ReserveSit</th>
            <th className="px-4 py-3">OpenTable</th>
            <th className="px-4 py-3">Resy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-900">{row.metric}</td>
              <td className="px-4 py-3 text-blue-700 font-semibold">{row.reservesit}</td>
              <td className="px-4 py-3 text-slate-700">{row.opentable}</td>
              <td className="px-4 py-3 text-slate-700">{row.resy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

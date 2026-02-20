const rows = [
  { plan: "ReserveSit Core", year1: "$2,199", year2: "$299", year3: "$299", total: "$2,797", reserveSit: true },
  { plan: "ReserveSit Service Pro", year1: "$2,999", year2: "$399", year3: "$399", total: "$3,797", reserveSit: true },
  { plan: "ReserveSit Full Suite", year1: "$3,799", year2: "$399", year3: "$399", total: "$4,597", reserveSit: true },
  { plan: "OpenTable", year1: "$6,000+", year2: "$6,000+", year3: "$6,000+", total: "$18,000+", reserveSit: false },
  { plan: "Resy", year1: "$5,988+", year2: "$5,988+", year3: "$5,988+", total: "$17,964+", reserveSit: false },
];

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[760px] w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Year 1</th>
            <th className="px-4 py-3">Year 2</th>
            <th className="px-4 py-3">Year 3</th>
            <th className="px-4 py-3">3-Year Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.plan} className="border-t border-slate-100">
              <td className={`px-4 py-3 font-semibold ${row.reserveSit ? "text-blue-700" : "text-slate-700"}`}>{row.plan}</td>
              <td className={`px-4 py-3 ${row.reserveSit ? "font-semibold text-blue-700" : "text-slate-700"}`}>{row.year1}</td>
              <td className={`px-4 py-3 ${row.reserveSit ? "font-semibold text-blue-700" : "text-slate-700"}`}>{row.year2}</td>
              <td className={`px-4 py-3 ${row.reserveSit ? "font-semibold text-blue-700" : "text-slate-700"}`}>{row.year3}</td>
              <td className={`px-4 py-3 font-semibold ${row.reserveSit ? "text-blue-700" : "text-slate-700"}`}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

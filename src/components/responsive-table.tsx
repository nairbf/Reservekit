"use client";

import type { ReactNode } from "react";

interface ResponsiveRow {
  key: string | number;
  cells: ReactNode[];
  mobileTitle: string;
  mobileSubtitle?: string;
  mobileMeta?: string[];
  onClick?: () => void;
  actions?: ReactNode;
}

interface ResponsiveTableProps {
  headers: string[];
  rows: ResponsiveRow[];
  emptyMessage?: string;
}

export default function ResponsiveTable({
  headers,
  rows,
  emptyMessage = "No records found.",
}: ResponsiveTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article
            key={row.key}
            onClick={row.onClick}
            className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${row.onClick ? "cursor-pointer" : ""}`}
          >
            <div className="font-semibold text-gray-900">{row.mobileTitle}</div>
            {row.mobileSubtitle ? <div className="mt-1 text-sm text-gray-600">{row.mobileSubtitle}</div> : null}
            {row.mobileMeta && row.mobileMeta.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {row.mobileMeta.map((meta, index) => (
                  <span
                    key={`${row.key}-meta-${index}`}
                    className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                  >
                    {meta}
                  </span>
                ))}
              </div>
            ) : null}
            {row.actions ? <div className="mt-3 flex flex-wrap gap-2">{row.actions}</div> : null}
          </article>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                onClick={row.onClick}
                className={`border-t border-gray-100 ${row.onClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
              >
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-cell-${index}`} className="px-4 py-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

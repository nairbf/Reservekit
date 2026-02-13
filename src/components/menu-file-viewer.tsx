"use client";

import { useMemo, useState } from "react";
import type { MenuFileEntry } from "@/lib/menu-files";

function isPdf(file: MenuFileEntry): boolean {
  return file.type === "pdf" || file.url.toLowerCase().endsWith(".pdf");
}

export function MenuFileViewer({
  files,
  accentColor,
}: {
  files: MenuFileEntry[];
  accentColor: string;
}) {
  const [activeId, setActiveId] = useState(files[0]?.id || "");

  const active = useMemo(() => {
    return files.find((file) => file.id === activeId) || files[0];
  }, [activeId, files]);

  if (!active) return null;

  const pdf = isPdf(active);

  return (
    <div className="space-y-4">
      {files.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => {
            const selected = file.id === active.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveId(file.id)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-all ${selected ? "text-white shadow" : "border-gray-200 bg-white text-gray-700"}`}
                style={selected ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
              >
                {file.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-serif">{active.label}</h2>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{pdf ? "PDF" : "Image"} menu</p>
          </div>
          <a
            href={active.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download
          </a>
        </div>

        {pdf ? (
          <div className="space-y-3">
            <embed
              src={active.url}
              type="application/pdf"
              className="hidden h-[70vh] w-full rounded-lg border md:block"
            />
            <div className="md:hidden rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              PDF preview is limited on mobile. Use the download button to open the full menu.
            </div>
          </div>
        ) : (
          <img src={active.url} alt={active.label} className="w-full rounded-lg border border-gray-100 object-contain" />
        )}
      </div>
    </div>
  );
}

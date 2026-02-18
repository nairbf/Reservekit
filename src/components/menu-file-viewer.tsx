"use client";

import { useEffect, useMemo, useState } from "react";
import type { MenuFileEntry } from "@/lib/menu-files";

function isPdf(file: MenuFileEntry): boolean {
  return file.type === "pdf" || file.url.toLowerCase().endsWith(".pdf");
}

interface LabelGroup {
  key: string;
  label: string;
  files: MenuFileEntry[];
  uploadedAt: string;
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function groupByLabel(files: MenuFileEntry[]): LabelGroup[] {
  const groups = new Map<string, LabelGroup>();

  for (const file of files) {
    const label = file.label.trim() || "Menu";
    const key = normalizeLabel(label);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        label,
        files: [file],
        uploadedAt: file.uploadedAt,
      });
      continue;
    }

    existing.files.push(file);
    if (new Date(file.uploadedAt).getTime() > new Date(existing.uploadedAt).getTime()) {
      existing.uploadedAt = file.uploadedAt;
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aOrder = a.files[0]?.order ?? 0;
    const bOrder = b.files[0]?.order ?? 0;
    return aOrder - bOrder || a.label.localeCompare(b.label);
  });
}

export function MenuFileViewer({
  files,
  accentColor,
}: {
  files: MenuFileEntry[];
  accentColor: string;
}) {
  const groups = useMemo(() => groupByLabel(files), [files]);
  const [activeKey, setActiveKey] = useState(groups[0]?.key || "");

  useEffect(() => {
    if (!groups.length) return;
    if (!groups.some((group) => group.key === activeKey)) {
      setActiveKey(groups[0].key);
    }
  }, [activeKey, groups]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.key === activeKey) || groups[0],
    [activeKey, groups],
  );

  if (!activeGroup) return null;

  return (
    <div className="space-y-4">
      {groups.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => {
            const selected = group.key === activeGroup.key;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setActiveKey(group.key)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-all ${selected ? "text-white shadow" : "border-gray-200 bg-white text-gray-700"}`}
                style={selected ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
              >
                {group.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 font-serif">{activeGroup.label}</h2>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              {activeGroup.files.length} page{activeGroup.files.length === 1 ? "" : "s"}
            </p>
          </div>
          {activeGroup.files.length === 1 ? (
            <a
              href={activeGroup.files[0].url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download
            </a>
          ) : null}
        </div>

        <div className="space-y-5">
          {activeGroup.files.map((file, index) => {
            const pdf = isPdf(file);
            return (
              <section key={file.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-700">Page {index + 1}</p>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Download
                  </a>
                </div>

                {pdf ? (
                  <div className="space-y-3">
                    <embed
                      src={file.url}
                      type="application/pdf"
                      className="hidden h-[70vh] w-full rounded-lg border md:block"
                    />
                    <div className="md:hidden rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      PDF preview is limited on mobile. Use download to open this page.
                    </div>
                  </div>
                ) : (
                  <img src={file.url} alt={`${activeGroup.label} page ${index + 1}`} className="w-full rounded-lg border border-gray-100 object-contain" />
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium mb-1">{children}</label>;
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
      />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow p-4 sm:p-6">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

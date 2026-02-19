"use client";

import Link from "next/link";

export default function AccessDenied() {
  return (
    <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <h2 className="text-lg font-semibold">You don&apos;t have access to this page</h2>
      <p className="mt-1 text-sm">
        Your account doesn&apos;t currently include permission to view this section.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex h-10 items-center rounded-lg border border-amber-300 px-3 text-sm font-medium"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}


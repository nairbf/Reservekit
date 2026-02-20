"use client";

import { useEffect, useMemo, useState } from "react";
import { Section } from "./shared";

interface LinksTabProps {
  settings: Record<string, string>;
}

type CopyState = "idle" | "copied" | "error";

export function LinksTab({ settings }: LinksTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [embedTheme, setEmbedTheme] = useState<"light" | "dark">("light");
  const [embedAccent, setEmbedAccent] = useState("#2563eb");
  const [embedHeight, setEmbedHeight] = useState(600);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setOrigin(window.location.origin);
      return;
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
      setOrigin(process.env.NEXT_PUBLIC_APP_URL);
    }
  }, []);

  const slug = (settings.slug || "").trim();
  const hasSlug = Boolean(slug);
  const safeSlug = hasSlug ? slug : "your-restaurant";
  const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "";

  function buildUrl(path: string) {
    const root = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    if (!root) return path;
    if (path === "/") return root;
    return `${root}${path}`;
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setCopyState("copied");
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
        setCopyState("idle");
      }, 2000);
    } catch {
      setCopiedKey(key);
      setCopyState("error");
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
        setCopyState("idle");
      }, 2000);
    }
  }

  const links = useMemo(
    () => [
      { key: "reserve", label: "Reservation Page", url: buildUrl(`/reserve/${safeSlug}`) },
      { key: "events", label: "Events Page", url: buildUrl("/events") },
      { key: "menu", label: "Menu Page", url: buildUrl("/menu") },
      { key: "waitlist", label: "Join Waitlist", url: buildUrl("/waitlist/join") },
      { key: "landing", label: "Landing Page", url: buildUrl("/") },
    ],
    [baseUrl, safeSlug],
  );

  const embedParams = useMemo(() => {
    const params = new URLSearchParams();
    if (embedTheme === "dark") params.set("theme", "dark");
    if (embedAccent && embedAccent !== "#2563eb") params.set("accent", embedAccent);
    return params;
  }, [embedAccent, embedTheme]);

  const embedSrc = `${buildUrl("/reserve/embed")}${embedParams.toString() ? `?${embedParams.toString()}` : ""}`;
  const embedCode = `<iframe src="${embedSrc}" width="100%" height="${embedHeight}" frameborder="0" style="border: none; border-radius: 12px;" title="Reserve a Table"></iframe>`;
  const buttonCode = `<a href="${buildUrl(`/reserve/${safeSlug}`)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; background-color: ${embedAccent}; color: white; text-decoration: none; border-radius: 8px; font-family: sans-serif; font-weight: 600;">Reserve a Table</a>`;
  const qrTarget = buildUrl(`/reserve/${safeSlug}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTarget)}`;

  const previewHeight = Math.max(260, Math.min(embedHeight, 420));

  return (
    <div className="space-y-6">
      {!hasSlug ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Slug is not set. Configure it in the Restaurant tab to generate final share links.
        </div>
      ) : null}

      <Section title="Quick Links">
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.key} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{link.label}</p>
                  <div className="mt-1 truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700">
                    {link.url}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(link.url, `link-${link.key}`)}
                    className="h-9 rounded-lg border border-gray-300 px-3 text-sm"
                  >
                    {copiedKey === `link-${link.key}` && copyState === "copied" ? "Copied!" : copiedKey === `link-${link.key}` && copyState === "error" ? "Copy failed" : "Copy"}
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 rounded-lg border border-gray-300 px-3 text-sm leading-9"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Embed Widget">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">Theme</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEmbedTheme("light")}
                className={`h-10 flex-1 rounded-lg border px-3 text-sm ${embedTheme === "light" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"}`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setEmbedTheme("dark")}
                className={`h-10 flex-1 rounded-lg border px-3 text-sm ${embedTheme === "dark" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"}`}
              >
                Dark
              </button>
            </div>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">Accent Color</span>
            <input
              type="color"
              value={embedAccent}
              onChange={(event) => setEmbedAccent(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">Height (px)</span>
            <input
              type="number"
              min={360}
              max={1200}
              value={embedHeight}
              onChange={(event) => setEmbedHeight(Math.max(360, Number(event.target.value || 600)))}
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-700">
            {embedCode}
          </pre>
        </div>
        <button
          type="button"
          onClick={() => copyToClipboard(embedCode, "embed-code")}
          className="mt-3 h-10 rounded-lg border border-gray-300 px-3 text-sm"
        >
          {copiedKey === "embed-code" && copyState === "copied" ? "Copied!" : copiedKey === "embed-code" && copyState === "error" ? "Copy failed" : "Copy Code"}
        </button>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <iframe
            src={embedSrc}
            title="Reservation Widget Preview"
            className="w-full"
            style={{ height: `${previewHeight}px`, border: "none" }}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </Section>

      <Section title="Button Snippet">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-700">
            {buttonCode}
          </pre>
        </div>
        <button
          type="button"
          onClick={() => copyToClipboard(buttonCode, "button-code")}
          className="mt-3 h-10 rounded-lg border border-gray-300 px-3 text-sm"
        >
          {copiedKey === "button-code" && copyState === "copied" ? "Copied!" : copiedKey === "button-code" && copyState === "error" ? "Copy failed" : "Copy Code"}
        </button>
      </Section>

      <Section title="QR Code">
        <p className="mb-3 text-sm text-gray-600">Use this QR code on table tents, signs, or printed menus to drive direct reservations.</p>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-3">
          <img src={qrUrl} alt="Reservation page QR code" className="h-48 w-48" />
        </div>
        <div className="mt-3">
          <a
            href={qrUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={`reservesit-${safeSlug}-qr.png`}
            className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-3 text-sm"
          >
            Download QR
          </a>
        </div>
      </Section>
    </div>
  );
}

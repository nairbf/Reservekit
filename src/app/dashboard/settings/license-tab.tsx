"use client";

import type { SettingsTabProps } from "./page";
import { Label, Section } from "./shared";

type LicenseTabProps = SettingsTabProps & { [key: string]: any };

export function LicenseTab(props: LicenseTabProps) {
  const {
    settings,
    maskedLicenseKey,
    showLicenseKey,
    setShowLicenseKey,
    copyLicenseKey,
    planBadge,
    statusBadge,
    formatDateTime,
    validateNow,
    licenseBusy,
    licenseMessage,
    FEATURE_ROWS,
  } = props;

  return (
    <div className="space-y-6">
          <Section title="License Information">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label>License Key</Label>
                <div className="h-11 rounded-lg border border-gray-200 px-3 flex items-center text-sm font-mono">
                  {maskedLicenseKey}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLicenseKey((value: boolean) => !value)}
                  className="h-11 rounded-lg border border-gray-200 px-3 text-sm"
                >
                  {showLicenseKey ? "Hide" : "Reveal"}
                </button>
                <button
                  type="button"
                  onClick={copyLicenseKey}
                  className="h-11 rounded-lg border border-gray-200 px-3 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Plan</div>
                <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${planBadge(settings.license_plan || "CORE")}`}>
                  {settings.license_plan || "CORE"}
                </span>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(settings.license_status || "UNKNOWN")}`}>
                  {settings.license_status || "UNKNOWN"}
                </span>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              Last validated: <span className="font-medium">{formatDateTime(settings.license_last_check || "")}</span>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={validateNow}
                disabled={licenseBusy}
                className="h-11 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-70"
              >
                {licenseBusy ? "Validating..." : "Validate Now"}
              </button>
            </div>

            {licenseMessage && (
              <p className={`mt-3 text-sm ${licenseMessage.toLowerCase().includes("failed") || licenseMessage.toLowerCase().includes("could not") ? "text-red-600" : "text-green-700"}`}>
                {licenseMessage}
              </p>
            )}
          </Section>

          <Section title="Enabled Features">
            <div className="space-y-2">
              {FEATURE_ROWS.map((feature: any) => {
                const enabled = settings[feature.key] === "true";
                return (
                  <div key={feature.key} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <span>{feature.label}</span>
                    <span className={enabled ? "text-green-700" : "text-gray-500"}>{enabled ? "✓ Enabled" : "✕ Disabled"}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-gray-500">Contact support@reservesit.com to change your plan or add features.</p>
          </Section>
    </div>
  );
}

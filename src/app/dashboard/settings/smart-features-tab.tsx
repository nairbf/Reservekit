"use client";

import { useState } from "react";
import type { SettingsTabProps } from "./page";
import { Section } from "./shared";

type SmartFeaturesTabProps = SettingsTabProps & { [key: string]: unknown };

const SMART_FEATURES = [
  {
    key: "smartTurnTime",
    label: "Turn Time Estimation",
    description:
      "Tracks average dining duration per table size. Shows estimated availability on the floor plan and improves waitlist time quotes.",
  },
  {
    key: "smartNoShowRisk",
    label: "No-Show Risk Scoring",
    description:
      "Flags reservations with higher no-show likelihood based on guest history and booking patterns. Shows a subtle badge on the tonight view.",
  },
  {
    key: "smartGuestIntel",
    label: "Guest Intelligence Tags",
    description:
      "Auto-tags guests as First Time, Regular, VIP, or Returning based on visit history. Shows on tonight view and reservation details.",
  },
  {
    key: "smartWaitlistEstimate",
    label: "Smart Waitlist Estimates",
    description:
      "Calculates real wait times based on current seated reservations and average turn times instead of just queue position.",
  },
  {
    key: "smartDailyPrep",
    label: "Daily Prep Summary",
    description:
      "Sends a morning email to staff with tonight's reservation count, VIP guests, large parties, and potential issues.",
  },
  {
    key: "smartPacingAlerts",
    label: "Pacing Alerts",
    description:
      "Warns when too many reservations are clustered in a time slot relative to your table capacity.",
  },
] as const;

export function SmartFeaturesTab(props: SmartFeaturesTabProps) {
  const { settings, setField, savePartial } = props;
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function toggleFeature(key: string, enabled: boolean) {
    const next = enabled ? "false" : "true";
    setSavingKey(key);
    setMessage("");
    setField(key, next);
    try {
      await savePartial({ [key]: next });
      setMessage("Smart features updated.");
    } catch (error) {
      setField(key, enabled ? "true" : "false");
      setMessage(error instanceof Error ? error.message : "Could not update feature.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Smart Features">
        <p className="mb-4 text-sm text-gray-600">
          These features run quietly in the background and surface insights where your team already looks. Toggle any feature on or off.
        </p>
        <div className="space-y-3">
          {SMART_FEATURES.map((feature) => {
            const enabled = settings[feature.key] !== "false";
            const busy = savingKey === feature.key;
            return (
              <div key={feature.key} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{feature.label}</h3>
                    <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFeature(feature.key, enabled)}
                    disabled={busy}
                    className={`inline-flex h-8 min-w-[62px] items-center justify-center rounded-full border px-3 text-xs font-semibold transition-all ${
                      enabled
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-gray-300 bg-gray-50 text-gray-600"
                    } disabled:opacity-60`}
                  >
                    {busy ? "Saving..." : enabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {message ? <p className="mt-4 text-sm text-gray-600">{message}</p> : null}
      </Section>
    </div>
  );
}

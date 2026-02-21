"use client";

import type { SettingsTabProps } from "./page";
import { Field, Label, Section } from "./shared";

type ReservationsTabProps = SettingsTabProps & { [key: string]: any };

function centsToDollarInput(value: string) {
  const cents = Number(value || "0");
  if (!Number.isFinite(cents)) return "0";
  const fixed = (cents / 100).toFixed(2);
  return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function dollarsToCents(value: string) {
  const dollars = Number(value || "0");
  if (!Number.isFinite(dollars)) return "0";
  return String(Math.max(0, Math.round(dollars * 100)));
}

export function ReservationsTab(props: ReservationsTabProps) {
  const {
    settings,
    setField,
    TIMEZONE_OPTIONS,
    currentTimeInTimezone,
    clockMs,
    stripeConfigured,
    depositsEnabled,
    setStripeTestStatus,
    setStripeTestMessage,
    onGoToIntegrations,
  } = props;

  return (
    <div className="space-y-6">
          <Section title="Booking Rules">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Restaurant Timezone</Label>
                <select
                  value={settings.timezone || "America/New_York"}
                  onChange={(event) => setField("timezone", event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  {(TIMEZONE_OPTIONS as Array<{ value: string; label: string }>).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Current time: {currentTimeInTimezone(settings.timezone || "America/New_York", clockMs)}
                </p>
              </div>
              <Field label="Default Open Time" type="time" value={settings.openTime || "17:00"} onChange={(v) => setField("openTime", v)} />
              <Field label="Default Close Time" type="time" value={settings.closeTime || "22:00"} onChange={(v) => setField("closeTime", v)} />
              <Field label="Slot Duration (minutes)" type="number" value={settings.slotInterval || "30"} onChange={(v) => setField("slotInterval", v)} />
              <Field label="Max Party Size" type="number" value={settings.maxPartySize || "8"} onChange={(v) => setField("maxPartySize", v)} />
              <Field label="Max Covers Per Slot" type="number" value={settings.maxCoversPerSlot || "40"} onChange={(v) => setField("maxCoversPerSlot", v)} />
              <Field label="Booking Lead Time (hours)" type="number" value={settings.bookingLeadHours || "0"} onChange={(v) => setField("bookingLeadHours", v)} />
              <Field label="Default Party Sizes" value={settings.defaultPartySizes || "2,4,6,8"} onChange={(v) => setField("defaultPartySizes", v)} />
              <Field label="Last Seating Buffer (minutes)" type="number" value={settings.lastSeatingBufferMin || "90"} onChange={(v) => setField("lastSeatingBufferMin", v)} />
              <Field label="Self-Service Cutoff (hours)" type="number" value={settings.selfServiceCutoffHours || "2"} onChange={(v) => setField("selfServiceCutoffHours", v)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Approval Mode</Label>
                <select
                  value={settings.reservationApprovalMode || "manual"}
                  onChange={(event) => setField("reservationApprovalMode", event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  <option value="manual">Manual approval</option>
                  <option value="auto">Auto-confirm</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <Label>Cancellation Policy</Label>
              <textarea
                value={settings.cancellationPolicy || ""}
                onChange={(event) => setField("cancellationPolicy", event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Example: Cancellations within 2 hours may be charged."
              />
            </div>
          </Section>

          <Section title="Deposits & No-Show Protection">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Want to accept deposits or card holds?</strong>{" "}
                Connect your Stripe account in the{" "}
                <button
                  type="button"
                  onClick={() => onGoToIntegrations?.()}
                  className="font-medium text-blue-700 underline"
                >
                  Integrations tab
                </button>
                .
              </p>
            </div>

            {depositsEnabled && !stripeConfigured ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠ Deposits are enabled but Stripe is not configured. Guests will not be charged.
              </div>
            ) : null}

            <label className="mb-4 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={depositsEnabled}
                onChange={(event) => {
                  if (event.target.checked && !stripeConfigured) {
                    setStripeTestStatus("invalid");
                    setStripeTestMessage("Configure Stripe keys before enabling deposits.");
                    return;
                  }
                  const value = event.target.checked ? "true" : "false";
                  setField("depositEnabled", value);
                }}
                className="h-4 w-4"
              />
              Enable deposits / card holds
            </label>

            {depositsEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Deposit Type</Label>
                  <select
                    value={settings.depositType || "hold"}
                    onChange={(event) => setField("depositType", event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  >
                    <option value="hold">Card hold (authorize only)</option>
                    <option value="deposit">Deposit (charge now)</option>
                  </select>
                </div>
                <div>
                  <Label>Deposit Amount (USD)</Label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={centsToDollarInput(settings.depositAmount || "0")}
                    onChange={(event) => setField("depositAmount", dollarsToCents(event.target.value))}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter amount in dollars (e.g., 25 for $25.00).</p>
                </div>
                <Field
                  label="Apply at Party Size >="
                  type="number"
                  value={settings.depositMinPartySize || settings.depositMinParty || "2"}
                  onChange={(v) => setField("depositMinPartySize", v)}
                />
                <div className="sm:col-span-2">
                  <Label>Deposit Message</Label>
                  <textarea
                    value={settings.depositMessage || ""}
                    onChange={(event) => setField("depositMessage", event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={settings.noshowChargeEnabled === "true"}
                onChange={(event) => setField("noshowChargeEnabled", event.target.checked ? "true" : "false")}
                className="h-4 w-4"
              />
              Charge no-shows when a card is on file
            </label>

            {settings.noshowChargeEnabled === "true" && (
              <div className="mt-4 max-w-sm">
                <div>
                  <Label>No-Show Charge Amount (USD)</Label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={centsToDollarInput(settings.noshowChargeAmount || settings.depositAmount || "0")}
                    onChange={(event) => setField("noshowChargeAmount", dollarsToCents(event.target.value))}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  />
                </div>
              </div>
            )}
          </Section>
    </div>
  );
}

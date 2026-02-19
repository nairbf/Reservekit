"use client";

import type { SettingsTabProps } from "./page";
import { Field, Label, Section } from "./shared";

type ReservationsTabProps = SettingsTabProps & { [key: string]: any };

export function ReservationsTab(props: ReservationsTabProps) {
  const {
    settings,
    setField,
    TIMEZONE_OPTIONS,
    currentTimeInTimezone,
    clockMs,
    stripeOAuthMessage,
    stripeOAuthError,
    stripeConnectedViaOauth,
    stripeAccountId,
    disconnectStripeConnect,
    stripeDisconnecting,
    stripeConnectEnabled,
    showStripeSecretKey,
    setShowStripeSecretKey,
    stripeConfigured,
    stripeTestStatus,
    testStripeConnection,
    stripeTestMessage,
    depositsEnabled,
    setStripeTestStatus,
    setStripeTestMessage,
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
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Payment Processing</h3>
              <p className="mt-1 text-sm text-gray-600">
                Connect your Stripe account to accept deposits and card holds from guests.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Don&apos;t have a Stripe account? Create one at{" "}
                <a className="text-blue-700 underline" href="https://stripe.com" target="_blank" rel="noreferrer">
                  stripe.com
                </a>{" "}
                — it takes about 10 minutes.
              </p>

              {stripeOAuthMessage ? (
                <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${stripeOAuthError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                  {stripeOAuthMessage}
                </div>
              ) : null}

              {stripeConnectedViaOauth ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-sm font-semibold text-emerald-800">✓ Connected via Stripe Connect</div>
                  <div className="mt-1 text-xs text-emerald-700">Account: {stripeAccountId}</div>
                  <button
                    type="button"
                    onClick={disconnectStripeConnect}
                    disabled={stripeDisconnecting}
                    className="mt-3 h-10 rounded-lg border border-emerald-300 bg-white px-3 text-sm text-emerald-800 disabled:opacity-60"
                  >
                    {stripeDisconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              ) : (
                <>
                  {stripeConnectEnabled ? (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                      <a
                        href="/api/stripe/connect"
                        className="inline-flex h-11 items-center rounded-lg bg-[#635bff] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#7a73ff]"
                      >
                        Connect with Stripe
                      </a>
                      <p className="mt-2 text-xs text-gray-500">One click to connect your Stripe account.</p>
                    </div>
                  ) : null}

                  <div className="mt-4 text-xs uppercase tracking-wide text-gray-500">or enter keys manually</div>

                  <div className="mt-3 grid gap-3">
                    <div>
                      <Label>Stripe Publishable Key</Label>
                      <input
                        type="text"
                        value={settings.stripePublishableKey || ""}
                        onChange={(event) => setField("stripePublishableKey", event.target.value)}
                        placeholder="pk_live_..."
                        className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>

                    <div>
                      <Label>Stripe Secret Key</Label>
                      <div className="flex gap-2">
                        <input
                          type={showStripeSecretKey ? "text" : "password"}
                          value={settings.stripeSecretKey || ""}
                          onChange={(event) => setField("stripeSecretKey", event.target.value)}
                          placeholder="sk_live_..."
                          className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStripeSecretKey((value: boolean) => !value)}
                          className="h-11 rounded-lg border border-gray-200 px-3 text-sm"
                        >
                          {showStripeSecretKey ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label>Stripe Webhook Secret (optional)</Label>
                      <input
                        type="password"
                        value={settings.stripeWebhookSecret || ""}
                        onChange={(event) => setField("stripeWebhookSecret", event.target.value)}
                        placeholder="whsec_..."
                        className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!stripeConfigured ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        ⚠ Not configured
                      </span>
                    ) : stripeTestStatus === "connected" ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        ✓ Connected
                      </span>
                    ) : stripeTestStatus === "invalid" ? (
                      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                        ✗ Invalid
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        ⚠ Not verified
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={testStripeConnection}
                      disabled={stripeTestStatus === "testing"}
                      className="h-10 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-60"
                    >
                      {stripeTestStatus === "testing" ? "Testing..." : "Test Connection"}
                    </button>
                  </div>

                  {stripeTestMessage ? (
                    <p className={`mt-2 text-sm ${stripeTestStatus === "invalid" ? "text-red-600" : "text-emerald-700"}`}>
                      {stripeTestMessage}
                    </p>
                  ) : null}
                </>
              )}
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
                <Field label="Deposit Amount (cents)" type="number" value={settings.depositAmount || "0"} onChange={(v) => setField("depositAmount", v)} />
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
                <Field
                  label="No-Show Charge Amount (cents)"
                  type="number"
                  value={settings.noshowChargeAmount || settings.depositAmount || "0"}
                  onChange={(v) => setField("noshowChargeAmount", v)}
                />
              </div>
            )}
          </Section>
    </div>
  );
}

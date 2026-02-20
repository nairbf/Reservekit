"use client";

import type { SettingsTabProps } from "./page";
import { Label, Section } from "./shared";

type IntegrationsTabProps = SettingsTabProps & { [key: string]: any };

export function IntegrationsTab(props: IntegrationsTabProps) {
  const {
    settings,
    setField,
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
    posMessage,
    posLoading,
    spotOnLoading,
    spotOnConfigured,
    spotOnStatus,
    spotOnExpanded,
    setSpotOnExpanded,
    maskedSpotOnApiKey,
    saveSpotOnConfig,
    spotOnSaving,
    syncSpotOnNow,
    spotOnSyncing,
    spotOnMappingOpen,
    setSpotOnMappingOpen,
    disconnectSpotOn,
    spotOnMessage,
    spotOnMappingBusy,
    autoMatchSpotOnTables,
    saveSpotOnMapping,
    spotOnMappingRows,
    setSpotOnMappingRow,
    spotOnTables,
    removeSpotOnMappingRow,
    addSpotOnMappingRow,
    spotOnMappingMessage,
    POS_PROVIDERS,
    posStatus,
    posBusy,
    syncPos,
    disconnectPos,
    connectPos,
    formatDateTime,
  } = props;

  return (
    <div className="space-y-6">
          <Section title="Stripe Connect">
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
          </Section>

          <Section title="Integrations">
            <p className="text-sm text-gray-600">
              Connect your POS system to sync menu items, tables, and business hours. Sync is read-only.
            </p>

            {posMessage ? (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${posMessage.toLowerCase().includes("failed") || posMessage.toLowerCase().includes("error") ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                {posMessage}
              </div>
            ) : null}

            {posLoading || spotOnLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Loading integration status...
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <article className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📍</span>
                        <h3 className="text-base font-semibold text-gray-900">SpotOn POS</h3>
                        {spotOnConfigured ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Connected
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        Real-time table status, auto-complete reservations when checks close.
                      </p>
                      {spotOnConfigured ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Last sync: {spotOnStatus.spotonLastSync ? formatDateTime(spotOnStatus.spotonLastSync) : "Never"} · {spotOnStatus.openChecks} open checks
                        </p>
                      ) : null}
                      {!spotOnStatus.licensed ? (
                        <p className="mt-1 text-xs text-amber-700">POS integration requires an active POS module license.</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSpotOnExpanded((value: boolean) => !value)}
                        className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white"
                      >
                        {spotOnExpanded ? "Hide" : spotOnConfigured ? "Manage" : "Configure"}
                      </button>
                    </div>
                  </div>

                  {spotOnExpanded ? (
                    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>SpotOn API Key</Label>
                          <input
                            type="password"
                            value={settings.spotonApiKey || ""}
                            onChange={(event) => setField("spotonApiKey", event.target.value)}
                            placeholder="Enter SpotOn API key"
                            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <Label>Location ID</Label>
                          <input
                            value={settings.spotonLocationId || ""}
                            onChange={(event) => setField("spotonLocationId", event.target.value)}
                            placeholder="Location ID"
                            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                          />
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={settings.spotonUseMock === "true"}
                          onChange={(event) => setField("spotonUseMock", event.target.checked ? "true" : "false")}
                          className="h-4 w-4"
                        />
                        Use Mock Data
                      </label>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <div>API Key: {maskedSpotOnApiKey}</div>
                        <div>Location ID: {(settings.spotonLocationId || "").trim() || "Not configured"}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveSpotOnConfig}
                          disabled={spotOnSaving}
                          className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                        >
                          {spotOnSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={syncSpotOnNow}
                          disabled={!spotOnConfigured || !spotOnStatus.licensed || spotOnSyncing}
                          className="h-10 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-60"
                        >
                          {spotOnSyncing ? "Syncing..." : "Sync Now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpotOnMappingOpen((value: boolean) => !value)}
                          disabled={!spotOnConfigured || !spotOnStatus.licensed}
                          className="h-10 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-60"
                        >
                          {spotOnMappingOpen ? "Hide Table Mapping" : "Table Mapping"}
                        </button>
                        <button
                          type="button"
                          onClick={disconnectSpotOn}
                          disabled={!spotOnConfigured || spotOnSaving}
                          className="h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700 disabled:opacity-60"
                        >
                          Disconnect
                        </button>
                      </div>

                      {spotOnMessage ? (
                        <p className={`text-sm ${spotOnMessage.toLowerCase().includes("failed") || spotOnMessage.toLowerCase().includes("error") ? "text-red-600" : "text-green-700"}`}>
                          {spotOnMessage}
                        </p>
                      ) : null}

                      {spotOnMappingOpen ? (
                        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-gray-900">Table Mapping</h4>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={autoMatchSpotOnTables}
                                disabled={spotOnMappingBusy}
                                className="h-9 rounded-lg border border-gray-300 px-3 text-xs"
                              >
                                Auto-Match
                              </button>
                              <button
                                type="button"
                                onClick={saveSpotOnMapping}
                                disabled={spotOnMappingBusy}
                                className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white"
                              >
                                Save Mapping
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {spotOnMappingRows.map((row: any) => (
                              <div key={row.rowId} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <select
                                  value={row.reservekitTableId}
                                  onChange={(event) => {
                                    const next = event.target.value ? Number(event.target.value) : "";
                                    setSpotOnMappingRow(row.rowId, { reservekitTableId: next });
                                  }}
                                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                                >
                                  <option value="">ReserveSit Table</option>
                                  {spotOnTables.map((table: any) => (
                                    <option key={table.id} value={table.id}>
                                      {table.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={row.spotOnTable}
                                  onChange={(event) => setSpotOnMappingRow(row.rowId, { spotOnTable: event.target.value })}
                                  placeholder="SpotOn table name/number"
                                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSpotOnMappingRow(row.rowId)}
                                  className="h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={addSpotOnMappingRow}
                            className="h-9 rounded-lg border border-gray-300 px-3 text-xs"
                          >
                            + Add Mapping Row
                          </button>

                          {spotOnMappingMessage ? (
                            <p className={`text-xs ${spotOnMappingMessage.toLowerCase().includes("failed") || spotOnMappingMessage.toLowerCase().includes("error") ? "text-red-600" : "text-gray-700"}`}>
                              {spotOnMappingMessage}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>

                {POS_PROVIDERS.map((provider: any) => {
                  const connected =
                    posStatus?.connected &&
                    posStatus.provider === provider.key &&
                    Boolean(posStatus.credentialsPresent?.[provider.key]);
                  const available = Boolean(posStatus?.availability?.[provider.key]);
                  const comingSoon = provider.key === "toast" && !available;

                  return (
                    <article key={provider.key} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{provider.icon}</span>
                            <h3 className="text-base font-semibold text-gray-900">{provider.name}</h3>
                            {connected ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Connected
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{provider.description}</p>
                          {connected ? (
                            <p className="mt-1 text-xs text-gray-500">
                              Location: {posStatus?.locationName || "Unknown"} · Last sync: {posStatus?.lastSync ? formatDateTime(posStatus.lastSync) : "Never"} · {posStatus?.counts.menuItems || 0} menu items
                            </p>
                          ) : null}
                          {comingSoon ? (
                            <p className="mt-1 text-xs text-amber-700">Pending Toast partner approval.</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {connected ? (
                            <>
                              <button
                                type="button"
                                onClick={() => syncPos(provider.key)}
                                disabled={posBusy === provider.key}
                                className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                              >
                                {posBusy === provider.key ? "Syncing..." : "Sync Now"}
                              </button>
                              <button
                                type="button"
                                onClick={() => disconnectPos(provider.key)}
                                disabled={posBusy === provider.key}
                                className="h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                              >
                                Disconnect
                              </button>
                            </>
                          ) : comingSoon ? (
                            <button
                              type="button"
                              disabled
                              className="h-10 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm text-amber-700"
                            >
                              Coming Soon
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => connectPos(provider.key)}
                              disabled={posBusy === provider.key}
                              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Section>
    </div>
  );
}

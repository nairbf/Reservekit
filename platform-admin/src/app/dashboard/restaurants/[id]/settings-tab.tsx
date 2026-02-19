// @ts-nocheck
"use client";

interface SettingsTabProps {
  [key: string]: any;
}

export function SettingsTab(props: SettingsTabProps) {
  const {
    restaurant,
    restaurantSettings,
    setRestaurantSettings,
    canManage,
    TIMEZONE_OPTIONS,
    saveRestaurantSettings,
    busy,
  } = props;

  return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Restaurant Settings</h2>
          <p className="text-sm text-slate-600">Manage onboarding and communication settings for this restaurant instance.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Email Overview</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Guests see:</span>
              <span>{`${restaurantSettings.restaurantName || restaurant.name} <reservations@reservesit.com>`}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Replies go to:</span>
              <span>{restaurantSettings.replyToEmail || "Not configured"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Alerts go to:</span>
              <span>{restaurantSettings.staffNotificationEmail || "Not configured"}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <span className="font-medium text-slate-500">Public email:</span>
              <span>{restaurantSettings.contactEmail || "Not configured"}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Email Configuration</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notification Email</span>
              <input
                value={restaurantSettings.staffNotificationEmail}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, staffNotificationEmail: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
              <span className="mt-1 block text-xs text-slate-500">New reservations, cancellations, and large party alerts go here.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reply-To Email</span>
              <input
                value={restaurantSettings.replyToEmail}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, replyToEmail: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
              <span className="mt-1 block text-xs text-slate-500">When guests reply to confirmation emails, replies are sent here.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Email</span>
              <input
                value={restaurantSettings.contactEmail}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, contactEmail: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
              <span className="mt-1 block text-xs text-slate-500">Shown publicly on the restaurant website.</span>
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.staffNotificationsEnabled}
                  disabled={!canManage}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, staffNotificationsEnabled: e.target.checked }))
                  }
                />
                Staff notifications enabled
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.emailEnabled}
                  disabled={!canManage}
                  onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, emailEnabled: e.target.checked }))}
                />
                Email enabled
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.emailSendConfirmations}
                  disabled={!canManage}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, emailSendConfirmations: e.target.checked }))
                  }
                />
                Send confirmations
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restaurantSettings.emailSendReminders}
                  disabled={!canManage}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, emailSendReminders: e.target.checked }))
                  }
                />
                Send reminders
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Large Party Threshold</span>
                <input
                  type="number"
                  min={1}
                  value={restaurantSettings.largePartyThreshold}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, largePartyThreshold: e.target.value }))
                  }
                  disabled={!canManage}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reminder Timing</span>
                <select
                  value={restaurantSettings.emailReminderTiming}
                  onChange={(e) =>
                    setRestaurantSettings((prev) => ({ ...prev, emailReminderTiming: e.target.value }))
                  }
                  disabled={!canManage}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                >
                  <option value="2">2 hours</option>
                  <option value="4">4 hours</option>
                  <option value="24">24 hours</option>
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Restaurant Identity</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant Name</span>
              <input
                value={restaurantSettings.restaurantName}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, restaurantName: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
              <input
                value={restaurantSettings.phone}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
              <input
                value={restaurantSettings.address}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, address: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</span>
                <select
                  value={restaurantSettings.timezone}
                  onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                  disabled={!canManage}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                >
                  {TIMEZONE_OPTIONS.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Accent Color</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={restaurantSettings.accentColor || "#1e3a5f"}
                    onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
                    disabled={!canManage}
                    className="h-10 w-14 rounded-lg border border-slate-300 bg-white p-1 disabled:bg-slate-100"
                  />
                  <input
                    value={restaurantSettings.accentColor}
                    onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
                    disabled={!canManage}
                    className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
                  />
                </div>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tagline</span>
              <input
                value={restaurantSettings.tagline}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, tagline: e.target.value }))}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
              <textarea
                value={restaurantSettings.description}
                onChange={(e) => setRestaurantSettings((prev) => ({ ...prev, description: e.target.value }))}
                disabled={!canManage}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
          </div>
        </div>

        {canManage ? (
          <div className="flex">
            <button
              type="button"
              onClick={saveRestaurantSettings}
              disabled={busy === "save-settings"}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "save-settings" ? "Saving..." : "Save Restaurant Settings"}
            </button>
          </div>
        ) : null}
      </section>
  );
}

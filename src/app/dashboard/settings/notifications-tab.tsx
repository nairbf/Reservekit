"use client";

import { useState } from "react";
import type { SettingsTabProps } from "./page";
import { Field, Label, Section } from "./shared";

type NotificationsTabProps = SettingsTabProps & { [key: string]: any };

const SMS_TEMPLATES = [
  {
    key: "sms_template_confirmed",
    title: "Reservation Confirmed",
    defaultBody:
      "Hi {{guestName}}, your reservation at {{restaurantName}} on {{date}} at {{time}} for {{partySize}} is confirmed. Manage: {{manageUrl}}",
  },
  {
    key: "sms_template_reminder",
    title: "Reservation Reminder",
    defaultBody:
      "Reminder: {{guestName}}, your table at {{restaurantName}} is at {{time}} today for {{partySize}}. See you soon! Manage: {{manageUrl}}",
  },
  {
    key: "sms_template_cancelled",
    title: "Reservation Cancelled",
    defaultBody:
      "Hi {{guestName}}, your reservation at {{restaurantName}} on {{date}} at {{time}} has been cancelled. Questions? Reply to this message.",
  },
  {
    key: "sms_template_waitlist_ready",
    title: "Waitlist Ready",
    defaultBody: "Great news {{guestName}}! Your table at {{restaurantName}} is ready. Please check in with the host.",
  },
] as const;

export function NotificationsTab(props: NotificationsTabProps) {
  const {
    settings,
    setField,
    replyToEmail,
    staffNotificationEmail,
    reminderLeadHours,
    smsEnabled,
    templates,
    templateLoading,
    templateExpanded,
    setTemplateExpanded,
    TEMPLATE_VARIABLES,
    insertTemplateVariable,
    testRecipient,
    setTestRecipient,
    currentUserEmail,
    templateSaving,
    templateTesting,
    templateMessage,
    setTemplateField,
    saveTemplate,
    resetTemplate,
    previewTemplate,
    sendTestTemplate,
  } = props;
  const [smsTemplateExpanded, setSmsTemplateExpanded] = useState<string | null>(null);

  function getSmsTemplateValue(key: string, fallback: string) {
    return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] || "" : fallback;
  }

  return (
    <div className="space-y-6">
          <Section title="Email Delivery">
            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p>
                Emails are sent from:{" "}
                <span className="font-semibold">
                  {`${settings.restaurantName || "Restaurant"} <reservations@reservesit.com>`}
                </span>
              </p>
              <p>
                Replies go to:{" "}
                <span className="font-semibold">
                  {replyToEmail || "Not configured"}
                </span>
              </p>
              {!replyToEmail && (
                <p className="text-xs text-blue-800">
                  Set a reply-to address below so guest replies go to your inbox.
                </p>
              )}
              <p className="text-xs text-blue-800">
                Guests will see your restaurant name as the sender. When they reply, it goes to your reply-to email.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Reply-to Email"
                value={replyToEmail}
                onChange={(v) => setField("replyToEmail", v)}
                placeholder="hello@restaurant.com"
              />
              <Field
                label="Staff Notification Email"
                value={staffNotificationEmail}
                onChange={(v) => setField("staffNotificationEmail", v)}
                placeholder="manager@restaurant.com"
              />
            </div>
          </Section>

          <Section title="Notification Rules">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailEnabled || "true") === "true"}
                  onChange={(event) => setField("emailEnabled", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Enable email notifications
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailSendConfirmations || "true") === "true"}
                  onChange={(event) => setField("emailSendConfirmations", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Send reservation confirmations
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailSendReminders || "true") === "true"}
                  onChange={(event) => {
                    const value = event.target.checked ? "true" : "false";
                    setField("emailSendReminders", value);
                  }}
                  className="h-4 w-4"
                />
                Send reservation reminders
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={(settings.emailSendWaitlist || "true") === "true"}
                  onChange={(event) => setField("emailSendWaitlist", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Send waitlist notifications
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={settings.staffNotificationsEnabled === "true"}
                  onChange={(event) => setField("staffNotificationsEnabled", event.target.checked ? "true" : "false")}
                  className="h-4 w-4"
                />
                Enable manager alert emails
              </label>
              <Field
                label="Large Party Threshold"
                type="number"
                value={settings.largePartyThreshold || "6"}
                onChange={(v) => setField("largePartyThreshold", v)}
              />
            </div>
            <div className="mt-4 max-w-xs">
              <Label>Reminder Timing</Label>
              <select
                value={reminderLeadHours}
                onChange={(event) => setField("reminderLeadHours", event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
              >
                <option value="2">2 hours before</option>
                <option value="4">4 hours before</option>
                <option value="24">24 hours before</option>
              </select>
            </div>
          </Section>

          {smsEnabled ? (
            <Section title="SMS Delivery (Enabled by License)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Twilio Account SID" value={settings.twilioSid || ""} onChange={(v) => setField("twilioSid", v)} />
                <Field label="Twilio Auth Token" type="password" value={settings.twilioToken || ""} onChange={(v) => setField("twilioToken", v)} />
                <Field label="Twilio Phone Number" value={settings.twilioPhone || ""} onChange={(v) => setField("twilioPhone", v)} placeholder="+15551234567" />
              </div>
            </Section>
          ) : (
            <Section title="SMS Delivery">
              <p className="text-sm text-gray-600">SMS is disabled for your plan. Contact support to enable this feature.</p>
            </Section>
          )}

          <Section title="Email Templates">
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Use variables like <code>{"{{guestName}}"}</code>, <code>{"{{date}}"}</code>, and <code>{"{{manageUrl}}"}</code> in your template content.
            </div>

            {templateMessage.__global && <p className="mb-4 text-sm text-red-600">{templateMessage.__global}</p>}

            {templateLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Loading templates...
              </div>
            ) : (
              <div className="space-y-3">
                {Object.values(templates as Record<string, any>).map((template: any) => {
                  const expanded = templateExpanded === template.id;
                  return (
                    <article key={template.id} className="rounded-xl border border-gray-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setTemplateExpanded(expanded ? null : template.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.subject}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {template.customized && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Customized
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{expanded ? "Hide" : "Edit"}</span>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-gray-100 px-4 py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Label>Subject</Label>
                              <input
                                data-template={template.id}
                                data-field="subject"
                                value={template.subject}
                                onChange={(event) => setTemplateField(template.id, "subject", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label>Heading</Label>
                              <input
                                data-template={template.id}
                                data-field="heading"
                                value={template.heading}
                                onChange={(event) => setTemplateField(template.id, "heading", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label>Body</Label>
                              <textarea
                                data-template={template.id}
                                data-field="body"
                                value={template.body}
                                onChange={(event) => setTemplateField(template.id, "body", event.target.value)}
                                rows={7}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              />
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(TEMPLATE_VARIABLES as string[]).map((variable) => (
                                  <button
                                    key={`${template.id}-body-${variable}`}
                                    type="button"
                                    onClick={() => insertTemplateVariable(template.id, "body", variable)}
                                    className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700"
                                  >
                                    {variable}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label>CTA Text</Label>
                              <input
                                data-template={template.id}
                                data-field="ctaText"
                                value={template.ctaText}
                                onChange={(event) => setTemplateField(template.id, "ctaText", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div>
                              <Label>CTA URL</Label>
                              <input
                                data-template={template.id}
                                data-field="ctaUrl"
                                value={template.ctaUrl}
                                onChange={(event) => setTemplateField(template.id, "ctaUrl", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Label>Footer Text</Label>
                              <input
                                data-template={template.id}
                                data-field="footerText"
                                value={template.footerText}
                                onChange={(event) => setTemplateField(template.id, "footerText", event.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                              />
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 md:flex md:flex-wrap md:items-center">
                            <button
                              type="button"
                              onClick={() => previewTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-11 rounded-lg border border-gray-300 px-3 text-sm"
                            >
                              Preview
                            </button>
                            <input
                              type="email"
                              value={testRecipient}
                              onChange={(event) => setTestRecipient(event.target.value)}
                              placeholder="Enter email address"
                              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm md:w-64"
                            />
                            <button
                              type="button"
                              onClick={() => sendTestTemplate(template.id)}
                              disabled={templateTesting === template.id}
                              className="h-11 rounded-lg border border-gray-300 px-3 text-sm"
                            >
                              {templateTesting === template.id ? "Sending..." : "Send Test Email"}
                            </button>
                            <span className="self-center text-xs text-gray-500 md:ml-1">
                              Test will be sent to: {testRecipient || currentUserEmail || "your account email"}
                            </span>
                            <button
                              type="button"
                              onClick={() => resetTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-11 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                            >
                              Reset to Default
                            </button>
                            <button
                              type="button"
                              onClick={() => saveTemplate(template.id)}
                              disabled={templateSaving === template.id}
                              className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70"
                            >
                              {templateSaving === template.id ? "Saving..." : "Save"}
                            </button>
                          </div>

                          {templateMessage[template.id] && (
                            <p className={`mt-3 text-sm ${templateMessage[template.id].toLowerCase().includes("failed") || templateMessage[template.id].toLowerCase().includes("could not") ? "text-red-600" : "text-green-700"}`}>
                              {templateMessage[template.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Section>

          {smsEnabled ? (
            <Section title="SMS Templates">
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                SMS templates have a 160-character limit per segment. Keep messages concise.
              </div>

              <div className="space-y-3">
                {SMS_TEMPLATES.map((template) => {
                  const expanded = smsTemplateExpanded === template.key;
                  const value = getSmsTemplateValue(template.key, template.defaultBody);
                  const count = value.length;
                  return (
                    <article key={template.key} className="rounded-xl border border-gray-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setSmsTemplateExpanded(expanded ? null : template.key)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{template.title}</div>
                          <div className="line-clamp-1 text-xs text-gray-500">{value}</div>
                        </div>
                        <span className="text-xs text-gray-500">{expanded ? "Hide" : "Edit"}</span>
                      </button>

                      {expanded ? (
                        <div className="border-t border-gray-100 px-4 py-4">
                          <textarea
                            value={value}
                            onChange={(event) => setField(template.key, event.target.value)}
                            rows={4}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          <div className={`mt-2 text-xs ${count > 160 ? "text-red-600" : "text-gray-500"}`}>
                            {count} characters
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </Section>
          ) : null}
    </div>
  );
}

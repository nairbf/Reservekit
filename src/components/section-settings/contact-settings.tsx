"use client";

import { useEffect, useState } from "react";

type SaveHandler = (patch: Record<string, string>) => Promise<void> | void;

export default function ContactSettings({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: SaveHandler;
}) {
  const [address, setAddress] = useState(settings.address || "");
  const [phone, setPhone] = useState(settings.phone || "");
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || "");
  const [socialInstagram, setSocialInstagram] = useState(settings.socialInstagram || "");
  const [socialFacebook, setSocialFacebook] = useState(settings.socialFacebook || "");
  const [footerTagline, setFooterTagline] = useState(settings.footerTagline || "Join us for seasonal cuisine, thoughtful service, and a dining room built for memorable nights.");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAddress(settings.address || "");
    setPhone(settings.phone || "");
    setContactEmail(settings.contactEmail || "");
    setSocialInstagram(settings.socialInstagram || "");
    setSocialFacebook(settings.socialFacebook || "");
    setFooterTagline(settings.footerTagline || "Join us for seasonal cuisine, thoughtful service, and a dining room built for memorable nights.");
  }, [settings]);

  async function saveSection() {
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        address,
        phone,
        contactEmail,
        socialInstagram,
        socialFacebook,
        footerTagline,
      });
      setMessage("Contact settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Contact email</label>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Instagram URL</label>
          <input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Facebook URL</label>
          <input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Footer tagline</label>
          <input value={footerTagline} onChange={(e) => setFooterTagline(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={saveSection} disabled={saving} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Contact Section"}
        </button>
        {message ? <span className="text-sm text-green-700">{message}</span> : null}
      </div>
    </div>
  );
}

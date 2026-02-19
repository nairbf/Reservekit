"use client";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/access-denied";
import { useHasPermission } from "@/hooks/use-permissions";

type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

interface Override {
  id: number;
  date: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  maxCovers: number | null;
  note: string | null;
}

interface DailyScheduleForm {
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  maxCovers: string;
}

type WeeklyScheduleForm = Record<WeekdayKey, DailyScheduleForm>;

interface SpecialDepositRule {
  enabled: boolean;
  label: string;
  requiresDeposit: boolean;
  amount: number;
  minParty: number;
  message: string;
}

interface SpecialDateForm {
  date: string;
  label: string;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  maxCovers: string;
  note: string;
  requiresDeposit: boolean;
  depositAmount: string;
  depositMinParty: string;
  depositMessage: string;
}

const WEEKDAYS: Array<{ key: WeekdayKey; label: string }> = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];
const INTERVAL_PRESETS = [5, 10, 15, 20, 30, 45, 60];
const LAST_SEATING_PRESETS = [0, 15, 30, 45, 60, 75, 90, 120];

function safeJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createDefaultWeekly(openTime: string, closeTime: string, maxCovers: string): WeeklyScheduleForm {
  return {
    sun: { isClosed: false, openTime, closeTime, maxCovers },
    mon: { isClosed: false, openTime, closeTime, maxCovers },
    tue: { isClosed: false, openTime, closeTime, maxCovers },
    wed: { isClosed: false, openTime, closeTime, maxCovers },
    thu: { isClosed: false, openTime, closeTime, maxCovers },
    fri: { isClosed: false, openTime, closeTime, maxCovers },
    sat: { isClosed: false, openTime, closeTime, maxCovers },
  };
}

function normalizeWeekdayKey(raw: string): WeekdayKey | null {
  const v = raw.trim().toLowerCase();
  if (v === "sun" || v === "sunday" || v === "0") return "sun";
  if (v === "mon" || v === "monday" || v === "1") return "mon";
  if (v === "tue" || v === "tuesday" || v === "2") return "tue";
  if (v === "wed" || v === "wednesday" || v === "3") return "wed";
  if (v === "thu" || v === "thursday" || v === "4") return "thu";
  if (v === "fri" || v === "friday" || v === "5") return "fri";
  if (v === "sat" || v === "saturday" || v === "6") return "sat";
  return null;
}

function parseWeeklySchedule(raw: string | undefined, fallback: WeeklyScheduleForm): WeeklyScheduleForm {
  const parsed = safeJson<Record<string, Partial<{ isClosed: boolean; openTime: string; closeTime: string; maxCovers: number | null }>>>(raw, {});
  const next: WeeklyScheduleForm = { ...fallback };
  for (const [rawKey, value] of Object.entries(parsed)) {
    const key = normalizeWeekdayKey(rawKey);
    if (!key) continue;
    const maxCovers = typeof value.maxCovers === "number" && Number.isFinite(value.maxCovers) ? String(Math.max(1, Math.trunc(value.maxCovers))) : fallback[key].maxCovers;
    next[key] = {
      isClosed: Boolean(value.isClosed),
      openTime: value.openTime || fallback[key].openTime,
      closeTime: value.closeTime || fallback[key].closeTime,
      maxCovers,
    };
  }
  return next;
}

function parseSpecialDepositRules(raw: string | undefined, defaults: { amount: string; minParty: string; message: string }) {
  const parsed = safeJson<Record<string, Partial<SpecialDepositRule>>>(raw, {});
  const rules: Record<string, SpecialDepositRule> = {};
  for (const [date, value] of Object.entries(parsed)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    rules[date] = {
      enabled: value.enabled !== false,
      label: String(value.label || ""),
      requiresDeposit: Boolean(value.requiresDeposit),
      amount: Number.isFinite(Number(value.amount)) ? Math.max(0, Number(value.amount)) : Number(defaults.amount || 0),
      minParty: Number.isFinite(Number(value.minParty)) ? Math.max(1, Number(value.minParty)) : Math.max(1, Number(defaults.minParty || 2)),
      message: String(value.message || defaults.message),
    };
  }
  return rules;
}

function getWeekdayFromDate(date: string): WeekdayKey {
  const d = new Date(`${date}T12:00:00`);
  const idx = Number.isNaN(d.getTime()) ? 0 : d.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"][idx] as WeekdayKey) || "sun";
}

function fmtTime12(t: string | null | undefined): string {
  if (!t) return "";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return t;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function fmtDateLabel(date: string): string {
  const dt = new Date(`${date}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function SchedulePage() {
  const canManageSchedule = useHasPermission("manage_schedule");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleForm>(createDefaultWeekly("17:00", "22:00", "40"));
  const [specialDepositRules, setSpecialDepositRules] = useState<Record<string, SpecialDepositRule>>({});
  const [specialForm, setSpecialForm] = useState<SpecialDateForm>({
    date: "",
    label: "",
    isClosed: false,
    openTime: "17:00",
    closeTime: "22:00",
    maxCovers: "",
    note: "",
    requiresDeposit: false,
    depositAmount: "0",
    depositMinParty: "2",
    depositMessage: "A refundable deposit may be required to hold your table.",
  });
  const [depositDefaults, setDepositDefaults] = useState({
    depositAmount: "0",
    depositMinParty: "2",
    depositMessage: "A refundable deposit may be required to hold your table.",
  });
  const [loaded, setLoaded] = useState(false);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingSpecial, setSavingSpecial] = useState(false);
  const [slotInterval, setSlotInterval] = useState("30");
  const [lastSeatingBufferMin, setLastSeatingBufferMin] = useState("90");
  const [weeklyMessage, setWeeklyMessage] = useState("");
  const [specialMessage, setSpecialMessage] = useState("");

  if (!canManageSchedule) return <AccessDenied />;

  async function load() {
    const [overrideRes, settingsRes] = await Promise.all([fetch("/api/day-overrides"), fetch("/api/settings/public")]);
    const [overrideData, settings] = await Promise.all([overrideRes.json(), settingsRes.json()]);
    const openTime = settings.openTime || "17:00";
    const closeTime = settings.closeTime || "22:00";
    const maxCovers = settings.maxCoversPerSlot || "40";
    const loadedInterval = String(settings.slotInterval || "30");
    const loadedLastSeatingBuffer = String(settings.lastSeatingBufferMin || "90");
    const depositMessage = settings.depositMessage || "A refundable deposit may be required to hold your table.";
    const depositAmount = settings.depositAmount || "0";
    const depositMinParty = settings.depositMinPartySize || settings.depositMinParty || "2";

    setOverrides(Array.isArray(overrideData) ? overrideData : []);
    setWeeklySchedule(parseWeeklySchedule(settings.weeklySchedule, createDefaultWeekly(openTime, closeTime, maxCovers)));
    setSpecialDepositRules(parseSpecialDepositRules(settings.specialDepositRules, {
      amount: depositAmount,
      minParty: depositMinParty,
      message: depositMessage,
    }));
    setSpecialForm(prev => ({
      ...prev,
      depositAmount,
      depositMinParty,
      depositMessage,
    }));
    setSlotInterval(loadedInterval);
    setLastSeatingBufferMin(loadedLastSeatingBuffer);
    setDepositDefaults({
      depositAmount,
      depositMinParty,
      depositMessage,
    });
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  const mergedSpecialRows = useMemo(() => {
    const byDate = new Map<string, { override: Override | null; rule: SpecialDepositRule | null }>();
    for (const o of overrides) byDate.set(o.date, { override: o, rule: null });
    for (const [date, rule] of Object.entries(specialDepositRules)) {
      const existing = byDate.get(date);
      if (existing) existing.rule = rule;
      else byDate.set(date, { override: null, rule });
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, override: value.override, rule: value.rule }));
  }, [overrides, specialDepositRules]);

  async function saveWeeklySchedule(e: React.FormEvent) {
    e.preventDefault();
    setSavingWeekly(true);
    setWeeklyMessage("");
    try {
      const payload: Record<string, { isClosed: boolean; openTime: string; closeTime: string; maxCovers: number | null }> = {};
      const parsedInterval = Math.max(5, parseInt(slotInterval || "30", 10) || 30);
      const parsedLastSeatingBuffer = Math.max(0, parseInt(lastSeatingBufferMin || "90", 10) || 0);
      for (const day of WEEKDAYS) {
        const row = weeklySchedule[day.key];
        if (!row.isClosed && (!row.openTime || !row.closeTime)) {
          setWeeklyMessage(`Set open and close times for ${day.label}.`);
          setSavingWeekly(false);
          return;
        }
        payload[day.key] = {
          isClosed: row.isClosed,
          openTime: row.openTime || "17:00",
          closeTime: row.closeTime || "22:00",
          maxCovers: row.maxCovers ? Math.max(1, parseInt(row.maxCovers, 10)) : null,
        };
      }

      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklySchedule: JSON.stringify(payload),
          slotInterval: String(parsedInterval),
          lastSeatingBufferMin: String(parsedLastSeatingBuffer),
        }),
      });
      setSlotInterval(String(parsedInterval));
      setLastSeatingBufferMin(String(parsedLastSeatingBuffer));
      setWeeklyMessage(`Weekly schedule saved. Slot interval ${parsedInterval} min, last seating buffer ${parsedLastSeatingBuffer} min.`);
    } finally {
      setSavingWeekly(false);
    }
  }

  function copyMondayToWeekdays() {
    setWeeklySchedule(prev => {
      const monday = prev.mon;
      return {
        ...prev,
        tue: { ...monday },
        wed: { ...monday },
        thu: { ...monday },
        fri: { ...monday },
      };
    });
    setWeeklyMessage("Copied Monday settings to Tuesday-Friday. Save weekly schedule to apply.");
  }

  async function saveSpecialSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSavingSpecial(true);
    setSpecialMessage("");
    try {
      if (!specialForm.date) {
        setSpecialMessage("Choose a date for this special schedule.");
        return;
      }
      if (!specialForm.isClosed && (!specialForm.openTime || !specialForm.closeTime)) {
        setSpecialMessage("Open and close times are required unless the day is closed.");
        return;
      }

      await fetch("/api/day-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: specialForm.date,
          isClosed: specialForm.isClosed,
          openTime: specialForm.isClosed ? null : specialForm.openTime || null,
          closeTime: specialForm.isClosed ? null : specialForm.closeTime || null,
          maxCovers: specialForm.maxCovers ? Math.max(1, parseInt(specialForm.maxCovers, 10)) : null,
          note: specialForm.note || specialForm.label || null,
        }),
      });

      const nextRules = { ...specialDepositRules };
      const shouldStoreRule = specialForm.requiresDeposit || specialForm.label.trim().length > 0;
      if (shouldStoreRule) {
        nextRules[specialForm.date] = {
          enabled: true,
          label: specialForm.label.trim(),
          requiresDeposit: specialForm.requiresDeposit,
          amount: Math.max(0, Number(specialForm.depositAmount || 0)),
          minParty: Math.max(1, Number(specialForm.depositMinParty || 2)),
          message: specialForm.depositMessage || depositDefaults.depositMessage,
        };
      } else {
        delete nextRules[specialForm.date];
      }

      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialDepositRules: JSON.stringify(nextRules) }),
      });

      setSpecialDepositRules(nextRules);
      setSpecialMessage("Special date schedule saved.");
      setSpecialForm({
        date: "",
        label: "",
        isClosed: false,
        openTime: "17:00",
        closeTime: "22:00",
        maxCovers: "",
        note: "",
        requiresDeposit: false,
        depositAmount: depositDefaults.depositAmount,
        depositMinParty: depositDefaults.depositMinParty,
        depositMessage: depositDefaults.depositMessage,
      });
      await load();
    } finally {
      setSavingSpecial(false);
    }
  }

  async function removeSpecial(date: string, overrideId: number | null) {
    if (!confirm("Remove this special schedule?")) return;
    if (overrideId) {
      await fetch(`/api/day-overrides/${overrideId}`, { method: "DELETE" });
    }
    if (specialDepositRules[date]) {
      const nextRules = { ...specialDepositRules };
      delete nextRules[date];
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialDepositRules: JSON.stringify(nextRules) }),
      });
      setSpecialDepositRules(nextRules);
    }
    setSpecialMessage("Special schedule removed.");
    await load();
  }

  function editSpecial(date: string, override: Override | null, rule: SpecialDepositRule | null) {
    const dayKey = getWeekdayFromDate(date);
    const weekly = weeklySchedule[dayKey];
    setSpecialForm({
      date,
      label: rule?.label || "",
      isClosed: override?.isClosed || false,
      openTime: override?.openTime || weekly.openTime,
      closeTime: override?.closeTime || weekly.closeTime,
      maxCovers: override?.maxCovers ? String(override.maxCovers) : "",
      note: override?.note || "",
      requiresDeposit: rule?.requiresDeposit || false,
      depositAmount: String(rule?.amount ?? depositDefaults.depositAmount),
      depositMinParty: String(rule?.minParty ?? depositDefaults.depositMinParty),
      depositMessage: rule?.message || depositDefaults.depositMessage,
    });
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading schedule...
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduling</h1>
        <p className="text-sm text-gray-500">Set day-by-day operating hours and create special-date plans with optional deposit requirements.</p>
      </div>

      <form onSubmit={saveWeeklySchedule} className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Weekly Hours & Capacity</h2>
            <p className="text-sm text-gray-500">Control open/closed status, service hours, and max covers for each day of week.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyMondayToWeekdays}
              className="h-11 px-4 rounded-lg border border-gray-200 text-sm font-medium transition-all duration-200"
            >
              Copy Monday to Weekdays
            </button>
            <button type="submit" className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">
              {savingWeekly ? "Saving..." : "Save Weekly Schedule"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-lg border p-3 mb-3">
            <div className="text-sm font-medium mb-2">Reservation Slot Interval</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {INTERVAL_PRESETS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSlotInterval(String(v))}
                  className={`h-11 px-3 rounded-lg border text-sm transition-all duration-200 ${slotInterval === String(v) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700"}`}
                >
                  {v} min
                </button>
              ))}
            </div>
            <label className="text-sm text-gray-600">
              Custom interval (minutes)
              <input
                type="number"
                min="5"
                value={slotInterval}
                onChange={e => setSlotInterval(e.target.value)}
                className="mt-1 h-11 w-36 border rounded px-3 text-sm"
              />
            </label>
          </div>

          <div className="rounded-lg border p-3 mb-3">
            <div className="text-sm font-medium mb-2">Last Seating Buffer Before Close</div>
            <p className="text-xs text-gray-500 mb-2">Controls how many minutes before closing the last reservable time can appear.</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {LAST_SEATING_PRESETS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLastSeatingBufferMin(String(v))}
                  className={`h-11 px-3 rounded-lg border text-sm transition-all duration-200 ${lastSeatingBufferMin === String(v) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700"}`}
                >
                  {v} min
                </button>
              ))}
            </div>
            <label className="text-sm text-gray-600">
              Custom buffer (minutes)
              <input
                type="number"
                min="0"
                value={lastSeatingBufferMin}
                onChange={e => setLastSeatingBufferMin(e.target.value)}
                className="mt-1 h-11 w-36 border rounded px-3 text-sm"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[760px] space-y-2">
              <div className="grid grid-cols-[160px_120px_1fr_1fr_1fr] gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <div>Day</div>
                <div>Open/Closed</div>
                <div>Start Time</div>
                <div>End Time</div>
                <div>Max Covers</div>
              </div>
              {WEEKDAYS.map(day => {
                const row = weeklySchedule[day.key];
                return (
                  <div key={day.key} className="grid grid-cols-[160px_120px_1fr_1fr_1fr] gap-2 items-center rounded-lg border p-2">
                    <div className="font-medium text-sm">{day.label}</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!row.isClosed}
                        onChange={e => setWeeklySchedule(prev => ({ ...prev, [day.key]: { ...prev[day.key], isClosed: !e.target.checked } }))}
                        className="h-4 w-4"
                      />
                      Open
                    </label>
                    <input
                      type="time"
                      value={row.openTime}
                      onChange={e => setWeeklySchedule(prev => ({ ...prev, [day.key]: { ...prev[day.key], openTime: e.target.value } }))}
                      disabled={row.isClosed}
                      className="h-11 border rounded px-3 text-sm disabled:bg-gray-100"
                    />
                    <input
                      type="time"
                      value={row.closeTime}
                      onChange={e => setWeeklySchedule(prev => ({ ...prev, [day.key]: { ...prev[day.key], closeTime: e.target.value } }))}
                      disabled={row.isClosed}
                      className="h-11 border rounded px-3 text-sm disabled:bg-gray-100"
                    />
                    <input
                      type="number"
                      min="1"
                      value={row.maxCovers}
                      onChange={e => setWeeklySchedule(prev => ({ ...prev, [day.key]: { ...prev[day.key], maxCovers: e.target.value } }))}
                      disabled={row.isClosed}
                      placeholder="Max covers"
                      className="h-11 border rounded px-3 text-sm disabled:bg-gray-100"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {weeklyMessage && <p className="text-sm text-gray-700 mt-3">{weeklyMessage}</p>}
      </form>

      <form onSubmit={saveSpecialSchedule} className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Special Date Schedule</h2>
            <p className="text-sm text-gray-500">Set holiday/service exceptions (example: Valentine's Day) and optionally require deposits.</p>
          </div>
          <button type="submit" className="h-11 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium transition-all duration-200">
            {savingSpecial ? "Saving..." : "Save Special Date"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <label className="text-sm font-medium">Date
            <input type="date" value={specialForm.date} onChange={e => setSpecialForm(s => ({ ...s, date: e.target.value }))} className="mt-1 h-11 w-full border rounded px-3" required />
          </label>
          <label className="text-sm font-medium">Event Label
            <input value={specialForm.label} onChange={e => setSpecialForm(s => ({ ...s, label: e.target.value }))} className="mt-1 h-11 w-full border rounded px-3" placeholder="Valentine's Day" />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium mt-7">
            <input type="checkbox" checked={specialForm.isClosed} onChange={e => setSpecialForm(s => ({ ...s, isClosed: e.target.checked }))} className="h-4 w-4" />
            Closed this date
          </label>
          <label className="text-sm font-medium">Open
            <input
              type="time"
              value={specialForm.openTime}
              onChange={e => setSpecialForm(s => ({ ...s, openTime: e.target.value }))}
              disabled={specialForm.isClosed}
              className="mt-1 h-11 w-full border rounded px-3 disabled:bg-gray-100"
            />
          </label>
          <label className="text-sm font-medium">Close
            <input
              type="time"
              value={specialForm.closeTime}
              onChange={e => setSpecialForm(s => ({ ...s, closeTime: e.target.value }))}
              disabled={specialForm.isClosed}
              className="mt-1 h-11 w-full border rounded px-3 disabled:bg-gray-100"
            />
          </label>
          <label className="text-sm font-medium">Max Covers
            <input
              type="number"
              min="1"
              value={specialForm.maxCovers}
              onChange={e => setSpecialForm(s => ({ ...s, maxCovers: e.target.value }))}
              disabled={specialForm.isClosed}
              className="mt-1 h-11 w-full border rounded px-3 disabled:bg-gray-100"
              placeholder="Use weekly default"
            />
          </label>
        </div>

        <label className="text-sm font-medium block mb-4">Internal Note
          <input
            value={specialForm.note}
            onChange={e => setSpecialForm(s => ({ ...s, note: e.target.value }))}
            className="mt-1 h-11 w-full border rounded px-3"
            placeholder="Special menu, private event, holiday staffing notes"
          />
        </label>

        <div className="border rounded-lg p-4">
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <input
              type="checkbox"
              checked={specialForm.requiresDeposit}
              onChange={e => setSpecialForm(s => ({ ...s, requiresDeposit: e.target.checked }))}
              className="h-4 w-4"
            />
            Require deposit on this special date
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">Deposit Amount (USD)
              <input
                type="number"
                min="0"
                value={specialForm.depositAmount}
                onChange={e => setSpecialForm(s => ({ ...s, depositAmount: e.target.value }))}
                disabled={!specialForm.requiresDeposit}
                className="mt-1 h-11 w-full border rounded px-3 disabled:bg-gray-100"
              />
            </label>
            <label className="text-sm font-medium">Apply at Party Size
              <input
                type="number"
                min="1"
                value={specialForm.depositMinParty}
                onChange={e => setSpecialForm(s => ({ ...s, depositMinParty: e.target.value }))}
                disabled={!specialForm.requiresDeposit}
                className="mt-1 h-11 w-full border rounded px-3 disabled:bg-gray-100"
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Deposit Message
              <textarea
                value={specialForm.depositMessage}
                onChange={e => setSpecialForm(s => ({ ...s, depositMessage: e.target.value }))}
                disabled={!specialForm.requiresDeposit}
                className="mt-1 w-full border rounded px-3 py-2 disabled:bg-gray-100"
                rows={2}
              />
            </label>
          </div>
        </div>
        {specialMessage && <p className="text-sm text-gray-700 mt-3">{specialMessage}</p>}
      </form>

      <div className="bg-white rounded-xl shadow divide-y">
        <div className="p-4 sm:p-6">
          <h2 className="text-lg font-bold">Special Dates</h2>
          <p className="text-sm text-gray-500">Review, edit, or remove all one-off schedule exceptions.</p>
        </div>
        {mergedSpecialRows.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No special date schedules yet.</p>
        )}
        {mergedSpecialRows.map(row => (
          <div key={row.date} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-medium">{fmtDateLabel(row.date)} {row.rule?.label ? `• ${row.rule.label}` : ""}</div>
              <div className="text-sm text-gray-500">
                {row.override
                  ? row.override.isClosed
                    ? "Closed"
                    : `${fmtTime12(row.override.openTime)} - ${fmtTime12(row.override.closeTime)}${row.override.maxCovers ? ` · Max ${row.override.maxCovers}` : ""}`
                  : "Using weekly schedule"}
              </div>
              {row.rule?.requiresDeposit && (
                <div className="text-xs text-amber-700 mt-1">
                  Deposit: ${row.rule.amount} for parties {row.rule.minParty}+.
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => editSpecial(row.date, row.override, row.rule)}
                className="h-11 px-3 rounded-lg border border-gray-200 text-sm transition-all duration-200"
              >
                Edit
              </button>
              <button
                onClick={() => removeSpecial(row.date, row.override?.id ?? null)}
                className="h-11 px-3 rounded-lg border border-red-200 text-red-700 text-sm transition-all duration-200"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

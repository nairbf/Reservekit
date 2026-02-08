"use client";
import { useState, useEffect, useCallback } from "react";

interface Slot { time: string; available: boolean }
interface ReserveWidgetClientProps {
  restaurantName: string;
  embedded?: boolean;
  theme?: "light" | "dark";
  accent?: string;
}

function fmt(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function getAccent(accent?: string): string {
  if (!accent) return "#2563eb";
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(accent) ? accent : "#2563eb";
}

export default function ReserveWidgetClient({
  restaurantName,
  embedded = false,
  theme = "light",
  accent,
}: ReserveWidgetClientProps) {
  const [step, setStep] = useState<"select" | "form" | "done">("select");
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");

  const isDark = theme === "dark";
  const primary = getAccent(accent);

  const wrapperClass = embedded
    ? `w-full ${isDark ? "text-zinc-100" : "text-gray-900"}`
    : "max-w-md mx-auto p-6 transition-all duration-200";

  const textMutedClass = isDark ? "text-zinc-300" : "text-gray-500";
  const textSoftClass = isDark ? "text-zinc-400" : "text-gray-400";
  const borderClass = isDark ? "border-zinc-700" : "border-gray-200";

  const inputClass = isDark
    ? "h-11 w-full border border-zinc-700 rounded px-3 py-2 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
    : "h-11 w-full border rounded px-3 py-2";

  const textareaClass = isDark
    ? "w-full border border-zinc-700 rounded px-3 py-2 mb-4 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
    : "w-full border rounded px-3 py-2 mb-4";

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split("T")[0]);
  }, []);

  const loadSlots = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setSelectedTime("");
    const res = await fetch(`/api/availability?date=${date}&partySize=${partySize}`);
    setSlots((await res.json()).slots || []);
    setLoading(false);
  }, [date, partySize]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/reservations/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: name,
        guestPhone: phone,
        guestEmail: email || null,
        partySize,
        date,
        time: selectedTime,
        specialRequests: notes || null,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setConfirmCode(d.code);
      setStep("done");
    } else {
      setError((await res.json()).error || "Something went wrong");
    }
  }

  if (step === "done") {
    return (
      <div className={wrapperClass}>
        <div className={embedded ? "text-center" : "max-w-md mx-auto p-6 text-center transition-all duration-200"}>
          <div className="text-5xl mb-4 animate-bounce">OK</div>
          <h2 className="text-2xl font-bold mb-2">Request Received!</h2>
          <p className={`${textMutedClass} mb-1`}>{date} at {fmt(selectedTime)}</p>
          <p className={`${textMutedClass} mb-4`}>Party of {partySize}</p>
          <p className={`text-sm ${textMutedClass} mb-2`}>Reference: <strong>{confirmCode}</strong></p>
          <p className={`text-sm ${textMutedClass}`}>We&apos;ll contact you shortly to confirm.</p>
          <button
            onClick={() => { setStep("select"); setSelectedTime(""); }}
            className="mt-6 h-11 px-4 rounded-lg border text-sm transition-all duration-200"
            style={{ borderColor: primary, color: primary }}
          >
            Make another reservation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={embedded ? { background: "transparent" } : undefined}>
      {!embedded && (
        <div className="text-center mb-4">
          <div className={`text-sm ${textMutedClass}`}>{restaurantName}</div>
          <h1 className="text-xl font-bold">Reserve a Table</h1>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Guests</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPartySize(Math.max(1, partySize - 1))}
              className={`w-11 h-11 border rounded transition-all duration-200 ${borderClass} ${isDark ? "bg-zinc-900" : ""}`}
            >
              -
            </button>
            <span className="w-6 text-center font-bold">{partySize}</span>
            <button
              type="button"
              onClick={() => setPartySize(Math.min(8, partySize + 1))}
              className={`w-11 h-11 border rounded transition-all duration-200 ${borderClass} ${isDark ? "bg-zinc-900" : ""}`}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center gap-3 text-sm mb-4 ${textSoftClass}`}>
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading times...
        </div>
      ) : slots.length === 0 ? (
        <p className={`text-sm mb-4 ${textMutedClass}`}>No availability for this date.</p>
      ) : (
        <div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-2 mb-4">
          {slots.map(s => {
            const isSelected = s.time === selectedTime;
            return (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => { setSelectedTime(s.time); setStep("form"); }}
                className={`h-11 rounded text-sm font-medium transition-all duration-200 ${isSelected ? "text-white" : s.available ? `${isDark ? "bg-zinc-900 border border-zinc-700 hover:bg-zinc-800" : "bg-white border hover:bg-blue-50"}` : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
                style={isSelected ? { backgroundColor: primary } : undefined}
              >
                {fmt(s.time)}
              </button>
            );
          })}
        </div>
      )}

      {step === "form" && selectedTime && (
        <form onSubmit={submit} className={`border-t pt-4 mt-4 transition-all duration-200 ${borderClass}`}>
          <p className="text-sm font-medium mb-3">{fmt(selectedTime)} · Party of {partySize} · {date}</p>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <input placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} className={`${inputClass} mb-3`} required />
          <input placeholder="Phone number *" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={`${inputClass} mb-3`} required />
          <input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${inputClass} mb-3`} />
          <textarea placeholder="Special requests (optional)" value={notes} onChange={e => setNotes(e.target.value)} className={textareaClass} rows={2} />
          <button type="submit" className="w-full h-11 text-white rounded font-medium transition-all duration-200" style={{ backgroundColor: primary }}>Request Reservation</button>
          <p className={`text-xs mt-2 text-center ${textSoftClass}`}>Your request will be reviewed and confirmed shortly.</p>
        </form>
      )}
    </div>
  );
}

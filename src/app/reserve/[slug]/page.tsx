"use client";
import { useState, useEffect, useCallback } from "react";

interface Slot { time: string; available: boolean }
function fmt(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }

export default function ReserveWidget() {
  const [step, setStep] = useState<"select" | "form" | "done">("select");
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(""); const [notes, setNotes] = useState("");
  const [confirmCode, setConfirmCode] = useState(""); const [error, setError] = useState("");

  useEffect(() => { const d = new Date(); d.setDate(d.getDate() + 1); setDate(d.toISOString().split("T")[0]); }, []);
  const loadSlots = useCallback(async () => {
    if (!date) return; setLoading(true); setSelectedTime("");
    const res = await fetch(`/api/availability?date=${date}&partySize=${partySize}`);
    setSlots((await res.json()).slots || []); setLoading(false);
  }, [date, partySize]);
  useEffect(() => { loadSlots(); }, [loadSlots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch("/api/reservations/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestName: name, guestPhone: phone, guestEmail: email || null, partySize, date, time: selectedTime, specialRequests: notes || null }) });
    if (res.ok) { const d = await res.json(); setConfirmCode(d.code); setStep("done"); }
    else { setError((await res.json()).error || "Something went wrong"); }
  }

  if (step === "done") return (
    <div className="max-w-md mx-auto p-6 text-center">
      <div className="text-4xl mb-4">✓</div>
      <h2 className="text-xl font-bold mb-2">Request Received!</h2>
      <p className="text-gray-600 mb-1">{date} at {fmt(selectedTime)}</p>
      <p className="text-gray-600 mb-4">Party of {partySize}</p>
      <p className="text-sm text-gray-500 mb-2">Reference: <strong>{confirmCode}</strong></p>
      <p className="text-sm text-gray-500">We&apos;ll contact you shortly to confirm.</p>
      <button onClick={() => { setStep("select"); setSelectedTime(""); }} className="mt-6 text-blue-600 text-sm underline">Make another reservation</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Reserve a Table</h1>
      <div className="flex gap-3 mb-4">
        <div className="flex-1"><label className="block text-sm font-medium mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Guests</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))} className="w-8 h-8 border rounded">−</button>
            <span className="w-6 text-center font-bold">{partySize}</span>
            <button type="button" onClick={() => setPartySize(Math.min(8, partySize + 1))} className="w-8 h-8 border rounded">+</button>
          </div></div>
      </div>
      {loading ? <p className="text-gray-400 text-sm mb-4">Loading times...</p>
        : slots.length === 0 ? <p className="text-gray-500 text-sm mb-4">No availability for this date.</p>
        : <div className="grid grid-cols-3 gap-2 mb-4">{slots.map(s => (
          <button key={s.time} disabled={!s.available} onClick={() => { setSelectedTime(s.time); setStep("form"); }}
            className={`py-2 rounded text-sm font-medium transition ${s.time === selectedTime ? "bg-blue-600 text-white" : s.available ? "bg-white border hover:bg-blue-50" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}>{fmt(s.time)}</button>
        ))}</div>}
      {step === "form" && selectedTime && (
        <form onSubmit={submit} className="border-t pt-4 mt-4">
          <p className="text-sm font-medium mb-3">{fmt(selectedTime)} · Party of {partySize} · {date}</p>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <input placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" required />
          <input placeholder="Phone number *" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" required />
          <input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" />
          <textarea placeholder="Special requests (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded px-3 py-2 mb-4" rows={2} />
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded font-medium">Request Reservation</button>
          <p className="text-xs text-gray-400 mt-2 text-center">Your request will be reviewed and confirmed shortly.</p>
        </form>
      )}
    </div>
  );
}

"use client";

interface AvailabilityDeposit {
  amount: number;
  message: string;
}

interface GuestDetailsProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  borderClass: string;
  selectedTime: string;
  partySize: number;
  date: string;
  fmt: (time: string) => string;
  depositApplies: boolean;
  availabilityDeposit: AvailabilityDeposit;
  depositMessage: string;
  formatCents: (amount: number) => string;
  error: string;
  name: string;
  setName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  loyaltyOptInEnabled: boolean;
  isDark: boolean;
  loyaltyProgramName: string;
  loyaltyOptInMessage: string;
  loyaltyChecking: boolean;
  textSoftClass: string;
  normalizePhone: (value: string) => string | null;
  loyaltyKnown: boolean;
  loyaltyKnownOptIn: boolean;
  canCaptureLoyalty: boolean;
  loyaltyOptInChoice: boolean;
  setLoyaltyOptInChoice: (value: boolean) => void;
  loyaltyOptInLabel: string;
  reserveRequestPlaceholder: string;
  notes: string;
  setNotes: (value: string) => void;
  textareaClass: string;
  reserveRequestSamples: string[];
  applySample: (sample: string) => void;
  inputClass: string;
  reserveRequestDisclaimer: string;
  primary: string;
}

export function GuestDetails({
  onSubmit,
  borderClass,
  selectedTime,
  partySize,
  date,
  fmt,
  depositApplies,
  availabilityDeposit,
  depositMessage,
  formatCents,
  error,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  loyaltyOptInEnabled,
  isDark,
  loyaltyProgramName,
  loyaltyOptInMessage,
  loyaltyChecking,
  textSoftClass,
  normalizePhone,
  loyaltyKnown,
  loyaltyKnownOptIn,
  canCaptureLoyalty,
  loyaltyOptInChoice,
  setLoyaltyOptInChoice,
  loyaltyOptInLabel,
  reserveRequestPlaceholder,
  notes,
  setNotes,
  textareaClass,
  reserveRequestSamples,
  applySample,
  inputClass,
  reserveRequestDisclaimer,
  primary,
}: GuestDetailsProps) {
  return (
    <form onSubmit={onSubmit} className={`border-t pt-4 mt-4 transition-all duration-200 ${borderClass}`}>
      <p className="text-sm font-medium mb-3">{fmt(selectedTime)} · Party of {partySize} · {date}</p>
      {depositApplies && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {availabilityDeposit.message || depositMessage}
          {availabilityDeposit.amount > 0 ? ` Deposit amount: ${formatCents(availabilityDeposit.amount)}.` : ""}
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <input placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} className={`${inputClass} mb-3`} required />
      <input placeholder="Phone number *" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={`${inputClass} mb-3`} required />
      <input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} className={`${inputClass} mb-3`} />
      {loyaltyOptInEnabled && (
        <div className={`mb-3 rounded-lg border px-3 py-2 ${isDark ? "border-zinc-700 bg-zinc-900/60" : "border-emerald-200 bg-emerald-50"}`}>
          <p className={`text-xs font-semibold ${isDark ? "text-zinc-100" : "text-emerald-900"}`}>{loyaltyProgramName}</p>
          <p className={`text-xs mt-1 ${isDark ? "text-zinc-300" : "text-emerald-800"}`}>{loyaltyOptInMessage}</p>
          {loyaltyChecking && (
            <div className={`mt-2 text-xs flex items-center gap-2 ${textSoftClass}`}>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Checking phone preference...
            </div>
          )}
          {!loyaltyChecking && !normalizePhone(phone) && (
            <p className={`text-xs mt-2 ${textSoftClass}`}>Enter a valid phone number to show loyalty preference.</p>
          )}
          {!loyaltyChecking && loyaltyKnown && (
            <p className={`text-xs mt-2 ${isDark ? "text-zinc-300" : "text-emerald-900"}`}>
              {loyaltyKnownOptIn ? "This number is already opted in." : "Preference already saved for this number."}
            </p>
          )}
          {!loyaltyChecking && canCaptureLoyalty && (
            <label className={`mt-2 flex items-start gap-2 text-xs ${isDark ? "text-zinc-200" : "text-emerald-900"}`}>
              <input
                type="checkbox"
                checked={loyaltyOptInChoice}
                onChange={e => setLoyaltyOptInChoice(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>{loyaltyOptInLabel}</span>
            </label>
          )}
        </div>
      )}
      <textarea placeholder={reserveRequestPlaceholder} value={notes} onChange={e => setNotes(e.target.value)} className={textareaClass} rows={2} />
      {reserveRequestSamples.length > 0 && (
        <div className="mb-3">
          <p className={`text-xs mb-2 ${textSoftClass}`}>Quick request samples:</p>
          <div className="flex flex-wrap gap-2">
            {reserveRequestSamples.map(sample => (
              <button
                key={sample}
                type="button"
                onClick={() => applySample(sample)}
                className={`px-2 py-1 text-xs rounded-full border transition-all duration-200 ${isDark ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="submit" className="w-full h-11 text-white rounded font-medium transition-all duration-200" style={{ backgroundColor: primary }}>Request Reservation</button>
      <p className={`text-xs mt-2 text-center ${textSoftClass}`}>{reserveRequestDisclaimer}</p>
    </form>
  );
}

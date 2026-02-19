"use client";

import type { ReactNode } from "react";

type Slot = { time: string; available: boolean };

interface DateTimePickerProps {
  embedded: boolean;
  wrapperClass: string;
  textMutedClass: string;
  textSoftClass: string;
  inputClass: string;
  borderClass: string;
  isDark: boolean;
  primary: string;
  restaurantName: string;
  reserveHeading: string;
  reserveSubheading: string;
  date: string;
  setDate: (value: string) => void;
  partySize: number;
  setPartySize: (value: number) => void;
  loading: boolean;
  slots: Slot[];
  selectedTime: string;
  setSelectedTime: (value: string) => void;
  setStep: (value: "select" | "form" | "payment" | "done") => void;
  fmt: (time: string) => string;
  children?: ReactNode;
}

export function DateTimePicker({
  embedded,
  wrapperClass,
  textMutedClass,
  textSoftClass,
  inputClass,
  borderClass,
  isDark,
  primary,
  restaurantName,
  reserveHeading,
  reserveSubheading,
  date,
  setDate,
  partySize,
  setPartySize,
  loading,
  slots,
  selectedTime,
  setSelectedTime,
  setStep,
  fmt,
  children,
}: DateTimePickerProps) {
  return (
    <div className={wrapperClass} style={embedded ? { background: "transparent" } : undefined}>
      {!embedded && (
        <div className="text-center mb-4">
          <div className={`text-sm ${textMutedClass}`}>{restaurantName}</div>
          <h1 className="text-xl font-bold">{reserveHeading}</h1>
          <p className={`text-xs mt-1 ${textSoftClass}`}>{reserveSubheading}</p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
          {slots.map((s: Slot) => {
            const isSelected = s.time === selectedTime;
            return (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => {
                  setSelectedTime(s.time);
                  setStep("form");
                }}
                className={`h-11 rounded text-sm font-medium transition-all duration-200 ${isSelected ? "text-white" : s.available ? `${isDark ? "bg-zinc-900 border border-zinc-700 hover:bg-zinc-800" : "bg-white border hover:bg-blue-50"}` : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
                style={isSelected ? { backgroundColor: primary } : undefined}
              >
                {fmt(s.time)}
              </button>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}

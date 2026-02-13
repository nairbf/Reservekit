"use client";
import { useState, useEffect } from "react";

interface Stats {
  totalCovers: number;
  totalReservations: number;
  noShows: number;
  noShowRate: number;
  coversPerDay: Record<string, number>;
  bySource: Record<string, number>;
  period: { startDate: string; endDate: string };
}

function Card({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        const enabled = data.feature_reporting === "true";
        setFeatureEnabled(enabled);
        if (!enabled) return null;
        return fetch("/api/reports/stats").then(r => r.json()).then(setStats);
      })
      .catch(() => setFeatureEnabled(false));
  }, []);

  if (featureEnabled === null) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading...
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Reports</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-gray-600">Feature not available for your current plan. Contact support to enable Reporting Dashboard.</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        Loading reports...
      </div>
    );
  }

  const days = Object.entries(stats.coversPerDay).sort(([a], [b]) => a.localeCompare(b));
  const maxC = Math.max(...Object.values(stats.coversPerDay), 1);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-gray-500">{stats.period.startDate} to {stats.period.endDate}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card label="Total Covers" value={stats.totalCovers} />
        <Card label="Reservations" value={stats.totalReservations} />
        <Card label="No-Shows" value={stats.noShows} color={stats.noShows > 0 ? "text-red-600" : ""} />
        <Card label="No-Show Rate" value={`${stats.noShowRate}%`} color={stats.noShowRate > 10 ? "text-red-600" : ""} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-bold mb-3">By Source</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(stats.bySource).map(([s, c]) => (
              <div key={s} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xl font-bold">{c}</div>
                <div className="text-sm text-gray-500 capitalize">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-bold mb-3">Covers per Day</h2>
          {days.length === 0 ? (
            <p className="text-gray-500">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {days.map(([date, covers]) => (
                <div key={date} className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm w-20 text-gray-500">{date}</span>
                  <div className="flex-1 bg-gray-100 rounded h-4">
                    <div className="bg-blue-500 h-4 rounded" style={{ width: `${Math.round((covers / maxC) * 100)}%` }} />
                  </div>
                  <span className="text-xs sm:text-sm w-10 text-right">{covers}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// @ts-nocheck
"use client";

interface ProvisionTabProps {
  [key: string]: any;
}

export function ProvisionTab(props: ProvisionTabProps) {
  const {
    restaurant,
    provisionStatusClass,
    showToast,
    canManage,
    reprovisionRestaurant,
    busy,
    showProvisionLog,
    setShowProvisionLog,
  } = props;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Provisioning</h2>
          <p className="text-sm text-slate-600">Deployment status and setup script output.</p>
        </div>
        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${provisionStatusClass(restaurant.provisionStatus)}`}>
          {restaurant.provisionStatus || "unknown"}
        </span>
      </div>

      {restaurant.generatedPassword ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="font-semibold">Generated password</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono">{restaurant.generatedPassword}</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(restaurant.generatedPassword || "");
                showToast("Password copied.", "success");
              }}
              className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-800"
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canManage && restaurant.provisionStatus.toLowerCase() === "failed" ? (
          <button
            type="button"
            onClick={reprovisionRestaurant}
            disabled={busy === "reprovision"}
            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-60"
          >
            {busy === "reprovision" ? "Re-provisioning..." : "Re-provision"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowProvisionLog((prev: boolean) => !prev)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {showProvisionLog ? "Hide Provision Log" : "Show Provision Log"}
        </button>
      </div>

      {showProvisionLog ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          {restaurant.provisionLog || "No provision log available."}
        </pre>
      ) : null}
    </section>
  );
}

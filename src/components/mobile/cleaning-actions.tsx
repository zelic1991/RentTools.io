"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cleanerCleaningActions,
  type CleanerCleaningAction,
} from "@/lib/mobile-cleaning-core";
import type { CleaningStatus } from "@/lib/cleaning-workflow";

const TONES: Record<CleanerCleaningAction["tone"], string> = {
  primary: "bg-[#3F1735] text-white hover:bg-[#5A214B]",
  success: "bg-emerald-700 text-white hover:bg-emerald-800",
  danger: "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
};

export function CleaningActions({
  propertyId,
  date,
  status,
}: {
  propertyId: number;
  date: string;
  status: CleaningStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actions = cleanerCleaningActions(status);
  if (actions.length === 0) return null;

  function run(nextStatus: CleanerCleaningAction["status"]) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/cleaning-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, date, status: nextStatus }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setError(body?.error ?? "Status konnte nicht aktualisiert werden.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={pending}
            onClick={() => run(action.status)}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#7B2E62] disabled:opacity-50 ${TONES[action.tone]}`}
          >
            {pending ? "Speichert…" : action.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
    </div>
  );
}

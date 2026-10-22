"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { localizedApiError } from "@/lib/mobile-api-errors";
import {
  cleanerCleaningActions,
  type CleanerCleaningAction,
} from "@/lib/mobile-cleaning-core";
import type { CleaningStatus } from "@/lib/cleaning-workflow";
import { useI18n } from "@/lib/i18n/context";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

const COPY: CopyMap<{
  actions: Record<CleanerCleaningAction["status"], string>;
  saving: string;
  failed: string;
}> = {
  en: {
    actions: { IN_PROGRESS: "Start", READY: "Done", ISSUE: "Problem" },
    saving: "Saving…",
    failed: "The status could not be updated.",
  },
  ru: {
    actions: { IN_PROGRESS: "Начать", READY: "Готово", ISSUE: "Проблема" },
    saving: "Сохранение…",
    failed: "Не удалось обновить статус.",
  },
  de: {
    actions: { IN_PROGRESS: "Starten", READY: "Fertig", ISSUE: "Problem" },
    saving: "Speichert…",
    failed: "Status konnte nicht aktualisiert werden.",
  },
  fr: {
    actions: { IN_PROGRESS: "Commencer", READY: "Terminé", ISSUE: "Problème" },
    saving: "Enregistrement…",
    failed: "Le statut n’a pas pu être mis à jour.",
  },
  es: {
    actions: { IN_PROGRESS: "Empezar", READY: "Hecho", ISSUE: "Problema" },
    saving: "Guardando…",
    failed: "No se pudo actualizar el estado.",
  },
  hr: {
    actions: { IN_PROGRESS: "Započni", READY: "Gotovo", ISSUE: "Problem" },
    saving: "Spremanje…",
    failed: "Status nije bilo moguće ažurirati.",
  },
};

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
  const { locale } = useI18n();
  const copy = resolveCopy(COPY, locale);
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
        setError(localizedApiError(body?.error, locale, copy.failed));
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
            {pending ? copy.saving : copy.actions[action.status]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
    </div>
  );
}

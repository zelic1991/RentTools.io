"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

type Platform = "airbnb" | "booking";
type Mode = "export" | "import";

interface PlatformInstructionsProps {
  platform: Platform;
  mode: Mode;
  defaultOpen?: boolean;
}

interface InstructionData {
  title: string;
  steps: string[];
}

// Step-by-step tutorials. In the translated versions the quoted menu and
// button names describe the platform's controls in that language; the
// exact wording on Airbnb / Booking.com depends on the language the
// host's platform account is set to.
const DATA: CopyMap<Record<Platform, Record<Mode, InstructionData>>> = {
  en: {
    airbnb: {
      export: {
        title: "How to find the Airbnb iCal export URL",
        steps: [
          "Open airbnb.com and go to your listing.",
          "Click \"Calendar\" in the top menu.",
          "Click the gear icon (Availability settings) on the right.",
          "Scroll to the \"Sync calendars\" section.",
          "Click \"Export Calendar\".",
          "Copy the URL (it starts with https://www.airbnb.com/calendar/ical/…).",
        ],
      },
      import: {
        title: "How to import RentTools into Airbnb",
        steps: [
          "Back in Airbnb → Calendar → Availability settings.",
          "Find the \"Sync calendars\" section.",
          "If Booking.com is already linked there, remove it — replace with our URL.",
          "Click \"Import calendar\".",
          "Paste the URL above into the \"Calendar address (URL)\" field.",
          "Name it \"RentTools Sync\" and click Import.",
        ],
      },
    },
    booking: {
      export: {
        title: "How to find the Booking.com iCal export URL",
        steps: [
          "Open admin.booking.com (Booking.com Extranet).",
          "Open Rates & Availability in the left menu.",
          "Click \"Sync calendars\" (sometimes \"Calendar Sync\").",
          "Find the \"Export\" section.",
          "Click \"Copy Link\" next to your iCal export URL.",
          "The URL looks like https://admin.booking.com/hotel/hoteladmin/ical.html?…",
        ],
      },
      import: {
        title: "How to import RentTools into Booking.com",
        steps: [
          "Back in admin.booking.com → Rates & Availability → Sync calendars.",
          "If Airbnb is already linked there, remove it — replace with our URL.",
          "Find the \"Import\" section (or \"Add connection\").",
          "Paste the URL above into the iCal URL field.",
          "Name it \"RentTools Sync\" and click Save.",
        ],
      },
    },
  },
  ru: {
    airbnb: {
      export: {
        title: "Как найти ссылку экспорта iCal в Airbnb",
        steps: [
          "Откройте airbnb.com и перейдите к своему объявлению.",
          "Нажмите «Календарь» в верхнем меню.",
          "Нажмите значок шестерёнки (настройки доступности) справа.",
          "Прокрутите до раздела «Синхронизация календарей».",
          "Нажмите «Экспортировать календарь».",
          "Скопируйте ссылку (она начинается с https://www.airbnb.com/calendar/ical/…).",
        ],
      },
      import: {
        title: "Как импортировать RentTools в Airbnb",
        steps: [
          "Вернитесь в Airbnb → Календарь → Настройки доступности.",
          "Найдите раздел «Синхронизация календарей».",
          "Если там уже подключён Booking.com, удалите его и замените нашей ссылкой.",
          "Нажмите «Импортировать календарь».",
          "Вставьте ссылку выше в поле «Адрес календаря (URL)».",
          "Назовите его «RentTools Sync» и нажмите «Импортировать».",
        ],
      },
    },
    booking: {
      export: {
        title: "Как найти ссылку экспорта iCal в Booking.com",
        steps: [
          "Откройте admin.booking.com (экстранет Booking.com).",
          "В левом меню откройте «Цены и наличие мест».",
          "Нажмите «Синхронизация календарей» (иногда «Calendar Sync»).",
          "Найдите раздел «Экспорт».",
          "Нажмите «Скопировать ссылку» рядом со ссылкой экспорта iCal.",
          "Ссылка выглядит так: https://admin.booking.com/hotel/hoteladmin/ical.html?…",
        ],
      },
      import: {
        title: "Как импортировать RentTools в Booking.com",
        steps: [
          "Вернитесь в admin.booking.com → Цены и наличие мест → Синхронизация календарей.",
          "Если там уже подключён Airbnb, удалите его и замените нашей ссылкой.",
          "Найдите раздел «Импорт» (или «Добавить подключение»).",
          "Вставьте ссылку выше в поле для ссылки iCal.",
          "Назовите его «RentTools Sync» и нажмите «Сохранить».",
        ],
      },
    },
  },
  de: {
    airbnb: {
      export: {
        title: "So finden Sie die iCal-Export-URL von Airbnb",
        steps: [
          "Öffnen Sie airbnb.com und gehen Sie zu Ihrem Inserat.",
          "Klicken Sie im oberen Menü auf „Kalender“.",
          "Klicken Sie rechts auf das Zahnrad (Verfügbarkeitseinstellungen).",
          "Scrollen Sie zum Abschnitt „Kalender synchronisieren“.",
          "Klicken Sie auf „Kalender exportieren“.",
          "Kopieren Sie die URL (sie beginnt mit https://www.airbnb.com/calendar/ical/…).",
        ],
      },
      import: {
        title: "So importieren Sie RentTools in Airbnb",
        steps: [
          "Zurück in Airbnb → Kalender → Verfügbarkeitseinstellungen.",
          "Suchen Sie den Abschnitt „Kalender synchronisieren“.",
          "Ist dort bereits Booking.com verknüpft, entfernen Sie es und ersetzen Sie es durch unsere URL.",
          "Klicken Sie auf „Kalender importieren“.",
          "Fügen Sie die obige URL in das Feld „Kalenderadresse (URL)“ ein.",
          "Nennen Sie ihn „RentTools Sync“ und klicken Sie auf „Importieren“.",
        ],
      },
    },
    booking: {
      export: {
        title: "So finden Sie die iCal-Export-URL von Booking.com",
        steps: [
          "Öffnen Sie admin.booking.com (Booking.com-Extranet).",
          "Öffnen Sie im linken Menü „Preise & Verfügbarkeit“.",
          "Klicken Sie auf „Kalender synchronisieren“ (manchmal „Calendar Sync“).",
          "Suchen Sie den Abschnitt „Export“.",
          "Klicken Sie neben Ihrer iCal-Export-URL auf „Link kopieren“.",
          "Die URL sieht so aus: https://admin.booking.com/hotel/hoteladmin/ical.html?…",
        ],
      },
      import: {
        title: "So importieren Sie RentTools in Booking.com",
        steps: [
          "Zurück in admin.booking.com → Preise & Verfügbarkeit → Kalender synchronisieren.",
          "Ist dort bereits Airbnb verknüpft, entfernen Sie es und ersetzen Sie es durch unsere URL.",
          "Suchen Sie den Abschnitt „Import“ (oder „Verbindung hinzufügen“).",
          "Fügen Sie die obige URL in das iCal-URL-Feld ein.",
          "Nennen Sie sie „RentTools Sync“ und klicken Sie auf „Speichern“.",
        ],
      },
    },
  },
  fr: {
    airbnb: {
      export: {
        title: "Trouver l’URL d’export iCal d’Airbnb",
        steps: [
          "Ouvrez airbnb.com et accédez à votre annonce.",
          "Cliquez sur « Calendrier » dans le menu du haut.",
          "Cliquez sur l’icône d’engrenage (paramètres de disponibilité) à droite.",
          "Faites défiler jusqu’à la section « Synchroniser les calendriers ».",
          "Cliquez sur « Exporter le calendrier ».",
          "Copiez l’URL (elle commence par https://www.airbnb.com/calendar/ical/…).",
        ],
      },
      import: {
        title: "Importer RentTools dans Airbnb",
        steps: [
          "De retour dans Airbnb → Calendrier → Paramètres de disponibilité.",
          "Trouvez la section « Synchroniser les calendriers ».",
          "Si Booking.com y est déjà lié, supprimez-le et remplacez-le par notre URL.",
          "Cliquez sur « Importer un calendrier ».",
          "Collez l’URL ci-dessus dans le champ « Adresse du calendrier (URL) ».",
          "Nommez-le « RentTools Sync » et cliquez sur Importer.",
        ],
      },
    },
    booking: {
      export: {
        title: "Trouver l’URL d’export iCal de Booking.com",
        steps: [
          "Ouvrez admin.booking.com (extranet Booking.com).",
          "Ouvrez « Tarifs et disponibilités » dans le menu de gauche.",
          "Cliquez sur « Synchroniser les calendriers » (parfois « Calendar Sync »).",
          "Trouvez la section « Exporter ».",
          "Cliquez sur « Copier le lien » à côté de votre URL d’export iCal.",
          "L’URL ressemble à https://admin.booking.com/hotel/hoteladmin/ical.html?…",
        ],
      },
      import: {
        title: "Importer RentTools dans Booking.com",
        steps: [
          "De retour dans admin.booking.com → Tarifs et disponibilités → Synchroniser les calendriers.",
          "Si Airbnb y est déjà lié, supprimez-le et remplacez-le par notre URL.",
          "Trouvez la section « Importer » (ou « Ajouter une connexion »).",
          "Collez l’URL ci-dessus dans le champ URL iCal.",
          "Nommez-la « RentTools Sync » et cliquez sur Enregistrer.",
        ],
      },
    },
  },
  es: {
    airbnb: {
      export: {
        title: "Cómo encontrar la URL de exportación iCal de Airbnb",
        steps: [
          "Abra airbnb.com y vaya a su anuncio.",
          "Haga clic en «Calendario» en el menú superior.",
          "Haga clic en el icono del engranaje (ajustes de disponibilidad) a la derecha.",
          "Desplácese hasta la sección «Sincronizar calendarios».",
          "Haga clic en «Exportar calendario».",
          "Copie la URL (empieza por https://www.airbnb.com/calendar/ical/…).",
        ],
      },
      import: {
        title: "Cómo importar RentTools en Airbnb",
        steps: [
          "De vuelta en Airbnb → Calendario → Ajustes de disponibilidad.",
          "Busque la sección «Sincronizar calendarios».",
          "Si Booking.com ya está vinculado ahí, elimínelo y sustitúyalo por nuestra URL.",
          "Haga clic en «Importar calendario».",
          "Pegue la URL de arriba en el campo «Dirección del calendario (URL)».",
          "Llámelo «RentTools Sync» y haga clic en Importar.",
        ],
      },
    },
    booking: {
      export: {
        title: "Cómo encontrar la URL de exportación iCal de Booking.com",
        steps: [
          "Abra admin.booking.com (extranet de Booking.com).",
          "Abra «Tarifas y disponibilidad» en el menú de la izquierda.",
          "Haga clic en «Sincronizar calendarios» (a veces «Calendar Sync»).",
          "Busque la sección «Exportar».",
          "Haga clic en «Copiar enlace» junto a su URL de exportación iCal.",
          "La URL tiene este aspecto: https://admin.booking.com/hotel/hoteladmin/ical.html?…",
        ],
      },
      import: {
        title: "Cómo importar RentTools en Booking.com",
        steps: [
          "De vuelta en admin.booking.com → Tarifas y disponibilidad → Sincronizar calendarios.",
          "Si Airbnb ya está vinculado ahí, elimínelo y sustitúyalo por nuestra URL.",
          "Busque la sección «Importar» (o «Añadir conexión»).",
          "Pegue la URL de arriba en el campo de URL iCal.",
          "Llámelo «RentTools Sync» y haga clic en Guardar.",
        ],
      },
    },
  },
  hr: {
    airbnb: {
      export: {
        title: "Kako pronaći Airbnb iCal izvozni URL",
        steps: [
          "Otvorite airbnb.com i idite na svoj oglas.",
          "U gornjem izborniku kliknite „Kalendar”.",
          "Kliknite ikonu zupčanika (postavke dostupnosti) s desne strane.",
          "Pomaknite se do odjeljka „Sinkronizacija kalendara”.",
          "Kliknite „Izvezi kalendar”.",
          "Kopirajte URL (počinje s https://www.airbnb.com/calendar/ical/…).",
        ],
      },
      import: {
        title: "Kako uvesti RentTools u Airbnb",
        steps: [
          "Vratite se u Airbnb → Kalendar → Postavke dostupnosti.",
          "Pronađite odjeljak „Sinkronizacija kalendara”.",
          "Ako je tamo već povezan Booking.com, uklonite ga i zamijenite našim URL-om.",
          "Kliknite „Uvezi kalendar”.",
          "Zalijepite gornji URL u polje „Adresa kalendara (URL)”.",
          "Nazovite ga „RentTools Sync” i kliknite „Uvezi”.",
        ],
      },
    },
    booking: {
      export: {
        title: "Kako pronaći Booking.com iCal izvozni URL",
        steps: [
          "Otvorite admin.booking.com (Booking.com Extranet).",
          "U lijevom izborniku otvorite „Cijene i dostupnost”.",
          "Kliknite „Sinkronizacija kalendara” (ponekad „Calendar Sync”).",
          "Pronađite odjeljak „Izvoz”.",
          "Kliknite „Kopiraj link” pokraj svog iCal izvoznog URL-a.",
          "URL izgleda ovako: https://admin.booking.com/hotel/hoteladmin/ical.html?…",
        ],
      },
      import: {
        title: "Kako uvesti RentTools u Booking.com",
        steps: [
          "Vratite se u admin.booking.com → Cijene i dostupnost → Sinkronizacija kalendara.",
          "Ako je tamo već povezan Airbnb, uklonite ga i zamijenite našim URL-om.",
          "Pronađite odjeljak „Uvoz” (ili „Dodaj vezu”).",
          "Zalijepite gornji URL u polje za iCal URL.",
          "Nazovite ga „RentTools Sync” i kliknite „Spremi”.",
        ],
      },
    },
  },
};

export function PlatformInstructions({ platform, mode, defaultOpen = false }: PlatformInstructionsProps) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const data = resolveCopy(DATA, locale)[platform][mode];

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--bg)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
      >
        <span>{data.title}</span>
        <svg
          className={`h-3.5 w-3.5 text-[var(--ink-4)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[var(--line)] p-3">
          <ol className="space-y-1.5 text-[12px] text-[var(--ink-3)]">
            {data.steps.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-px shrink-0 rounded bg-[var(--bg-3)] px-1.5 text-center font-mono text-[10px] text-[var(--ink-3)]">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

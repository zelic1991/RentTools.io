import { DEFAULT_PROPERTY_TIME_ZONE } from "@/lib/owner-calendar-window";

/**
 * Date and clock time as the host reads them on the property's wall clock.
 *
 * The phone screens are rendered on the server, which runs in UTC. Without
 * a time zone, "last sync 14:20" showed for a sync at 15:20 in Croatia, so
 * a working sync looked an hour stale.
 */
export function propertyDateTimeFormat(localeTag: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(localeTag, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DEFAULT_PROPERTY_TIME_ZONE,
  });
}

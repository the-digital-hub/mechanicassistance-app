import type {
  Address,
  AvailabilityPayload,
  UserData,
} from "@/lib/dao/interfaces";

// ── Types ──────────────────────────────────────────────────────────────────
export type DayHours = { startTime: string; endTime: string };

/** What the form emits — the `availability` payload of `POST`/`PATCH /api/users`. */
export type AvailabilityValue = AvailabilityPayload;

export type BaseLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

// ── Constants ──────────────────────────────────────────────────────────────
export const DAYS: string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DEFAULT_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];
export const DEFAULT_START_TIME = "09:00";
export const DEFAULT_END_TIME = "17:00";
export const DEFAULT_SERVICE_RADIUS = 15;
export const RADIUS_MIN = 1;
export const RADIUS_MAX = 50;

/**
 * Shown until the mechanic's own address is known, and as the fallback when
 * there is none (or the street was typed by hand, which drops the coordinates).
 */
export const BASE_LOCATION: BaseLocation = {
  latitude: 33.4484,
  longitude: -112.074,
  address: "2418 Sunset Blvd · Phoenix, AZ",
};

// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Half-hour slots as "HH:mm", 24-hour.
 *
 * The screen used to hold 12-hour strings ("09:00 AM") and send them straight to
 * the API, which documented — and now enforces — 24-hour. Production ended up
 * with both formats in the same column. "HH:mm" is the canon on the wire; the
 * 12-hour form below is presentation only.
 */
export const TIMES: string[] = (() => {
  const result: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ["00", "30"]) {
      result.push(`${h.toString().padStart(2, "0")}:${m}`);
    }
  }
  return result;
})();

/** "13:30" → "01:30 PM". Display only — never persisted. */
export function formatTime12h(hhmm: string): string {
  const [rawHour, minutes] = hhmm.split(":");
  const h = Number(rawHour);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour.toString().padStart(2, "0")}:${minutes} ${period}`;
}

/** Lexicographic order matches chronological order for zero-padded "HH:mm". */
export function isValidRange({ startTime, endTime }: DayHours): boolean {
  return endTime > startTime;
}

type AddressLike = Pick<
  Address,
  "street" | "city" | "state" | "locationLat" | "locationLng"
>;

function toBaseLocation(entry?: AddressLike): BaseLocation | null {
  if (!entry?.street) return null;

  const cityState = [entry.city, entry.state].filter(Boolean).join(", ");
  return {
    latitude: entry.locationLat ?? BASE_LOCATION.latitude,
    longitude: entry.locationLng ?? BASE_LOCATION.longitude,
    address: [entry.street, cityState].filter(Boolean).join(" · "),
  };
}

/** Turns the signup address step's entry into the map centre + the one-line label. */
export function baseLocationFromSetupAddress(address: {
  type?: string;
  home?: AddressLike;
  work?: AddressLike;
}): BaseLocation | null {
  return toBaseLocation(address.type === "work" ? address.work : address.home);
}

/**
 * Same, from a registered account. The first address is the primary one — the
 * one `personal-info` edits and signup created.
 */
export function baseLocationFromAddresses(
  addresses?: Address[],
): BaseLocation | null {
  return toBaseLocation(addresses?.[0]);
}

/** Rows may come back as "09:00:00"; the picker only knows "HH:mm". */
function toHHmm(time?: string): string | undefined {
  return time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : undefined;
}

/**
 * Rebuilds the form's state from what the account has saved. Days with the same
 * hours collapse back into the week-wide pair; anything else reopens per day.
 * Returns only the radius when there are no rows, so the form keeps its defaults.
 */
export function availabilityFromUser(
  user: Pick<UserData, "mechanicAvailabilities" | "mechanicDetails">,
): Partial<AvailabilityValue> {
  const serviceRadius = user.mechanicDetails?.serviceRadiusMiles;
  const radius = serviceRadius != null ? { serviceRadius } : {};

  const schedule = DAYS.flatMap((day) => {
    const row = user.mechanicAvailabilities?.find((r) => r.day === day);
    const startTime = toHHmm(row?.startTime);
    const endTime = toHHmm(row?.endTime);
    return row && startTime && endTime ? [{ day, startTime, endTime }] : [];
  });

  if (schedule.length === 0) return radius;

  const [first] = schedule;
  const sameHours = schedule.every(
    (s) => s.startTime === first.startTime && s.endTime === first.endTime,
  );

  return {
    ...radius,
    selectedDays: schedule.map((s) => s.day),
    startTime: first.startTime,
    endTime: first.endTime,
    applySameTime: sameHours,
    ...(sameHours ? {} : { schedule }),
  };
}

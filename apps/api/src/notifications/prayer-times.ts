// Approximate prayer-time windows by country.
//
// This is a *coarse* server-side gate. The mobile app recomputes using
// the device GPS + the Aladhan API (or muslim_prayer_times) for accuracy,
// and honors its own result when the app is in the foreground.
//
// The intent is to prevent pushing marketing notifications during common
// prayer times. Each window below expands to ±10 minutes and the
// comparison is done in the user's country's local timezone.

interface PrayerWindow {
  startMin: number; // minutes since local midnight
  endMin: number;
}

const WINDOW_PADDING_MIN = 10;

function buildWindows(times: string[]): PrayerWindow[] {
  return times.map((t) => {
    const [h, m] = t.split(':').map(Number);
    const minutes = h * 60 + m;
    return {
      startMin: minutes - WINDOW_PADDING_MIN,
      endMin: minutes + WINDOW_PADDING_MIN,
    };
  });
}

const PRAYER_WINDOWS_BY_COUNTRY: Record<string, PrayerWindow[]> = {
  SA: buildWindows(['04:45', '12:10', '15:30', '18:10', '19:40']),
  AE: buildWindows(['05:00', '12:20', '15:40', '18:30', '20:00']),
  EG: buildWindows(['04:45', '12:00', '15:20', '18:00', '19:30']),
  KW: buildWindows(['04:30', '11:50', '15:10', '17:50', '19:20']),
  OM: buildWindows(['05:00', '12:20', '15:40', '18:30', '19:50']),
  BH: buildWindows(['04:30', '12:00', '15:20', '18:00', '19:30']),
  QA: buildWindows(['04:30', '12:00', '15:20', '18:00', '19:30']),
  JO: buildWindows(['04:45', '12:10', '15:30', '18:10', '19:40']),
};

/** Country-local UTC offset in minutes (Phase 6 approximation; DST-agnostic). */
const COUNTRY_UTC_OFFSET_MIN: Record<string, number> = {
  SA: 180, AE: 240, EG: 120, KW: 180, OM: 240, BH: 180, QA: 180, JO: 180,
};

export function isWithinPrayerQuietHours(
  now: Date,
  countryCode: string | null,
): boolean {
  if (!countryCode) return false;
  const windows = PRAYER_WINDOWS_BY_COUNTRY[countryCode];
  const offset = COUNTRY_UTC_OFFSET_MIN[countryCode];
  if (!windows || offset === undefined) return false;

  const localMin =
    (now.getUTCHours() * 60 + now.getUTCMinutes() + offset) % (24 * 60);
  return windows.some((w) => localMin >= w.startMin && localMin <= w.endMin);
}

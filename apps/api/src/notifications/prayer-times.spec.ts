import { isWithinPrayerQuietHours } from './prayer-times';

/** Build a UTC Date that lands on a given local-time for the country. */
function utcAt(hour: number, min: number, utcOffsetMinutes: number): Date {
  const utcMin = (hour * 60 + min - utcOffsetMinutes + 24 * 60) % (24 * 60);
  const d = new Date();
  d.setUTCHours(Math.floor(utcMin / 60), utcMin % 60, 0, 0);
  return d;
}

describe('isWithinPrayerQuietHours', () => {
  it('returns true inside the fajr window in Saudi Arabia', () => {
    // KSA local 04:45 fajr, offset +3h.
    const fajr = utcAt(4, 45, 180);
    expect(isWithinPrayerQuietHours(fajr, 'SA')).toBe(true);
  });

  it('returns false at a neutral local time', () => {
    const neutral = utcAt(9, 0, 180);
    expect(isWithinPrayerQuietHours(neutral, 'SA')).toBe(false);
  });

  it('uses the correct offset for the UAE', () => {
    // UAE dhuhr 12:20, offset +4h.
    const dhuhr = utcAt(12, 20, 240);
    expect(isWithinPrayerQuietHours(dhuhr, 'AE')).toBe(true);
  });

  it('returns false for unknown countries', () => {
    expect(isWithinPrayerQuietHours(new Date(), 'US')).toBe(false);
    expect(isWithinPrayerQuietHours(new Date(), null)).toBe(false);
  });

  it('respects the padding window', () => {
    // 8 minutes before fajr — should still be quiet.
    const before = utcAt(4, 37, 180);
    expect(isWithinPrayerQuietHours(before, 'SA')).toBe(true);
    // 12 minutes before fajr — outside the padding.
    const well_before = utcAt(4, 33, 180);
    expect(isWithinPrayerQuietHours(well_before, 'SA')).toBe(false);
  });
});

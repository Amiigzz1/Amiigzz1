# Majlis — Cultural & localization guide

> "مجلس" means *gathering room*. The product is a digital one.

## Non-negotiables

1. **Arabic-first, RTL-first.** Default locale is `ar-SA`. Every feature is
   RTL-tested before merge. English is a secondary convenience locale.
2. **Voice only.** No video, no live streaming of faces, no profile videos.
   The product thesis depends on this.
3. **Modesty-aligned UX.** Avatars default to non-human frames (animals,
   patterns, calligraphy). Hosts may use real photos if they choose.

## Language

- Primary: **Modern Standard Arabic** for system text (errors, legal, FAQ).
- Secondary: **Gulf dialect** for marketing copy and notifications — it reads
  warmer. Example: `يلا نلعب لودو` over the MSA equivalent.
- Numerals: display Western (0-9) by default; expose "Eastern Arabic numerals
  (٠-٩)" in settings for users who prefer them.

## Typography

- Text: **Tajawal** (body) + **Cairo** (display). Load via `google_fonts`.
- Minimum size: 14 pt body, 16 pt on forms.
- Arabic rendering requires `FontFeature.enable('calt')` (contextual
  alternates) for correct ligatures.

## Iconography

- Avoid crescents and mosques as generic "Muslim" shorthand — it reads as
  corny. Use coffee cups, dallah pots, palm trees, majlis cushions, geometric
  Islamic patterns.
- Gift catalog starts at 20 items — see `PROJECT_RULES.md` / Phase 4. At least
  half must be regionally specific (dallah, tamr, oud, bakhoor, khaima, saqr).

## Prayer-time quiet hours

- Default ON. Five windows per day, computed from device location using
  `muslim_prayers_times` or the Aladhan API.
- Suppresses push notifications and reduces gift-blast sounds.
- User can disable per-window or globally in settings.

## Ramadan mode

- During Ramadan, shift home-screen copy to `رمضان كريم` greetings.
- Feature suhoor (pre-dawn) and iftar rooms on Discover.
- Increase matchmaking priority for after-iftar hours (peak social time).

## Weekend awareness

- KSA / UAE / EG / BH / QA / KW / OM weekend is **Friday–Saturday**
  (Friday only in EG). Use this when scheduling notifications or events,
  not the Mon–Sun assumption.

## Content guidelines

- No alcohol imagery in gifts or avatars.
- No dating positioning. Marketing frames the app as "family & friends
  gathering," not "meet new people for romance."
- Host/room disputes: moderators always have a published, translated
  community guidelines document to cite. No silent bans — see
  `docs/COMPLIANCE.md`.

## Testing checklist (every PR touching UI)

- [ ] Screen renders in RTL.
- [ ] Arabic text wraps correctly (no truncated tails of ي, ة).
- [ ] Date/time formatted with the user's locale (`intl` package).
- [ ] Numbers honor the Eastern/Western numeral preference.
- [ ] Push notification body renders RTL on both iOS and Android.

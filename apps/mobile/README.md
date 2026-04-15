# majlis mobile

Flutter app targeting iOS, Android, and Web from a single codebase.

## Run

```bash
flutter pub get
flutter run -d chrome --web-port 8090   # web
flutter run                             # attached device
```

## Test

```bash
flutter test
```

## Localization

- `lib/l10n/app_ar.arb` — Arabic (default, `ar-SA`)
- `lib/l10n/app_en.arb` — English

Regenerate the localization delegate with `flutter gen-l10n` (wired up in Phase 1).

## RTL

The app pins `locale: ar-SA` at the root. All new screens must be RTL-tested
before merge — see project rule #1.

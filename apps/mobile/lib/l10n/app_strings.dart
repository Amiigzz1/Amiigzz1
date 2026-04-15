import 'package:flutter/widgets.dart';

/// Hand-rolled localization table. Mirrors the contents of the .arb files.
///
/// We avoid `flutter gen-l10n` for now so the app builds without a generator
/// step in CI. The .arb files remain the copy source of truth for
/// translators — see `lib/l10n/app_ar.arb` and `app_en.arb`. When we adopt
/// gen-l10n, this file is deleted and callers swap to the generated class.
class AppStrings {
  AppStrings(this._table);

  final Map<String, String> _table;

  String get appName => _table['appName']!;
  String get splashTagline => _table['splashTagline']!;
  String get loading => _table['loading']!;

  String get phoneEntryTitle => _table['phoneEntryTitle']!;
  String get phoneEntrySubtitle => _table['phoneEntrySubtitle']!;
  String get phoneFieldLabel => _table['phoneFieldLabel']!;
  String get phoneFieldHint => _table['phoneFieldHint']!;
  String get countryLabel => _table['countryLabel']!;
  String get continueAction => _table['continueAction']!;

  String get otpTitle => _table['otpTitle']!;
  String otpSubtitle(String phone) =>
      _table['otpSubtitle']!.replaceFirst('{phone}', phone);
  String get otpResend => _table['otpResend']!;
  String otpResendIn(int seconds) =>
      _table['otpResendIn']!.replaceFirst('{seconds}', seconds.toString());
  String get otpInvalid => _table['otpInvalid']!;
  String get verifyAction => _table['verifyAction']!;

  String get profileSetupTitle => _table['profileSetupTitle']!;
  String get profileSetupSubtitle => _table['profileSetupSubtitle']!;
  String get displayNameLabel => _table['displayNameLabel']!;
  String get displayNameHint => _table['displayNameHint']!;
  String get bioLabel => _table['bioLabel']!;
  String get selectAvatarAction => _table['selectAvatarAction']!;
  String get saveAction => _table['saveAction']!;
  String get skipAction => _table['skipAction']!;

  String homeGreeting(String name) =>
      _table['homeGreeting']!.replaceFirst('{name}', name);
  String get homeSubtitle => _table['homeSubtitle']!;
  String get homePlayLudo => _table['homePlayLudo']!;
  String get homeExploreRooms => _table['homeExploreRooms']!;

  String get settingsTitle => _table['settingsTitle']!;
  String get settingsLanguage => _table['settingsLanguage']!;
  String get settingsLogout => _table['settingsLogout']!;
  String settingsVersion(String version) =>
      _table['settingsVersion']!.replaceFirst('{version}', version);

  String get errorNetwork => _table['errorNetwork']!;
  String get errorGeneric => _table['errorGeneric']!;
  String get errorUnauthorized => _table['errorUnauthorized']!;

  /// Country display name lookup by ISO 3166-1 alpha-2 code.
  String country(String code) => _table['country${code.toUpperCase()}'] ?? code;

  static AppStrings of(BuildContext context) {
    final loc = Localizations.localeOf(context);
    return forLocale(loc);
  }

  static AppStrings forLocale(Locale locale) {
    switch (locale.languageCode) {
      case 'en':
        return AppStrings(_en);
      case 'ar':
      default:
        return AppStrings(_ar);
    }
  }
}

// Keep these two tables in sync with the .arb files.

const Map<String, String> _ar = {
  'appName': 'مجلس',
  'splashTagline': 'قهوتك الرقمية — العب، اتكلم، اتعرّف',
  'loading': 'جارِ التحميل…',
  'phoneEntryTitle': 'دخولك بدقيقة واحدة',
  'phoneEntrySubtitle': 'هنبعت لك كود على رقمك.',
  'phoneFieldLabel': 'رقم الجوال',
  'phoneFieldHint': '5XXXXXXXX',
  'countryLabel': 'الدولة',
  'continueAction': 'التالي',
  'otpTitle': 'أدخل الكود',
  'otpSubtitle': 'كود مكوّن من 6 أرقام بعتناه لك على {phone}',
  'otpResend': 'إعادة إرسال الكود',
  'otpResendIn': 'إعادة الإرسال بعد {seconds} ثانية',
  'otpInvalid': 'الكود غير صحيح أو انتهت صلاحيته',
  'verifyAction': 'تأكيد',
  'profileSetupTitle': 'خلّينا نتعرّف عليك',
  'profileSetupSubtitle': 'اختار اسم وصورة — تقدر تغيّرهم في أي وقت.',
  'displayNameLabel': 'الاسم',
  'displayNameHint': 'ظاهر للناس في الغرف',
  'bioLabel': 'نبذة عنك (اختياري)',
  'selectAvatarAction': 'اختار صورة',
  'saveAction': 'حفظ',
  'skipAction': 'تخطّي',
  'homeGreeting': 'أهلاً {name} 👋',
  'homeSubtitle': 'ابدأ بفتح غرفة أو دخول لعبة.',
  'homePlayLudo': 'العب لودو',
  'homeExploreRooms': 'استكشف الغرف',
  'settingsTitle': 'الإعدادات',
  'settingsLanguage': 'اللغة',
  'settingsLogout': 'تسجيل خروج',
  'settingsVersion': 'الإصدار {version}',
  'errorNetwork': 'مافي اتصال. تأكد من الإنترنت.',
  'errorGeneric': 'حصل خطأ. جرّب تاني.',
  'errorUnauthorized': 'انتهت الجلسة، سجّل دخول تاني.',
  'countrySA': 'السعودية',
  'countryAE': 'الإمارات',
  'countryEG': 'مصر',
  'countryKW': 'الكويت',
  'countryOM': 'عُمان',
  'countryBH': 'البحرين',
  'countryQA': 'قطر',
  'countryJO': 'الأردن',
};

const Map<String, String> _en = {
  'appName': 'Majlis',
  'splashTagline': 'Your digital coffee — play, talk, connect',
  'loading': 'Loading…',
  'phoneEntryTitle': 'Sign in in one minute',
  'phoneEntrySubtitle': "We'll send a code to your phone.",
  'phoneFieldLabel': 'Phone number',
  'phoneFieldHint': '5XXXXXXXX',
  'countryLabel': 'Country',
  'continueAction': 'Continue',
  'otpTitle': 'Enter the code',
  'otpSubtitle': 'We sent a 6-digit code to {phone}',
  'otpResend': 'Resend code',
  'otpResendIn': 'Resend in {seconds}s',
  'otpInvalid': 'Invalid or expired code',
  'verifyAction': 'Verify',
  'profileSetupTitle': "Let's get to know you",
  'profileSetupSubtitle':
      'Pick a name and photo — you can change them anytime.',
  'displayNameLabel': 'Name',
  'displayNameHint': 'Shown to others in rooms',
  'bioLabel': 'Bio (optional)',
  'selectAvatarAction': 'Pick a photo',
  'saveAction': 'Save',
  'skipAction': 'Skip',
  'homeGreeting': 'Hi {name} 👋',
  'homeSubtitle': 'Open a room or jump into a game.',
  'homePlayLudo': 'Play Ludo',
  'homeExploreRooms': 'Explore rooms',
  'settingsTitle': 'Settings',
  'settingsLanguage': 'Language',
  'settingsLogout': 'Log out',
  'settingsVersion': 'Version {version}',
  'errorNetwork': 'No connection. Check your network.',
  'errorGeneric': 'Something went wrong. Try again.',
  'errorUnauthorized': 'Session expired, please sign in again.',
  'countrySA': 'Saudi Arabia',
  'countryAE': 'United Arab Emirates',
  'countryEG': 'Egypt',
  'countryKW': 'Kuwait',
  'countryOM': 'Oman',
  'countryBH': 'Bahrain',
  'countryQA': 'Qatar',
  'countryJO': 'Jordan',
};

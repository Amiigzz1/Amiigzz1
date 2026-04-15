/// Client-side mirror of the server allow-list. Kept tiny on purpose:
/// full libphonenumber validation happens server-side — the client just
/// attaches the correct dial code and maps the chosen country to its flag.
class CountryInfo {
  const CountryInfo({
    required this.code,
    required this.dialCode,
    required this.flag,
    required this.nationalLength,
  });

  /// ISO 3166-1 alpha-2.
  final String code;

  /// E.164 dial prefix, e.g. "+966".
  final String dialCode;

  /// Emoji flag.
  final String flag;

  /// Expected length of the national number (used for a soft client-side
  /// length check; server still validates with libphonenumber).
  final int nationalLength;

  /// Compose an E.164 number from a national-format input.
  /// Strips leading zeros and the dial code if the user pasted them.
  String toE164(String national) {
    var digits = national.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith(dialCode.substring(1))) {
      digits = digits.substring(dialCode.length - 1);
    }
    digits = digits.replaceFirst(RegExp(r'^0+'), '');
    return '$dialCode$digits';
  }
}

const List<CountryInfo> kSupportedCountries = [
  CountryInfo(code: 'SA', dialCode: '+966', flag: '🇸🇦', nationalLength: 9),
  CountryInfo(code: 'AE', dialCode: '+971', flag: '🇦🇪', nationalLength: 9),
  CountryInfo(code: 'EG', dialCode: '+20',  flag: '🇪🇬', nationalLength: 10),
  CountryInfo(code: 'KW', dialCode: '+965', flag: '🇰🇼', nationalLength: 8),
  CountryInfo(code: 'OM', dialCode: '+968', flag: '🇴🇲', nationalLength: 8),
  CountryInfo(code: 'BH', dialCode: '+973', flag: '🇧🇭', nationalLength: 8),
  CountryInfo(code: 'QA', dialCode: '+974', flag: '🇶🇦', nationalLength: 8),
  CountryInfo(code: 'JO', dialCode: '+962', flag: '🇯🇴', nationalLength: 9),
];

CountryInfo countryByCode(String code) => kSupportedCountries.firstWhere(
  (c) => c.code == code.toUpperCase(),
  orElse: () => kSupportedCountries.first,
);

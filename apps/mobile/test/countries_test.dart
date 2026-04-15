import 'package:flutter_test/flutter_test.dart';

import 'package:majlis/features/auth/countries.dart';

void main() {
  group('CountryInfo.toE164', () {
    test('prefixes the dial code on a bare national number', () {
      final sa = countryByCode('SA');
      expect(sa.toE164('512345678'), '+966512345678');
    });

    test('strips leading zeros', () {
      final sa = countryByCode('SA');
      expect(sa.toE164('0512345678'), '+966512345678');
    });

    test('strips the dial code if the user typed it', () {
      final ae = countryByCode('AE');
      expect(ae.toE164('971501234567'), '+971501234567');
    });

    test('handles formatting characters', () {
      final eg = countryByCode('EG');
      expect(eg.toE164('010-1234-5678'), '+201012345678');
    });
  });

  test('the 8 supported countries are present', () {
    expect(kSupportedCountries.map((c) => c.code).toList(), [
      'SA',
      'AE',
      'EG',
      'KW',
      'OM',
      'BH',
      'QA',
      'JO',
    ]);
  });
}

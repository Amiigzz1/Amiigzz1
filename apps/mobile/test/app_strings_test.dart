import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:majlis/l10n/app_strings.dart';

void main() {
  group('AppStrings.forLocale', () {
    test('returns Arabic strings for ar', () {
      final s = AppStrings.forLocale(const Locale('ar'));
      expect(s.appName, 'مجلس');
      expect(s.continueAction, 'التالي');
      expect(s.country('SA'), 'السعودية');
    });

    test('returns English strings for en', () {
      final s = AppStrings.forLocale(const Locale('en'));
      expect(s.appName, 'Majlis');
      expect(s.continueAction, 'Continue');
      expect(s.country('SA'), 'Saudi Arabia');
    });

    test('falls back to Arabic for unknown locales', () {
      final s = AppStrings.forLocale(const Locale('fr'));
      expect(s.appName, 'مجلس');
    });
  });

  group('AppStrings placeholder interpolation', () {
    final s = AppStrings.forLocale(const Locale('en'));

    test('otpSubtitle fills in the phone number', () {
      expect(s.otpSubtitle('+966512345678'),
          'We sent a 6-digit code to +966512345678');
    });

    test('homeGreeting fills in the name', () {
      expect(s.homeGreeting('Ali'), 'Hi Ali 👋');
    });

    test('otpResendIn formats the countdown', () {
      expect(s.otpResendIn(30), 'Resend in 30s');
    });
  });
}

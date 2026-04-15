import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:majlis/features/auth/screens/phone_entry_screen.dart';

void main() {
  testWidgets('phone entry screen renders title and continue button in RTL', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          locale: Locale('ar', 'SA'),
          supportedLocales: [Locale('ar'), Locale('en')],
          localizationsDelegates: [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: PhoneEntryScreen(),
        ),
      ),
    );

    expect(find.text('دخولك بدقيقة واحدة'), findsOneWidget);
    expect(find.text('التالي'), findsOneWidget);
    expect(find.text('رقم الجوال'), findsOneWidget);

    // Default country is Saudi Arabia and its dial code is visible.
    expect(find.textContaining('+966'), findsWidgets);

    // Directionality wrapper forces RTL.
    final directionality = tester.widget<Directionality>(
      find
          .descendant(
            of: find.byType(PhoneEntryScreen),
            matching: find.byType(Directionality),
          )
          .first,
    );
    expect(directionality.textDirection, TextDirection.rtl);
  });
}

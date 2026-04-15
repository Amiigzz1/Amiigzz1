import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:majlis/screens/splash_screen.dart';

void main() {
  testWidgets('splash renders Arabic brand and tagline in RTL', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SplashScreen()));

    expect(find.text('مجلس'), findsOneWidget);
    expect(find.text('قهوتك الرقمية — العب، اتكلم، اتعرّف'), findsOneWidget);

    final directionality = tester.widget<Directionality>(
      find.descendant(
        of: find.byType(SplashScreen),
        matching: find.byType(Directionality),
      ).first,
    );
    expect(directionality.textDirection, TextDirection.rtl);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/splash_screen.dart';

void main() {
  runApp(const ProviderScope(child: MajlisApp()));
}

class MajlisApp extends StatelessWidget {
  const MajlisApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Majlis',
      debugShowCheckedModeBanner: false,
      // Arabic-first: default locale is ar-SA. The RTL direction follows
      // automatically from the locale.
      locale: const Locale('ar', 'SA'),
      supportedLocales: const [
        Locale('ar'),
        Locale('en'),
      ],
      localizationsDelegates: const [
        // TODO(phase-1): re-enable generated AppLocalizations.delegate once
        // `flutter gen-l10n` is part of the build pipeline.
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0E7C66),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        // TODO(phase-1): switch to Tajawal/Cairo once the font is bundled.
      ),
      home: const SplashScreen(),
    );
  }
}

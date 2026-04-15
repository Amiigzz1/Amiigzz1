import 'package:flutter/foundation.dart';

/// Compile-time configuration. Pass at build / run time via --dart-define, e.g.
///
///   flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000
///
/// Defaults target the local docker-compose stack. On Android emulator, the
/// API is at `http://10.0.2.2:3000` (use --dart-define to override).
class AppConfig {
  const AppConfig({required this.apiBaseUrl, required this.apiPrefix});

  final String apiBaseUrl;
  final String apiPrefix;

  String get baseUrl {
    final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final prefix = apiPrefix.startsWith('/') ? apiPrefix : '/$apiPrefix';
    return '$base$prefix';
  }

  static AppConfig fromEnv() {
    const fromDefine = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: '',
    );

    final base = fromDefine.isNotEmpty
        ? fromDefine
        : (defaultTargetPlatform == TargetPlatform.android && !kIsWeb
              ? 'http://10.0.2.2:3000'
              : 'http://localhost:3000');

    return AppConfig(apiBaseUrl: base, apiPrefix: '/v1');
  }
}

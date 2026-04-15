import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/auth_state.dart';
import '../features/auth/screens/otp_verify_screen.dart';
import '../features/auth/screens/phone_entry_screen.dart';
import '../features/home/screens/home_screen.dart';
import '../features/profile/screens/profile_setup_screen.dart';
import '../features/profile/screens/settings_screen.dart';
import '../screens/splash_screen.dart';

/// Bridge an arbitrary Listenable-friendly source to go_router's refresh stream.
class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(this._ref) {
    _ref.listen<AuthState>(
      authControllerProvider,
      (_, __) => notifyListeners(),
    );
  }

  final Ref _ref;
}

final routerRefreshProvider = Provider<_RouterRefresh>(_RouterRefresh.new);

final goRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ref.watch(routerRefreshProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      // Gate everything on the splash while we restore the session.
      if (auth.status == AuthStatus.unknown) {
        return loc == '/' ? null : '/';
      }

      final isAuthFlow = loc == '/phone' || loc.startsWith('/otp');
      final isSplash = loc == '/';

      if (auth.status == AuthStatus.signedOut) {
        return isAuthFlow ? null : '/phone';
      }

      // signedIn
      if (auth.isNewUser) {
        return loc == '/profile-setup' ? null : '/profile-setup';
      }
      if (isAuthFlow || isSplash) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/phone', builder: (_, __) => const PhoneEntryScreen()),
      GoRoute(
        path: '/otp',
        builder: (context, state) {
          final extra = (state.extra as Map?)?.cast<String, dynamic>() ?? {};
          return OtpVerifyScreen(
            phoneE164: extra['phone'] as String,
            countryCode: extra['country'] as String,
            devCode: extra['devCode'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/profile-setup',
        builder: (_, __) => const ProfileSetupScreen(),
      ),
      GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    ],
  );
});

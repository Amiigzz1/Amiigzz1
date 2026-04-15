import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/config/app_config.dart';
import '../../core/storage/token_storage.dart';
import 'auth_repository.dart';
import 'auth_state.dart';

// ---- Providers ----

final appConfigProvider = Provider<AppConfig>((_) => AppConfig.fromEnv());

final tokenStorageProvider = Provider<TokenStorage>((_) => TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokens = ref.watch(tokenStorageProvider);
  final config = ref.watch(appConfigProvider);
  return ApiClient(
    config: config,
    tokens: tokens,
    onSignedOut: () {
      // Propagate forced-logout (refresh failed) to the auth state.
      ref.read(authControllerProvider.notifier).markSignedOut();
    },
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    api: ref.watch(apiClientProvider),
    tokens: ref.watch(tokenStorageProvider),
  );
});

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
      return AuthController(
        tokens: ref.watch(tokenStorageProvider),
        repo: ref.watch(authRepositoryProvider),
      );
    });

// ---- Controller ----

class AuthController extends StateNotifier<AuthState> {
  AuthController({required this.tokens, required this.repo})
    : super(const AuthState.unknown()) {
    _restore();
  }

  final TokenStorage tokens;
  final AuthRepository repo;

  Future<void> _restore() async {
    final access = await tokens.readAccess();
    final userId = await tokens.readUserId();
    if (access != null && access.isNotEmpty && userId != null) {
      state = AuthState.signedIn(userId: userId);
    } else {
      state = const AuthState.signedOut();
    }
  }

  Future<String?> requestOtp({
    required String phoneE164,
    String? countryHint,
  }) async {
    final res = await repo.requestOtp(
      phoneE164: phoneE164,
      countryHint: countryHint,
    );
    return res.devCode;
  }

  Future<void> verifyOtp({
    required String phoneE164,
    required String code,
    String? countryHint,
  }) async {
    final res = await repo.verifyOtp(
      phoneE164: phoneE164,
      code: code,
      countryHint: countryHint,
    );
    state = AuthState.signedIn(
      userId: res.userId,
      isNewUser: res.isNewUser,
    );
  }

  Future<void> logout() async {
    await repo.logout();
    state = const AuthState.signedOut();
  }

  /// Called by the API client when a refresh attempt fails.
  void markSignedOut() {
    state = const AuthState.signedOut();
  }

  /// Clears the "isNewUser" flag once the profile-setup screen has consumed it.
  void clearNewUserFlag() {
    if (state.isNewUser) {
      state = state.copyWith(isNewUser: false);
    }
  }
}

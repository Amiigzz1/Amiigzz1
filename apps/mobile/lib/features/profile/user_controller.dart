import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import 'models/user.dart';
import 'user_repository.dart';

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepository(api: ref.watch(apiClientProvider));
});

/// Reactive current user. Loads from the API whenever auth flips to signed-in,
/// and clears when signed-out.
final currentUserProvider = FutureProvider<UserModel?>((ref) async {
  final auth = ref.watch(authControllerProvider);
  if (auth.status != AuthStatus.signedIn) return null;
  final repo = ref.watch(userRepositoryProvider);
  return repo.getMe();
});

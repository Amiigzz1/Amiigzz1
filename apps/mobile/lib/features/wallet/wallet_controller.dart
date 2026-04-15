import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import '../gifts/gift_repository.dart';
import 'wallet_repository.dart';

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  return WalletRepository(api: ref.watch(apiClientProvider));
});

final giftRepositoryProvider = Provider<GiftRepository>((ref) {
  return GiftRepository(api: ref.watch(apiClientProvider));
});

final walletSnapshotProvider = FutureProvider<WalletSnapshot?>((ref) async {
  final auth = ref.watch(authControllerProvider);
  if (auth.status != AuthStatus.signedIn) return null;
  final repo = ref.watch(walletRepositoryProvider);
  return repo.get();
});

final giftCatalogProvider = FutureProvider<List<Gift>>((ref) async {
  final auth = ref.watch(authControllerProvider);
  if (auth.status != AuthStatus.signedIn) return const [];
  final repo = ref.watch(giftRepositoryProvider);
  return repo.listCatalog();
});

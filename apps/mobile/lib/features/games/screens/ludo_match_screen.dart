import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../l10n/app_strings.dart';
import '../../auth/auth_controller.dart';
import '../games_repository.dart';

final gamesRepositoryProvider = Provider<GamesRepository>((ref) {
  return GamesRepository(api: ref.watch(apiClientProvider));
});

/// Phase 3 matchmaking + launch stub.
///
/// Flow:
///   1. User lands → we POST /v1/games/ludo/quick-match which stakes the
///      entry fee and enqueues the user.
///   2. On success we show the game id + a button to open the Phaser
///      board (hosted at /games/ludo — wired to a real WebView in
///      Phase 3 polish).
///   3. On failure (timeout, insufficient funds, etc.) we surface the
///      server error so the user can retry.
class LudoMatchScreen extends ConsumerStatefulWidget {
  const LudoMatchScreen({super.key});

  @override
  ConsumerState<LudoMatchScreen> createState() => _LudoMatchScreenState();
}

class _LudoMatchScreenState extends ConsumerState<LudoMatchScreen> {
  bool _loading = true;
  String? _gameId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _quickMatch();
  }

  Future<void> _quickMatch() async {
    final strings = AppStrings.of(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(gamesRepositoryProvider);
      final result = await repo.quickMatchLudo();
      if (!mounted) return;
      setState(() {
        _gameId = result.gameId;
        _loading = false;
      });
    } on NetworkException {
      setState(() {
        _loading = false;
        _error = strings.errorNetwork;
      });
    } on ApiException catch (e) {
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final theme = Theme.of(context);
    final userId = ref.watch(authControllerProvider).userId ?? '';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: Text(strings.homePlayLudo)),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_loading)
                  Column(
                    children: [
                      const CircularProgressIndicator(),
                      const SizedBox(height: 16),
                      Text(
                        'بنلاقي لك خصوم…',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'رسوم الدخول: 100 عملة',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  )
                else if (_error != null)
                  Column(
                    children: [
                      Icon(
                        Icons.error_outline,
                        color: theme.colorScheme.error,
                        size: 48,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyLarge,
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _quickMatch,
                        child: Text(strings.continueAction),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => context.go('/home'),
                        child: Text(strings.skipAction),
                      ),
                    ],
                  )
                else if (_gameId != null)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'لقينا لك خصوم! 🎲',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'رقم الجولة: ${_gameId!.substring(0, 8)}…',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 32),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                        ),
                        icon: const Icon(Icons.play_arrow),
                        label: const Text('ابدأ اللعب'),
                        // TODO(phase-3-polish): push a WebView scene that
                        // loads /games/ludo/index.html with this gameId +
                        // access token + userId appended to the hash.
                        onPressed: null,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'كود لاعب: ${userId.substring(0, userId.length.clamp(0, 8))}…',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

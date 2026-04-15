import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/app_strings.dart';
import '../wallet_controller.dart';
import '../wallet_repository.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppStrings.of(context);
    final walletAsync = ref.watch(walletSnapshotProvider);
    final theme = Theme.of(context);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('محفظتي')),
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: () async => ref.refresh(walletSnapshotProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                walletAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (_, __) => Text(strings.errorGeneric),
                  data: (w) => _BalanceCard(snapshot: w),
                ),
                const SizedBox(height: 24),
                Text(
                  'اشحن رصيدك',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                const _PackagesGrid(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.snapshot});

  final WalletSnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final coins = snapshot?.coins.toString() ?? '—';
    final diamonds = snapshot?.diamonds.toString() ?? '—';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [theme.colorScheme.primary, theme.colorScheme.primaryContainer],
          begin: Alignment.topStart,
          end: Alignment.bottomEnd,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: _StatColumn(
              icon: Icons.monetization_on_outlined,
              label: 'عملات',
              value: coins,
              color: theme.colorScheme.onPrimary,
            ),
          ),
          Container(
            width: 1,
            height: 48,
            color: theme.colorScheme.onPrimary.withOpacity(0.3),
          ),
          Expanded(
            child: _StatColumn(
              icon: Icons.diamond_outlined,
              label: 'ألماس',
              value: diamonds,
              color: theme.colorScheme.onPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 32, color: color),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(color: color.withOpacity(0.85), fontSize: 14),
        ),
      ],
    );
  }
}

class _PackagesGrid extends ConsumerWidget {
  const _PackagesGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(walletRepositoryProvider);
    return FutureBuilder<List<CoinPackage>>(
      future: repo.listPackages(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final packages = snapshot.data!;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: packages.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 1.3,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
          ),
          itemBuilder: (_, i) => _PackageCard(pkg: packages[i]),
        );
      },
    );
  }
}

class _PackageCard extends StatelessWidget {
  const _PackageCard({required this.pkg});

  final CoinPackage pkg;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          // TODO(phase-4-polish): route to provider-specific checkout flow.
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('الشحن يتم من داخل المتجر — قريباً')),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Icon(Icons.monetization_on, size: 36, color: theme.colorScheme.primary),
              const SizedBox(height: 4),
              Text(
                '${pkg.coins}',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (pkg.bonusCoins > BigInt.zero)
                Text(
                  '+${pkg.bonusCoins} مكافأة',
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.colorScheme.tertiary,
                  ),
                ),
              const Spacer(),
              Text(
                '\$${pkg.priceUsd}',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

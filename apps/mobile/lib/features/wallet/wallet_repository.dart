import '../../core/api/api_client.dart';

class WalletSnapshot {
  const WalletSnapshot({required this.coins, required this.diamonds});

  final BigInt coins;
  final BigInt diamonds;

  factory WalletSnapshot.fromJson(Map<String, dynamic> json) => WalletSnapshot(
    coins: BigInt.parse(json['coins'] as String),
    diamonds: BigInt.parse(json['diamonds'] as String),
  );
}

class CoinPackage {
  const CoinPackage({
    required this.id,
    required this.coins,
    required this.bonusCoins,
    required this.priceUsd,
    required this.currency,
  });

  final String id;
  final BigInt coins;
  final BigInt bonusCoins;
  final String priceUsd;
  final String currency;

  factory CoinPackage.fromJson(Map<String, dynamic> json) => CoinPackage(
    id: json['id'] as String,
    coins: BigInt.parse(json['coins'] as String),
    bonusCoins: BigInt.parse(json['bonusCoins'] as String),
    priceUsd: json['priceUsd'] as String,
    currency: json['currency'] as String,
  );
}

class WalletRepository {
  WalletRepository({required this.api});
  final ApiClient api;

  Future<WalletSnapshot> get() async {
    final data = await api.get('/wallet');
    return WalletSnapshot.fromJson(data);
  }

  Future<List<CoinPackage>> listPackages() async {
    final items = await api.getList('/payments/packages');
    return items
        .map((e) => CoinPackage.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }
}

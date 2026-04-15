import '../../core/api/api_client.dart';

class Gift {
  const Gift({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.priceCoins,
    this.animationUrl,
    required this.category,
  });

  final String id;
  final String nameAr;
  final String nameEn;
  final BigInt priceCoins;
  final String? animationUrl;
  final String category;

  factory Gift.fromJson(Map<String, dynamic> json) => Gift(
    id: json['id'] as String,
    nameAr: json['nameAr'] as String,
    nameEn: json['nameEn'] as String,
    priceCoins: BigInt.parse(json['priceCoins'] as String),
    animationUrl: json['animationUrl'] as String?,
    category: json['category'] as String,
  );
}

class GiftSendResult {
  const GiftSendResult({
    required this.giftSendId,
    required this.totalCoins,
    required this.totalDiamonds,
    required this.senderCoins,
  });

  final String giftSendId;
  final BigInt totalCoins;
  final BigInt totalDiamonds;
  final BigInt senderCoins;

  factory GiftSendResult.fromJson(Map<String, dynamic> json) => GiftSendResult(
    giftSendId: json['giftSendId'] as String,
    totalCoins: BigInt.parse(json['totalCoins'] as String),
    totalDiamonds: BigInt.parse(json['totalDiamonds'] as String),
    senderCoins: BigInt.parse(json['senderCoins'] as String),
  );
}

class GiftRepository {
  GiftRepository({required this.api});
  final ApiClient api;

  Future<List<Gift>> listCatalog() async {
    final items = await api.getList('/gifts');
    return items
        .map((e) => Gift.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<GiftSendResult> send({
    required String recipientId,
    required String giftId,
    String? roomId,
    int quantity = 1,
  }) async {
    final body = <String, dynamic>{
      'recipientId': recipientId,
      'giftId': giftId,
      'quantity': quantity,
      if (roomId != null) 'roomId': roomId,
    };
    final data = await api.post('/gifts/send', body);
    return GiftSendResult.fromJson(data);
  }
}

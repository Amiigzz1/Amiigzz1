import '../../core/api/api_client.dart';

class LudoMatchResult {
  const LudoMatchResult({
    required this.gameId,
    required this.roomUrl,
  });

  final String gameId;
  final String roomUrl;
}

class GamesRepository {
  GamesRepository({required this.api});
  final ApiClient api;

  Future<LudoMatchResult> quickMatchLudo() async {
    final data = await api.post('/games/ludo/quick-match', <String, dynamic>{});
    return LudoMatchResult(
      gameId: data['gameId'] as String,
      roomUrl: data['roomUrl'] as String,
    );
  }
}

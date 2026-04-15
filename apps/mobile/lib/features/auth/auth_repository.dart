import '../../core/api/api_client.dart';
import '../../core/storage/token_storage.dart';

class OtpRequestResult {
  const OtpRequestResult({this.devCode});

  /// Populated only when the server runs in LOCAL_OTP_MODE=true.
  final String? devCode;
}

class LoginResult {
  const LoginResult({
    required this.userId,
    required this.isNewUser,
    required this.accessToken,
    required this.refreshToken,
  });

  final String userId;
  final bool isNewUser;
  final String accessToken;
  final String refreshToken;
}

class AuthRepository {
  AuthRepository({required this.api, required this.tokens});

  final ApiClient api;
  final TokenStorage tokens;

  Future<OtpRequestResult> requestOtp({
    required String phoneE164,
    String? countryHint,
  }) async {
    final body = <String, dynamic>{'phone': phoneE164};
    if (countryHint != null) body['country'] = countryHint;

    final data = await api.post('/auth/request-otp', body, skipAuth: true);
    final dev = data['devCode'];
    return OtpRequestResult(devCode: dev is String ? dev : null);
  }

  Future<LoginResult> verifyOtp({
    required String phoneE164,
    required String code,
    String? countryHint,
    String? deviceId,
  }) async {
    final body = <String, dynamic>{'phone': phoneE164, 'code': code};
    if (countryHint != null) body['country'] = countryHint;
    if (deviceId != null) body['deviceId'] = deviceId;

    final data = await api.post('/auth/verify-otp', body, skipAuth: true);

    final result = LoginResult(
      userId: data['userId'] as String,
      isNewUser: data['isNewUser'] as bool,
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    await tokens.saveTokens(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
    );
    return result;
  }

  Future<void> logout() async {
    final refresh = await tokens.readRefresh();
    if (refresh != null) {
      try {
        await api.post('/auth/logout', {'refreshToken': refresh});
      } catch (_) {
        // Best-effort; local tokens are cleared regardless.
      }
    }
    await tokens.clear();
  }
}

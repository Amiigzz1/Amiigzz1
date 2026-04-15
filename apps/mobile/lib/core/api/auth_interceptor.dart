import 'package:dio/dio.dart';

import '../storage/token_storage.dart';

/// Attaches the current access token as a Bearer header on every request,
/// and transparently rotates the refresh token once per 401.
///
/// The refresh call uses its own Dio instance to avoid recursive interception.
/// On refresh failure the stored tokens are cleared and the original 401
/// bubbles up so the caller (usually router) can redirect to phone entry.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required this.tokens,
    required this.refreshBaseUrl,
    this.onSignedOut,
  });

  final TokenStorage tokens;
  final String refreshBaseUrl;
  final void Function()? onSignedOut;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra['skipAuth'] != true) {
      final access = await tokens.readAccess();
      if (access != null && access.isNotEmpty) {
        options.headers['authorization'] = 'Bearer $access';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final status = err.response?.statusCode;
    final requestOptions = err.requestOptions;

    final isUnauth = status == 401;
    final alreadyRetried = requestOptions.extra['didRetryRefresh'] == true;
    final skipAuth = requestOptions.extra['skipAuth'] == true;

    if (!isUnauth || alreadyRetried || skipAuth) {
      return handler.next(err);
    }

    final refresh = await tokens.readRefresh();
    if (refresh == null || refresh.isEmpty) {
      await tokens.clear();
      onSignedOut?.call();
      return handler.next(err);
    }

    try {
      final refreshDio = Dio(BaseOptions(baseUrl: refreshBaseUrl));
      final response = await refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );
      final data = response.data!;
      await Future.wait([
        tokens.updateAccess(data['accessToken'] as String),
        tokens.updateRefresh(data['refreshToken'] as String),
      ]);

      requestOptions.extra['didRetryRefresh'] = true;
      requestOptions.headers['authorization'] =
          'Bearer ${data['accessToken']}';
      final retryDio = Dio(BaseOptions(baseUrl: requestOptions.baseUrl));
      final retryResponse = await retryDio.fetch(requestOptions);
      return handler.resolve(retryResponse);
    } catch (_) {
      await tokens.clear();
      onSignedOut?.call();
      return handler.next(err);
    }
  }
}

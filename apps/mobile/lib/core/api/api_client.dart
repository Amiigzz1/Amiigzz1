import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';
import 'auth_interceptor.dart';

/// Thin Dio-based API client.
/// - Injects bearer tokens + auto-refreshes on 401 (see AuthInterceptor).
/// - Normalizes errors to our typed `ApiException` hierarchy so callers
///   don't leak Dio types into the UI layer.
class ApiClient {
  ApiClient({
    required this.config,
    required this.tokens,
    void Function()? onSignedOut,
  }) {
    _dio = Dio(
      BaseOptions(
        baseUrl: config.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 20),
        headers: {'content-type': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      AuthInterceptor(
        tokens: tokens,
        refreshBaseUrl: config.baseUrl,
        onSignedOut: onSignedOut,
      ),
    );
  }

  final AppConfig config;
  final TokenStorage tokens;
  late final Dio _dio;

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    bool skipAuth = false,
  }) async {
    return _run<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(extra: {'skipAuth': skipAuth}),
      ),
    );
  }

  Future<Map<String, dynamic>> get(String path) async {
    return _run<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(path),
    );
  }

  Future<Map<String, dynamic>> patch(
    String path,
    Map<String, dynamic> body,
  ) async {
    return _run<Map<String, dynamic>>(
      () => _dio.patch<Map<String, dynamic>>(path, data: body),
    );
  }

  Future<Map<String, dynamic>> postMultipart(
    String path, {
    required FormData data,
  }) async {
    return _run<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(contentType: 'multipart/form-data'),
      ),
    );
  }

  Future<T> _run<T>(Future<Response<T>> Function() fn) async {
    try {
      final res = await fn();
      if (res.data == null) {
        throw const ServerException('empty response');
      }
      return res.data!;
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  ApiException _mapDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        return const NetworkException('no connection');
      case DioExceptionType.badCertificate:
        return const NetworkException('bad certificate');
      case DioExceptionType.cancel:
        return const ServerException('request cancelled');
      case DioExceptionType.badResponse:
        final code = e.response?.statusCode;
        if (code == 401) return const UnauthorizedException();
        final message =
            (e.response?.data is Map && (e.response?.data as Map)['message'] is String)
            ? (e.response?.data as Map)['message'] as String
            : 'server error';
        return ServerException(message, statusCode: code);
    }
  }
}

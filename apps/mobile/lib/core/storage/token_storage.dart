import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists access + refresh tokens in the platform secure storage
/// (Keychain on iOS, EncryptedSharedPreferences on Android, IndexedDB on web).
class TokenStorage {
  TokenStorage([FlutterSecureStorage? backend])
    : _storage = backend ?? const FlutterSecureStorage(
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
      );

  final FlutterSecureStorage _storage;

  static const _kAccess = 'majlis.auth.access';
  static const _kRefresh = 'majlis.auth.refresh';
  static const _kUserId = 'majlis.auth.userId';

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required String userId,
  }) async {
    await Future.wait([
      _storage.write(key: _kAccess, value: accessToken),
      _storage.write(key: _kRefresh, value: refreshToken),
      _storage.write(key: _kUserId, value: userId),
    ]);
  }

  Future<String?> readAccess() => _storage.read(key: _kAccess);
  Future<String?> readRefresh() => _storage.read(key: _kRefresh);
  Future<String?> readUserId() => _storage.read(key: _kUserId);

  Future<void> updateAccess(String accessToken) =>
      _storage.write(key: _kAccess, value: accessToken);

  Future<void> updateRefresh(String refreshToken) =>
      _storage.write(key: _kRefresh, value: refreshToken);

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _kAccess),
      _storage.delete(key: _kRefresh),
      _storage.delete(key: _kUserId),
    ]);
  }
}

/// Typed error surface for the API layer. UI code should handle these three
/// cases (network / unauthorized / generic) rather than raw DioException.
sealed class ApiException implements Exception {
  const ApiException(this.message);
  final String message;

  @override
  String toString() => '$runtimeType: $message';
}

class NetworkException extends ApiException {
  const NetworkException(super.message);
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException([super.message = 'unauthorized']);
}

class ServerException extends ApiException {
  const ServerException(super.message, {this.statusCode});
  final int? statusCode;
}

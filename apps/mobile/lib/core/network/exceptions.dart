class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class UnauthorizedException extends ApiException {
  UnauthorizedException([super.message = 'Unauthorized']) : super(statusCode: 401);
}

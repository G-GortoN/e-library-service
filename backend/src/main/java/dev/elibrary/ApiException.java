package dev.elibrary;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
  final HttpStatus status;
  final String code;

  ApiException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "NOT_FOUND", "The resource was not found / 资源不存在");
  }

  static ApiException conflict(String code, String message) {
    return new ApiException(HttpStatus.CONFLICT, code, message);
  }

  static ApiException bad(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", message);
  }
}

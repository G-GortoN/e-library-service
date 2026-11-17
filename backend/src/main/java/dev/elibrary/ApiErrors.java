package dev.elibrary;

import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(ApiException.class)
  ProblemDetail business(ApiException e) {
    return problem(e.status, e.code, e.getMessage());
  }

  @ExceptionHandler({
    MethodArgumentNotValidException.class,
    ConstraintViolationException.class,
    IllegalArgumentException.class
  })
  ProblemDetail validation(Exception e) {
    return problem(
        HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Check the submitted fields / 请检查提交内容");
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ProblemDetail tooLarge(Exception e) {
    return problem(
        HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Maximum upload size is 5 MB / 文件最大 5 MB");
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ProblemDetail integrity(DataIntegrityViolationException e) {
    // Only known domain constraints are exposed as conflicts. SQL and internal details remain
    // private.
    String text = e.getMostSpecificCause().getMessage();
    if (text != null
        && (text.contains("uq_loan_active_book")
            || text.contains("uq_reservation_active")
            || text.contains("app_user_email_key")
            || text.contains("book_isbn_key")))
      return problem(
          HttpStatus.CONFLICT,
          "RESOURCE_CONFLICT",
          "The resource has changed or already exists / 资源冲突，请刷新后重试");
    return problem(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "The request could not be completed / 请求未能完成");
  }

  @ExceptionHandler({
    org.springframework.http.converter.HttpMessageNotReadableException.class,
    org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
    org.springframework.web.bind.MissingServletRequestParameterException.class
  })
  ProblemDetail malformed(Exception e) {
    return problem(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Malformed request / 请求格式无效");
  }

  @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
  ProblemDetail notFound(Exception e) {
    return problem(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found / 资源不存在");
  }

  @ExceptionHandler(Exception.class)
  ProblemDetail unexpected(Exception e) {
    org.slf4j.LoggerFactory.getLogger(ApiErrors.class).error("Unexpected request failure", e);
    return problem(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "The request could not be completed / 请求未能完成");
  }

  static ProblemDetail problem(HttpStatus status, String code, String message) {
    ProblemDetail p = ProblemDetail.forStatusAndDetail(status, message);
    p.setProperty("code", code);
    return p;
  }
}

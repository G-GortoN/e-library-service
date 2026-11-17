package dev.elibrary;

import static org.junit.jupiter.api.Assertions.*;

import java.time.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class RateLimitsTest {
  @Test
  void limitsAreScopedAndExpire() {
    var time = new AtomicReference<>(Instant.parse("2030-01-01T00:00:00Z"));
    Clock clock =
        new Clock() {
          public ZoneId getZone() {
            return ZoneOffset.UTC;
          }

          public Clock withZone(ZoneId zone) {
            return this;
          }

          public Instant instant() {
            return time.get();
          }
        };
    var limits = new RateLimits(clock);
    limits.check("login:one", 2);
    limits.check("login:one", 2);
    var exception = assertThrows(ApiException.class, () -> limits.check("login:one", 2));
    assertEquals(429, exception.status.value());
    assertDoesNotThrow(() -> limits.check("login:two", 2));
    time.updateAndGet(t -> t.plusSeconds(61));
    assertDoesNotThrow(() -> limits.check("login:one", 2));
  }
}

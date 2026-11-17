package dev.elibrary;

import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
class RateLimits {
  record Window(long start, int count) {}

  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
  private final Clock clock;

  RateLimits(Clock clock) {
    this.clock = clock;
  }

  void check(String key, int limit) {
    long now = clock.millis();
    if (windows.size() > 10000)
      windows.entrySet().removeIf(e -> now - e.getValue().start() > 3600000);
    Window w =
        windows.compute(
            key,
            (k, old) ->
                old == null || now - old.start() > 60000
                    ? new Window(now, 1)
                    : new Window(old.start(), old.count() + 1));
    if (w.count() > limit)
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "RATE_LIMITED",
          "Too many attempts; try again later / 请求过于频繁，请稍后再试");
  }
}

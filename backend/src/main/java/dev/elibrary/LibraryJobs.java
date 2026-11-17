package dev.elibrary;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.scheduling-enabled", havingValue = "true", matchIfMissing = true)
class LibraryJobs {
  private final LendingService lending;
  private final NotificationService notifications;

  LibraryJobs(LendingService lending, NotificationService notifications) {
    this.lending = lending;
    this.notifications = notifications;
  }

  @Scheduled(fixedDelayString = "${app.maintenance-delay-ms:60000}", initialDelay = 5000)
  void maintain() {
    lending.tick();
  }

  @Scheduled(fixedDelayString = "${app.delivery-delay-ms:15000}", initialDelay = 10000)
  void deliver() {
    notifications.deliverPending();
  }
}

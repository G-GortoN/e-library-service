package dev.elibrary;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
class Settings {
  @Value("${app.loan-days}")
  int loanDays;

  @Value("${app.max-active-loans}")
  int maxLoans;

  @Value("${app.renewal-days}")
  int renewalDays;

  @Value("${app.max-renewals}")
  int maxRenewals;

  @Value("${app.reservation-hours}")
  int reservationHours;

  @Value("${app.fine-rate-minor}")
  long fineRate;

  @Value("${app.fine-cap-minor}")
  long fineCap;

  @Value("${app.public-base-url}")
  String publicBaseUrl;

  @Value("${app.public-backup-base-url:}")
  String publicBackupBaseUrl;

  @Value("${app.media-directory}")
  String mediaDirectory;

  @Value("${app.mail-enabled}")
  boolean mailEnabled;

  @Value("${app.mail-from}")
  String mailFrom;

  @jakarta.annotation.PostConstruct
  void validate() {
    if (loanDays < 1
        || maxLoans < 1
        || renewalDays < 1
        || maxRenewals < 0
        || reservationHours < 1
        || fineRate < 0
        || fineCap < 0) {
      throw new IllegalStateException("Invalid lending rule configuration");
    }
    publicBaseUrl = publicBaseUrl.strip();
    publicBackupBaseUrl = publicBackupBaseUrl.strip();
    validatePublicBase(publicBaseUrl, "APP_PUBLIC_BASE_URL");
    if (!publicBackupBaseUrl.isEmpty()) {
      validatePublicBase(publicBackupBaseUrl, "APP_PUBLIC_BACKUP_BASE_URL");
    }
  }

  private static void validatePublicBase(String value, String setting) {
    java.net.URI base = java.net.URI.create(value);
    if (!("http".equals(base.getScheme()) || "https".equals(base.getScheme()))
        || base.getHost() == null
        || base.getUserInfo() != null
        || base.getQuery() != null
        || base.getFragment() != null) {
      throw new IllegalStateException(
          setting + " must be an absolute HTTP(S) URL without credentials, query or" + " fragment");
    }
  }
}

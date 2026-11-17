package dev.elibrary;

import java.time.*;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class NotificationService {
  private final Store db;
  private final Clock clock;
  private final Settings settings;
  private final JavaMailSender mail;

  NotificationService(Store db, Clock clock, Settings settings, JavaMailSender mail) {
    this.db = db;
    this.clock = clock;
    this.settings = settings;
    this.mail = mail;
  }

  void notify(long readerId, String key, String title, String body, String type) {
    int inserted =
        db.update(
            "insert into notification(reader_id,event_key,title,body,type,created_at)"
                + " values(?,?,?,?,?,?) on conflict(event_key) do nothing",
            readerId,
            key,
            title,
            body,
            type,
            clock.instant());
    if (inserted > 0 && settings.mailEnabled) {
      var recipient =
          db.one("select email from app_user where id=?", readerId).get("email").toString();
      email(recipient, title, body, "notice:" + key);
    }
  }

  void email(String recipient, String subject, String body, String key) {
    Instant now = clock.instant();
    db.update(
        "insert into email_delivery(recipient,subject,body,event_key,next_attempt_at,created_at)"
            + " values(?,?,?,?,?,?) on conflict(event_key) do nothing",
        recipient,
        subject,
        body,
        key,
        now,
        now);
  }

  @Transactional
  public void deliverPending() {
    if (!settings.mailEnabled) return;
    for (var row :
        db.rows(
            "select * from email_delivery where status='PENDING' and next_attempt_at<=? order by id"
                + " limit 10 for update skip locked",
            clock.instant())) {
      try {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(settings.mailFrom);
        message.setTo(row.get("recipient").toString());
        message.setSubject(row.get("subject").toString());
        message.setText(row.get("body").toString());
        mail.send(message);
        db.update(
            "update email_delivery set status='SENT',sent_at=?,body='[redacted after delivery]'"
                + " where id=?",
            clock.instant(),
            row.get("id"));
      } catch (org.springframework.mail.MailException ex) {
        int attempts = ((Number) row.get("attempts")).intValue() + 1;
        db.update(
            "update email_delivery set attempts=?,status=?,next_attempt_at=? where id=?",
            attempts,
            attempts >= 5 ? "FAILED" : "PENDING",
            clock.instant().plusSeconds(Math.min(1800, 60L * (1L << attempts))),
            row.get("id"));
      }
    }
    db.update(
        "update email_delivery set body='[expired content redacted]' where event_key like 'token:%'"
            + " and created_at<? and body not like '[%redacted%]'",
        clock.instant().minus(Duration.ofDays(1)));
  }
}

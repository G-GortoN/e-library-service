package dev.elibrary;

import java.time.*;
import org.springframework.stereotype.Component;

/** Invoked only inside a transaction holding Store.lock(). */
@Component
class ReservationQueue {
  private final Store db;
  private final Clock clock;
  private final Settings settings;
  private final NotificationService notices;

  ReservationQueue(Store db, Clock clock, Settings settings, NotificationService notices) {
    this.db = db;
    this.clock = clock;
    this.settings = settings;
    this.notices = notices;
  }

  void advance(long book) {
    Instant now = clock.instant();
    for (var r :
        db.rows(
            "select id,reader_id from reservation where book_id=? and status='READY' and"
                + " expires_at<=?",
            book,
            now)) {
      db.update("update reservation set status='EXPIRED' where id=?", r.get("id"));
      notices.notify(
          ((Number) r.get("readerId")).longValue(),
          "reservation-expired:" + r.get("id"),
          "Reservation expired / 预约已过期",
          "Your collection window has ended. / 领取窗口已结束。",
          "RESERVATION_EXPIRED");
    }
    if (db.count("select count(*) from book where id=? and status='PUBLISHED'", book) == 0
        || db.count("select count(*) from loan where book_id=? and returned_at is null", book) > 0
        || db.count("select count(*) from reservation where book_id=? and status='READY'", book)
            > 0) return;
    var next =
        db.optional(
            "select r.id,r.reader_id from reservation r join app_user u on u.id=r.reader_id where"
                + " r.book_id=? and r.status='WAITING' and u.enabled order by r.created_at,r.id"
                + " limit 1",
            book);
    next.ifPresent(
        r -> {
          db.update(
              "update reservation set status='READY',ready_at=?,expires_at=? where id=?",
              now,
              now.plus(Duration.ofHours(settings.reservationHours)),
              r.get("id"));
          notices.notify(
              ((Number) r.get("readerId")).longValue(),
              "reservation-ready:" + r.get("id"),
              "Your book is ready / 预约图书可领取",
              "Borrow within "
                  + settings.reservationHours
                  + " hours. / 请在 "
                  + settings.reservationHours
                  + " 小时内借阅。",
              "RESERVATION_READY");
        });
  }
}

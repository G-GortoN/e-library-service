package dev.elibrary;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class LendingService {
  static final String LOAN_VIEW =
      "select"
          + " l.id,l.book_id,b.title,b.author,b.cover_url,l.borrowed_at,l.due_at,l.returned_at,l.renewal_count,least(l.fine_cap_minor,greatest(0,floor(extract(epoch"
          + " from(coalesce(l.returned_at,?::timestamptz)-l.due_at))/86400)::bigint)*l.fine_rate_minor)"
          + " as fine_amount_minor from loan l join book b on b.id=l.book_id";
  static final String RESERVATION_VIEW =
      "select r.id,r.book_id,b.title,b.cover_url,r.status,r.created_at,r.expires_at,case when"
          + " r.status in ('WAITING','READY') then (select count(*) from reservation p where"
          + " p.book_id=r.book_id and p.status in ('WAITING','READY') and"
          + " (p.created_at,p.id)<=(r.created_at,r.id)) else 0 end as position from reservation r"
          + " join book b on b.id=r.book_id";
  static final String FINE_VIEW =
      "select f.id,f.loan_id,b.title as"
          + " book_title,f.amount_minor,f.waived_minor,f.status,f.created_at from fine f join loan"
          + " l on l.id=f.loan_id join book b on b.id=l.book_id";
  static final String ADMIN_LOAN_VIEW = adminView(LOAN_VIEW, " from loan l ", "l");
  static final String ADMIN_RESERVATION_VIEW =
      adminView(RESERVATION_VIEW, " from reservation r ", "r");
  static final String ADMIN_FINE_VIEW = adminView(FINE_VIEW, " from fine f ", "l");

  private static String adminView(String view, String outerFrom, String readerAlias) {
    int from = view.indexOf(outerFrom);
    if (from < 0) throw new IllegalArgumentException("Missing outer SELECT boundary");
    return view.substring(0, from)
        + ","
        + readerAlias
        + ".reader_id,u.display_name as reader_name,u.email as reader_email"
        + view.substring(from)
        + " join app_user u on u.id="
        + readerAlias
        + ".reader_id";
  }

  private final Store db;
  private final Clock clock;
  private final Settings settings;
  private final NotificationService notices;
  private final IdentityService identity;
  private final ReservationQueue queue;

  LendingService(
      Store db,
      Clock clock,
      Settings settings,
      NotificationService notices,
      IdentityService identity,
      ReservationQueue queue) {
    this.db = db;
    this.clock = clock;
    this.settings = settings;
    this.notices = notices;
    this.identity = identity;
    this.queue = queue;
  }

  private void requireEnabled(long id) {
    if (db.count("select count(*) from app_user where id=? and enabled and email_verified", id)
        != 1) throw ApiException.conflict("ACCOUNT_DISABLED", "Account is unavailable / 账号不可用");
  }

  private void requirePublished(long id) {
    if (db.count("select count(*) from book where id=? and status='PUBLISHED'", id) != 1)
      throw ApiException.conflict("BOOK_UNAVAILABLE", "The book is not published / 该书尚未上架");
  }

  private Map<String, Object> owned(long id, long user, boolean admin) {
    return db.optional(
            "select * from loan where id=?" + (admin ? "" : " and reader_id=?"),
            admin ? new Object[] {id} : new Object[] {id, user})
        .orElseThrow(ApiException::missing);
  }

  @Transactional
  Map<String, Object> borrow(long reader, long bookId) {
    db.lock();
    requireEnabled(reader);
    requirePublished(bookId);
    expireAndAllocate(bookId);
    if (db.count("select count(*) from loan where reader_id=? and returned_at is null", reader)
        >= settings.maxLoans)
      throw ApiException.conflict("LOAN_LIMIT", "Active loan limit reached / 已达到借阅上限");
    if (db.count("select count(*) from loan where book_id=? and returned_at is null", bookId) > 0)
      throw ApiException.conflict("BORROW_CONFLICT", "Book already borrowed / 图书已被借阅");
    var ready = db.optional("select * from reservation where book_id=? and status='READY'", bookId);
    if (ready.isPresent() && ((Number) ready.get().get("readerId")).longValue() != reader)
      throw ApiException.conflict(
          "RESERVED_FOR_ANOTHER_READER", "Reserved for the queue head / 已为队首读者保留");
    Instant now = clock.instant();
    long id =
        db.insert(
            "insert into loan(book_id,reader_id,borrowed_at,due_at,fine_rate_minor,fine_cap_minor)"
                + " values(?,?,?,?,?,?) returning id",
            bookId,
            reader,
            now,
            now.plus(Duration.ofDays(settings.loanDays)),
            settings.fineRate,
            settings.fineCap);
    ready.ifPresent(
        r -> db.update("update reservation set status='CLAIMED' where id=?", r.get("id")));
    notices.notify(
        reader,
        "borrowed:" + id,
        "Book borrowed / 借阅成功",
        "Your loan is due in " + settings.loanDays + " days. / 借期为 " + settings.loanDays + " 天。",
        "BORROWED");
    return loan(id);
  }

  @Transactional
  void returnLoan(long id, long user, boolean admin) {
    db.lock();
    var row = owned(id, user, admin);
    if (row.get("returnedAt") != null) return;
    db.update(
        "update loan set returned_at=? where id=? and returned_at is null", clock.instant(), id);
    syncFine(id);
    long reader = ((Number) row.get("readerId")).longValue();
    notices.notify(
        reader,
        "returned:" + id,
        "Book returned / 归还成功",
        "Your loan has been returned. / 借阅已归还。",
        "RETURNED");
    expireAndAllocate(((Number) row.get("bookId")).longValue());
    if (admin) identity.audit("LOAN_RETURN", Long.toString(id), "Administrative return");
  }

  @Transactional
  Map<String, Object> renew(long id, long user) {
    db.lock();
    var row = owned(id, user, false);
    requireEnabled(user);
    long book = ((Number) row.get("bookId")).longValue();
    requirePublished(book);
    expireAndAllocate(book);
    if (row.get("returnedAt") != null || !Store.instant(row, "dueAt").isAfter(clock.instant()))
      throw ApiException.conflict(
          "RENEWAL_NOT_ALLOWED", "Returned or overdue loans cannot renew / 已归还或逾期借阅不可续借");
    if (((Number) row.get("renewalCount")).intValue() >= settings.maxRenewals
        || db.count(
                "select count(*) from reservation where book_id=? and status in ('WAITING','READY')"
                    + " and reader_id<>?",
                book,
                user)
            > 0)
      throw ApiException.conflict(
          "RENEWAL_NOT_ALLOWED", "Renewal limit reached or readers are waiting / 已达续借上限或有人预约");
    db.update(
        "update loan set due_at=?,renewal_count=renewal_count+1 where id=?",
        Store.instant(row, "dueAt").plus(Duration.ofDays(settings.renewalDays)),
        id);
    return loan(id);
  }

  @Transactional
  Map<String, Object> reserve(long reader, long book) {
    db.lock();
    requireEnabled(reader);
    requirePublished(book);
    expireAndAllocate(book);
    if (db.count(
            "select count(*) from loan where book_id=? and reader_id=? and returned_at is null",
            book,
            reader)
        > 0)
      throw ApiException.conflict("ALREADY_BORROWED", "You already borrowed this book / 已借阅此书");
    if (db.count(
            "select count(*) from reservation where book_id=? and reader_id=? and status in"
                + " ('WAITING','READY')",
            book,
            reader)
        > 0)
      throw ApiException.conflict("ALREADY_RESERVED", "You already reserved this book / 已预约此书");
    if (db.count("select count(*) from loan where book_id=? and returned_at is null", book) == 0
        && db.count("select count(*) from reservation where book_id=? and status='READY'", book)
            == 0)
      throw ApiException.conflict(
          "BORROW_INSTEAD", "The book can be borrowed immediately / 图书可直接借阅");
    long id =
        db.insert(
            "insert into reservation(book_id,reader_id,status,created_at) values(?,?,'WAITING',?)"
                + " returning id",
            book,
            reader,
            clock.instant());
    return db.one(RESERVATION_VIEW + " where r.id=?", id);
  }

  @Transactional
  void cancelReservation(long id, long reader) {
    db.lock();
    var row =
        db.optional("select * from reservation where id=? and reader_id=?", id, reader)
            .orElseThrow(ApiException::missing);
    if (Set.of("WAITING", "READY").contains(row.get("status")))
      db.update("update reservation set status='CANCELLED' where id=?", id);
    expireAndAllocate(((Number) row.get("bookId")).longValue());
  }

  void expireAndAllocate(long book) {
    queue.advance(book);
  }

  Map<String, Object> loan(long id) {
    return db.one(LOAN_VIEW + " where l.id=?", clock.instant(), id);
  }

  List<Map<String, Object>> loans(long reader, boolean history) {
    return db.rows(
        LOAN_VIEW
            + " where l.reader_id=? and l.returned_at is "
            + (history ? "not null" : "null")
            + " order by l.borrowed_at desc,l.id desc",
        clock.instant(),
        reader);
  }

  List<Map<String, Object>> reservations(long reader) {
    return db.rows(
        RESERVATION_VIEW + " where r.reader_id=? order by r.created_at desc,r.id desc", reader);
  }

  private void syncFine(long loan) {
    var row = loan(loan);
    long amount = ((Number) row.get("fineAmountMinor")).longValue();
    if (amount > 0)
      db.update(
          "insert into fine(loan_id,amount_minor,created_at) values(?,?,?) on conflict(loan_id) do"
              + " update set amount_minor=excluded.amount_minor where fine.status='OPEN'",
          loan,
          amount,
          clock.instant());
  }

  @Transactional
  void tick() {
    db.lock();
    for (var b :
        db.rows(
            "select distinct book_id as id from reservation where status in ('WAITING','READY')"))
      expireAndAllocate(Store.id(b));
    for (var row : db.rows("select * from loan where returned_at is null")) {
      long id = Store.id(row);
      Instant due = Store.instant(row, "dueAt");
      long reader = ((Number) row.get("readerId")).longValue();
      if (!due.isAfter(clock.instant())) {
        syncFine(id);
        notices.notify(
            reader,
            "overdue:" + id + ":" + due,
            "Loan overdue / 借阅已逾期",
            "Please return your book. / 请及时归还图书。",
            "OVERDUE");
      } else if (due.isBefore(clock.instant().plus(Duration.ofDays(1))))
        notices.notify(
            reader,
            "due:" + id + ":" + due,
            "Book due soon / 图书即将到期",
            "Your book is due within one day. / 图书将在一天内到期。",
            "DUE_SOON");
    }
  }

  @Transactional
  List<Map<String, Object>> fines(long reader) {
    db.lock();
    for (var l : db.rows("select id from loan where reader_id=? and returned_at is null", reader))
      syncFine(Store.id(l));
    return db.rows(FINE_VIEW + " where l.reader_id=? order by f.created_at desc", reader);
  }

  @Transactional
  Map<String, Object> adjust(long fine, long amount, String reason, boolean settle) {
    db.lock();
    var row =
        db.one(
            "select f.*,l.returned_at from fine f join loan l on l.id=f.loan_id where f.id=?",
            fine);
    if (row.get("returnedAt") == null)
      throw ApiException.conflict("RETURN_FIRST", "Return the book before settling / 请先归还图书再处理账单");
    if (!"OPEN".equals(row.get("status")))
      throw ApiException.conflict("FINE_CLOSED", "Bill is already closed / 账单已关闭");
    long balance =
        ((Number) row.get("amountMinor")).longValue()
            - ((Number) row.get("waivedMinor")).longValue();
    if (settle) {
      db.update("update fine set status='SETTLED' where id=?", fine);
      identity.audit(
          "FINE_DEMO_SETTLE", Long.toString(fine), "Demonstration only; no payment processed");
    } else {
      if (amount < 1
          || amount > balance
          || reason == null
          || reason.isBlank()
          || reason.length() > 500) throw ApiException.bad("Invalid adjustment / 减免金额或原因无效");
      db.update(
          "insert into fine_adjustment(fine_id,actor_id,amount_minor,reason,created_at)"
              + " values(?,?,?,?,?)",
          fine,
          SecurityConfig.user().id(),
          amount,
          reason,
          clock.instant());
      db.update(
          "update fine set waived_minor=waived_minor+?,status=? where id=?",
          amount,
          amount == balance ? "WAIVED" : "OPEN",
          fine);
      identity.audit("FINE_WAIVE", Long.toString(fine), reason);
    }
    return db.one(FINE_VIEW + " where f.id=?", fine);
  }
}

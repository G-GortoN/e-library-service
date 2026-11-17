package dev.elibrary;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class IdentityService {
  static final String USER_COLUMNS = "id,email,display_name,role,enabled,email_verified";
  private final Store db;
  private final PasswordEncoder passwords;
  private final Clock clock;
  private final NotificationService notices;
  private final Settings settings;
  private final ReservationQueue queue;

  IdentityService(
      Store db,
      PasswordEncoder passwords,
      Clock clock,
      NotificationService notices,
      Settings settings,
      ReservationQueue queue) {
    this.db = db;
    this.passwords = passwords;
    this.clock = clock;
    this.notices = notices;
    this.settings = settings;
    this.queue = queue;
  }

  Map<String, Object> me(long id) {
    return db.one("select " + USER_COLUMNS + " from app_user where id=?", id);
  }

  Map<String, Object> credentials(String email, String password) {
    var row = db.optional("select * from app_user where email=?", normalizeEmail(email));
    String hash =
        row.map(r -> r.get("passwordHash").toString())
            .orElse("$2a$12$2DySoU7B4i5xFj3i/SZ0neJ2Kaqb2xbmUfjJ0t8oNcGnkWTw2GttS");
    boolean matches = passwords.matches(password, hash);
    if (row.isEmpty() || !matches || !Boolean.TRUE.equals(row.get().get("enabled")))
      throw new ApiException(
          HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password / 邮箱或密码错误");
    if (!Boolean.TRUE.equals(row.get().get("emailVerified")))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Verify your email first / 请先验证邮箱");
    return row.get();
  }

  @Transactional
  void register(String email, String name, String password) {
    db.lock();
    ensureMail();
    email = normalizeEmail(email);
    validateName(name);
    validatePassword(password);
    // Do not reveal whether an address already exists.
    var existing =
        db.optional("select id,email_verified,enabled from app_user where email=?", email);
    if (existing.isPresent()) {
      if (Boolean.TRUE.equals(existing.get().get("enabled"))
          && !Boolean.TRUE.equals(existing.get().get("emailVerified"))) {
        long userId = Store.id(existing.get());
        // The address may have been preregistered by somebody else. Never activate its old
        // password through a replacement verification email: the mailbox owner must choose a new
        // password after proving ownership via the recovery link.
        db.update(
            "update account_token set used_at=? where user_id=? and purpose='VERIFY' and used_at"
                + " is null",
            clock.instant(),
            userId);
        issueToken(userId, "RESET");
      }
      return;
    }
    long id =
        db.insert(
            "insert into app_user(email,display_name,password_hash,role) values(?,?,?,'READER')"
                + " returning id",
            email,
            name.strip(),
            passwords.encode(password));
    issueToken(id, "VERIFY");
  }

  @Transactional
  void resetRequest(String email) {
    db.lock();
    ensureMail();
    db.optional("select id from app_user where email=? and enabled=true", normalizeEmail(email))
        .ifPresent(r -> issueToken(Store.id(r), "RESET"));
  }

  private void issueToken(long userId, String purpose) {
    byte[] random = new byte[32];
    new SecureRandom().nextBytes(random);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    Instant now = clock.instant();
    db.update(
        "update account_token set used_at=? where user_id=? and purpose=? and used_at is null",
        now,
        userId,
        purpose);
    db.update(
        "insert into account_token(user_id,token_hash,purpose,expires_at) values(?,?,?,?)",
        userId,
        hash(token),
        purpose,
        now.plus(purpose.equals("VERIFY") ? Duration.ofHours(24) : Duration.ofMinutes(30)));
    String path = purpose.equals("VERIFY") ? "/verify-email" : "/reset-password";
    String base = settings.publicBaseUrl.replaceAll("/+$", "");
    String link = base + path + "?token=" + token;
    String backup = settings.publicBackupBaseUrl.replaceAll("/+$", "");
    String backupLink =
        !backup.isBlank()
                && !java.net
                    .URI
                    .create(base)
                    .normalize()
                    .equals(java.net.URI.create(backup).normalize())
            ? "\n\nBackup link (if the primary is unreachable) / 主链接无法访问时使用备用链接：\n"
                + backup
                + path
                + "?token="
                + token
            : "";
    String subject =
        purpose.equals("VERIFY") ? "Verify your email / 验证邮箱" : "Reset your password / 重置密码";
    notices.email(
        db.one("select email from app_user where id=?", userId).get("email").toString(),
        subject,
        subject
            + "\n\n"
            + link
            + backupLink
            + "\n\nIf you did not request this, ignore this email. / 如非本人操作，请忽略。",
        "token:" + hash(token));
  }

  @Transactional
  void verify(String token) {
    db.lock();
    var row = consumeToken(token, "VERIFY");
    db.update("update app_user set email_verified=true where id=?", row.get("userId"));
  }

  @Transactional
  void reset(String token, String password) {
    db.lock();
    validatePassword(password);
    var row = consumeToken(token, "RESET");
    db.update(
        "update app_user set password_hash=?,email_verified=true,session_version=session_version+1"
            + " where id=?",
        passwords.encode(password),
        row.get("userId"));
  }

  private Map<String, Object> consumeToken(String token, String purpose) {
    if (token == null || token.length() > 200)
      throw ApiException.bad("Invalid or expired link / 链接无效或已过期");
    var row =
        db.optional(
                "select * from account_token where token_hash=? and purpose=? and used_at is null"
                    + " and expires_at>?",
                hash(token),
                purpose,
                clock.instant())
            .orElseThrow(() -> ApiException.bad("Invalid or expired link / 链接无效或已过期"));
    db.update("update account_token set used_at=? where id=?", clock.instant(), row.get("id"));
    return row;
  }

  @Transactional
  Map<String, Object> profile(long id, String name) {
    db.lock();
    validateName(name);
    db.update("update app_user set display_name=? where id=?", name.strip(), id);
    return me(id);
  }

  @Transactional
  void changePassword(long id, String current, String replacement) {
    db.lock();
    validatePassword(replacement);
    var row = db.one("select password_hash from app_user where id=?", id);
    if (!passwords.matches(current, row.get("passwordHash").toString()))
      throw ApiException.bad("Current password is incorrect / 当前密码错误");
    db.update(
        "update app_user set password_hash=?,session_version=session_version+1 where id=?",
        passwords.encode(replacement),
        id);
  }

  @Transactional
  Map<String, Object> createUser(String email, String name, String password, String role) {
    db.lock();
    email = normalizeEmail(email);
    validateName(name);
    validatePassword(password);
    validateRole(role);
    if (db.count("select count(*) from app_user where email=?", email) > 0)
      throw ApiException.conflict("EMAIL_EXISTS", "Email is already registered / 邮箱已注册");
    long id =
        db.insert(
            "insert into app_user(email,display_name,password_hash,role,email_verified)"
                + " values(?,?,?,?,true) returning id",
            email,
            name.strip(),
            passwords.encode(password),
            role);
    audit("USER_CREATE", Long.toString(id), role);
    return me(id);
  }

  @Transactional
  Map<String, Object> updateUser(long id, Boolean enabled, String role, String name) {
    db.lock();
    var old = me(id);
    if (role != null) validateRole(role);
    if (name != null) validateName(name);
    boolean nextEnabled = enabled == null ? (Boolean) old.get("enabled") : enabled;
    String nextRole = role == null ? old.get("role").toString() : role;
    if ("ADMIN".equals(old.get("role"))
        && Boolean.TRUE.equals(old.get("enabled"))
        && (!nextEnabled || !"ADMIN".equals(nextRole))
        && db.count("select count(*) from app_user where role='ADMIN' and enabled=true") <= 1)
      throw ApiException.conflict(
          "LAST_ADMIN", "Keep at least one enabled administrator / 至少保留一位有效管理员");
    db.update(
        "update app_user set enabled=?,role=?,display_name=?,session_version=session_version+1"
            + " where id=?",
        nextEnabled,
        nextRole,
        name == null ? old.get("displayName") : name.strip(),
        id);
    if (!nextEnabled) {
      var reservations =
          db.rows(
              "select * from reservation where reader_id=? and status in ('WAITING','READY')", id);
      db.update(
          "update reservation set status='CANCELLED' where reader_id=? and status in"
              + " ('WAITING','READY')",
          id);
      reservations.forEach(
          r ->
              notices.notify(
                  id,
                  "reservation-cancelled:" + r.get("id"),
                  "Reservation cancelled / 预约已取消",
                  "Your account was disabled / 账号已停用",
                  "RESERVATION_CANCELLED"));
      reservations.stream()
          .map(r -> ((Number) r.get("bookId")).longValue())
          .distinct()
          .forEach(queue::advance);
    }
    audit("USER_UPDATE", Long.toString(id), "enabled=" + nextEnabled + ",role=" + nextRole);
    return me(id);
  }

  void audit(String action, String target, String detail) {
    var user = SecurityConfig.optionalUser();
    db.update(
        "insert into audit_log(actor_id,action,target,detail,created_at) values(?,?,?,?,?)",
        user == null ? null : user.id(),
        action,
        target,
        detail,
        clock.instant());
  }

  private void ensureMail() {
    if (!settings.mailEnabled)
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "MAIL_NOT_CONFIGURED",
          "Email delivery is not configured / 尚未配置邮件投递");
  }

  static String normalizeEmail(String email) {
    if (email == null || email.length() > 254 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))
      throw ApiException.bad("Invalid email / 邮箱格式无效");
    return email.strip().toLowerCase(Locale.ROOT);
  }

  static void validatePassword(String password) {
    if (password == null
        || password.length() < 10
        || password.length() > 72
        || password.getBytes(StandardCharsets.UTF_8).length > 72)
      throw ApiException.bad("Password must be 10–72 bytes / 密码长度须为 10–72 字节");
  }

  static void validateName(String name) {
    if (name == null || name.isBlank() || name.length() > 80)
      throw ApiException.bad("Name is required (maximum 80 characters) / 请填写姓名，最多 80 字符");
  }

  static void validateRole(String role) {
    if (!Set.of("ADMIN", "READER").contains(role)) throw ApiException.bad("Invalid role / 角色无效");
  }

  static String hash(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}

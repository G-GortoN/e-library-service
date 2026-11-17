package dev.elibrary;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.nio.file.*;
import java.time.Clock;
import java.util.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
@Validated
public class LibraryController {
  record Login(@NotBlank String email, @NotBlank String password) {}

  record Register(
      @NotBlank String email, @NotBlank String displayName, @NotBlank String password) {}

  record Email(@NotBlank String email) {}

  record Token(@NotBlank String token) {}

  record Reset(@NotBlank String token, @NotBlank String password) {}

  record Profile(@NotBlank String displayName) {}

  record Password(@NotBlank String currentPassword, @NotBlank String newPassword) {}

  record BookInput(
      @NotBlank String title,
      @NotBlank String author,
      String isbn,
      String description,
      @NotBlank String category) {}

  record BookId(@NotNull @Positive Long bookId) {}

  record Status(@NotBlank String status) {}

  record CreateUser(
      @NotBlank String email,
      @NotBlank String displayName,
      @NotBlank String password,
      @NotBlank String role) {}

  record UpdateUser(Boolean enabled, String role, String displayName) {}

  record Adjustment(@NotNull @Positive Long amountMinor, @NotBlank String reason) {}

  private final IdentityService identity;
  private final CatalogService catalog;
  private final LendingService lending;
  private final Store db;
  private final RateLimits rate;
  private final Settings settings;
  private final Clock clock;
  private final HttpSessionSecurityContextRepository contexts;
  private final HttpSessionCsrfTokenRepository csrf;

  LibraryController(
      IdentityService identity,
      CatalogService catalog,
      LendingService lending,
      Store db,
      RateLimits rate,
      Settings settings,
      Clock clock,
      HttpSessionSecurityContextRepository contexts,
      HttpSessionCsrfTokenRepository csrf) {
    this.identity = identity;
    this.catalog = catalog;
    this.lending = lending;
    this.db = db;
    this.rate = rate;
    this.settings = settings;
    this.clock = clock;
    this.contexts = contexts;
    this.csrf = csrf;
  }

  @GetMapping("/health")
  Map<String, Object> health() {
    return Map.of("status", "UP");
  }

  @GetMapping("/auth/csrf")
  Map<String, Object> csrf(HttpServletRequest request) {
    var token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/auth/me")
  Map<String, Object> me() {
    return identity.me(SecurityConfig.user().id());
  }

  @PostMapping("/auth/login")
  Map<String, Object> login(
      @Valid @RequestBody Login input, HttpServletRequest req, HttpServletResponse res) {
    rate.check("login:" + req.getRemoteAddr(), 20);
    var row = identity.credentials(input.email(), input.password());
    var principal =
        new SecurityConfig.SessionUser(
            Store.id(row),
            row.get("email").toString(),
            row.get("role").toString(),
            ((Number) row.get("sessionVersion")).longValue());
    var authentication =
        UsernamePasswordAuthenticationToken.authenticated(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
    new ChangeSessionIdAuthenticationStrategy().onAuthentication(authentication, req, res);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, req, res);
    csrf.saveToken(null, req, res);
    return identity.me(principal.id());
  }

  @PostMapping("/auth/logout")
  ResponseEntity<Void> logout(HttpServletRequest req, HttpServletResponse res) {
    var s = req.getSession(false);
    if (s != null) s.invalidate();
    SecurityContextHolder.clearContext();
    csrf.saveToken(null, req, res);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/auth/register")
  ResponseEntity<?> register(@Valid @RequestBody Register input, HttpServletRequest req) {
    rate.check("register:" + req.getRemoteAddr(), 5);
    identity.register(input.email(), input.displayName(), input.password());
    return ResponseEntity.accepted()
        .body(Map.of("message", "If eligible, follow the account setup email / 如可操作，请按账号设置邮件继续"));
  }

  @PostMapping("/auth/verify-email")
  Map<String, Object> verify(@Valid @RequestBody Token input, HttpServletRequest req) {
    rate.check("token:" + req.getRemoteAddr(), 20);
    identity.verify(input.token());
    return Map.of("message", "Email verified / 邮箱验证成功");
  }

  @PostMapping("/auth/password-reset-requests")
  ResponseEntity<?> resetRequest(@Valid @RequestBody Email input, HttpServletRequest req) {
    rate.check("reset:" + req.getRemoteAddr(), 5);
    identity.resetRequest(input.email());
    return ResponseEntity.accepted()
        .body(Map.of("message", "If eligible, a reset email will arrive / 如账号有效，将收到重置邮件"));
  }

  @PostMapping("/auth/password-resets")
  ResponseEntity<Void> reset(@Valid @RequestBody Reset input, HttpServletRequest req) {
    rate.check("token:" + req.getRemoteAddr(), 20);
    identity.reset(input.token(), input.password());
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/me")
  Map<String, Object> profile(@Valid @RequestBody Profile input) {
    return identity.profile(SecurityConfig.user().id(), input.displayName());
  }

  @PostMapping("/me/password")
  ResponseEntity<Void> password(@Valid @RequestBody Password input) {
    identity.changePassword(
        SecurityConfig.user().id(), input.currentPassword(), input.newPassword());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/books")
  Map<String, Object> books(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) String category,
      @RequestParam(defaultValue = "false") boolean availableOnly,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "12") int size) {
    return catalog.list(q, category, availableOnly, page, size, false);
  }

  @GetMapping("/books/{id}")
  Map<String, Object> book(@PathVariable @Positive long id) {
    return catalog.detail(id, false);
  }

  @GetMapping("/categories")
  List<String> categories() {
    return catalog.categories();
  }

  @GetMapping("/recommendations")
  List<Map<String, Object>> recommendations() {
    return catalog.recommendations();
  }

  @PostMapping("/loans")
  ResponseEntity<?> borrow(@Valid @RequestBody BookId input) {
    var loan = lending.borrow(SecurityConfig.user().id(), input.bookId());
    return ResponseEntity.created(java.net.URI.create("/api/v1/me/loans")).body(loan);
  }

  @GetMapping("/me/loans")
  List<Map<String, Object>> loans(@RequestParam(defaultValue = "false") boolean history) {
    return lending.loans(SecurityConfig.user().id(), history);
  }

  @GetMapping("/me/loans/history")
  List<Map<String, Object>> history() {
    return lending.loans(SecurityConfig.user().id(), true);
  }

  @PutMapping("/loans/{id}/return")
  ResponseEntity<Void> returnLoan(@PathVariable @Positive long id) {
    lending.returnLoan(id, SecurityConfig.user().id(), false);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/loans/{id}/renewals")
  Map<String, Object> renew(@PathVariable @Positive long id) {
    return lending.renew(id, SecurityConfig.user().id());
  }

  @PostMapping("/reservations")
  ResponseEntity<?> reserve(@Valid @RequestBody BookId input) {
    var reservation = lending.reserve(SecurityConfig.user().id(), input.bookId());
    return ResponseEntity.status(201).body(reservation);
  }

  @DeleteMapping("/reservations/{id}")
  ResponseEntity<Void> cancel(@PathVariable @Positive long id) {
    lending.cancelReservation(id, SecurityConfig.user().id());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me/reservations")
  List<Map<String, Object>> reservations() {
    return lending.reservations(SecurityConfig.user().id());
  }

  @GetMapping("/me/notifications")
  List<Map<String, Object>> notifications() {
    return db.rows(
        "select id,title,body,type,is_read as read,created_at from notification where reader_id=?"
            + " order by created_at desc,id desc limit 100",
        SecurityConfig.user().id());
  }

  @PutMapping("/notifications/{id}/read")
  ResponseEntity<Void> read(@PathVariable @Positive long id) {
    if (db.update(
            "update notification set is_read=true where id=? and reader_id=?",
            id,
            SecurityConfig.user().id())
        != 1) throw ApiException.missing();
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me/fines")
  List<Map<String, Object>> fines() {
    return lending.fines(SecurityConfig.user().id());
  }

  @GetMapping("/admin/stats")
  Map<String, Object> stats() {
    return Map.of(
        "books",
        db.count("select count(*) from book"),
        "users",
        db.count("select count(*) from app_user"),
        "activeLoans",
        db.count("select count(*) from loan where returned_at is null"),
        "overdueLoans",
        db.count(
            "select count(*) from loan where returned_at is null and due_at<?", clock.instant()),
        "reservations",
        db.count("select count(*) from reservation where status in ('WAITING','READY')"),
        "outstandingFineMinor",
        db.count(
            "select coalesce(sum(amount_minor-waived_minor),0) from fine where status='OPEN'"));
  }

  @GetMapping("/admin/books")
  Map<String, Object> adminBooks(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) String category,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return catalog.list(q, category, false, page, size, true);
  }

  @PostMapping("/admin/books")
  @ResponseStatus(HttpStatus.CREATED)
  Map<String, Object> createBook(@Valid @RequestBody BookInput i) {
    return catalog.save(null, i.title(), i.author(), i.isbn(), i.description(), i.category());
  }

  @PatchMapping("/admin/books/{id}")
  Map<String, Object> editBook(@PathVariable @Positive long id, @Valid @RequestBody BookInput i) {
    return catalog.save(id, i.title(), i.author(), i.isbn(), i.description(), i.category());
  }

  @PutMapping("/admin/books/{id}/status")
  Map<String, Object> bookStatus(@PathVariable @Positive long id, @Valid @RequestBody Status i) {
    return catalog.status(id, i.status());
  }

  @PostMapping(value = "/admin/books/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  Map<String, Object> cover(@PathVariable @Positive long id, @RequestParam MultipartFile file) {
    return catalog.cover(id, file);
  }

  @PostMapping(value = "/admin/books/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  Map<String, Object> importBooks(
      @RequestParam(defaultValue = "true") boolean dryRun, @RequestParam MultipartFile file) {
    return catalog.importBooks(file, dryRun);
  }

  @GetMapping("/media/{name}")
  ResponseEntity<FileSystemResource> media(@PathVariable String name) throws IOException {
    if (!name.matches("[a-f0-9-]{36}\\.png")) throw ApiException.missing();
    Path root = Path.of(settings.mediaDirectory).toAbsolutePath().normalize();
    Path file = root.resolve(name).normalize();
    if (!file.startsWith(root) || !Files.isRegularFile(file) || Files.isSymbolicLink(file))
      throw ApiException.missing();
    return ResponseEntity.ok()
        .contentType(MediaType.IMAGE_PNG)
        .header("X-Content-Type-Options", "nosniff")
        .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(7)))
        .body(new FileSystemResource(file));
  }

  @GetMapping("/admin/users")
  Map<String, Object> users(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    page = Store.page(page);
    size = Store.size(size);
    String match = "%" + q.toLowerCase(Locale.ROOT) + "%";
    return Store.page(
        db.rows(
            "select "
                + IdentityService.USER_COLUMNS
                + " from app_user where lower(email) like ? or lower(display_name) like ? order by"
                + " id desc limit ? offset ?",
            match,
            match,
            size,
            page * size),
        db.count(
            "select count(*) from app_user where lower(email) like ? or lower(display_name) like ?",
            match,
            match),
        page,
        size);
  }

  @PostMapping("/admin/users")
  @ResponseStatus(HttpStatus.CREATED)
  Map<String, Object> createUser(@Valid @RequestBody CreateUser i) {
    return identity.createUser(i.email(), i.displayName(), i.password(), i.role());
  }

  @PatchMapping("/admin/users/{id}")
  Map<String, Object> updateUser(@PathVariable @Positive long id, @RequestBody UpdateUser i) {
    return identity.updateUser(id, i.enabled(), i.role(), i.displayName());
  }

  @PostMapping("/admin/users/{id}/password-reset")
  ResponseEntity<?> adminReset(@PathVariable @Positive long id) {
    identity.resetRequest(identity.me(id).get("email").toString());
    return ResponseEntity.accepted().body(Map.of("message", "Reset requested / 已请求重置"));
  }

  @GetMapping("/admin/loans")
  Map<String, Object> allLoans(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    page = Store.page(page);
    size = Store.size(size);
    return Store.page(
        db.rows(
            LendingService.ADMIN_LOAN_VIEW + " order by l.id desc limit ? offset ?",
            clock.instant(),
            size,
            page * size),
        db.count("select count(*) from loan"),
        page,
        size);
  }

  @PutMapping("/admin/loans/{id}/return")
  ResponseEntity<Void> adminReturn(@PathVariable @Positive long id) {
    lending.returnLoan(id, SecurityConfig.user().id(), true);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/admin/reservations")
  Map<String, Object> allReservations(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    page = Store.page(page);
    size = Store.size(size);
    return Store.page(
        db.rows(
            LendingService.ADMIN_RESERVATION_VIEW + " order by r.id desc limit ? offset ?",
            size,
            page * size),
        db.count("select count(*) from reservation"),
        page,
        size);
  }

  @GetMapping("/admin/fines")
  Map<String, Object> allFines(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    page = Store.page(page);
    size = Store.size(size);
    return Store.page(
        db.rows(
            LendingService.ADMIN_FINE_VIEW + " order by f.id desc limit ? offset ?",
            size,
            page * size),
        db.count("select count(*) from fine"),
        page,
        size);
  }

  @PostMapping("/admin/fines/{id}/adjustments")
  Map<String, Object> adjustment(
      @PathVariable @Positive long id, @Valid @RequestBody Adjustment i) {
    return lending.adjust(id, i.amountMinor(), i.reason(), false);
  }

  @PostMapping("/admin/fines/{id}/settle")
  Map<String, Object> settle(@PathVariable @Positive long id) {
    return lending.adjust(id, 0, "", true);
  }

  @GetMapping("/admin/audit")
  Map<String, Object> audit(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    page = Store.page(page);
    size = Store.size(size);
    return Store.page(
        db.rows(
            "select a.id,coalesce(u.display_name,'System') as"
                + " actor,a.action,a.target,a.detail,a.created_at from audit_log a left join"
                + " app_user u on u.id=a.actor_id order by a.id desc limit ? offset ?",
            size,
            page * size),
        db.count("select count(*) from audit_log"),
        page,
        size);
  }
}

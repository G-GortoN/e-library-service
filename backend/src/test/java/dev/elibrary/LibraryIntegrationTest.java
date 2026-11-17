package dev.elibrary;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.mail.*;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "app.seed-demo=false",
      "app.admin-email=",
      "app.admin-password=",
      "app.scheduling-enabled=false",
      "app.mail-enabled=true",
      "app.public-base-url=https://primary.library.example",
      "app.public-backup-base-url=https://backup.library.example/",
      "server.servlet.session.cookie.secure=false"
    })
@Import(LibraryIntegrationTest.TestBeans.class)
class LibraryIntegrationTest {
  static PostgreSQLContainer postgres;

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    String external = System.getenv("ELIB_TEST_DATABASE_URL");
    if (external != null && !external.isBlank()) {
      registry.add("spring.datasource.url", () -> external);
      registry.add(
          "spring.datasource.username",
          () -> System.getenv().getOrDefault("ELIB_TEST_DATABASE_USERNAME", "elibrary"));
      registry.add(
          "spring.datasource.password",
          () -> System.getenv().getOrDefault("ELIB_TEST_DATABASE_PASSWORD", ""));
    } else {
      postgres = new PostgreSQLContainer("postgres:17-alpine");
      postgres.start();
      registry.add("spring.datasource.url", postgres::getJdbcUrl);
      registry.add("spring.datasource.username", postgres::getUsername);
      registry.add("spring.datasource.password", postgres::getPassword);
    }
  }

  static class MutableClock extends Clock {
    AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2030-01-01T00:00:00Z"));

    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    public Clock withZone(ZoneId zone) {
      return this;
    }

    public Instant instant() {
      return now.get();
    }

    void advance(Duration duration) {
      now.updateAndGet(t -> t.plus(duration));
    }
  }

  @TestConfiguration
  static class TestBeans {
    @Bean
    @Primary
    MutableClock testClock() {
      return new MutableClock();
    }

    @Bean
    @Primary
    RateLimits integrationRateLimits() {
      return mock(RateLimits.class);
    }

    @Bean
    @Primary
    JavaMailSender testMail() {
      return mock(JavaMailSender.class);
    }
  }

  @LocalServerPort int port;
  @Autowired Store db;
  @Autowired PasswordEncoder passwords;
  @Autowired MutableClock clock;
  @Autowired NotificationService notifications;
  @Autowired LendingService lending;
  @Autowired JavaMailSender mail;
  final JsonMapper json = JsonMapper.builder().build();
  long reader1, reader2, admin;

  @BeforeEach
  void clean() {
    db.jdbc.execute(
        "truncate"
            + " audit_log,fine_adjustment,fine,account_token,email_delivery,notification,reservation,loan,book,app_user"
            + " restart identity cascade");
    clock.now.set(Instant.parse("2030-01-01T00:00:00Z"));
    reset(mail);
    String hash = passwords.encode("TestPassword2026!");
    reader1 = user("one@example.com", "READER", hash);
    reader2 = user("two@example.com", "READER", hash);
    admin = user("admin@example.com", "ADMIN", hash);
  }

  long user(String email, String role, String hash) {
    return db.insert(
        "insert into app_user(email,display_name,password_hash,role,email_verified)"
            + " values(?,?,?,?,true) returning id",
        email,
        email,
        hash,
        role);
  }

  long book() {
    return db.insert(
        "insert into book(title,author,category,status,published_at) values('A Book','An"
            + " Author','文学','PUBLISHED',?) returning id",
        clock.instant());
  }

  class Client {
    HttpClient http =
        HttpClient.newBuilder()
            .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
            .build();

    HttpResponse<String> raw(String method, String path, Object body, Map<String, String> headers)
        throws Exception {
      var request =
          HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1" + path))
              .timeout(Duration.ofSeconds(20));
      headers.forEach(request::header);
      if (body != null) request.header("Content-Type", "application/json");
      request.method(
          method,
          body == null
              ? HttpRequest.BodyPublishers.noBody()
              : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
      return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> get(String path) throws Exception {
      return raw("GET", path, null, Map.of());
    }

    HttpResponse<String> send(String method, String path, Object body) throws Exception {
      var token = json.readTree(get("/auth/csrf").body());
      return raw(
          method,
          path,
          body,
          Map.of(token.get("headerName").asText(), token.get("token").asText()));
    }

    HttpResponse<String> multipart(String path, String filename, String type, byte[] bytes)
        throws Exception {
      var token = json.readTree(get("/auth/csrf").body());
      String boundary = "LibraryTestBoundary";
      var payload = new java.io.ByteArrayOutputStream();
      payload.writeBytes(
          ("--"
                  + boundary
                  + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\""
                  + filename
                  + "\"\r\nContent-Type: "
                  + type
                  + "\r\n\r\n")
              .getBytes(java.nio.charset.StandardCharsets.UTF_8));
      payload.writeBytes(bytes);
      payload.writeBytes(
          ("\r\n--" + boundary + "--\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
      var request =
          HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1" + path))
              .header(token.get("headerName").asText(), token.get("token").asText())
              .header("Content-Type", "multipart/form-data; boundary=" + boundary)
              .POST(HttpRequest.BodyPublishers.ofByteArray(payload.toByteArray()))
              .build();
      return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    Client login(String email) throws Exception {
      var result =
          send("POST", "/auth/login", Map.of("email", email, "password", "TestPassword2026!"));
      assertEquals(200, result.statusCode(), result.body());
      return this;
    }
  }

  JsonNode body(HttpResponse<String> response) {
    return json.readTree(response.body());
  }

  @Test
  void csrfIdentityAndRoleBoundaries() throws Exception {
    var visitor = new Client();
    for (String path :
        List.of(
            "/api/docs",
            "/api/swagger-ui/swagger-ui.css",
            "/api/swagger-ui/swagger-ui-bundle.js")) {
      var response =
          visitor.http.send(
              HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(200, response.statusCode(), path);
    }
    assertEquals(401, visitor.get("/me/loans").statusCode());
    assertEquals(
        403, visitor.raw("POST", "/loans", Map.of("bookId", book()), Map.of()).statusCode());
    var reader = new Client().login("one@example.com");
    assertEquals(403, reader.get("/admin/users").statusCode());
    assertEquals("one@example.com", body(reader.get("/auth/me")).get("email").asText());
    assertEquals(400, reader.send("POST", "/loans", Map.of("bookId", 1.5)).statusCode());
  }

  @Test
  void concurrentBorrowAndFifoReservation() throws Exception {
    long book = book();
    var a = new Client().login("one@example.com");
    var b = new Client().login("two@example.com");
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first =
          executor.submit(
              () -> {
                start.await();
                return a.send("POST", "/loans", Map.of("bookId", book));
              });
      var second =
          executor.submit(
              () -> {
                start.await();
                return b.send("POST", "/loans", Map.of("bookId", book));
              });
      start.countDown();
      var ra = first.get();
      var rb = second.get();
      assertEquals(
          List.of(201, 409),
          java.util.stream.Stream.of(ra.statusCode(), rb.statusCode()).sorted().toList());
      assertEquals(1, db.count("select count(*) from loan where returned_at is null"));
      var winner = ra.statusCode() == 201 ? a : b;
      var waiting = ra.statusCode() == 201 ? b : a;
      long loan = body(ra.statusCode() == 201 ? ra : rb).get("id").asLong();
      assertEquals(404, waiting.send("PUT", "/loans/" + loan + "/return", null).statusCode());
      assertEquals(201, waiting.send("POST", "/reservations", Map.of("bookId", book)).statusCode());
      assertEquals(409, winner.send("POST", "/loans/" + loan + "/renewals", null).statusCode());
      assertEquals(204, winner.send("PUT", "/loans/" + loan + "/return", null).statusCode());
      assertEquals(204, winner.send("PUT", "/loans/" + loan + "/return", null).statusCode());
      assertEquals(409, winner.send("POST", "/loans", Map.of("bookId", book)).statusCode());
      assertEquals(201, waiting.send("POST", "/loans", Map.of("bookId", book)).statusCode());
    }
  }

  @Test
  void limitsAndRenewalAreEnforced() throws Exception {
    var a = new Client().login("one@example.com");
    long firstLoan = 0;
    for (int i = 0; i < 5; i++) {
      var response = a.send("POST", "/loans", Map.of("bookId", book()));
      assertEquals(201, response.statusCode(), response.body());
      if (i == 0) firstLoan = body(response).get("id").asLong();
    }
    assertEquals(409, a.send("POST", "/loans", Map.of("bookId", book())).statusCode());
    var renewed = a.send("POST", "/loans/" + firstLoan + "/renewals", null);
    assertEquals(200, renewed.statusCode());
    assertEquals(1, body(renewed).get("renewalCount").asInt());
    assertEquals("2030-01-22T00:00:00Z", body(renewed).get("dueAt").asText());
    assertEquals(409, a.send("POST", "/loans/" + firstLoan + "/renewals", null).statusCode());
  }

  @Test
  void unpublishKeepsExistingLoanAndReturnWorks() throws Exception {
    long book = book();
    var reader = new Client().login("one@example.com");
    var manager = new Client().login("admin@example.com");
    long loan = body(reader.send("POST", "/loans", Map.of("bookId", book))).get("id").asLong();
    assertEquals(
        200,
        manager
            .send("PUT", "/admin/books/" + book + "/status", Map.of("status", "UNPUBLISHED"))
            .statusCode());
    assertEquals(0, body(new Client().get("/books")).get("total").asLong());
    assertEquals(200, reader.get("/books/" + book).statusCode());
    assertEquals(409, reader.send("POST", "/loans/" + loan + "/renewals", null).statusCode());
    assertEquals(204, reader.send("PUT", "/loans/" + loan + "/return", null).statusCode());
    assertEquals(1, body(reader.get("/me/loans?history=true")).size());
  }

  @Test
  void disablingInvalidatesExistingSessionAndProtectsLastAdmin() throws Exception {
    var reader = new Client().login("one@example.com");
    var manager = new Client().login("admin@example.com");
    assertEquals(
        409, manager.send("PATCH", "/admin/users/" + admin, Map.of("enabled", false)).statusCode());
    assertEquals(
        200,
        manager.send("PATCH", "/admin/users/" + reader1, Map.of("enabled", false)).statusCode());
    assertEquals(401, reader.get("/me/loans").statusCode());
  }

  @Test
  void expiryAdvancesQueueAndDoesNotDuplicateNotices() throws Exception {
    long book = book();
    var a = new Client().login("one@example.com");
    var b = new Client().login("two@example.com");
    var manager = new Client().login("admin@example.com");
    long loan = body(a.send("POST", "/loans", Map.of("bookId", book))).get("id").asLong();
    assertEquals(201, b.send("POST", "/reservations", Map.of("bookId", book)).statusCode());
    assertEquals(201, manager.send("POST", "/reservations", Map.of("bookId", book)).statusCode());
    a.send("PUT", "/loans/" + loan + "/return", null);
    clock.advance(Duration.ofHours(49));
    lending.tick();
    lending.tick();
    assertEquals(
        "EXPIRED",
        db.one("select status from reservation where reader_id=?", reader2).get("status"));
    assertEquals(
        "READY", db.one("select status from reservation where reader_id=?", admin).get("status"));
    assertEquals(
        1,
        db.count(
            "select count(*) from notification where reader_id=? and type='RESERVATION_READY'",
            admin));
  }

  @Test
  void overdueAmountsFreezeAndSettlementIsDemonstrationOnly() throws Exception {
    long book = book();
    var reader = new Client().login("one@example.com");
    var manager = new Client().login("admin@example.com");
    long loan = body(reader.send("POST", "/loans", Map.of("bookId", book))).get("id").asLong();
    clock.advance(Duration.ofDays(16).plusHours(12));
    var fines = body(reader.get("/me/fines"));
    assertEquals(20, fines.get(0).get("amountMinor").asInt());
    long fine = fines.get(0).get("id").asLong();
    assertEquals(409, manager.send("POST", "/admin/fines/" + fine + "/settle", null).statusCode());
    reader.send("PUT", "/loans/" + loan + "/return", null);
    clock.advance(Duration.ofDays(30));
    reader.send("PUT", "/loans/" + loan + "/return", null);
    assertEquals(20, body(reader.get("/me/fines")).get(0).get("amountMinor").asInt());
    assertEquals(
        200,
        manager
            .send(
                "POST",
                "/admin/fines/" + fine + "/adjustments",
                Map.of("amountMinor", 10, "reason", "Demo waiver"))
            .statusCode());
    assertEquals(200, manager.send("POST", "/admin/fines/" + fine + "/settle", null).statusCode());
    assertEquals("SETTLED", db.one("select status from fine where id=?", fine).get("status"));
    assertEquals(1, db.count("select count(*) from fine_adjustment"));
  }

  @Test
  void adminListsIdentifyReadersWithoutChangingReaderResponses() throws Exception {
    long book = book();
    var reader = new Client().login("one@example.com");
    var manager = new Client().login("admin@example.com");
    reader.send("POST", "/loans", Map.of("bookId", book));
    var own = body(reader.get("/me/loans")).get(0);
    assertFalse(own.has("readerEmail"));
    var adminLoan = body(manager.get("/admin/loans")).get("items").get(0);
    assertEquals(reader1, adminLoan.get("readerId").asLong());
    assertEquals("one@example.com", adminLoan.get("readerEmail").asText());
    var another = new Client().login("two@example.com");
    another.send("POST", "/reservations", Map.of("bookId", book));
    assertEquals(
        "two@example.com",
        body(manager.get("/admin/reservations")).get("items").get(0).get("readerEmail").asText());
    clock.advance(Duration.ofDays(16));
    reader.get("/me/fines");
    assertEquals(
        "one@example.com",
        body(manager.get("/admin/fines")).get("items").get(0).get("readerEmail").asText());
  }

  @Test
  void verificationAndPasswordRecoveryAreSingleUse() throws Exception {
    var visitor = new Client();
    var registration =
        visitor.send(
            "POST",
            "/auth/register",
            Map.of(
                "email",
                "new@example.com",
                "displayName",
                "New Reader",
                "password",
                "TestPassword2026!"));
    assertEquals(202, registration.statusCode(), registration.body());
    String verify = tokenFromOutbox("Verify%");
    assertEquals(
        200, visitor.send("POST", "/auth/verify-email", Map.of("token", verify)).statusCode());
    assertEquals(
        400, visitor.send("POST", "/auth/verify-email", Map.of("token", verify)).statusCode());
    var logged = new Client().login("new@example.com");
    assertEquals(
        202,
        visitor
            .send("POST", "/auth/password-reset-requests", Map.of("email", "new@example.com"))
            .statusCode());
    String reset = tokenFromOutbox("Reset%");
    assertEquals(
        204,
        visitor
            .send(
                "POST",
                "/auth/password-resets",
                Map.of("token", reset, "password", "Replacement2026!"))
            .statusCode());
    assertEquals(
        400,
        visitor
            .send(
                "POST",
                "/auth/password-resets",
                Map.of("token", reset, "password", "Replacement2026!"))
            .statusCode());
    assertEquals(401, logged.get("/auth/me").statusCode());
  }

  @Test
  void repeatedPendingRegistrationRequiresMailboxOwnerToChooseFreshPassword() throws Exception {
    var visitor = new Client();
    String email = "pending@example.com";
    var first =
        visitor.send(
            "POST",
            "/auth/register",
            Map.of(
                "email", email, "displayName", "First request", "password", "Preregistered2026!"));
    assertEquals(202, first.statusCode());
    String oldVerification = tokenFromOutbox("Verify%");
    String originalHash =
        db.one("select password_hash from app_user where email=?", email)
            .get("passwordHash")
            .toString();
    var repeated =
        visitor.send(
            "POST",
            "/auth/register",
            Map.of(
                "email", email, "displayName", "Mailbox owner", "password", "RepeatedForm2026!"));
    assertEquals(202, repeated.statusCode());
    assertEquals(first.body(), repeated.body());
    assertEquals(
        originalHash,
        db.one("select password_hash from app_user where email=?", email).get("passwordHash"));
    assertEquals(
        0,
        db.count("select count(*) from account_token where purpose='VERIFY' and used_at is null"));
    assertEquals(
        400,
        visitor.send("POST", "/auth/verify-email", Map.of("token", oldVerification)).statusCode());
    assertEquals(
        Boolean.FALSE,
        db.one("select email_verified from app_user where email=?", email).get("emailVerified"));
    String recovery = tokenFromOutbox("Reset%");
    assertEquals(
        204,
        visitor
            .send(
                "POST",
                "/auth/password-resets",
                Map.of("token", recovery, "password", "MailboxChosen2026!"))
            .statusCode());
    for (String rejected : List.of("Preregistered2026!", "RepeatedForm2026!"))
      assertEquals(
          401,
          new Client()
              .send("POST", "/auth/login", Map.of("email", email, "password", rejected))
              .statusCode());
    assertEquals(
        200,
        new Client()
            .send("POST", "/auth/login", Map.of("email", email, "password", "MailboxChosen2026!"))
            .statusCode());
    assertEquals(
        400,
        visitor
            .send(
                "POST",
                "/auth/password-resets",
                Map.of("token", recovery, "password", "DifferentAgain2026!"))
            .statusCode());
  }

  @Test
  void disabledOrVerifiedRegistrationDoesNotIssueNewSetupTokens() throws Exception {
    var visitor = new Client();
    String email = "disabled-pending@example.com";
    var initial =
        visitor.send(
            "POST",
            "/auth/register",
            Map.of("email", email, "displayName", "Pending", "password", "Preregistered2026!"));
    assertEquals(202, initial.statusCode());
    db.update("update app_user set enabled=false where email=?", email);
    long tokens = db.count("select count(*) from account_token");
    long deliveries = db.count("select count(*) from email_delivery");
    for (String address : List.of(email, "one@example.com")) {
      var repeated =
          visitor.send(
              "POST",
              "/auth/register",
              Map.of("email", address, "displayName", "Repeated", "password", "RepeatedForm2026!"));
      assertEquals(202, repeated.statusCode());
      assertEquals(initial.body(), repeated.body());
    }
    assertEquals(tokens, db.count("select count(*) from account_token"));
    assertEquals(deliveries, db.count("select count(*) from email_delivery"));
  }

  String tokenFromOutbox(String subject) {
    String content =
        db.one(
                "select body from email_delivery where subject like ? order by id desc limit 1",
                subject)
            .get("body")
            .toString();
    return content.split("token=")[1].split("\\s")[0];
  }

  @Test
  void deliveryFailureRetriesWithoutLosingPersistentState() throws Exception {
    var visitor = new Client();
    visitor.send(
        "POST",
        "/auth/register",
        Map.of(
            "email",
            "new@example.com",
            "displayName",
            "New Reader",
            "password",
            "TestPassword2026!"));
    doThrow(new MailSendException("offline")).when(mail).send(any(SimpleMailMessage.class));
    notifications.deliverPending();
    assertEquals(1, db.one("select attempts from email_delivery").get("attempts"));
    assertEquals("PENDING", db.one("select status from email_delivery").get("status"));
    reset(mail);
    clock.advance(Duration.ofMinutes(3));
    notifications.deliverPending();
    assertEquals("SENT", db.one("select status from email_delivery").get("status"));
    assertEquals(
        "[redacted after delivery]", db.one("select body from email_delivery").get("body"));
  }

  @Test
  void disablingQueueHeadImmediatelyPromotesTheNextReader() throws Exception {
    long book = book();
    var a = new Client().login("one@example.com");
    var b = new Client().login("two@example.com");
    var manager = new Client().login("admin@example.com");
    long loan = body(a.send("POST", "/loans", Map.of("bookId", book))).get("id").asLong();
    b.send("POST", "/reservations", Map.of("bookId", book));
    manager.send("POST", "/reservations", Map.of("bookId", book));
    a.send("PUT", "/loans/" + loan + "/return", null);
    assertEquals(
        "READY", db.one("select status from reservation where reader_id=?", reader2).get("status"));
    assertEquals(
        200,
        manager.send("PATCH", "/admin/users/" + reader2, Map.of("enabled", false)).statusCode());
    assertEquals(
        "CANCELLED",
        db.one("select status from reservation where reader_id=?", reader2).get("status"));
    assertEquals(
        "READY", db.one("select status from reservation where reader_id=?", admin).get("status"));
  }

  @Test
  void resetLinksExpireAndTokensAreStoredAsHashes() throws Exception {
    var visitor = new Client();
    assertEquals(
        202,
        visitor
            .send("POST", "/auth/password-reset-requests", Map.of("email", "one@example.com"))
            .statusCode());
    String token = tokenFromOutbox("Reset%");
    String hash = db.one("select token_hash from account_token").get("tokenHash").toString();
    assertEquals(64, hash.length());
    assertNotEquals(token, hash);
    String emailBody = db.one("select body from email_delivery").get("body").toString();
    assertTrue(emailBody.contains("https://primary.library.example/reset-password?token=" + token));
    assertTrue(emailBody.contains("https://backup.library.example/reset-password?token=" + token));
    assertEquals(2, emailBody.split("token=", -1).length - 1);
    assertFalse(emailBody.contains("localhost"));
    clock.advance(Duration.ofMinutes(31));
    assertEquals(
        400,
        visitor
            .send(
                "POST",
                "/auth/password-resets",
                Map.of("token", token, "password", "Replacement2026!"))
            .statusCode());
  }

  @Test
  void csvPreviewAndImageUploadValidateActualContent() throws Exception {
    var manager = new Client().login("admin@example.com");
    assertEquals(
        400,
        manager
            .multipart(
                "/admin/books/import?dryRun=true",
                "bad.csv",
                "text/csv",
                new byte[] {(byte) 0xc3, (byte) 0x28})
            .statusCode());
    byte[] csv =
        "title,author,category,isbn\nImported Book,Writer,文学,IMPORT-1\n"
            .getBytes(java.nio.charset.StandardCharsets.UTF_8);
    var preview =
        manager.multipart("/admin/books/import?dryRun=true", "books.csv", "text/csv", csv);
    assertEquals(200, preview.statusCode(), preview.body());
    assertEquals(0, body(preview).get("imported").asInt());
    assertEquals(0, db.count("select count(*) from book"));
    assertEquals(
        1,
        body(manager.multipart("/admin/books/import?dryRun=false", "books.csv", "text/csv", csv))
            .get("imported")
            .asInt());
    var repeated =
        body(manager.multipart("/admin/books/import?dryRun=false", "books.csv", "text/csv", csv));
    assertEquals(0, repeated.get("imported").asInt());
    assertFalse(repeated.get("rows").get(0).get("valid").asBoolean());
    long id = ((Number) db.one("select id from book").get("id")).longValue();
    assertEquals(
        400,
        manager
            .multipart(
                "/admin/books/" + id + "/cover",
                "cover.png",
                "image/png",
                "not an image".getBytes())
            .statusCode());
    var bytes = new java.io.ByteArrayOutputStream();
    javax.imageio.ImageIO.write(
        new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB),
        "png",
        bytes);
    var uploaded =
        manager.multipart(
            "/admin/books/" + id + "/cover", "cover.png", "image/png", bytes.toByteArray());
    assertEquals(200, uploaded.statusCode(), uploaded.body());
    String url = body(uploaded).get("coverUrl").asText();
    assertTrue(url.matches("/api/v1/media/[a-f0-9-]{36}\\.png"));
    assertEquals(200, new Client().get(url.replace("/api/v1", "")).statusCode());
  }
}

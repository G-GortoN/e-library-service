package dev.elibrary;

import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.*;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.*;
import io.swagger.v3.oas.models.servers.Server;
import java.util.*;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class OpenApiConfig {
  private static Schema<?> text() {
    return new StringSchema();
  }

  private static Schema<?> number() {
    return new IntegerSchema().format("int64");
  }

  private static Schema<?> instant() {
    return new StringSchema().format("date-time");
  }

  private static Schema<?> ref(String name) {
    return new Schema<>().$ref("#/components/schemas/" + name);
  }

  private static Schema<?> array(String name) {
    return new ArraySchema().items(ref(name));
  }

  private static Schema<?> object(Object... fields) {
    var schema = new ObjectSchema();
    for (int i = 0; i < fields.length; i += 2)
      schema.addProperty((String) fields[i], (Schema<?>) fields[i + 1]);
    return schema;
  }

  private static Schema<?> page(String item) {
    return object("items", array(item), "total", number(), "page", number(), "size", number());
  }

  private static Schema<?> admin(String base) {
    return new ComposedSchema()
        .addAllOfItem(ref(base))
        .addAllOfItem(
            object(
                "readerId",
                number(),
                "readerName",
                text(),
                "readerEmail",
                new StringSchema().format("email")));
  }

  private static Components libraryComponents() {
    var schemas = new LinkedHashMap<String, Schema>();
    schemas.put(
        "User",
        object(
            "id",
            number(),
            "email",
            new StringSchema().format("email"),
            "displayName",
            text(),
            "role",
            new StringSchema()._enum(List.of("READER", "ADMIN")),
            "enabled",
            new BooleanSchema(),
            "emailVerified",
            new BooleanSchema()));
    schemas.put(
        "Book",
        object(
            "id",
            number(),
            "title",
            text(),
            "author",
            text(),
            "isbn",
            new StringSchema().nullable(true),
            "description",
            text(),
            "category",
            text(),
            "coverUrl",
            new StringSchema().nullable(true),
            "status",
            new StringSchema()._enum(List.of("DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED")),
            "available",
            new BooleanSchema(),
            "borrowCount",
            number(),
            "publishedAt",
            new StringSchema().format("date-time").nullable(true)));
    schemas.put(
        "Loan",
        object(
            "id",
            number(),
            "bookId",
            number(),
            "title",
            text(),
            "author",
            text(),
            "coverUrl",
            new StringSchema().nullable(true),
            "borrowedAt",
            instant(),
            "dueAt",
            instant(),
            "returnedAt",
            new StringSchema().format("date-time").nullable(true),
            "renewalCount",
            number(),
            "fineAmountMinor",
            number()));
    schemas.put(
        "Reservation",
        object(
            "id",
            number(),
            "bookId",
            number(),
            "title",
            text(),
            "coverUrl",
            new StringSchema().nullable(true),
            "status",
            new StringSchema()
                ._enum(List.of("WAITING", "READY", "CLAIMED", "CANCELLED", "EXPIRED")),
            "position",
            number(),
            "createdAt",
            instant(),
            "expiresAt",
            new StringSchema().format("date-time").nullable(true)));
    schemas.put(
        "Notification",
        object(
            "id",
            number(),
            "title",
            text(),
            "body",
            text(),
            "type",
            text(),
            "read",
            new BooleanSchema(),
            "createdAt",
            instant()));
    schemas.put(
        "Fine",
        object(
            "id",
            number(),
            "loanId",
            number(),
            "bookTitle",
            text(),
            "amountMinor",
            number(),
            "waivedMinor",
            number(),
            "status",
            new StringSchema()._enum(List.of("OPEN", "SETTLED", "WAIVED")),
            "createdAt",
            instant()));
    schemas.put(
        "Audit",
        object(
            "id",
            number(),
            "actor",
            text(),
            "action",
            text(),
            "target",
            text(),
            "detail",
            text(),
            "createdAt",
            instant()));
    schemas.put(
        "AdminStats",
        object(
            "books",
            number(),
            "users",
            number(),
            "activeLoans",
            number(),
            "overdueLoans",
            number(),
            "reservations",
            number(),
            "outstandingFineMinor",
            number()));
    schemas.put("Csrf", object("token", text(), "headerName", text()));
    schemas.put("Message", object("message", text()));
    schemas.put("Health", object("status", text()));
    schemas.put(
        "Problem",
        object(
            "type",
            text(),
            "title",
            text(),
            "status",
            number(),
            "detail",
            text(),
            "instance",
            text(),
            "code",
            text()));
    schemas.put(
        "ImportResult",
        object(
            "rows",
            new ArraySchema()
                .items(
                    object(
                        "row",
                        number(),
                        "valid",
                        new BooleanSchema(),
                        "errors",
                        new ArraySchema().items(text()))),
            "imported",
            number()));
    schemas.put(
        "Page",
        object(
            "items",
            new ArraySchema().items(new ObjectSchema()),
            "total",
            number(),
            "page",
            number(),
            "size",
            number()));
    for (String name : List.of("Book", "User", "Loan", "Reservation", "Fine", "Audit"))
      schemas.put(name + "Page", page(name));
    for (String name : List.of("Loan", "Reservation", "Fine")) {
      schemas.put("Admin" + name, admin(name));
      schemas.put("Admin" + name + "Page", page("Admin" + name));
    }
    var components =
        new Components()
            .schemas(schemas)
            .addSecuritySchemes(
                "sessionCookie",
                new SecurityScheme()
                    .type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.COOKIE)
                    .name("JSESSIONID")
                    .description(
                        "Sign in with /auth/login; browser sends its HttpOnly cookie automatically."
                            + " / 先调用登录接口，浏览器自动携带 HttpOnly Cookie。"));
    return components;
  }

  @Bean
  OpenAPI libraryApi() {
    return new OpenAPI()
        .openapi("3.0.3")
        .servers(List.of(new Server().url("/")))
        .components(new Components())
        .info(
            new Info()
                .title("E-Library Service / 电子图书馆 API")
                .version("0.1.0")
                .description(
                    "Use /api/docs for interactive calls. The local UI fetches a fresh CSRF token"
                        + " before each unsafe request. Log in with POST /api/v1/auth/login; admin"
                        + " routes require ADMIN. Money is integer minor units; settlement is"
                        + " demonstration-only. / 使用 /api/docs 交互调用；本地文档页面会在写请求前获取新"
                        + " CSRF。先调用登录接口，管理路由需要 ADMIN。金额为整数最小货币单位，结清只做演示。"));
  }

  @Bean
  OpenApiCustomizer documentedResponses() {
    return api -> {
      // springdoc prunes unreferenced definitions before OpenApiCustomizer runs. Install response
      // components in the same phase as their references, preserving generated request DTO schemas.
      if (api.getComponents() == null) api.setComponents(new Components());
      Components definitions = libraryComponents();
      definitions.getSchemas().forEach(api.getComponents()::addSchemas);
      definitions.getSecuritySchemes().forEach(api.getComponents()::addSecuritySchemes);
      if (api.getPaths() == null) return;
      for (var path : api.getPaths().entrySet())
        for (var operation : path.getValue().readOperationsMap().entrySet()) {
          var op = operation.getValue();
          String id =
              op.getOperationId() == null ? "" : op.getOperationId().replaceAll("_\\d+$", "");
          op.setSummary(SUMMARIES.getOrDefault(id, id + " / " + path.getKey()));
          op.setTags(
              List.of(
                  path.getKey().contains("/admin/")
                      ? "Administration / 后台管理"
                      : path.getKey().contains("/auth/") ? "Identity / 账号" : "Library / 图书馆"));
          Schema<?> schema = response(id);
          String code =
              Set.of("borrow", "reserve", "createBook", "createUser").contains(id)
                  ? "201"
                  : Set.of("register", "resetRequest", "adminReset").contains(id)
                      ? "202"
                      : Set.of(
                                  "logout",
                                  "reset",
                                  "password",
                                  "returnLoan",
                                  "cancel",
                                  "read",
                                  "adminReturn")
                              .contains(id)
                          ? "204"
                          : "200";
          var success =
              new ApiResponse()
                  .description(code.equals("204") ? "Completed / 已完成" : "Success / 成功");
          if (schema != null && !code.equals("204"))
            success.content(
                new Content().addMediaType("application/json", new MediaType().schema(schema)));
          op.getResponses().addApiResponse(code, success);
          for (String status : List.of("400", "401", "403", "404", "409", "429", "503"))
            op.getResponses()
                .addApiResponse(
                    status,
                    new ApiResponse()
                        .description("Problem response; inspect code and detail / 查看业务错误码和说明")
                        .content(
                            new Content()
                                .addMediaType(
                                    "application/problem+json",
                                    new MediaType().schema(ref("Problem")))));
          boolean publicRead =
              Set.of("csrf", "health", "books", "book", "categories", "recommendations")
                  .contains(id);
          boolean publicAuth =
              Set.of("login", "register", "verify", "resetRequest", "reset", "logout").contains(id);
          op.setSecurity(
              publicRead || publicAuth
                  ? List.of()
                  : List.of(new SecurityRequirement().addList("sessionCookie")));
        }
    };
  }

  private static Schema<?> response(String id) {
    return switch (id) {
      case "csrf" -> ref("Csrf");
      case "health" -> ref("Health");
      case "login", "me", "profile", "createUser", "updateUser" -> ref("User");
      case "books", "adminBooks" -> ref("BookPage");
      case "book", "createBook", "editBook", "bookStatus", "cover" -> ref("Book");
      case "categories" -> new ArraySchema().items(text());
      case "recommendations" -> array("Book");
      case "borrow", "renew" -> ref("Loan");
      case "loans", "history" -> array("Loan");
      case "reserve" -> ref("Reservation");
      case "reservations" -> array("Reservation");
      case "notifications" -> array("Notification");
      case "fines" -> array("Fine");
      case "adjustment", "settle" -> ref("Fine");
      case "stats" -> ref("AdminStats");
      case "users" -> ref("UserPage");
      case "allLoans" -> ref("AdminLoanPage");
      case "allReservations" -> ref("AdminReservationPage");
      case "allFines" -> ref("AdminFinePage");
      case "audit" -> ref("AuditPage");
      case "importBooks" -> ref("ImportResult");
      case "register", "verify", "resetRequest", "adminReset" -> ref("Message");
      default -> null;
    };
  }

  private static final Map<String, String> SUMMARIES =
      Map.ofEntries(
          Map.entry("health", "Service health / 服务健康"),
          Map.entry("csrf", "Get CSRF token / 获取 CSRF 令牌"),
          Map.entry("me", "Current account / 当前账号"),
          Map.entry("login", "Sign in / 登录"),
          Map.entry("logout", "Sign out / 退出登录"),
          Map.entry("register", "Register and queue account-confirmation email / 注册并发送账号确认邮件"),
          Map.entry("verify", "Verify email / 验证邮箱"),
          Map.entry("resetRequest", "Request password reset / 请求密码重置"),
          Map.entry("reset", "Complete password reset / 完成密码重置"),
          Map.entry("profile", "Update own profile / 修改个人资料"),
          Map.entry("password", "Change own password / 修改本人密码"),
          Map.entry("books", "Browse and search books / 浏览与搜索书籍"),
          Map.entry("book", "Book details / 书籍详情"),
          Map.entry("categories", "Published categories / 已上架分类"),
          Map.entry("recommendations", "Personalized rule-based recommendations / 规则推荐"),
          Map.entry("borrow", "Borrow a book / 借阅书籍"),
          Map.entry("loans", "Current or historical loans / 当前或历史借阅"),
          Map.entry("history", "Loan history / 借阅历史"),
          Map.entry("returnLoan", "Return own loan / 归还本人借阅"),
          Map.entry("renew", "Renew own loan / 续借本人借阅"),
          Map.entry("reserve", "Join reservation queue / 加入预约队列"),
          Map.entry("cancel", "Cancel own reservation / 取消本人预约"),
          Map.entry("reservations", "Own reservations / 本人预约"),
          Map.entry("notifications", "Own notifications / 本人通知"),
          Map.entry("read", "Mark own notification read / 标记本人通知已读"),
          Map.entry("fines", "Own demonstration balances / 本人演示账单"),
          Map.entry("stats", "Administration summary / 后台概览"),
          Map.entry("adminBooks", "Manage book catalog / 管理书目列表"),
          Map.entry("createBook", "Create draft book / 新建草稿书籍"),
          Map.entry("editBook", "Edit book metadata / 编辑书目"),
          Map.entry("bookStatus", "Change publication status / 书籍上下架"),
          Map.entry("cover", "Upload and sanitize cover / 上传并净化封面"),
          Map.entry("importBooks", "Preview or import CSV / 预览或导入 CSV"),
          Map.entry("media", "Read sanitized cover / 读取封面"),
          Map.entry("users", "Manage accounts / 管理账号列表"),
          Map.entry("createUser", "Create account / 创建账号"),
          Map.entry("updateUser", "Change account or role / 修改账号状态与角色"),
          Map.entry("adminReset", "Send account recovery email / 发送账号恢复邮件"),
          Map.entry("allLoans", "Manage loans with reader identities / 按读者管理借阅"),
          Map.entry("adminReturn", "Return on behalf of a reader / 管理员代归还"),
          Map.entry("allReservations", "Manage reservation queue / 管理预约队列"),
          Map.entry("allFines", "Manage demonstration balances / 管理演示账单"),
          Map.entry("adjustment", "Waive demonstration balance / 减免演示费用"),
          Map.entry("settle", "Settle demonstration balance without payment / 演示结清，不实际扣款"),
          Map.entry("audit", "Administrative audit trail / 管理操作审计"));
}

package dev.elibrary;

import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Clock;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import org.apache.commons.csv.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
class CatalogService {
  private final Store db;
  private final Clock clock;
  private final IdentityService identity;
  private final Settings settings;
  private final NotificationService notices;
  private final BookRepository books;

  CatalogService(
      Store db,
      Clock clock,
      IdentityService identity,
      Settings settings,
      NotificationService notices,
      BookRepository books) {
    this.db = db;
    this.clock = clock;
    this.identity = identity;
    this.settings = settings;
    this.notices = notices;
    this.books = books;
  }

  private String view(long reader) {
    return "select"
               + " b.id,b.title,b.author,b.isbn,b.description,b.category,b.cover_url,b.status,b.published_at,(b.status='PUBLISHED'"
               + " and not exists(select 1 from loan l where l.book_id=b.id and l.returned_at is"
               + " null) and not exists(select 1 from reservation r where r.book_id=b.id and"
               + " r.status='READY' and r.reader_id<>"
        + reader
        + ")) as available,(select count(*) from loan h where h.book_id=b.id) as borrow_count from"
        + " book b";
  }

  Map<String, Object> list(
      String q, String category, boolean availableOnly, int page, int size, boolean admin) {
    page = Store.page(page);
    size = Store.size(size);
    long reader = SecurityConfig.optionalUser() == null ? 0 : SecurityConfig.optionalUser().id();
    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder(" where " + (admin ? "true" : "b.status='PUBLISHED'"));
    if (q != null && !q.isBlank()) {
      if (q.length() > 200) throw ApiException.bad("Search is too long / 搜索内容过长");
      where.append(" and (b.title ilike ? escape '\\' or b.author ilike ? escape '\\')");
      String pattern =
          "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
      args.add(pattern);
      args.add(pattern);
    }
    if (category != null && !category.isBlank()) {
      where.append(" and b.category=?");
      args.add(category);
    }
    if (availableOnly)
      where.append(
          " and b.status='PUBLISHED' and not exists(select 1 from loan l where l.book_id=b.id and"
              + " l.returned_at is null) and not exists(select 1 from reservation r where"
              + " r.book_id=b.id and r.status='READY' and r.reader_id<>"
              + reader
              + ")");
    long total = db.count("select count(*) from book b" + where, args.toArray());
    List<Object> paged = new ArrayList<>(args);
    paged.add(size);
    paged.add(page * size);
    return Store.page(
        db.rows(
            view(reader)
                + where
                + " order by b.published_at desc nulls last,b.id desc limit ? offset ?",
            paged.toArray()),
        total,
        page,
        size);
  }

  Map<String, Object> detail(long id, boolean admin) {
    // JPA validates and loads the catalog aggregate; the query projection includes live
    // loan/reservation availability.
    var book = books.findById(id).orElseThrow(ApiException::missing);
    var user = SecurityConfig.optionalUser();
    long reader = user == null ? 0 : user.id();
    if (!admin
        && !"PUBLISHED".equals(book.status)
        && db.count("select count(*) from loan where book_id=? and reader_id=?", id, reader) == 0)
      throw ApiException.missing();
    return raw(id);
  }

  Map<String, Object> raw(long id) {
    var user = SecurityConfig.optionalUser();
    return db.one(view(user == null ? 0 : user.id()) + " where b.id=?", id);
  }

  List<String> categories() {
    return db
        .rows("select distinct category from book where status='PUBLISHED' order by category")
        .stream()
        .map(r -> r.get("category").toString())
        .toList();
  }

  List<Map<String, Object>> recommendations() {
    long user = SecurityConfig.optionalUser() == null ? 0 : SecurityConfig.optionalUser().id();
    return db.rows(
        view(user)
            + " where b.status='PUBLISHED' and not exists(select 1 from loan l where l.book_id=b.id"
            + " and l.reader_id=? and l.returned_at is null) order by (select count(*) from loan p"
            + " join book pb on pb.id=p.book_id where p.reader_id=? and pb.category=b.category)"
            + " desc,(select count(*) from loan p where p.book_id=b.id) desc,b.published_at desc"
            + " nulls last,b.id desc limit 8",
        user,
        user);
  }

  @Transactional
  Map<String, Object> save(
      Long id, String title, String author, String isbn, String description, String category) {
    db.lock();
    validate(title, author, isbn, description, category);
    if (isbn != null) isbn = isbn.isBlank() ? null : isbn.strip();
    if (id == null)
      id =
          db.insert(
              "insert into book(title,author,isbn,description,category) values(?,?,?,?,?) returning"
                  + " id",
              title.strip(),
              author.strip(),
              isbn,
              description == null ? "" : description,
              category.strip());
    else {
      db.one("select id from book where id=?", id);
      db.update(
          "update book set title=?,author=?,isbn=?,description=?,category=? where id=?",
          title.strip(),
          author.strip(),
          isbn,
          description == null ? "" : description,
          category.strip(),
          id);
    }
    identity.audit("BOOK_SAVE", id.toString(), title.strip());
    return raw(id);
  }

  @Transactional
  Map<String, Object> status(long id, String status) {
    db.lock();
    if (status == null || !Set.of("DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED").contains(status))
      throw ApiException.bad("Invalid publication status / 上下架状态无效");
    db.one("select id from book where id=?", id);
    db.update(
        "update book set status=?,published_at=case when ?='PUBLISHED' then"
            + " coalesce(published_at,?) else published_at end where id=?",
        status,
        status,
        clock.instant(),
        id);
    if (!status.equals("PUBLISHED")) {
      for (var r :
          db.rows(
              "select id,reader_id from reservation where book_id=? and status in"
                  + " ('WAITING','READY')",
              id))
        notices.notify(
            ((Number) r.get("readerId")).longValue(),
            "reservation-cancelled:" + r.get("id"),
            "Reservation cancelled / 预约已取消",
            "The book was unpublished. / 图书已下架。",
            "RESERVATION_CANCELLED");
      db.update(
          "update reservation set status='CANCELLED' where book_id=? and status in"
              + " ('WAITING','READY')",
          id);
    }
    identity.audit("BOOK_STATUS", Long.toString(id), status);
    return raw(id);
  }

  @Transactional
  Map<String, Object> cover(long id, MultipartFile file) {
    db.lock();
    db.one("select id from book where id=?", id);
    if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024)
      throw ApiException.bad("Upload a PNG/JPEG up to 5 MB / 请上传不超过 5 MB 的 PNG/JPEG");
    BufferedImage image;
    try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
      Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
      if (!readers.hasNext()) throw ApiException.bad("Unsupported image / 图片格式无效");
      ImageReader reader = readers.next();
      try {
        String format = reader.getFormatName().toLowerCase(Locale.ROOT);
        if (!Set.of("png", "jpeg", "jpg").contains(format))
          throw ApiException.bad("Only PNG/JPEG images are supported / 仅支持 PNG/JPEG 图片");
        reader.setInput(input);
        int w = reader.getWidth(0), h = reader.getHeight(0);
        if (w < 1 || h < 1 || w > 4096 || h > 4096)
          throw ApiException.bad("Image dimensions exceed 4096 pixels / 图片尺寸不能超过 4096 像素");
        image = reader.read(0);
      } finally {
        reader.dispose();
      }
    } catch (IOException e) {
      throw ApiException.bad("Image could not be processed / 无法处理图片");
    }
    String name = UUID.randomUUID() + ".png";
    try {
      Path directory = Path.of(settings.mediaDirectory).toAbsolutePath().normalize();
      Files.createDirectories(directory);
      if (!ImageIO.write(image, "png", directory.resolve(name).toFile()))
        throw new IOException("No image encoder");
    } catch (IOException e) {
      throw new ApiException(
          org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
          "MEDIA_STORAGE_UNAVAILABLE",
          "Cover storage is not writable / 封面存储目录暂不可写");
    }
    db.update("update book set cover_url=? where id=?", "/api/v1/media/" + name, id);
    identity.audit("BOOK_COVER", Long.toString(id), "Uploaded sanitized PNG");
    return raw(id);
  }

  @Transactional
  Map<String, Object> importBooks(MultipartFile file, boolean dryRun) {
    db.lock();
    if (file.isEmpty() || file.getSize() > 1024 * 1024)
      throw ApiException.bad("CSV must be 1 MB or smaller / CSV 最大 1 MB");
    try {
      String text =
          StandardCharsets.UTF_8
              .newDecoder()
              .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
              .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
              .decode(java.nio.ByteBuffer.wrap(file.getBytes()))
              .toString()
              .replaceFirst("^\\uFEFF", "");
      var csv =
          CSVParser.parse(
              text,
              CSVFormat.DEFAULT
                  .builder()
                  .setHeader()
                  .setSkipHeaderRecord(true)
                  .setIgnoreEmptyLines(true)
                  .get());
      if (!csv.getHeaderMap().keySet().containsAll(Set.of("title", "author", "category")))
        throw ApiException.bad("CSV headers: title,author,category[,isbn,description] / 缺少必要表头");
      List<Map<String, Object>> results = new ArrayList<>();
      List<String[]> valid = new ArrayList<>();
      Set<String> seen = new HashSet<>();
      for (CSVRecord row : csv) {
        if (results.size() >= 200) throw ApiException.bad("Import at most 200 rows / 每次最多导入 200 行");
        List<String> errors = new ArrayList<>();
        String title = row.get("title"),
            author = row.get("author"),
            category = row.get("category"),
            isbn = row.isMapped("isbn") ? row.get("isbn") : null,
            description = row.isMapped("description") ? row.get("description") : "";
        if (isbn != null) isbn = isbn.strip();
        try {
          validate(title, author, isbn, description, category);
        } catch (ApiException e) {
          errors.add(e.getMessage());
        }
        if (isbn != null && !isbn.isBlank()) {
          if (!seen.add("isbn:" + isbn)
              || db.count("select count(*) from book where isbn=?", isbn) > 0)
            errors.add("Duplicate ISBN / ISBN 重复");
        } else {
          String key =
              "book:"
                  + title.strip().toLowerCase(Locale.ROOT)
                  + ":"
                  + author.strip().toLowerCase(Locale.ROOT);
          if (!seen.add(key)
              || db.count(
                      "select count(*) from book where lower(title)=? and lower(author)=?",
                      title.strip().toLowerCase(Locale.ROOT),
                      author.strip().toLowerCase(Locale.ROOT))
                  > 0) errors.add("Duplicate title and author without ISBN / 无 ISBN 的同名同作者书目已存在");
        }
        results.add(
            Map.of("row", row.getRecordNumber() + 1, "valid", errors.isEmpty(), "errors", errors));
        if (errors.isEmpty()) valid.add(new String[] {title, author, isbn, description, category});
      }
      int imported = 0;
      if (!dryRun && valid.size() == results.size()) {
        for (String[] row : valid) {
          save(null, row[0], row[1], row[2], row[3], row[4]);
          imported++;
        }
        identity.audit("BOOK_IMPORT", Integer.toString(imported), "CSV import");
      }
      return Map.of("rows", results, "imported", imported);
    } catch (IOException | IllegalArgumentException e) {
      throw ApiException.bad("Invalid CSV / CSV 格式无效");
    }
  }

  private void validate(
      String title, String author, String isbn, String description, String category) {
    if (title == null
        || title.isBlank()
        || title.length() > 200
        || author == null
        || author.isBlank()
        || author.length() > 150
        || category == null
        || category.isBlank()
        || category.length() > 80
        || isbn != null && isbn.length() > 32
        || description != null && description.length() > 6000)
      throw ApiException.bad("Invalid book fields / 书籍字段不完整或过长");
  }
}

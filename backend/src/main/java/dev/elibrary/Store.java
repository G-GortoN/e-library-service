package dev.elibrary;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
class Store {
  final JdbcTemplate jdbc;

  Store(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  List<Map<String, Object>> rows(String sql, Object... args) {
    return jdbc.query(
        sql,
        (rs, n) -> {
          Map<String, Object> row = new LinkedHashMap<>();
          for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
            String key = rs.getMetaData().getColumnLabel(i);
            StringBuilder camel = new StringBuilder();
            boolean upper = false;
            for (char c : key.toCharArray()) {
              if (c == '_') upper = true;
              else {
                camel.append(upper ? Character.toUpperCase(c) : c);
                upper = false;
              }
            }
            Object value = rs.getObject(i);
            if (value instanceof Timestamp t) value = t.toInstant();
            row.put(camel.toString(), value);
          }
          return row;
        },
        parameters(args));
  }

  Map<String, Object> one(String sql, Object... args) {
    var all = rows(sql, args);
    if (all.isEmpty()) throw ApiException.missing();
    return all.getFirst();
  }

  Optional<Map<String, Object>> optional(String sql, Object... args) {
    return rows(sql, args).stream().findFirst();
  }

  long count(String sql, Object... args) {
    return Objects.requireNonNull(jdbc.queryForObject(sql, Long.class, parameters(args)));
  }

  int update(String sql, Object... args) {
    return jdbc.update(sql, parameters(args));
  }

  long insert(String sql, Object... args) {
    return Objects.requireNonNull(jdbc.queryForObject(sql, Long.class, parameters(args)));
  }

  // A database-wide transactional writer mutex intentionally favors correctness over write
  // throughput on one NAS.
  // PostgreSQL enforces this across processes, and transaction completion always releases it.
  void lock() {
    jdbc.execute("select pg_advisory_xact_lock(73190421)");
  }

  private static Object[] parameters(Object[] args) {
    return Arrays.stream(args).map(v -> v instanceof Instant t ? Timestamp.from(t) : v).toArray();
  }

  static long id(Map<String, Object> row) {
    return ((Number) row.get("id")).longValue();
  }

  static Instant instant(Map<String, Object> row, String key) {
    return (Instant) row.get(key);
  }

  static Map<String, Object> page(List<Map<String, Object>> items, long total, int page, int size) {
    return Map.of("items", items, "total", total, "page", page, "size", size);
  }

  static int page(int page) {
    if (page < 0 || page > 100000) throw ApiException.bad("Invalid page / 页码无效");
    return page;
  }

  static int size(int size) {
    if (size < 1 || size > 100) throw ApiException.bad("Size must be 1–100 / 每页数量须为 1–100");
    return size;
  }
}

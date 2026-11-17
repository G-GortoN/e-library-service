package dev.elibrary;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "book")
class Book {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  Long id;

  @Column(nullable = false, length = 200)
  String title;

  @Column(nullable = false, length = 150)
  String author;

  @Column(length = 32)
  String isbn;

  @Column(nullable = false, length = 6000)
  String description;

  @Column(nullable = false, length = 80)
  String category;

  @Column(name = "cover_url", length = 300)
  String coverUrl;

  @Column(nullable = false, length = 20)
  String status;

  @Column(name = "published_at")
  Instant publishedAt;

  @Column(name = "created_at", nullable = false)
  Instant createdAt;

  protected Book() {}
}

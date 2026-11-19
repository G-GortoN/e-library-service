import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { App, Button, Checkbox, Input, Pagination, Tag } from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  SearchOutlined,
  ReadOutlined,
} from "@ant-design/icons";
import { api, errorMessage, queryString } from "../api";
import { useAuth } from "../auth";
import {
  BookCard,
  BookCover,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from "../components";
import type { Book, Loan, Page, Reservation } from "../types";

export default function Catalog() {
  const { t } = useTranslation("reader");
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [input, setInput] = useState(params.get("q") || "");
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  useEffect(() => {
    setInput(q);
  }, [q]);
  const availableOnly = params.get("availableOnly") === "true";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const books = useQuery({
    queryKey: ["books", q, category, availableOnly, page],
    queryFn: () =>
      api.get<Page<Book>>(
        `/books?${queryString({ q, category, availableOnly, page, size: 12 })}`,
      ),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<string[]>("/categories"),
  });
  const recommendations = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.get<Book[]>("/recommendations"),
  });
  const setFilter = (key: string, value: string) =>
    setParams((p) => {
      value ? p.set(key, value) : p.delete(key);
      p.delete("page");
      return p;
    });
  const isHome =
    location.pathname === "/" &&
    !q &&
    !category &&
    !availableOnly &&
    page === 0;
  const featured = recommendations.data?.slice(0, 3) || [];
  return (
    <>
      {isHome && (
        <section className="reading-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-star">✳</span> {t("hero.eyebrow")}
            </p>
            <h1>
              {t("hero.titleFirst")}
              <br />
              {t("hero.titleSecond")}
              <span>{t("hero.titleAccent")}</span>
            </h1>
            <p>
              {t("hero.introFirst")}
              <br />
              {t("hero.introSecond")}
            </p>
            <a href="#catalog" className="hero-link">
              {t("hero.discover")} <ArrowRightOutlined />
            </a>
            <div className="hero-footnote">
              <span className="hero-rule" /> {t("hero.footnote")}
            </div>
          </div>
          <div className="hero-shelf" aria-label={t("hero.shelfAria")}>
            {featured.length > 0 ? (
              featured.map((book, index) => (
                <Link
                  to={`/books/${book.id}`}
                  className={`hero-book hero-book-${index}`}
                  key={book.id}
                  tabIndex={index ? -1 : 0}
                >
                  <BookCover book={book} />
                </Link>
              ))
            ) : (
              <div className="hero-lettering" aria-hidden="true">
                <span>{t("hero.read")}</span>
                <span>{t("hero.more")}</span>
                <i>{t("hero.curious")}</i>
              </div>
            )}
            <div className="hero-orbit" />
            <span className="hero-shelf-note">{t("hero.shelfNote")}</span>
          </div>
          <span className="hero-index" aria-hidden="true">
            {t("hero.index")}
          </span>
        </section>
      )}
      <section className="catalog-section" id="catalog">
        <PageHeading
          eyebrow={t("catalog.eyebrow")}
          title={
            q ? t("catalog.searchTitle", { query: q }) : t("catalog.title")
          }
          description={t("catalog.description")}
          extra={
            <span className="collection-count">
              {books.data
                ? t("catalog.bookCount", { count: books.data.total })
                : t("catalog.explore")}{" "}
              <ReadOutlined />
            </span>
          }
        />
        <div className="catalog-layout">
          <aside className="catalog-sidebar">
            <p className="filter-label">
              {t("catalog.categories")}{" "}
              <span>{t("catalog.categoriesCaption")}</span>
            </p>
            <button
              className={`category-item ${!category ? "active" : ""}`}
              onClick={() => setFilter("category", "")}
            >
              {t("catalog.allBooks")} <ArrowRightOutlined />
            </button>
            {categories.data?.map((c) => (
              <button
                key={c}
                onClick={() => setFilter("category", c)}
                className={`category-item ${category === c ? "active" : ""}`}
              >
                {c}
                <span className="category-dot" />
              </button>
            ))}
            {categories.isError && (
              <p className="muted small-text">
                {t("catalog.categoriesUnavailable")}
              </p>
            )}
            <div className="sidebar-divider" />
            <Checkbox
              checked={availableOnly}
              onChange={(e) =>
                setFilter("availableOnly", e.target.checked ? "true" : "")
              }
            >
              {t("catalog.availableOnly")}
            </Checkbox>
            <div className="reading-note">
              <span>“</span>
              <p>
                {t("catalog.quoteFirst")}
                <br />
                {t("catalog.quoteSecond")}
              </p>
              <small>{t("catalog.quoteNote")}</small>
            </div>
          </aside>
          <div className="catalog-main">
            <div className="catalog-toolbar">
              <Input.Search
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSearch={(value) => setFilter("q", value.trim())}
                placeholder={t("catalog.searchPlaceholder")}
                allowClear
                prefix={<SearchOutlined />}
                aria-label={t("catalog.searchAria")}
                enterButton={t("catalog.search")}
              />
              <span className="sort-caption">{t("catalog.sortCaption")}</span>
            </div>
            {(category || q || availableOnly) && (
              <div className="active-filters">
                {t("catalog.activeFilters")}{" "}
                {category && (
                  <Tag closable onClose={() => setFilter("category", "")}>
                    {category}
                  </Tag>
                )}
                {q && (
                  <Tag
                    closable
                    onClose={() => {
                      setInput("");
                      setFilter("q", "");
                    }}
                  >
                    {q}
                  </Tag>
                )}
                {availableOnly && (
                  <Tag closable onClose={() => setFilter("availableOnly", "")}>
                    {t("catalog.available")}
                  </Tag>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setParams({});
                    setInput("");
                  }}
                >
                  {t("catalog.clearFilters")}
                </button>
              </div>
            )}
            {books.isPending ? (
              <LoadingState />
            ) : books.isError ? (
              <ErrorState error={books.error} retry={() => books.refetch()} />
            ) : books.data.items.length === 0 ? (
              <EmptyState
                title={t("catalog.emptyTitle")}
                description={t("catalog.emptyDescription")}
                action={
                  <Button
                    onClick={() => {
                      setParams({});
                      setInput("");
                    }}
                  >
                    {t("catalog.viewAll")}
                  </Button>
                }
              />
            ) : (
              <>
                <div className="book-grid">
                  {books.data.items.map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </div>
                <div className="pagination-row">
                  <span className="muted">{t("catalog.paginationNote")}</span>
                  <Pagination
                    current={page + 1}
                    pageSize={12}
                    total={books.data.total}
                    showSizeChanger={false}
                    onChange={(p) => {
                      setParams((prev) => {
                        prev.set("page", String(p - 1));
                        return prev;
                      });
                      document
                        .getElementById("catalog")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      {isHome && recommendations.data && recommendations.data.length > 0 && (
        <section className="recommend-section">
          <PageHeading
            eyebrow={t("recommend.eyebrow")}
            title={t("recommend.title")}
            description={t("recommend.description")}
            extra={
              <Link className="text-link" to="/books">
                {t("recommend.browseAll")} <ArrowRightOutlined />
              </Link>
            }
          />
          <div className="recommend-grid">
            {recommendations.data.slice(0, 4).map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}
      {isHome && (
        <section className="manifesto">
          <span className="tiny-star">✳</span>
          <p>
            {t("manifesto.first")}
            <br />
            <em>{t("manifesto.second")}</em>
          </p>
          <span>{t("manifesto.caption")}</span>
        </section>
      )}
    </>
  );
}

export function BookDetail() {
  const { t } = useTranslation("reader");
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { message } = App.useApp();
  const book = useQuery({
    queryKey: ["book", id],
    queryFn: () => api.get<Book>(`/books/${id}`),
  });
  const borrow = useMutation({
    mutationFn: () => api.post<Loan>("/loans", { bookId: Number(id) }),
    onSuccess: () => {
      message.success(t("detail.borrowSuccess"));
      client.invalidateQueries();
      navigate("/shelf");
    },
    onError: (e) => {
      message.error(errorMessage(e));
      client.invalidateQueries({ queryKey: ["book", id] });
    },
  });
  const reserve = useMutation({
    mutationFn: () =>
      api.post<Reservation>("/reservations", { bookId: Number(id) }),
    onSuccess: () => {
      message.success(t("detail.reserveSuccess"));
      client.invalidateQueries();
      navigate("/shelf?tab=reservations");
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  if (book.isPending) return <LoadingState />;
  if (book.isError)
    return (
      <ErrorState
        title={t("detail.errorTitle")}
        error={book.error}
        retry={() => book.refetch()}
      />
    );
  const b = book.data;
  const published = b.status === "PUBLISHED";
  const act = () => {
    if (!published) return;
    if (!user) {
      navigate("/login", { state: { from: `/books/${id}` } });
      return;
    }
    b.available ? borrow.mutate() : reserve.mutate();
  };
  return (
    <section className="detail-page">
      <Link className="back-link" to="/books">
        <ArrowLeftOutlined /> {t("detail.back")}
      </Link>
      <div className="book-detail-grid">
        <div className="detail-cover-stage">
          <BookCover book={b} />
          <span className="detail-cover-caption">
            {t("detail.coverCaption")}
          </span>
        </div>
        <div className="book-detail-copy">
          <p className="eyebrow">{b.category || t("detail.collection")}</p>
          <h1>{b.title}</h1>
          <p className="detail-author">
            {b.author} <span>{t("detail.authorSuffix")}</span>
          </p>
          <div className="detail-description">
            <h2>{t("detail.about")}</h2>
            <p>{b.description || t("detail.descriptionFallback")}</p>
          </div>
          <dl className="book-facts">
            <div>
              <dt>{t("detail.category")}</dt>
              <dd>{b.category || t("detail.generalCategory")}</dd>
            </div>
            <div>
              <dt>{t("detail.isbn")}</dt>
              <dd>{b.isbn || t("detail.notProvided")}</dd>
            </div>
            <div>
              <dt>{t("detail.borrowCountLabel")}</dt>
              <dd>{t("detail.borrowCount", { count: b.borrowCount || 0 })}</dd>
            </div>
          </dl>
          <div className="borrow-panel">
            <div>
              <span
                className={`availability ${b.available ? "" : "unavailable"}`}
              >
                {!published
                  ? t("detail.unpublished")
                  : b.available
                    ? t("detail.available")
                    : t("detail.unavailable")}
              </span>
              <p>
                {!published
                  ? t("detail.unpublishedHint")
                  : b.available
                    ? t("detail.availableHint")
                    : t("detail.unavailableHint")}
              </p>
            </div>
            {!published ? (
              <Link to="/shelf">
                <Button>{t("detail.goToShelf")}</Button>
              </Link>
            ) : (
              <Button
                size="large"
                type="primary"
                icon={b.available ? <ReadOutlined /> : <CheckOutlined />}
                loading={borrow.isPending || reserve.isPending}
                onClick={act}
              >
                {!user
                  ? t("detail.loginToBorrow")
                  : b.available
                    ? t("detail.borrow")
                    : t("detail.reserve")}
              </Button>
            )}
          </div>
          <p className="detail-notice">{t("detail.notice")}</p>
        </div>
      </div>
    </section>
  );
}

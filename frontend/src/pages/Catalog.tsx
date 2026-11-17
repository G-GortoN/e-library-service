import { useEffect, useState } from "react";
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
              <span className="tiny-star">✳</span> A LITTLE SPACE FOR BIG IDEAS
            </p>
            <h1>
              把世界
              <br />
              翻开<span>一页。</span>
            </h1>
            <p>
              在日常的空隙，遇见下一本好书。
              <br />
              一座随时为你打开的数字图书馆。
            </p>
            <a href="#catalog" className="hero-link">
              找到下一本好书 <ArrowRightOutlined />
            </a>
            <div className="hero-footnote">
              <span className="hero-rule" /> 阅读，让平凡的日子有了远方
            </div>
          </div>
          <div className="hero-shelf" aria-label="本期推荐书籍">
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
                <span>READ</span>
                <span>MORE.</span>
                <i>stay curious</i>
              </div>
            )}
            <div className="hero-orbit" />
            <span className="hero-shelf-note">THE ART OF SLOW READING</span>
          </div>
          <span className="hero-index" aria-hidden="true">
            01 — FOLIO JOURNAL
          </span>
        </section>
      )}
      <section className="catalog-section" id="catalog">
        <PageHeading
          eyebrow="THE COLLECTION"
          title={q ? `寻找「${q}」` : "总有一本，正合心意"}
          description="从熟悉的领域出发，也向未曾抵达的世界走近。"
          extra={
            <span className="collection-count">
              {books.data ? `${books.data.total} 本藏书` : "探索馆藏"}{" "}
              <ReadOutlined />
            </span>
          }
        />
        <div className="catalog-layout">
          <aside className="catalog-sidebar">
            <p className="filter-label">
              书籍分类 <span>CATEGORIES</span>
            </p>
            <button
              className={`category-item ${!category ? "active" : ""}`}
              onClick={() => setFilter("category", "")}
            >
              全部藏书 <ArrowRightOutlined />
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
              <p className="muted small-text">分类暂时不可用</p>
            )}
            <div className="sidebar-divider" />
            <Checkbox
              checked={availableOnly}
              onChange={(e) =>
                setFilter("availableOnly", e.target.checked ? "true" : "")
              }
            >
              只看可借阅
            </Checkbox>
            <div className="reading-note">
              <span>“</span>
              <p>
                阅读，是随身携带的
                <br />
                一座避难所。
              </p>
              <small>给自己留一点翻页的时间</small>
            </div>
          </aside>
          <div className="catalog-main">
            <div className="catalog-toolbar">
              <Input.Search
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSearch={(value) => setFilter("q", value.trim())}
                placeholder="搜索书名、作者…"
                allowClear
                prefix={<SearchOutlined />}
                aria-label="搜索书籍"
                enterButton="搜索"
              />
              <span className="sort-caption">精选排序 · 发现好书</span>
            </div>
            {(category || q || availableOnly) && (
              <div className="active-filters">
                当前筛选{" "}
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
                    可借阅
                  </Tag>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setParams({});
                    setInput("");
                  }}
                >
                  清空筛选
                </button>
              </div>
            )}
            {books.isPending ? (
              <LoadingState />
            ) : books.isError ? (
              <ErrorState error={books.error} retry={() => books.refetch()} />
            ) : books.data.items.length === 0 ? (
              <EmptyState
                title="还没有找到这本书"
                description="试试其他关键词，或放宽筛选条件。"
                action={
                  <Button
                    onClick={() => {
                      setParams({});
                      setInput("");
                    }}
                  >
                    查看全部藏书
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
                  <span className="muted">每一次翻页，都是新的相遇</span>
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
            eyebrow="PICKED FOR YOU"
            title="下一页的灵感"
            description="从阅读偏好与馆藏热度，发现值得停留的故事。"
            extra={
              <Link className="text-link" to="/books">
                浏览全部 <ArrowRightOutlined />
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
            不必匆忙读完世界。
            <br />
            <em>从你喜欢的一页开始。</em>
          </p>
          <span>YOUR NEXT CHAPTER STARTS HERE</span>
        </section>
      )}
    </>
  );
}

export function BookDetail() {
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
      message.success("已放入你的书架，愿这段阅读时光愉快。");
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
      message.success("预约成功，轮到你时我们会通知你。");
      client.invalidateQueries();
      navigate("/shelf?tab=reservations");
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  if (book.isPending) return <LoadingState />;
  if (book.isError)
    return (
      <ErrorState
        title="无法打开这本书"
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
        <ArrowLeftOutlined /> 返回馆藏
      </Link>
      <div className="book-detail-grid">
        <div className="detail-cover-stage">
          <BookCover book={b} />
          <span className="detail-cover-caption">FOLIO LIBRARY · 精选馆藏</span>
        </div>
        <div className="book-detail-copy">
          <p className="eyebrow">{b.category || "FOLIO COLLECTION"}</p>
          <h1>{b.title}</h1>
          <p className="detail-author">
            {b.author} <span>著</span>
          </p>
          <div className="detail-description">
            <h2>关于这本书</h2>
            <p>{b.description || "关于书页之间的世界，留给你慢慢发现。"}</p>
          </div>
          <dl className="book-facts">
            <div>
              <dt>分类</dt>
              <dd>{b.category || "综合"}</dd>
            </div>
            <div>
              <dt>ISBN</dt>
              <dd>{b.isbn || "未提供"}</dd>
            </div>
            <div>
              <dt>借阅次数</dt>
              <dd>{b.borrowCount || 0} 次</dd>
            </div>
          </dl>
          <div className="borrow-panel">
            <div>
              <span
                className={`availability ${b.available ? "" : "unavailable"}`}
              >
                {!published
                  ? "该书当前未上架"
                  : b.available
                    ? "当前可以借阅"
                    : "当前借阅授权已占用"}
              </span>
              <p>
                {!published
                  ? "已有借阅仍可归还，暂停新增借阅与预约"
                  : b.available
                    ? "借期 14 天 · 符合条件可续借一次"
                    : "加入预约队列，轮到你时保留 48 小时"}
              </p>
            </div>
            {!published ? (
              <Link to="/shelf">
                <Button>前往我的书架</Button>
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
                  ? "登录后借阅"
                  : b.available
                    ? "借阅这本书"
                    : "预约这本书"}
              </Button>
            )}
          </div>
          <p className="detail-notice">
            这是数字书目与借阅服务，目前不提供正文在线阅读。
          </p>
        </div>
      </div>
    </section>
  );
}

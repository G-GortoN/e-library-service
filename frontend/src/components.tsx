import { Alert, Button, Empty, Skeleton, Tag } from "antd";
import {
  ArrowRightOutlined,
  BookOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import type { Book } from "./types";
import { errorMessage } from "./api";

export function LoadingState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`state-wrap ${compact ? "compact" : ""}`}
      role="status"
      aria-label="正在加载"
    >
      <Skeleton active paragraph={{ rows: compact ? 2 : 4 }} />
    </div>
  );
}
export function ErrorState({
  error,
  retry,
  title = "暂时无法加载",
  description,
}: {
  error?: unknown;
  retry?: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="state-wrap">
      <Alert
        type="error"
        showIcon
        title={title}
        description={description || errorMessage(error)}
        action={
          retry ? (
            <Button icon={<ReloadOutlined />} onClick={retry}>
              重试
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
export function EmptyState({
  title = "这里还没有内容",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Empty
        image={<BookOutlined />}
        description={
          <>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </>
        }
      >
        {action}
      </Empty>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  extra,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-intro">{description}</p>}
      </div>
      {extra}
    </div>
  );
}
const palettes = [
  ["#c7d6c7", "#244536"],
  ["#dfbb8b", "#613c25"],
  ["#bdccdf", "#27445f"],
  ["#c97b63", "#fff5de"],
  ["#ded1b2", "#5d4a30"],
  ["#899e91", "#fff8df"],
];
export function BookCover({
  book,
  small = false,
}: {
  book: Pick<Book, "title" | "author" | "coverUrl"> & { category?: string };
  small?: boolean;
}) {
  const hash = Array.from(book.title).reduce(
    (sum, c) => sum + c.charCodeAt(0),
    0,
  );
  const [background, color] = palettes[hash % palettes.length];
  if (book.coverUrl)
    return (
      <div className={`book-cover image-cover ${small ? "small" : ""}`}>
        <img
          loading="lazy"
          src={book.coverUrl}
          alt={`${book.title}封面`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add("cover-failed");
          }}
        />
        <span className="cover-fallback">{book.title}</span>
      </div>
    );
  return (
    <div
      className={`book-cover generated-cover cover-variant-${hash % 4} ${small ? "small" : ""}`}
      style={{ background, color }}
      aria-label={`${book.title}文字封面`}
    >
      <span className="cover-imprint">FOLIO / SELECTED</span>
      <div className="cover-art" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <strong>{book.title}</strong>
      <span className="cover-author">{book.author}</span>
      <span className="cover-bottom">栖页藏书 · {book.category || "阅读"}</span>
    </div>
  );
}
export function BookCard({ book }: { book: Book }) {
  return (
    <Link className="book-card" to={`/books/${book.id}`}>
      <BookCover book={book} />
      <div className="book-card-meta">
        <span>{book.category}</span>
        <span className={`availability ${book.available ? "" : "unavailable"}`}>
          {book.available ? "可借阅" : "可预约"}
        </span>
      </div>
      <h3>{book.title}</h3>
      <p>{book.author}</p>
      <span className="book-card-arrow" aria-hidden="true">
        <ArrowRightOutlined />
      </span>
    </Link>
  );
}
export const bookStatusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已上架",
  UNPUBLISHED: "已下架",
  ARCHIVED: "已归档",
};
export const reservationLabels: Record<string, string> = {
  WAITING: "排队中",
  READY: "待领取",
  CLAIMED: "已领取",
  FULFILLED: "已完成",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
};
export function StatusTag({ value }: { value: string }) {
  return (
    <Tag
      color={
        ["PUBLISHED", "READY", "PAID", "SETTLED"].includes(value)
          ? "green"
          : ["CANCELLED", "UNPUBLISHED", "EXPIRED", "ARCHIVED"].includes(value)
            ? "default"
            : "gold"
      }
    >
      {bookStatusLabels[value] ||
        reservationLabels[value] ||
        {
          OPEN: "待处理",
          SETTLED: "已结清",
          PAID: "已结清",
          WAIVED: "已减免",
          UNPAID: "未结清",
        }[value] ||
        value}
    </Tag>
  );
}
export function formatDate(value?: string | null, time = false) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
      }).format(date);
}
export function money(minor = 0) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(minor / 100);
}

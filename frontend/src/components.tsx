import { Alert, Button, Empty, Skeleton, Tag } from "antd";
import {
  ArrowRightOutlined,
  BookOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import type { Book, Notification } from "./types";
import { errorMessage } from "./api";
import { useTranslation } from "react-i18next";
import i18n, { currentLanguage, localizeText } from "./i18n";

export function LoadingState({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  return (
    <div
      className={`state-wrap ${compact ? "compact" : ""}`}
      role="status"
      aria-label={t("loading")}
    >
      <Skeleton active paragraph={{ rows: compact ? 2 : 4 }} />
    </div>
  );
}
export function ErrorState({
  error,
  retry,
  title,
  description,
}: {
  error?: unknown;
  retry?: () => void;
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="state-wrap">
      <Alert
        type="error"
        showIcon
        title={title || t("loadError")}
        description={description || errorMessage(error)}
        action={
          retry ? (
            <Button icon={<ReloadOutlined />} onClick={retry}>
              {t("retry")}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="empty-state">
      <Empty
        image={<BookOutlined />}
        description={
          <>
            <h3>{title || t("empty")}</h3>
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
  const { t } = useTranslation("common");
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
          alt={t("cover.image", { title: book.title })}
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
      aria-label={t("cover.generated", { title: book.title })}
    >
      <span className="cover-imprint">FOLIO / SELECTED</span>
      <div className="cover-art" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <strong>{book.title}</strong>
      <span className="cover-author">{book.author}</span>
      <span className="cover-bottom">
        {t("cover.collection")} · {book.category || t("cover.reading")}
      </span>
    </div>
  );
}
export function BookCard({ book }: { book: Book }) {
  const { t } = useTranslation("common");
  return (
    <Link className="book-card" to={`/books/${book.id}`}>
      <BookCover book={book} />
      <div className="book-card-meta">
        <span>{book.category}</span>
        <span className={`availability ${book.available ? "" : "unavailable"}`}>
          {t(book.available ? "book.available" : "book.reservable")}
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
function statusLabels(values: string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  values.forEach((value) =>
    Object.defineProperty(labels, value, {
      enumerable: true,
      get: () => i18n.t(`status.${value}`),
    }),
  );
  return labels;
}
export const bookStatusLabels = statusLabels([
  "DRAFT",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
]);
export const reservationLabels = statusLabels([
  "WAITING",
  "READY",
  "CLAIMED",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
]);
export function StatusTag({ value }: { value: string }) {
  const { t } = useTranslation("common");
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
      {t(`status.${value}`, { defaultValue: value })}
    </Tag>
  );
}
export function formatDate(value?: string | null, time = false) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(currentLanguage(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
      }).format(date);
}
export function money(minor = 0) {
  return new Intl.NumberFormat(currentLanguage(), {
    style: "currency",
    currency: "CNY",
  }).format(minor / 100);
}

export function localizedNotification(notification: Notification) {
  return {
    title: localizeText(notification.title),
    body: localizeText(notification.body),
  };
}

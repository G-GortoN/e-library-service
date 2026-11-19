import { App, Button, Popconfirm, Tabs, Tag } from "antd";
import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, errorMessage } from "../api";
import {
  BookCover,
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  money,
  PageHeading,
  StatusTag,
} from "../components";
import type { Loan, Reservation } from "../types";

export default function Shelf() {
  const { t } = useTranslation("reader");
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") || "current";
  return (
    <section className="standard-page">
      <PageHeading
        eyebrow={t("shelf.eyebrow")}
        title={t("shelf.title")}
        description={t("shelf.description")}
        extra={
          <Link className="text-link" to="/books">
            {t("shelf.findAnother")} <ArrowRightOutlined />
          </Link>
        }
      />
      <Tabs
        activeKey={tab}
        onChange={(key) => setSearch({ tab: key })}
        items={[
          { key: "current", label: t("shelf.current"), children: <Loans /> },
          {
            key: "reservations",
            label: t("shelf.reservations"),
            children: <Reservations />,
          },
          {
            key: "history",
            label: t("shelf.history"),
            children: <Loans history />,
          },
        ]}
      />
    </section>
  );
}

function Loans({ history = false }: { history?: boolean }) {
  const { t } = useTranslation("reader");
  const client = useQueryClient();
  const { message } = App.useApp();
  const loans = useQuery({
    queryKey: ["loans", history],
    queryFn: () => api.get<Loan[]>(`/me/loans?history=${history}`),
  });
  const returnBook = useMutation({
    mutationFn: (id: number) => api.put(`/loans/${id}/return`),
    onSuccess: () => {
      message.success(t("loans.returnSuccess"));
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const renew = useMutation({
    mutationFn: (id: number) => api.post<Loan>(`/loans/${id}/renewals`),
    onSuccess: () => {
      message.success(t("loans.renewSuccess"));
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  if (loans.isPending) return <LoadingState />;
  if (loans.isError)
    return <ErrorState error={loans.error} retry={() => loans.refetch()} />;
  if (!loans.data.length)
    return (
      <EmptyState
        title={history ? t("loans.historyEmpty") : t("loans.currentEmpty")}
        description={t("loans.emptyDescription")}
        action={
          <Link to="/books">
            <Button type="primary">{t("loans.discover")}</Button>
          </Link>
        }
      />
    );
  return (
    <div className="loan-list">
      {loans.data.map((loan) => {
        const overdue = !history && new Date(loan.dueAt).getTime() < Date.now();
        return (
          <article className="loan-card" key={loan.id}>
            <Link className="loan-cover" to={`/books/${loan.bookId}`}>
              <BookCover book={loan} small />
            </Link>
            <div className="loan-info">
              <span className="eyebrow">
                {history
                  ? t("loans.completedEyebrow")
                  : t("loans.currentEyebrow")}
              </span>
              <Link to={`/books/${loan.bookId}`}>
                <h2>{loan.title}</h2>
              </Link>
              <p>{loan.author}</p>
              <div className="loan-dates">
                <span>
                  {t("loans.borrowedAt", { date: formatDate(loan.borrowedAt) })}
                </span>
                <span className={overdue ? "danger-text" : ""}>
                  {history
                    ? t("loans.returnedAt", {
                        date: formatDate(loan.returnedAt),
                      })
                    : t("loans.dueAt", { date: formatDate(loan.dueAt) })}
                </span>
              </div>
              {overdue && <Tag color="red">{t("loans.overdue")}</Tag>}
              {loan.fineAmountMinor > 0 && (
                <span className="danger-text small-text">
                  {t("loans.demoFine", { amount: money(loan.fineAmountMinor) })}
                </span>
              )}
            </div>
            {!history && (
              <div className="loan-actions">
                <Button
                  icon={<ReloadOutlined />}
                  disabled={overdue || loan.renewalCount >= 1}
                  loading={renew.isPending && renew.variables === loan.id}
                  onClick={() => renew.mutate(loan.id)}
                >
                  {t("loans.renew")}
                </Button>
                <Popconfirm
                  title={t("loans.returnConfirm")}
                  description={t("loans.returnDescription")}
                  onConfirm={() =>
                    returnBook.mutateAsync(loan.id).catch(() => {})
                  }
                  okText={t("loans.returnOk")}
                  cancelText={t("loans.keepReading")}
                >
                  <Button
                    type="primary"
                    loading={
                      returnBook.isPending && returnBook.variables === loan.id
                    }
                  >
                    {t("loans.return")}
                  </Button>
                </Popconfirm>
                <small>
                  {loan.renewalCount
                    ? t("loans.renewalUsed")
                    : t("loans.renewalHint")}
                </small>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Reservations() {
  const { t } = useTranslation("reader");
  const { message } = App.useApp();
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["reservations"],
    queryFn: () => api.get<Reservation[]>("/me/reservations"),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => api.delete(`/reservations/${id}`),
    onSuccess: () => {
      message.success(t("reservations.cancelSuccess"));
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const claim = useMutation({
    mutationFn: (id: number) => api.post("/loans", { bookId: id }),
    onSuccess: () => {
      message.success(t("reservations.claimSuccess"));
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  if (list.isPending) return <LoadingState />;
  if (list.isError)
    return <ErrorState error={list.error} retry={() => list.refetch()} />;
  if (!list.data.length)
    return (
      <EmptyState
        title={t("reservations.emptyTitle")}
        description={t("reservations.emptyDescription")}
        action={
          <Link to="/books">
            <Button>{t("reservations.browse")}</Button>
          </Link>
        }
      />
    );
  return (
    <div className="loan-list">
      {list.data.map((r) => (
        <article className="loan-card" key={r.id}>
          <Link className="loan-cover" to={`/books/${r.bookId}`}>
            <BookCover
              book={{
                title: r.title,
                author: t("reservations.library"),
                coverUrl: r.coverUrl,
              }}
              small
            />
          </Link>
          <div className="loan-info">
            <StatusTag value={r.status} />
            <Link to={`/books/${r.bookId}`}>
              <h2>{r.title}</h2>
            </Link>
            <p>
              {r.status === "READY"
                ? t("reservations.readyUntil", {
                    date: formatDate(r.expiresAt, true),
                  })
                : r.status === "WAITING"
                  ? t("reservations.queue", { position: r.position })
                  : t("reservations.createdAt", {
                      date: formatDate(r.createdAt),
                    })}
            </p>
          </div>
          <div className="loan-actions">
            {r.status === "READY" && (
              <Button
                type="primary"
                loading={claim.isPending && claim.variables === r.bookId}
                onClick={() => claim.mutate(r.bookId)}
              >
                {t("reservations.claim")}
              </Button>
            )}
            {["READY", "WAITING"].includes(r.status) && (
              <Popconfirm
                title={t("reservations.cancelConfirm")}
                okText={t("reservations.cancel")}
                cancelText={t("reservations.keep")}
                onConfirm={() => cancel.mutateAsync(r.id).catch(() => {})}
              >
                <Button loading={cancel.isPending && cancel.variables === r.id}>
                  {t("reservations.cancel")}
                </Button>
              </Popconfirm>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

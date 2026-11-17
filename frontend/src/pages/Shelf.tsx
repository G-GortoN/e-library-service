import { App, Button, Popconfirm, Tabs, Tag } from "antd";
import { ArrowRightOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
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
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") || "current";
  return (
    <section className="standard-page">
      <PageHeading
        eyebrow="YOUR READING CORNER"
        title="我的书架"
        description="读过的故事，正在翻阅的世界，还有值得期待的下一本。"
        extra={
          <Link className="text-link" to="/books">
            再找一本 <ArrowRightOutlined />
          </Link>
        }
      />
      <Tabs
        activeKey={tab}
        onChange={(key) => setSearch({ tab: key })}
        items={[
          { key: "current", label: "正在阅读", children: <Loans /> },
          {
            key: "reservations",
            label: "我的预约",
            children: <Reservations />,
          },
          { key: "history", label: "阅读足迹", children: <Loans history /> },
        ]}
      />
    </section>
  );
}

function Loans({ history = false }: { history?: boolean }) {
  const client = useQueryClient();
  const { message } = App.useApp();
  const loans = useQuery({
    queryKey: ["loans", history],
    queryFn: () => api.get<Loan[]>(`/me/loans?history=${history}`),
  });
  const returnBook = useMutation({
    mutationFn: (id: number) => api.put(`/loans/${id}/return`),
    onSuccess: () => {
      message.success("已归还。期待下一次相遇。");
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const renew = useMutation({
    mutationFn: (id: number) => api.post<Loan>(`/loans/${id}/renewals`),
    onSuccess: () => {
      message.success("续借成功，阅读时光延长了。");
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
        title={history ? "阅读足迹，等待第一步" : "书架还空着，故事正在等你"}
        description="找到一本喜欢的书，让它陪你度过下一段时光。"
        action={
          <Link to="/books">
            <Button type="primary">去发现好书</Button>
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
                {history ? "A CHAPTER COMPLETED" : "ON YOUR SHELF"}
              </span>
              <Link to={`/books/${loan.bookId}`}>
                <h2>{loan.title}</h2>
              </Link>
              <p>{loan.author}</p>
              <div className="loan-dates">
                <span>借阅于 {formatDate(loan.borrowedAt)}</span>
                <span className={overdue ? "danger-text" : ""}>
                  {history
                    ? `归还于 ${formatDate(loan.returnedAt)}`
                    : `到期于 ${formatDate(loan.dueAt)}`}
                </span>
              </div>
              {overdue && <Tag color="red">已逾期，请及时归还</Tag>}
              {loan.fineAmountMinor > 0 && (
                <span className="danger-text small-text">
                  演示逾期金额 {money(loan.fineAmountMinor)}
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
                  续借 7 天
                </Button>
                <Popconfirm
                  title="确认归还这本书？"
                  description="归还后将释放借阅授权，预约队列会继续推进。"
                  onConfirm={() =>
                    returnBook.mutateAsync(loan.id).catch(() => {})
                  }
                  okText="确认归还"
                  cancelText="继续阅读"
                >
                  <Button
                    type="primary"
                    loading={
                      returnBook.isPending && returnBook.variables === loan.id
                    }
                  >
                    归还书籍
                  </Button>
                </Popconfirm>
                <small>
                  {loan.renewalCount
                    ? "已使用续借机会"
                    : "有其他读者预约时无法续借"}
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
  const { message } = App.useApp();
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["reservations"],
    queryFn: () => api.get<Reservation[]>("/me/reservations"),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => api.delete(`/reservations/${id}`),
    onSuccess: () => {
      message.success("已取消预约。");
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const claim = useMutation({
    mutationFn: (id: number) => api.post("/loans", { bookId: id }),
    onSuccess: () => {
      message.success("领取成功，书已放入你的书架。");
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
        title="没有等待中的故事"
        description="喜欢的书暂时不可借时，可以加入预约队列。"
        action={
          <Link to="/books">
            <Button>浏览馆藏</Button>
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
                author: "FOLIO LIBRARY",
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
                ? `为你保留至 ${formatDate(r.expiresAt, true)}`
                : r.status === "WAITING"
                  ? `排队位置 ${r.position} · 轮到你时会收到提醒`
                  : `预约于 ${formatDate(r.createdAt)}`}
            </p>
          </div>
          <div className="loan-actions">
            {r.status === "READY" && (
              <Button
                type="primary"
                loading={claim.isPending && claim.variables === r.bookId}
                onClick={() => claim.mutate(r.bookId)}
              >
                领取并借阅
              </Button>
            )}
            {["READY", "WAITING"].includes(r.status) && (
              <Popconfirm
                title="取消这次预约？"
                okText="取消预约"
                cancelText="保留"
                onConfirm={() => cancel.mutateAsync(r.id).catch(() => {})}
              >
                <Button loading={cancel.isPending && cancel.variables === r.id}>
                  取消预约
                </Button>
              </Popconfirm>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

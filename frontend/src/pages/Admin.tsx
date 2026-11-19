import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { LanguageSwitcher, useLocalizedValidation } from "../language";
import { localizeText } from "../i18n";
import {
  App,
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AuditOutlined,
  BookOutlined,
  DashboardOutlined,
  DownloadOutlined,
  EditOutlined,
  InboxOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReadOutlined,
  TeamOutlined,
  UploadOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { api, errorMessage, queryString } from "../api";
import {
  BookCover,
  ErrorState,
  formatDate,
  LoadingState,
  money,
  PageHeading,
  StatusTag,
} from "../components";
import { useAuth } from "../auth";
import type {
  AdminFine,
  AdminLoan,
  AdminReaderInfo,
  AdminReservation,
  Audit,
  Book,
  BookStatus,
  Fine,
  ImportResult,
  Page,
  Stats,
  User,
} from "../types";

function adminReaderColumn(t: TFunction<"admin">) {
  return {
    title: t("reader"),
    key: "reader",
    width: 220,
    render: (_: unknown, reader: AdminReaderInfo) => (
      <div className="admin-reader-cell">
        <strong>
          {reader.readerName ||
            (reader.readerId
              ? t("reader.id", { id: reader.readerId })
              : t("notProvided"))}
        </strong>
        {reader.readerEmail && <small>{reader.readerEmail}</small>}
      </div>
    ),
  };
}

export default function Admin() {
  const { t } = useTranslation("admin");
  const nav = [
    {
      to: "/admin",
      label: t("nav.overview"),
      icon: <DashboardOutlined />,
      end: true,
    },
    { to: "/admin/books", label: t("nav.books"), icon: <BookOutlined /> },
    { to: "/admin/users", label: t("nav.users"), icon: <TeamOutlined /> },
    { to: "/admin/loans", label: t("nav.loans"), icon: <ReadOutlined /> },
    {
      to: "/admin/reservations",
      label: t("nav.reservations"),
      icon: <InboxOutlined />,
    },
    { to: "/admin/fines", label: t("nav.fines"), icon: <WalletOutlined /> },
    { to: "/admin/audit", label: t("nav.audit"), icon: <AuditOutlined /> },
  ];
  const { user } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <BookOutlined />
          </span>
          <strong>
            {t("brand.name")}
            <span>{t("brand.subtitle")}</span>
          </strong>
        </Link>
        <p className="admin-sidebar-label">{t("workspace.eyebrow")}</p>
        <nav aria-label={t("nav.label")}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-user-badge">
            <span>{user?.displayName.slice(0, 1)}</span>
            <div>
              <strong>{user?.displayName}</strong>
              <small>{t("workspace.role")}</small>
            </div>
          </div>
          <Link to="/books">
            <LogoutOutlined />
            {t("workspace.return")}
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>
            {t("workspace.title")}
            <i>/</i>
            {t("workspace.tagline")}
          </span>
          <Space>
            <LanguageSwitcher />
            <Tag color="green">{t("workspace.access")}</Tag>
          </Space>
        </header>
        <div className="admin-content">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="books" element={<BooksAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="loans" element={<LoansAdmin />} />
            <Route path="reservations" element={<ReservationsAdmin />} />
            <Route path="fines" element={<FinesAdmin />} />
            <Route path="audit" element={<AuditAdmin />} />
            <Route
              path="*"
              element={
                <ErrorState
                  title={t("workspace.notFound")}
                  description={t("workspace.notFoundHint")}
                />
              }
            />
          </Routes>
        </div>
        <footer className="admin-footer">{t("workspace.footer")}</footer>
      </div>
    </div>
  );
}

function useAdminList<T>(resource: string, search = "") {
  const [page, setPage] = useState(0);
  const result = useQuery({
    queryKey: ["admin", resource, page, search],
    queryFn: () =>
      api.get<Page<T>>(
        `/admin/${resource}?${queryString({ page, size: 20, q: search })}`,
      ),
  });
  useEffect(() => {
    setPage(0);
  }, [search]);
  return {
    result,
    pagination: {
      current: page + 1,
      pageSize: 20,
      total: result.data?.total || 0,
      showSizeChanger: false,
      onChange: (n: number) => setPage(n),
    },
  };
}
function AdminListError({
  result,
}: {
  result: { isError: boolean; error: unknown; refetch: () => unknown };
}) {
  return result.isError ? (
    <ErrorState error={result.error} retry={() => result.refetch()} />
  ) : null;
}
function Overview() {
  const { t } = useTranslation("admin");
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<Stats>("/admin/stats"),
  });
  const loans = useQuery({
    queryKey: ["admin", "recent-loans"],
    queryFn: () => api.get<Page<AdminLoan>>("/admin/loans?page=0&size=5"),
  });
  if (stats.isPending) return <LoadingState />;
  if (stats.isError)
    return <ErrorState error={stats.error} retry={() => stats.refetch()} />;
  const items = [
    [t("overview.books"), stats.data.books, "CATALOG", <BookOutlined />],
    [t("overview.readers"), stats.data.users, "READERS", <TeamOutlined />],
    [t("overview.loans"), stats.data.activeLoans, "ON LOAN", <ReadOutlined />],
    [
      t("overview.overdue"),
      stats.data.overdueLoans,
      "OVERDUE",
      <InboxOutlined />,
    ],
  ];
  return (
    <>
      <PageHeading
        eyebrow={t("overview.eyebrow")}
        title={t("overview.title")}
        description={t("overview.description")}
        extra={
          <Link to="/admin/books">
            <Button type="primary" icon={<PlusOutlined />}>
              {t("overview.manage")}
            </Button>
          </Link>
        }
      />
      <div className="metric-grid">
        {items.map(([label, value, en, icon]) => (
          <Card key={String(en)} className="metric-card">
            <div className="metric-top">
              <span>{label}</span>
              {icon}
            </div>
            <strong>{value}</strong>
            <small>{en}</small>
          </Card>
        ))}
      </div>
      <div className="admin-overview-grid">
        <Card
          title={t("overview.recent")}
          extra={<Link to="/admin/loans">{t("overview.all")}</Link>}
        >
          {loans.isError ? (
            <ErrorState error={loans.error} retry={() => loans.refetch()} />
          ) : (
            <Table
              rowKey="id"
              loading={loans.isPending}
              pagination={false}
              size="small"
              dataSource={loans.data?.items}
              columns={[
                adminReaderColumn(t),
                { title: t("column.book"), dataIndex: "title" },
                {
                  title: t("column.borrowedAt"),
                  dataIndex: "borrowedAt",
                  render: (v) => formatDate(v),
                },
                {
                  title: t("column.dueAt"),
                  dataIndex: "dueAt",
                  render: (v) => formatDate(v),
                },
              ]}
              scroll={{ x: 480 }}
            />
          )}
        </Card>
        <Card className="overview-note">
          <p className="eyebrow">{t("overview.noteEyebrow")}</p>
          <h2>
            {t("overview.noteLine1")}
            <br />
            {t("overview.noteLine2")}
          </h2>
          <dl>
            <div>
              <dt>{t("overview.reservations")}</dt>
              <dd>{stats.data.reservations}</dd>
            </div>
            <div>
              <dt>{t("overview.balance")}</dt>
              <dd>{money(stats.data.outstandingFineMinor)}</dd>
            </div>
          </dl>
          <p>{t("overview.auditHint")}</p>
        </Card>
      </div>
    </>
  );
}

function BooksAdmin() {
  const { t } = useTranslation("admin");
  const [search, setSearch] = useState("");
  const { result, pagination } = useAdminList<Book>("books", search);
  const client = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form] = Form.useForm();
  useLocalizedValidation(form);
  const [importOpen, setImportOpen] = useState(false);
  const refresh = () => {
    client.invalidateQueries();
  };
  const save = useMutation({
    mutationFn: (values: Record<string, string>) =>
      editing
        ? api.patch<Book>(`/admin/books/${editing.id}`, values)
        : api.post<Book>("/admin/books", values),
    onSuccess: () => {
      message.success(t("books.saved"));
      setOpen(false);
      refresh();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const status = useMutation({
    mutationFn: ({ book, status }: { book: Book; status: BookStatus }) =>
      api.put(`/admin/books/${book.id}/status`, { status }),
    onSuccess: () => {
      message.success(t("books.statusSaved"));
      refresh();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const upload = useMutation({
    mutationFn: (file: File) =>
      api.upload<Book>(`/admin/books/${editing?.id}/cover`, file),
    onSuccess: (book) => {
      message.success(t("books.coverSaved"));
      setEditing(book);
      refresh();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const edit = (book: Book | null) => {
    setEditing(book);
    form.resetFields();
    form.setFieldsValue(book || { category: "文学" });
    setOpen(true);
  };
  const columns: ColumnsType<Book> = [
    {
      title: t("column.book"),
      dataIndex: "title",
      width: 270,
      render: (_, b) => (
        <div className="admin-book-cell">
          <BookCover book={b} small />
          <div>
            <strong>{b.title}</strong>
            <small>{b.author}</small>
          </div>
        </div>
      ),
    },
    { title: t("column.category"), dataIndex: "category" },
    {
      title: t("column.status"),
      dataIndex: "status",
      render: (v) => <StatusTag value={v} />,
    },
    {
      title: t("column.borrowCount"),
      dataIndex: "borrowCount",
      render: (v) => t("count.times", { count: v || 0 }),
    },
    {
      title: t("column.actions"),
      key: "actions",
      width: 270,
      render: (_, b) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => edit(b)}>
            {t("action.edit")}
          </Button>
          <Popconfirm
            title={
              b.status === "PUBLISHED"
                ? t("books.unpublishConfirm")
                : t("books.publishConfirm")
            }
            description={
              b.status === "PUBLISHED"
                ? t("books.unpublishHint")
                : t("books.publishHint")
            }
            okText={t("action.confirm")}
            cancelText={t("action.cancel")}
            onConfirm={() =>
              status
                .mutateAsync({
                  book: b,
                  status:
                    b.status === "PUBLISHED" ? "UNPUBLISHED" : "PUBLISHED",
                })
                .catch(() => {})
            }
          >
            <Button
              size="small"
              loading={status.isPending && status.variables?.book.id === b.id}
            >
              {b.status === "PUBLISHED"
                ? t("books.unpublish")
                : t("books.publish")}
            </Button>
          </Popconfirm>
          {b.status !== "ARCHIVED" && (
            <Popconfirm
              title={t("books.archiveConfirm")}
              description={t("books.archiveHint")}
              okText={t("action.archive")}
              cancelText={t("action.cancel")}
              onConfirm={() =>
                status
                  .mutateAsync({ book: b, status: "ARCHIVED" })
                  .catch(() => {})
              }
            >
              <Button size="small" type="text">
                {t("action.archive")}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={t("books.eyebrow")}
        title={t("nav.books")}
        description={t("books.description")}
        extra={
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportOpen(true)}
            >
              {t("books.import")}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => edit(null)}
            >
              {t("books.add")}
            </Button>
          </Space>
        }
      />
      <Card className="admin-table-card">
        <div className="admin-toolbar">
          <Input.Search
            placeholder={t("books.search")}
            onSearch={setSearch}
            allowClear
            style={{ maxWidth: 360 }}
            enterButton={t("action.search")}
          />
          <span className="muted">
            {t("books.total", { count: result.data?.total ?? 0 })}
          </span>
        </div>
        <AdminListError result={result} />
        {!result.isError && (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={result.data?.items}
            loading={result.isPending}
            pagination={pagination}
            scroll={{ x: 950 }}
          />
        )}
      </Card>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("books.edit") : t("books.add")}
        size="large"
        extra={
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={save.isPending}
          >
            {t("action.save")}
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => save.mutate(values)}
        >
          <Form.Item
            name="title"
            label={t("books.title")}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("books.titleRequired"),
              },
              { max: 200, message: t("books.titleLimit") },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="author"
            label={t("books.author")}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("books.authorRequired"),
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category"
            label={t("column.category")}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("books.categoryRequired"),
              },
            ]}
          >
            <Input placeholder={t("books.categoryPlaceholder")} />
          </Form.Item>
          <Form.Item name="isbn" label="ISBN">
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label={t("books.descriptionLabel")}
            rules={[{ max: 6000, message: t("books.descriptionLimit") }]}
          >
            <Input.TextArea rows={6} maxLength={6000} showCount />
          </Form.Item>
        </Form>
        {editing ? (
          <div className="cover-upload-panel">
            <BookCover book={editing} small />
            <div>
              <h3>{t("books.cover")}</h3>
              <p className="muted">{t("books.coverFormats")}</p>
              <Upload
                accept="image/jpeg,image/png"
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > 5 * 1024 * 1024) {
                    message.error(t("books.coverLimit"));
                    return false;
                  }
                  upload.mutate(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={upload.isPending}>
                  {t("books.coverUpload")}
                </Button>
              </Upload>
            </div>
          </div>
        ) : (
          <Alert type="info" title={t("books.draftHint")} />
        )}
      </Drawer>
      <BookImport open={importOpen} close={() => setImportOpen(false)} />
    </>
  );
}

function BookImport({ open, close }: { open: boolean; close: () => void }) {
  const { t } = useTranslation("admin");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const client = useQueryClient();
  const { message } = App.useApp();
  const upload = useMutation({
    mutationFn: (dryRun: boolean) =>
      api.upload<ImportResult>(`/admin/books/import?dryRun=${dryRun}`, file!),
    onSuccess: (r, dryRun) => {
      if (dryRun) {
        setPreview(r);
      } else {
        message.success(t("import.success", { count: r.imported }));
        client.invalidateQueries();
        setFile(null);
        setPreview(null);
        close();
      }
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const template = () => {
    const blob = new Blob(
      [
        `\ufefftitle,author,isbn,description,category\n${t("import.exampleRow")}\n`,
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "folio-catalog-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Modal
      open={open}
      onCancel={() => {
        setPreview(null);
        setFile(null);
        close();
      }}
      title={t("import.title")}
      width={760}
      footer={
        <Space>
          <Button onClick={close}>{t("action.cancel")}</Button>
          <Button
            disabled={!file}
            loading={upload.isPending}
            onClick={() => upload.mutate(true)}
          >
            {t("import.preview")}
          </Button>
          <Button
            type="primary"
            disabled={
              !preview ||
              !preview.rows.length ||
              preview.rows.some((r) => !r.valid)
            }
            loading={upload.isPending}
            onClick={() => upload.mutate(false)}
          >
            {t("import.confirm")}
          </Button>
        </Space>
      }
    >
      <p className="muted">{t("import.instructions")}</p>
      <Button icon={<DownloadOutlined />} type="link" onClick={template}>
        {t("import.download")}
      </Button>
      <Upload.Dragger
        accept=".csv,text/csv"
        maxCount={1}
        fileList={file ? [{ uid: "csv", name: file.name, status: "done" }] : []}
        beforeUpload={(f) => {
          setFile(f);
          setPreview(null);
          return false;
        }}
        onRemove={() => {
          setFile(null);
          setPreview(null);
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p>{t("import.drop")}</p>
        <p className="ant-upload-hint">{t("import.fields")}</p>
      </Upload.Dragger>
      {preview && (
        <Table
          size="small"
          className="import-preview"
          rowKey="row"
          dataSource={preview.rows}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: t("import.row"), dataIndex: "row", width: 90 },
            {
              title: t("import.validation"),
              dataIndex: "valid",
              width: 100,
              render: (v) => (
                <Tag color={v ? "green" : "red"}>
                  {v ? t("import.passed") : t("import.invalid")}
                </Tag>
              ),
            },
            {
              title: t("import.errors"),
              dataIndex: "errors",
              render: (v: string[]) =>
                v.length
                  ? v
                      .map((error) => localizeText(error))
                      .join(t("import.separator"))
                  : "—",
            },
          ]}
        />
      )}
    </Modal>
  );
}

function UsersAdmin() {
  const { t } = useTranslation("admin");
  const [search, setSearch] = useState("");
  const { result, pagination } = useAdminList<User>("users", search);
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  useLocalizedValidation(form);
  const client = useQueryClient();
  const { message } = App.useApp();
  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      editing
        ? api.patch<User>(`/admin/users/${editing.id}`, {
            displayName: values.displayName,
            role: values.role,
            enabled: values.enabled,
          })
        : api.post<User>("/admin/users", values),
    onSuccess: () => {
      message.success(t("users.saved"));
      setOpen(false);
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: (id: number) => api.post(`/admin/users/${id}/password-reset`),
    onSuccess: () => message.success(t("users.resetRequested")),
    onError: (e) => message.error(errorMessage(e)),
  });
  const edit = (u: User | null) => {
    setEditing(u);
    form.resetFields();
    form.setFieldsValue(u || { role: "READER", enabled: true });
    setOpen(true);
  };
  const columns: ColumnsType<User> = [
    {
      title: t("reader"),
      dataIndex: "displayName",
      render: (_, u) => (
        <div className="user-cell">
          <span>{u.displayName.slice(0, 1)}</span>
          <div>
            <strong>{u.displayName}</strong>
            <small>{u.email}</small>
          </div>
        </div>
      ),
    },
    {
      title: t("users.role"),
      dataIndex: "role",
      render: (v) => (
        <Tag color={v === "ADMIN" ? "purple" : "default"}>
          {v === "ADMIN" ? t("users.admin") : t("reader")}
        </Tag>
      ),
    },
    {
      title: t("column.status"),
      dataIndex: "enabled",
      render: (v) => (
        <Tag color={v ? "green" : "red"}>
          {v ? t("users.enabled") : t("users.disabled")}
        </Tag>
      ),
    },
    {
      title: t("users.email"),
      dataIndex: "emailVerified",
      render: (v) => (v ? t("users.verified") : t("users.unverified")),
    },
    {
      title: t("column.actions"),
      key: "action",
      width: 220,
      render: (_, u) => (
        <Space>
          <Button size="small" onClick={() => edit(u)}>
            {t("users.manage")}
          </Button>
          <Popconfirm
            title={t("users.resetConfirm")}
            description={t("users.resetHint")}
            okText={t("action.send")}
            cancelText={t("action.cancel")}
            onConfirm={() => reset.mutateAsync(u.id).catch(() => {})}
          >
            <Button
              size="small"
              loading={reset.isPending && reset.variables === u.id}
            >
              {t("users.reset")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={t("users.eyebrow")}
        title={t("nav.users")}
        description={t("users.description")}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => edit(null)}
          >
            {t("users.create")}
          </Button>
        }
      />
      <Card className="admin-table-card">
        <div className="admin-toolbar">
          <Input.Search
            placeholder={t("users.search")}
            onSearch={setSearch}
            allowClear
            style={{ maxWidth: 360 }}
            enterButton={t("action.search")}
          />
          <span className="muted">
            {t("users.total", { count: result.data?.total ?? 0 })}
          </span>
        </div>
        <AdminListError result={result} />
        {!result.isError && (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={result.data?.items}
            loading={result.isPending}
            pagination={pagination}
            scroll={{ x: 850 }}
          />
        )}
      </Card>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("users.edit") : t("users.create")}
        extra={
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={save.isPending}
          >
            {t("action.save")}
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => save.mutate(values)}
        >
          <Form.Item
            name="displayName"
            label={t("users.name")}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("users.nameRequired"),
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label={t("users.email")}
            rules={[
              { required: true, message: t("users.emailRequired") },
              { type: "email", message: t("users.emailInvalid") },
            ]}
          >
            <Input disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="password"
              label={t("users.password")}
              rules={[
                { required: true, message: t("users.passwordRequired") },
                {
                  min: 10,
                  max: 72,
                  message: t("users.passwordLimit"),
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item name="role" label={t("users.role")}>
            <Select
              options={[
                { value: "READER", label: t("reader") },
                { value: "ADMIN", label: t("users.admin") },
              ]}
            />
          </Form.Item>
          {editing && (
            <Form.Item
              name="enabled"
              label={t("users.enableAccount")}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
          <Alert
            type="info"
            showIcon
            title={t("users.accessTitle")}
            description={t("users.accessHint")}
          />
        </Form>
      </Drawer>
    </>
  );
}

function LoansAdmin() {
  const { t } = useTranslation("admin");
  const { result, pagination } = useAdminList<AdminLoan>("loans");
  const client = useQueryClient();
  const { message } = App.useApp();
  const ret = useMutation({
    mutationFn: (id: number) => api.put(`/admin/loans/${id}/return`),
    onSuccess: () => {
      message.success(t("loans.returnedToast"));
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeading
        eyebrow={t("loans.eyebrow")}
        title={t("nav.loans")}
        description={t("loans.description")}
      />
      <Card className="admin-table-card">
        <AdminListError result={result} />
        {!result.isError && (
          <Table
            rowKey="id"
            loading={result.isPending}
            dataSource={result.data?.items}
            pagination={pagination}
            scroll={{ x: 950 }}
            columns={[
              adminReaderColumn(t),
              {
                title: t("loans.id"),
                dataIndex: "id",
                ellipsis: true,
                width: 150,
              },
              { title: t("column.book"), dataIndex: "title" },
              {
                title: t("loans.borrowed"),
                dataIndex: "borrowedAt",
                render: (v) => formatDate(v),
              },
              {
                title: t("loans.due"),
                dataIndex: "dueAt",
                render: (v, r) => (
                  <span
                    className={
                      !r.returnedAt && new Date(v).getTime() < Date.now()
                        ? "danger-text"
                        : ""
                    }
                  >
                    {formatDate(v)}
                  </span>
                ),
              },
              {
                title: t("loans.returned"),
                dataIndex: "returnedAt",
                render: (v) => formatDate(v),
              },
              {
                title: t("loans.renewal"),
                dataIndex: "renewalCount",
                render: (v) => t("count.times", { count: v }),
              },
              {
                title: t("column.actions"),
                key: "action",
                render: (_, r) =>
                  r.returnedAt ? (
                    <Tag>{t("loans.returnedStatus")}</Tag>
                  ) : (
                    <Popconfirm
                      title={t("loans.returnConfirm")}
                      description={t("loans.returnHint")}
                      okText={t("loans.returnConfirmAction")}
                      cancelText={t("action.cancel")}
                      onConfirm={() => ret.mutateAsync(r.id).catch(() => {})}
                    >
                      <Button
                        size="small"
                        loading={ret.isPending && ret.variables === r.id}
                      >
                        {t("loans.return")}
                      </Button>
                    </Popconfirm>
                  ),
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}

function ReservationsAdmin() {
  const { t } = useTranslation("admin");
  const { result, pagination } = useAdminList<AdminReservation>("reservations");
  return (
    <>
      <PageHeading
        eyebrow={t("reservations.eyebrow")}
        title={t("nav.reservations")}
        description={t("reservations.description")}
      />
      <Card className="admin-table-card">
        <AdminListError result={result} />
        {!result.isError && (
          <Table
            rowKey="id"
            dataSource={result.data?.items}
            loading={result.isPending}
            pagination={pagination}
            scroll={{ x: 800 }}
            columns={[
              adminReaderColumn(t),
              {
                title: t("reservations.id"),
                dataIndex: "id",
                ellipsis: true,
                width: 150,
              },
              { title: t("column.book"), dataIndex: "title" },
              {
                title: t("column.status"),
                dataIndex: "status",
                render: (v) => <StatusTag value={v} />,
              },
              {
                title: t("reservations.position"),
                dataIndex: "position",
                render: (v) => v || "—",
              },
              {
                title: t("reservations.created"),
                dataIndex: "createdAt",
                render: (v) => formatDate(v, true),
              },
              {
                title: t("reservations.expires"),
                dataIndex: "expiresAt",
                render: (v) => formatDate(v, true),
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}

function FinesAdmin() {
  const { t } = useTranslation("admin");
  const { result, pagination } = useAdminList<AdminFine>("fines");
  const client = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Fine | null>(null);
  const [form] = Form.useForm();
  useLocalizedValidation(form);
  const adjust = useMutation({
    mutationFn: (values: { amount: number; reason: string }) =>
      api.post(`/admin/fines/${editing?.id}/adjustments`, {
        amountMinor: Math.round(values.amount * 100),
        reason: values.reason,
      }),
    onSuccess: () => {
      message.success(t("fines.waivedToast"));
      setEditing(null);
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const settle = useMutation({
    mutationFn: (id: number) => api.post(`/admin/fines/${id}/settle`),
    onSuccess: () => {
      message.success(t("fines.settledToast"));
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeading
        eyebrow={t("fines.eyebrow")}
        title={t("nav.fines")}
        description={t("fines.description")}
      />
      <Alert
        className="billing-notice"
        type="info"
        showIcon
        title={t("fines.notice")}
        description={t("fines.noticeHint")}
      />
      <Card className="admin-table-card">
        <AdminListError result={result} />
        {!result.isError && (
          <Table
            rowKey="id"
            dataSource={result.data?.items}
            loading={result.isPending}
            pagination={pagination}
            scroll={{ x: 900 }}
            columns={[
              adminReaderColumn(t),
              { title: t("column.book"), dataIndex: "bookTitle" },
              {
                title: t("fines.original"),
                dataIndex: "amountMinor",
                render: (v) => money(v),
              },
              {
                title: t("fines.waived"),
                dataIndex: "waivedMinor",
                render: (v) => money(v),
              },
              {
                title: t("fines.outstanding"),
                render: (_, f) =>
                  money(
                    ["SETTLED", "PAID", "WAIVED"].includes(f.status)
                      ? 0
                      : Math.max(0, f.amountMinor - f.waivedMinor),
                  ),
              },
              {
                title: t("column.status"),
                dataIndex: "status",
                render: (v) => <StatusTag value={v} />,
              },
              {
                title: t("column.actions"),
                render: (_, f) =>
                  !["SETTLED", "PAID", "WAIVED"].includes(f.status) ? (
                    <Space>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditing(f);
                          form.resetFields();
                        }}
                      >
                        {t("fines.waive")}
                      </Button>
                      <Popconfirm
                        title={t("fines.settleConfirm")}
                        description={t("fines.settleHint")}
                        okText={t("action.confirm")}
                        cancelText={t("action.cancel")}
                        onConfirm={() =>
                          settle.mutateAsync(f.id).catch(() => {})
                        }
                      >
                        <Button
                          size="small"
                          loading={
                            settle.isPending && settle.variables === f.id
                          }
                        >
                          {t("fines.settle")}
                        </Button>
                      </Popconfirm>
                    </Space>
                  ) : (
                    <span className="muted">{t("fines.processed")}</span>
                  ),
              },
            ]}
          />
        )}
      </Card>
      <Modal
        open={!!editing}
        title={t("fines.waiveTitle")}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={adjust.isPending}
        okText={t("fines.waiveConfirm")}
        cancelText={t("action.cancel")}
      >
        <p>
          {t("fines.balance", {
            title: editing?.bookTitle || "",
            amount: money(
              editing ? editing.amountMinor - editing.waivedMinor : 0,
            ),
          })}
        </p>
        <Form form={form} layout="vertical" onFinish={(v) => adjust.mutate(v)}>
          <Form.Item
            name="amount"
            label={t("fines.amount")}
            rules={[
              { required: true, message: t("fines.amountRequired") },
              { type: "number", min: 0.01, message: t("fines.amountPositive") },
            ]}
          >
            <InputNumber
              min={0.01}
              max={
                editing
                  ? (editing.amountMinor - editing.waivedMinor) / 100
                  : undefined
              }
              precision={2}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label={t("fines.reason")}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("fines.reasonRequired"),
              },
              { max: 500, message: t("fines.reasonLimit") },
            ]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function AuditAdmin() {
  const { t } = useTranslation("admin");
  const { result, pagination } = useAdminList<Audit>("audit");
  return (
    <>
      <PageHeading
        eyebrow={t("audit.eyebrow")}
        title={t("nav.audit")}
        description={t("audit.description")}
      />
      <Card className="admin-table-card">
        <AdminListError result={result} />
        {!result.isError && (
          <Table
            rowKey="id"
            dataSource={result.data?.items}
            loading={result.isPending}
            pagination={pagination}
            scroll={{ x: 950 }}
            columns={[
              {
                title: t("audit.time"),
                dataIndex: "createdAt",
                width: 180,
                render: (v) => formatDate(v, true),
              },
              { title: t("audit.actor"), dataIndex: "actor", ellipsis: true },
              {
                title: t("column.actions"),
                dataIndex: "action",
                render: (v: string) => (
                  <Tag title={v}>
                    {t(`audit.action.${v}`, { defaultValue: v })}
                  </Tag>
                ),
              },
              { title: t("audit.target"), dataIndex: "target", ellipsis: true },
              {
                title: t("audit.detail"),
                dataIndex: "detail",
                ellipsis: true,
                render: (value: string, record: Audit) =>
                  auditDetail(value, record.action, t),
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}

function auditDetail(value: string, action: string, t: TFunction<"admin">) {
  if (action === "BOOK_STATUS")
    return t(`audit.status.${value}`, { defaultValue: value });
  if (action === "USER_CREATE")
    return value === "ADMIN"
      ? t("users.admin")
      : value === "READER"
        ? t("reader")
        : value;
  const details: Record<string, string> = {
    "Administrative return": "audit.detail.return",
    "Demonstration only; no payment processed": "audit.detail.settle",
    "Uploaded sanitized PNG": "audit.detail.cover",
    "CSV import": "audit.detail.import",
  };
  if (details[value]) return t(details[value]);
  if (action === "USER_UPDATE") {
    const update = /^enabled=(true|false),role=(ADMIN|READER)$/.exec(value);
    if (update)
      return t("audit.detail.userUpdate", {
        status: t(update[1] === "true" ? "users.enabled" : "users.disabled"),
        role: t(update[2] === "ADMIN" ? "users.admin" : "reader"),
      });
  }
  // Book titles and administrator-entered reasons remain original content.
  return value;
}

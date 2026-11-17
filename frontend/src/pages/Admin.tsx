import { useEffect, useState } from "react";
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

const adminReaderColumn = {
  title: "读者",
  key: "reader",
  width: 220,
  render: (_: unknown, reader: AdminReaderInfo) => (
    <div className="admin-reader-cell">
      <strong>
        {reader.readerName ||
          (reader.readerId ? `读者 #${reader.readerId}` : "未提供")}
      </strong>
      {reader.readerEmail && <small>{reader.readerEmail}</small>}
    </div>
  ),
};

const nav = [
  { to: "/admin", label: "运营概览", icon: <DashboardOutlined />, end: true },
  { to: "/admin/books", label: "书籍管理", icon: <BookOutlined /> },
  { to: "/admin/users", label: "账号管理", icon: <TeamOutlined /> },
  { to: "/admin/loans", label: "借阅记录", icon: <ReadOutlined /> },
  { to: "/admin/reservations", label: "预约队列", icon: <InboxOutlined /> },
  { to: "/admin/fines", label: "演示账单", icon: <WalletOutlined /> },
  { to: "/admin/audit", label: "操作审计", icon: <AuditOutlined /> },
];
export default function Admin() {
  const { user } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <BookOutlined />
          </span>
          <strong>
            栖页<span>FOLIO</span>
          </strong>
        </Link>
        <p className="admin-sidebar-label">LIBRARY WORKSPACE</p>
        <nav aria-label="管理后台">
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
              <small>图书馆管理员</small>
            </div>
          </div>
          <Link to="/books">
            <LogoutOutlined /> 返回读者端
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>
            栖页管理工作台 <i>/</i> 让好书有序流动
          </span>
          <Tag color="green">管理访问</Tag>
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
                  title="管理页面不存在"
                  description="请通过左侧导航访问管理功能。"
                />
              }
            />
          </Routes>
        </div>
        <footer className="admin-footer">
          FOLIO LIBRARY · 每一个有序的细节，都为了更好的阅读。
        </footer>
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
    ["馆藏图书", stats.data.books, "CATALOG", <BookOutlined />],
    ["注册读者", stats.data.users, "READERS", <TeamOutlined />],
    ["正在借阅", stats.data.activeLoans, "ON LOAN", <ReadOutlined />],
    ["逾期借阅", stats.data.overdueLoans, "OVERDUE", <InboxOutlined />],
  ];
  return (
    <>
      <PageHeading
        eyebrow="A WELL-KEPT LIBRARY"
        title="每一次借阅，都值得被照顾"
        description="从馆藏到读者，在这里掌握图书馆的日常。"
        extra={
          <Link to="/admin/books">
            <Button type="primary" icon={<PlusOutlined />}>
              管理馆藏
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
          title="最近借阅"
          extra={<Link to="/admin/loans">全部记录 →</Link>}
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
                adminReaderColumn,
                { title: "书籍", dataIndex: "title" },
                {
                  title: "借阅时间",
                  dataIndex: "borrowedAt",
                  render: (v) => formatDate(v),
                },
                {
                  title: "到期时间",
                  dataIndex: "dueAt",
                  render: (v) => formatDate(v),
                },
              ]}
              scroll={{ x: 480 }}
            />
          )}
        </Card>
        <Card className="overview-note">
          <p className="eyebrow">IN THE LIBRARY</p>
          <h2>
            有序流动，
            <br />
            静心阅读。
          </h2>
          <dl>
            <div>
              <dt>当前预约</dt>
              <dd>{stats.data.reservations}</dd>
            </div>
            <div>
              <dt>待处理演示金额</dt>
              <dd>{money(stats.data.outstandingFineMinor)}</dd>
            </div>
          </dl>
          <p>所有管理修改都会留下审计记录。账单为演示记账，不产生真实收费。</p>
        </Card>
      </div>
    </>
  );
}

function BooksAdmin() {
  const [search, setSearch] = useState("");
  const { result, pagination } = useAdminList<Book>("books", search);
  const client = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form] = Form.useForm();
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
      message.success("书籍信息已保存。");
      setOpen(false);
      refresh();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const status = useMutation({
    mutationFn: ({ book, status }: { book: Book; status: BookStatus }) =>
      api.put(`/admin/books/${book.id}/status`, { status }),
    onSuccess: () => {
      message.success("上架状态已更新。");
      refresh();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const upload = useMutation({
    mutationFn: (file: File) =>
      api.upload<Book>(`/admin/books/${editing?.id}/cover`, file),
    onSuccess: (book) => {
      message.success("封面已更新。");
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
      title: "书籍",
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
    { title: "分类", dataIndex: "category" },
    {
      title: "状态",
      dataIndex: "status",
      render: (v) => <StatusTag value={v} />,
    },
    { title: "借阅", dataIndex: "borrowCount", render: (v) => `${v || 0} 次` },
    {
      title: "操作",
      key: "actions",
      width: 270,
      render: (_, b) => (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => edit(b)}>
            编辑
          </Button>
          <Popconfirm
            title={b.status === "PUBLISHED" ? "确认下架？" : "确认上架？"}
            description={
              b.status === "PUBLISHED"
                ? "下架将取消有效预约；既有借阅和历史保留。"
                : "上架后读者可浏览、借阅和预约。"
            }
            okText="确认"
            cancelText="取消"
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
              {b.status === "PUBLISHED" ? "下架" : "上架"}
            </Button>
          </Popconfirm>
          {b.status !== "ARCHIVED" && (
            <Popconfirm
              title="确认归档？"
              description="归档保留历史，停止新借阅与预约。"
              okText="归档"
              cancelText="取消"
              onConfirm={() =>
                status
                  .mutateAsync({ book: b, status: "ARCHIVED" })
                  .catch(() => {})
              }
            >
              <Button size="small" type="text">
                归档
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
        eyebrow="CATALOG MANAGEMENT"
        title="书籍管理"
        description="维护每一本书的信息，让值得阅读的内容被看见。"
        extra={
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportOpen(true)}
            >
              导入书目
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => edit(null)}
            >
              新增书籍
            </Button>
          </Space>
        }
      />
      <Card className="admin-table-card">
        <div className="admin-toolbar">
          <Input.Search
            placeholder="搜索书名、作者"
            onSearch={setSearch}
            allowClear
            style={{ maxWidth: 360 }}
            enterButton="搜索"
          />
          <span className="muted">
            {result.data?.total ?? "—"} 本馆藏 · 包含草稿与下架
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
        title={editing ? "编辑书籍" : "新增书籍"}
        size="large"
        extra={
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={save.isPending}
          >
            保存
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
            label="书名"
            rules={[
              { required: true, whitespace: true, message: "请输入书名" },
              { max: 200, message: "书名不超过200位" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="author"
            label="作者"
            rules={[
              { required: true, whitespace: true, message: "请输入作者" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[
              { required: true, whitespace: true, message: "请输入分类" },
            ]}
          >
            <Input placeholder="例如：文学、科技、人文" />
          </Form.Item>
          <Form.Item name="isbn" label="ISBN">
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="内容简介"
            rules={[{ max: 6000, message: "内容简介不能超过6000位" }]}
          >
            <Input.TextArea rows={6} maxLength={6000} showCount />
          </Form.Item>
        </Form>
        {editing ? (
          <div className="cover-upload-panel">
            <BookCover book={editing} small />
            <div>
              <h3>书籍封面</h3>
              <p className="muted">JPEG、PNG，最大 5 MB。</p>
              <Upload
                accept="image/jpeg,image/png"
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > 5 * 1024 * 1024) {
                    message.error("封面不能超过5MB");
                    return false;
                  }
                  upload.mutate(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={upload.isPending}>
                  上传封面
                </Button>
              </Upload>
            </div>
          </div>
        ) : (
          <Alert type="info" title="新书保存为草稿后，可以上传封面并上架。" />
        )}
      </Drawer>
      <BookImport open={importOpen} close={() => setImportOpen(false)} />
    </>
  );
}

function BookImport({ open, close }: { open: boolean; close: () => void }) {
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
        message.success(`已导入 ${r.imported} 本书。`);
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
        "\ufefftitle,author,isbn,description,category\n示例书籍,示例作者,,内容简介,文学\n",
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
      title="CSV 书目导入"
      width={760}
      footer={
        <Space>
          <Button onClick={close}>取消</Button>
          <Button
            disabled={!file}
            loading={upload.isPending}
            onClick={() => upload.mutate(true)}
          >
            校验与预览
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
            确认导入
          </Button>
        </Space>
      }
    >
      <p className="muted">
        先选择 UTF-8
        CSV，预览并检查每行结果，再确认导入。重复或不合法记录需修正。
      </p>
      <Button icon={<DownloadOutlined />} type="link" onClick={template}>
        下载书目模板
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
        <p>拖入 CSV 文件，或点击选择</p>
        <p className="ant-upload-hint">
          字段：title、author、isbn、description、category
        </p>
      </Upload.Dragger>
      {preview && (
        <Table
          size="small"
          className="import-preview"
          rowKey="row"
          dataSource={preview.rows}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: "CSV 行", dataIndex: "row", width: 90 },
            {
              title: "校验",
              dataIndex: "valid",
              width: 100,
              render: (v) => (
                <Tag color={v ? "green" : "red"}>{v ? "通过" : "需修正"}</Tag>
              ),
            },
            {
              title: "错误说明",
              dataIndex: "errors",
              render: (v: string[]) => (v.length ? v.join("；") : "—"),
            },
          ]}
        />
      )}
    </Modal>
  );
}

function UsersAdmin() {
  const [search, setSearch] = useState("");
  const { result, pagination } = useAdminList<User>("users", search);
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
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
      message.success("账号已保存。");
      setOpen(false);
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: (id: number) => api.post(`/admin/users/${id}/password-reset`),
    onSuccess: () => message.success("已提交密码重置邮件请求。"),
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
      title: "读者",
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
      title: "角色",
      dataIndex: "role",
      render: (v) => (
        <Tag color={v === "ADMIN" ? "purple" : "default"}>
          {v === "ADMIN" ? "管理员" : "读者"}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      render: (v) => (
        <Tag color={v ? "green" : "red"}>{v ? "已启用" : "已禁用"}</Tag>
      ),
    },
    {
      title: "邮箱",
      dataIndex: "emailVerified",
      render: (v) => (v ? "已验证" : "未验证"),
    },
    {
      title: "操作",
      key: "action",
      width: 220,
      render: (_, u) => (
        <Space>
          <Button size="small" onClick={() => edit(u)}>
            管理
          </Button>
          <Popconfirm
            title="发送密码重置邮件？"
            description="管理员不能查看或读取用户密码。"
            okText="发送"
            cancelText="取消"
            onConfirm={() => reset.mutateAsync(u.id).catch(() => {})}
          >
            <Button
              size="small"
              loading={reset.isPending && reset.variables === u.id}
            >
              重置密码
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="READER MANAGEMENT"
        title="账号管理"
        description="管理读者与角色，安全地维护每个阅读空间。"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => edit(null)}
          >
            创建账号
          </Button>
        }
      />
      <Card className="admin-table-card">
        <div className="admin-toolbar">
          <Input.Search
            placeholder="搜索称呼、邮箱"
            onSearch={setSearch}
            allowClear
            style={{ maxWidth: 360 }}
            enterButton="搜索"
          />
          <span className="muted">{result.data?.total ?? "—"} 个账号</span>
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
        title={editing ? "管理账号" : "创建账号"}
        extra={
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={save.isPending}
          >
            保存
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
            label="称呼"
            rules={[
              { required: true, whitespace: true, message: "请输入称呼" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="password"
              label="初始密码"
              rules={[
                { required: true, message: "请输入初始密码" },
                {
                  min: 10,
                  max: 72,
                  message: "密码10–72位，非ASCII字符受字节限制",
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item name="role" label="角色">
            <Select
              options={[
                { value: "READER", label: "读者" },
                { value: "ADMIN", label: "管理员" },
              ]}
            />
          </Form.Item>
          {editing && (
            <Form.Item name="enabled" label="账号启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <Alert
            type="info"
            showIcon
            title="账号状态变更立即影响访问权限"
            description="禁用将取消有效预约并使现有会话失效，历史记录保留。系统保护最后一个有效管理员。"
          />
        </Form>
      </Drawer>
    </>
  );
}

function LoansAdmin() {
  const { result, pagination } = useAdminList<AdminLoan>("loans");
  const client = useQueryClient();
  const { message } = App.useApp();
  const ret = useMutation({
    mutationFn: (id: number) => api.put(`/admin/loans/${id}/return`),
    onSuccess: () => {
      message.success("已代为归还，并保留审计记录。");
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeading
        eyebrow="LENDING RECORDS"
        title="借阅记录"
        description="查看借阅生命周期，在必要时协助读者归还。"
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
              adminReaderColumn,
              {
                title: "借阅编号",
                dataIndex: "id",
                ellipsis: true,
                width: 150,
              },
              adminReaderColumn,
              { title: "书籍", dataIndex: "title" },
              {
                title: "借阅于",
                dataIndex: "borrowedAt",
                render: (v) => formatDate(v),
              },
              {
                title: "到期于",
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
                title: "归还于",
                dataIndex: "returnedAt",
                render: (v) => formatDate(v),
              },
              {
                title: "续借",
                dataIndex: "renewalCount",
                render: (v) => `${v} 次`,
              },
              {
                title: "操作",
                key: "action",
                render: (_, r) =>
                  r.returnedAt ? (
                    <Tag>已归还</Tag>
                  ) : (
                    <Popconfirm
                      title="以管理员身份代为归还？"
                      description="操作将释放授权、计算演示逾期金额并留下审计。"
                      okText="确认归还"
                      cancelText="取消"
                      onConfirm={() => ret.mutateAsync(r.id).catch(() => {})}
                    >
                      <Button
                        size="small"
                        loading={ret.isPending && ret.variables === r.id}
                      >
                        代为归还
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
  const { result, pagination } = useAdminList<AdminReservation>("reservations");
  return (
    <>
      <PageHeading
        eyebrow="RESERVATION QUEUE"
        title="预约队列"
        description="按顺序分配每一次阅读机会。可领取授权保留48小时。"
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
              adminReaderColumn,
              {
                title: "预约编号",
                dataIndex: "id",
                ellipsis: true,
                width: 150,
              },
              adminReaderColumn,
              { title: "书籍", dataIndex: "title" },
              {
                title: "状态",
                dataIndex: "status",
                render: (v) => <StatusTag value={v} />,
              },
              {
                title: "队列位置",
                dataIndex: "position",
                render: (v) => v || "—",
              },
              {
                title: "预约时间",
                dataIndex: "createdAt",
                render: (v) => formatDate(v, true),
              },
              {
                title: "保留至",
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
  const { result, pagination } = useAdminList<AdminFine>("fines");
  const client = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Fine | null>(null);
  const [form] = Form.useForm();
  const adjust = useMutation({
    mutationFn: (values: { amount: number; reason: string }) =>
      api.post(`/admin/fines/${editing?.id}/adjustments`, {
        amountMinor: Math.round(values.amount * 100),
        reason: values.reason,
      }),
    onSuccess: () => {
      message.success("减免已记录。");
      setEditing(null);
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const settle = useMutation({
    mutationFn: (id: number) => api.post(`/admin/fines/${id}/settle`),
    onSuccess: () => {
      message.success("已标记演示结清，没有发生真实扣款。");
      client.invalidateQueries();
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeading
        eyebrow="DEMONSTRATION BILLING"
        title="演示账单"
        description="清晰展示计费与调整，不连接支付网关，不发生真实扣款。"
      />
      <Alert
        className="billing-notice"
        type="info"
        showIcon
        title="仅作演示记账"
        description="减免与演示结清均保存操作记录。实际余额以服务端返回为准。"
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
              adminReaderColumn,
              { title: "书籍", dataIndex: "bookTitle" },
              {
                title: "原金额",
                dataIndex: "amountMinor",
                render: (v) => money(v),
              },
              {
                title: "已减免",
                dataIndex: "waivedMinor",
                render: (v) => money(v),
              },
              {
                title: "待处理",
                render: (_, f) =>
                  money(
                    ["SETTLED", "PAID", "WAIVED"].includes(f.status)
                      ? 0
                      : Math.max(0, f.amountMinor - f.waivedMinor),
                  ),
              },
              {
                title: "状态",
                dataIndex: "status",
                render: (v) => <StatusTag value={v} />,
              },
              {
                title: "操作",
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
                        减免
                      </Button>
                      <Popconfirm
                        title="标记为演示结清？"
                        description="这不代表已收到真实款项。"
                        okText="确认"
                        cancelText="取消"
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
                          演示结清
                        </Button>
                      </Popconfirm>
                    </Space>
                  ) : (
                    <span className="muted">已处理</span>
                  ),
              },
            ]}
          />
        )}
      </Card>
      <Modal
        open={!!editing}
        title="记录账单减免"
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={adjust.isPending}
        okText="记录减免"
        cancelText="取消"
      >
        <p>
          {editing?.bookTitle} · 当前剩余{" "}
          {money(editing ? editing.amountMinor - editing.waivedMinor : 0)}
        </p>
        <Form form={form} layout="vertical" onFinish={(v) => adjust.mutate(v)}>
          <Form.Item
            name="amount"
            label="减免金额（元）"
            rules={[
              { required: true, message: "请输入金额" },
              { type: "number", min: 0.01, message: "金额必须大于0" },
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
            label="原因"
            rules={[
              { required: true, whitespace: true, message: "请填写减免原因" },
              { max: 500, message: "原因不超过500位" },
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
  const { result, pagination } = useAdminList<Audit>("audit");
  return (
    <>
      <PageHeading
        eyebrow="A TRACE OF EVERY CHANGE"
        title="操作审计"
        description="谁在什么时候，做了什么。重要操作保持可追溯。"
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
                title: "时间",
                dataIndex: "createdAt",
                width: 180,
                render: (v) => formatDate(v, true),
              },
              { title: "操作人", dataIndex: "actor", ellipsis: true },
              {
                title: "操作",
                dataIndex: "action",
                render: (v) => <Tag>{v}</Tag>,
              },
              { title: "目标", dataIndex: "target", ellipsis: true },
              { title: "详情", dataIndex: "detail", ellipsis: true },
            ]}
          />
        )}
      </Card>
    </>
  );
}

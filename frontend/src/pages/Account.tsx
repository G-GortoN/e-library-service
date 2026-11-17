import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  List,
  Popconfirm,
  Tabs,
  Tag,
} from "antd";
import {
  BellOutlined,
  CheckOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, clearCsrf, errorMessage } from "../api";
import { useAuth } from "../auth";
import {
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  money,
  PageHeading,
  StatusTag,
} from "../components";
import type { Fine, Notification, User } from "../types";

export function Notifications() {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const client = useQueryClient();
  const { message } = App.useApp();
  const data = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/me/notifications"),
  });
  const read = useMutation({
    mutationFn: (id: number) => api.put(`/notifications/${id}/read`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => message.error(errorMessage(e)),
  });
  return (
    <section className="standard-page">
      <PageHeading
        eyebrow="LETTERS FROM THE LIBRARY"
        title="你的阅读来信"
        description="借期提醒、预约进展，还有图书馆为你留意的小事。"
      />
      <Tabs
        activeKey={onlyUnread ? "unread" : "all"}
        onChange={(v) => setOnlyUnread(v === "unread")}
        items={[
          { key: "all", label: "全部消息" },
          { key: "unread", label: "未读消息" },
        ]}
      />
      {data.isPending ? (
        <LoadingState />
      ) : data.isError ? (
        <ErrorState error={data.error} retry={() => data.refetch()} />
      ) : (
        <List
          className="notification-list"
          dataSource={data.data.filter((n) => !onlyUnread || !n.read)}
          locale={{
            emptyText: (
              <EmptyState
                title="此刻，一切安静"
                description="有新的借阅与预约进展时，消息会出现在这里。"
              />
            ),
          }}
          renderItem={(n) => (
            <List.Item
              className={n.read ? "read" : "unread"}
              actions={
                !n.read
                  ? [
                      <Button
                        key="read"
                        icon={<CheckOutlined />}
                        loading={read.isPending && read.variables === n.id}
                        onClick={() => read.mutate(n.id)}
                      >
                        标为已读
                      </Button>,
                    ]
                  : []
              }
            >
              <div className="notification-icon">
                <BellOutlined />
              </div>
              <List.Item.Meta
                title={
                  <span>
                    {!n.read && <i className="unread-dot" />}
                    {n.title}
                  </span>
                }
                description={
                  <>
                    <p>{n.body}</p>
                    <time>{formatDate(n.createdAt, true)}</time>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </section>
  );
}

export function Fines() {
  const data = useQuery({
    queryKey: ["fines"],
    queryFn: () => api.get<Fine[]>("/me/fines"),
  });
  const outstanding =
    data.data
      ?.filter((f) => !["SETTLED", "PAID", "WAIVED"].includes(f.status))
      .reduce(
        (sum, f) => sum + Math.max(0, f.amountMinor - f.waivedMinor),
        0,
      ) || 0;
  return (
    <section className="standard-page">
      <PageHeading
        eyebrow="READING ACCOUNT"
        title="借阅账单"
        description="每一笔金额都有清楚的来由。这里的账单仅用于演示，不发生真实扣款。"
      />
      <div className="balance-card">
        <div>
          <p>当前待处理 · 演示金额</p>
          <strong>{money(outstanding)}</strong>
        </div>
        <SafetyCertificateOutlined />
        <small>逾期满 24 小时计 ¥0.10，每笔最高 ¥10.00；归还时冻结金额。</small>
      </div>
      <Alert
        type="info"
        showIcon
        title="演示记账，无在线支付"
        description="如有疑问，请由管理员核对账单并记录减免或演示结清。"
      />
      {data.isPending ? (
        <LoadingState />
      ) : data.isError ? (
        <ErrorState error={data.error} retry={() => data.refetch()} />
      ) : (
        <List
          className="fine-list"
          dataSource={data.data}
          locale={{
            emptyText: (
              <EmptyState
                title="账单空空，阅读轻松"
                description="按时归还，一起让好书流动起来。"
              />
            ),
          }}
          renderItem={(fine) => (
            <List.Item
              extra={
                <strong>
                  {money(Math.max(0, fine.amountMinor - fine.waivedMinor))}
                </strong>
              }
            >
              <List.Item.Meta
                title={
                  <>
                    {fine.bookTitle} <StatusTag value={fine.status} />
                  </>
                }
                description={
                  <span>
                    {formatDate(fine.createdAt)} · 原金额{" "}
                    {money(fine.amountMinor)} · 已减免 {money(fine.waivedMinor)}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}
    </section>
  );
}

export function Profile() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [passwordForm] = Form.useForm();
  const save = useMutation({
    mutationFn: (values: { displayName: string }) =>
      api.patch<User>("/me", values),
    onSuccess: (updated) => {
      client.setQueryData(["me"], updated);
      message.success("资料已更新。");
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  const password = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      api.post("/me/password", values),
    onSuccess: () => {
      clearCsrf();
      client.setQueryData(["me"], null);
      passwordForm.resetFields();
      message.success("密码已更新，请重新登录。");
      navigate("/login");
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  return (
    <section className="standard-page profile-page">
      <PageHeading
        eyebrow="A LITTLE ABOUT YOU"
        title="账号与设置"
        description="照顾好你的阅读空间，也保护好你的账号。"
      />
      <div className="profile-grid">
        <Card title="个人资料">
          <div className="profile-avatar">
            {user?.displayName?.slice(0, 1) || "读"}
          </div>
          <Form
            layout="vertical"
            initialValues={{ displayName: user?.displayName }}
            onFinish={(values) => save.mutate(values)}
          >
            <Form.Item
              name="displayName"
              label="你的称呼"
              rules={[
                { required: true, whitespace: true, message: "请输入称呼" },
                { max: 80, message: "称呼不超过80位" },
              ]}
            >
              <Input autoComplete="nickname" />
            </Form.Item>
            <Form.Item label="邮箱地址">
              <Input value={user?.email} disabled />
            </Form.Item>
            <p>
              <Tag color={user?.emailVerified ? "green" : "gold"}>
                {user?.emailVerified ? "邮箱已验证" : "邮箱尚未验证"}
              </Tag>
              <Tag>{user?.role === "ADMIN" ? "管理员" : "读者"}</Tag>
            </p>
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              保存资料
            </Button>
          </Form>
        </Card>
        <Card title="修改密码">
          <p className="muted">修改后，现有登录会话将失效。</p>
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={(values) => password.mutate(values)}
          >
            <Form.Item
              name="currentPassword"
              label="当前密码"
              rules={[{ required: true, message: "请输入当前密码" }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: "请输入新密码" },
                {
                  min: 10,
                  max: 72,
                  message:
                    "新密码至少10位，最多72位（非ASCII字符另受字节限制）",
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirm"
              label="确认新密码"
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "请确认新密码" },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    !value || getFieldValue("newPassword") === value
                      ? Promise.resolve()
                      : Promise.reject(new Error("两次密码不一致")),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Popconfirm
              title="确认修改密码？"
              description="修改后需要重新登录。"
              okText="确认"
              cancelText="取消"
              onConfirm={() => passwordForm.submit()}
            >
              <Button loading={password.isPending}>更新密码</Button>
            </Popconfirm>
          </Form>
        </Card>
      </div>
    </section>
  );
}

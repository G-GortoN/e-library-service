import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useLocalizedValidation } from "../language";
import {
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  localizedNotification,
  money,
  PageHeading,
  StatusTag,
} from "../components";
import type { Fine, Notification, User } from "../types";

export function Notifications() {
  const { t } = useTranslation("reader");
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
        eyebrow={t("notifications.eyebrow")}
        title={t("notifications.title")}
        description={t("notifications.description")}
      />
      <Tabs
        activeKey={onlyUnread ? "unread" : "all"}
        onChange={(v) => setOnlyUnread(v === "unread")}
        items={[
          { key: "all", label: t("notifications.all") },
          { key: "unread", label: t("notifications.unread") },
        ]}
      />
      {data.isPending ? (
        <LoadingState />
      ) : data.isError ? (
        <ErrorState error={data.error} retry={() => data.refetch()} />
      ) : (
        <List
          className="notification-list"
          dataSource={data.data
            .filter((n) => !onlyUnread || !n.read)
            .map((n) => ({ ...n, ...localizedNotification(n) }))}
          locale={{
            emptyText: (
              <EmptyState
                title={t("notifications.emptyTitle")}
                description={t("notifications.emptyDescription")}
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
                        {t("notifications.markRead")}
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
  const { t } = useTranslation("reader");
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
        eyebrow={t("fines.eyebrow")}
        title={t("fines.title")}
        description={t("fines.description")}
      />
      <div className="balance-card">
        <div>
          <p>{t("fines.balance")}</p>
          <strong>{money(outstanding)}</strong>
        </div>
        <SafetyCertificateOutlined />
        <small>
          {t("fines.policy", { rate: money(10), cap: money(1000) })}
        </small>
      </div>
      <Alert
        type="info"
        showIcon
        title={t("fines.alertTitle")}
        description={t("fines.alertDescription")}
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
                title={t("fines.emptyTitle")}
                description={t("fines.emptyDescription")}
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
                    {t("fines.itemDescription", {
                      date: formatDate(fine.createdAt),
                      original: money(fine.amountMinor),
                      waived: money(fine.waivedMinor),
                    })}
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
  const { t } = useTranslation("reader");
  const { user } = useAuth();
  const client = useQueryClient();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  useLocalizedValidation(profileForm);
  useLocalizedValidation(passwordForm);
  const save = useMutation({
    mutationFn: (values: { displayName: string }) =>
      api.patch<User>("/me", values),
    onSuccess: (updated) => {
      client.setQueryData(["me"], updated);
      message.success(t("profile.saveSuccess"));
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
      message.success(t("profile.passwordSuccess"));
      navigate("/login");
    },
    onError: (e) => message.error(errorMessage(e)),
  });
  return (
    <section className="standard-page profile-page">
      <PageHeading
        eyebrow={t("profile.eyebrow")}
        title={t("profile.title")}
        description={t("profile.description")}
      />
      <div className="profile-grid">
        <Card title={t("profile.personal")}>
          <div className="profile-avatar">
            {user?.displayName?.slice(0, 1) || t("profile.avatarFallback")}
          </div>
          <Form
            form={profileForm}
            layout="vertical"
            initialValues={{ displayName: user?.displayName }}
            onFinish={(values) => save.mutate(values)}
          >
            <Form.Item
              name="displayName"
              label={t("profile.displayName")}
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: t("profile.displayNameRequired"),
                },
                { max: 80, message: t("profile.displayNameMax") },
              ]}
            >
              <Input autoComplete="nickname" />
            </Form.Item>
            <Form.Item label={t("profile.email")}>
              <Input value={user?.email} disabled />
            </Form.Item>
            <p>
              <Tag color={user?.emailVerified ? "green" : "gold"}>
                {user?.emailVerified
                  ? t("profile.verified")
                  : t("profile.unverified")}
              </Tag>
              <Tag>
                {user?.role === "ADMIN"
                  ? t("profile.admin")
                  : t("profile.reader")}
              </Tag>
            </p>
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              {t("profile.save")}
            </Button>
          </Form>
        </Card>
        <Card title={t("profile.changePassword")}>
          <p className="muted">{t("profile.passwordHint")}</p>
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={(values) => password.mutate(values)}
          >
            <Form.Item
              name="currentPassword"
              label={t("profile.currentPassword")}
              rules={[
                {
                  required: true,
                  message: t("profile.currentPasswordRequired"),
                },
              ]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label={t("profile.newPassword")}
              rules={[
                { required: true, message: t("profile.newPasswordRequired") },
                {
                  min: 10,
                  max: 72,
                  message: t("profile.passwordLength"),
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirm"
              label={t("profile.confirmPassword")}
              dependencies={["newPassword"]}
              rules={[
                {
                  required: true,
                  message: t("profile.confirmPasswordRequired"),
                },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    !value || getFieldValue("newPassword") === value
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error(t("profile.passwordMismatch")),
                        ),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Popconfirm
              title={t("profile.passwordConfirm")}
              description={t("profile.passwordConfirmDescription")}
              okText={t("profile.confirm")}
              cancelText={t("profile.cancel")}
              onConfirm={() => passwordForm.submit()}
            >
              <Button loading={password.isPending}>
                {t("profile.updatePassword")}
              </Button>
            </Popconfirm>
          </Form>
        </Card>
      </div>
    </section>
  );
}

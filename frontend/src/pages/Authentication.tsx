import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, App, Button, Form, Input, Result } from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../auth";
import { api, errorMessage } from "../api";

export default function Authentication({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset" | "verify";
}) {
  const { t, i18n } = useTranslation("authentication");
  const { login, user } = useAuth();
  const passwordRules = [
    { required: true, message: t("validation.passwordRequired") },
    { min: 10, max: 72, message: t("validation.passwordLength") },
  ];
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState("");
  const [form] = Form.useForm();
  const token = params.get("token") || "";
  useEffect(() => {
    setError(null);
    setSuccess("");
    form.resetFields();
  }, [mode, token, form]);
  useEffect(() => {
    const invalidFields = form
      .getFieldsError()
      .filter((field) => field.errors.length > 0)
      .map((field) => field.name);
    if (invalidFields.length > 0)
      void form.validateFields(invalidFields).catch(() => {});
  }, [form, i18n.resolvedLanguage]);
  const verifyEmail = () => {
    if (!token || pending) return;
    setPending(true);
    setError(null);
    api
      .post<{ message: string }>("/auth/verify-email", { token })
      .then(() => setSuccess("verify.success"))
      .catch((e: unknown) => setError(e))
      .finally(() => setPending(false));
  };
  const submit = async (values: Record<string, string>) => {
    setPending(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(values.email.trim(), values.password);
        message.success(t("login.welcome"));
        const from = (location.state as { from?: string } | null)?.from;
        navigate(
          from?.startsWith("/") && !from.startsWith("//") ? from : "/shelf",
          { replace: true },
        );
      } else if (mode === "register") {
        await api.post<{ message: string }>("/auth/register", {
          email: values.email.trim(),
          displayName: values.displayName.trim(),
          password: values.password,
        });
        setSuccess("register.success");
      } else if (mode === "forgot") {
        await api.post<{ message: string }>("/auth/password-reset-requests", {
          email: values.email.trim(),
        });
        setSuccess("forgot.success");
      } else if (mode === "reset") {
        await api.post("/auth/password-resets", {
          token,
          password: values.password,
        });
        setSuccess("reset.success");
      }
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="auth-page">
      <div className="auth-art">
        <p className="eyebrow">{t("art.eyebrow")}</p>
        <h1>
          {t("art.line1")}
          <br />
          {t("art.line2")}
          <br />
          <em>{t("art.line3")}</em>
        </h1>
        <div className="auth-art-books" aria-hidden="true">
          <span>
            {t("art.bookLine1")}
            <br />
            {t("art.bookLine2")}
            <br />
            {t("art.bookLine3")}
          </span>
          <i>FOLIO</i>
        </div>
        <p>{t("art.description")}</p>
      </div>
      <div className="auth-content">
        <Link className="back-link" to="/books">
          <ArrowLeftOutlined /> {t("backToCatalog")}
        </Link>
        <div className="auth-form-wrap">
          <p className="eyebrow">{t("form.eyebrow")}</p>
          <h2>{t(`${mode}.title`)}</h2>
          <p className="muted">{t(`${mode}.description`)}</p>
          {Boolean(error) && (
            <Alert
              className="form-alert"
              type="error"
              showIcon
              title={errorMessage(error)}
            />
          )}
          {success ? (
            <Result
              status="success"
              title={t(
                mode === "register" ? "register.checkEmail" : "completed",
              )}
              subTitle={t(success)}
              extra={
                <Link to="/login">
                  <Button type="primary">{t("goToLogin")}</Button>
                </Link>
              }
            />
          ) : mode === "verify" ? (
            <div className="verify-panel">
              {!token ? (
                <Alert type="warning" title={t("verify.missingToken")} />
              ) : (
                <Button type="primary" loading={pending} onClick={verifyEmail}>
                  {t("verify.confirm")}
                </Button>
              )}
            </div>
          ) : (
            <Form
              layout="vertical"
              form={form}
              onFinish={submit}
              requiredMark={false}
              size="large"
            >
              {mode === "register" && (
                <Form.Item
                  name="displayName"
                  label={t("field.name")}
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: t("validation.nameRequired"),
                    },
                    { max: 80, message: t("validation.nameLength") },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder={t("placeholder.name")}
                    autoComplete="nickname"
                  />
                </Form.Item>
              )}
              {mode !== "reset" && (
                <Form.Item
                  name="email"
                  label={t("field.email")}
                  rules={[
                    { required: true, message: t("validation.emailRequired") },
                    { type: "email", message: t("validation.emailValid") },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Form.Item>
              )}
              {mode !== "forgot" && (
                <Form.Item
                  name="password"
                  label={t(
                    mode === "reset" ? "field.newPassword" : "field.password",
                  )}
                  rules={
                    mode === "login"
                      ? [
                          {
                            required: true,
                            message: t("validation.passwordRequired"),
                          },
                        ]
                      : passwordRules
                  }
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t(
                      mode === "login"
                        ? "placeholder.password"
                        : "placeholder.newPassword",
                    )}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                </Form.Item>
              )}
              {["register", "reset"].includes(mode) && (
                <Form.Item
                  name="confirm"
                  label={t("field.confirmPassword")}
                  dependencies={["password"]}
                  rules={[
                    {
                      required: true,
                      message: t("validation.confirmRequired"),
                    },
                    ({ getFieldValue }) => ({
                      validator: (_, v) =>
                        !v || getFieldValue("password") === v
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error(t("validation.passwordMismatch")),
                            ),
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t("placeholder.confirmPassword")}
                    autoComplete="new-password"
                  />
                </Form.Item>
              )}
              {mode === "login" && (
                <div className="auth-helper">
                  <span>{t("login.helper")}</span>
                  <Link to="/forgot-password">{t("login.forgotPassword")}</Link>
                </div>
              )}
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={pending}
                disabled={mode === "reset" && !token}
                icon={<ArrowRightOutlined />}
                iconPlacement="end"
              >
                {t(`${mode}.submit`)}
              </Button>
              {mode === "reset" && !token && (
                <p className="danger-text">{t("reset.missingToken")}</p>
              )}
            </Form>
          )}
          {mode === "login" ? (
            <p className="auth-bottom">
              {t("login.noAccount")}
              <Link to="/register">{t("login.join")}</Link>
            </p>
          ) : (
            <p className="auth-bottom">
              {t("existingAccount")}
              <Link to="/login">{t("returnToLogin")}</Link>
            </p>
          )}
          {mode === "login" &&
            (import.meta.env.DEV ||
              import.meta.env.VITE_DEMO_MODE === "true") && (
              <div className="demo-login">
                <strong>{t("demo.title")}</strong>
                <p>{t("demo.description")}</p>
                <div>
                  <Button
                    size="small"
                    onClick={() =>
                      form.setFieldsValue({
                        email: "reader@example.com",
                        password: "LibraryDemo2026!",
                      })
                    }
                  >
                    {t("demo.readerOne")}
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      form.setFieldsValue({
                        email: "reader2@example.com",
                        password: "LibraryDemo2026!",
                      })
                    }
                  >
                    {t("demo.readerTwo")}
                  </Button>
                </div>
              </div>
            )}
          {user && mode === "login" && (
            <p className="muted small-text">
              {t("alreadySignedIn", { name: user.displayName })}{" "}
              <Link to="/shelf">{t("goToShelf")}</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

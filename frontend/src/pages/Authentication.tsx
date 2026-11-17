import { useEffect, useState } from "react";
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

const passwordRules = [
  { required: true, message: "请输入密码" },
  {
    min: 10,
    max: 72,
    message: "密码需为 10–72 位；非 ASCII 字符仍受服务端字节长度限制",
  },
];
export default function Authentication({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset" | "verify";
}) {
  const { login, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { message } = App.useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form] = Form.useForm();
  const token = params.get("token") || "";
  useEffect(() => {
    setError("");
    setSuccess("");
    form.resetFields();
  }, [mode, token, form]);
  const verifyEmail = () => {
    if (!token || pending) return;
    setPending(true);
    setError("");
    api
      .post<{ message: string }>("/auth/verify-email", { token })
      .then((result) =>
        setSuccess(result.message || "邮箱验证成功，现在可以登录。"),
      )
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setPending(false));
  };
  const titles = {
    login: "欢迎回到书页之间",
    register: "开启你的阅读旅程",
    forgot: "找回你的阅读入口",
    reset: "设置新的密码",
    verify: "验证你的邮箱",
  };
  const descriptions = {
    login: "登录栖页，让下一本好书与你相遇。",
    register: "创建账号，把喜欢的故事带回自己的书架。",
    forgot: "输入注册邮箱，我们会发送密码重置链接。",
    reset: "为账号设置一个新的、安全的密码。",
    verify: "点击下方按钮，确认邮箱后即可开始借阅。",
  };
  const submit = async (values: Record<string, string>) => {
    setPending(true);
    setError("");
    try {
      if (mode === "login") {
        await login(values.email.trim(), values.password);
        message.success("欢迎回来，愿今天也有好书相伴。");
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
        setSuccess(
          "注册请求已提交，请查看账号确认邮件，按邮件提示验证邮箱或设置密码。",
        );
      } else if (mode === "forgot") {
        const result = await api.post<{ message: string }>(
          "/auth/password-reset-requests",
          { email: values.email.trim() },
        );
        setSuccess(
          result.message || "如果该邮箱已注册，你会收到密码重置邮件。",
        );
      } else if (mode === "reset") {
        await api.post("/auth/password-resets", {
          token,
          password: values.password,
        });
        setSuccess("密码已更新，原有会话已失效。请使用新密码登录。");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="auth-page">
      <div className="auth-art">
        <p className="eyebrow">FOLIO / A PLACE TO BEGIN</p>
        <h1>
          每一次翻页，
          <br />
          都在靠近
          <br />
          <em>新的自己。</em>
        </h1>
        <div className="auth-art-books" aria-hidden="true">
          <span>
            THE
            <br />
            NEXT
            <br />
            CHAPTER
          </span>
          <i>FOLIO</i>
        </div>
        <p>一座数字图书馆，一处心灵的栖息地。</p>
      </div>
      <div className="auth-content">
        <Link className="back-link" to="/books">
          <ArrowLeftOutlined /> 返回馆藏
        </Link>
        <div className="auth-form-wrap">
          <p className="eyebrow">MAKE ROOM FOR READING</p>
          <h2>{titles[mode]}</h2>
          <p className="muted">{descriptions[mode]}</p>
          {error && (
            <Alert className="form-alert" type="error" showIcon title={error} />
          )}
          {success ? (
            <Result
              status="success"
              title={mode === "register" ? "请查看账号确认邮件" : "已完成"}
              subTitle={success}
              extra={
                <Link to="/login">
                  <Button type="primary">前往登录</Button>
                </Link>
              }
            />
          ) : mode === "verify" ? (
            <div className="verify-panel">
              {!token ? (
                <Alert
                  type="warning"
                  title="验证链接缺少令牌，请使用邮件中的完整链接。"
                />
              ) : (
                <Button type="primary" loading={pending} onClick={verifyEmail}>
                  确认验证邮箱
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
                  label="你的称呼"
                  rules={[
                    { required: true, whitespace: true, message: "请输入称呼" },
                    { max: 80, message: "称呼不超过80位" },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="我们该如何称呼你"
                    autoComplete="nickname"
                  />
                </Form.Item>
              )}
              {mode !== "reset" && (
                <Form.Item
                  name="email"
                  label="邮箱地址"
                  rules={[
                    { required: true, message: "请输入邮箱" },
                    { type: "email", message: "请输入有效的邮箱地址" },
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
                  label={mode === "reset" ? "新密码" : "密码"}
                  rules={
                    mode === "login"
                      ? [{ required: true, message: "请输入密码" }]
                      : passwordRules
                  }
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={
                      mode === "login" ? "输入你的密码" : "至少 10 位字符"
                    }
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                </Form.Item>
              )}
              {["register", "reset"].includes(mode) && (
                <Form.Item
                  name="confirm"
                  label="确认密码"
                  dependencies={["password"]}
                  rules={[
                    { required: true, message: "请再次输入密码" },
                    ({ getFieldValue }) => ({
                      validator: (_, v) =>
                        !v || getFieldValue("password") === v
                          ? Promise.resolve()
                          : Promise.reject(new Error("两次输入的密码不一致")),
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                  />
                </Form.Item>
              )}
              {mode === "login" && (
                <div className="auth-helper">
                  <span>欢迎回来</span>
                  <Link to="/forgot-password">忘记密码？</Link>
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
                {mode === "login"
                  ? "登录并继续阅读"
                  : mode === "register"
                    ? "创建阅读账号"
                    : mode === "forgot"
                      ? "发送重置邮件"
                      : "更新密码"}
              </Button>
              {mode === "reset" && !token && (
                <p className="danger-text">
                  重置链接缺少令牌，请重新申请邮件。
                </p>
              )}
            </Form>
          )}
          {mode === "login" ? (
            <p className="auth-bottom">
              还没有账号？<Link to="/register">加入栖页</Link>
            </p>
          ) : (
            <p className="auth-bottom">
              已有账号？<Link to="/login">返回登录</Link>
            </p>
          )}
          {mode === "login" &&
            (import.meta.env.DEV ||
              import.meta.env.VITE_DEMO_MODE === "true") && (
              <div className="demo-login">
                <strong>想先看看？试用读者账号</strong>
                <p>共享演示数据，仅供体验。管理员账号单独配置。</p>
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
                    填入读者一
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
                    填入读者二
                  </Button>
                </div>
              </div>
            )}
          {user && mode === "login" && (
            <p className="muted small-text">
              当前已登录为 {user.displayName}，可直接
              <Link to="/shelf">前往书架</Link>。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

import { lazy, Suspense, useState } from "react";
import { App as AntApp, Badge, Button, Dropdown, Drawer } from "antd";
import {
  ArrowRightOutlined,
  BellOutlined,
  BookOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Link,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth, useAuth } from "./auth";
import { api, errorMessage } from "./api";
import { ErrorState, LoadingState } from "./components";
import type { Notification } from "./types";
const Catalog = lazy(() => import("./pages/Catalog"));
const BookDetail = lazy(() =>
  import("./pages/Catalog").then((m) => ({ default: m.BookDetail })),
);
const Shelf = lazy(() => import("./pages/Shelf"));
const Authentication = lazy(() => import("./pages/Authentication"));
const Notifications = lazy(() =>
  import("./pages/Account").then((m) => ({ default: m.Notifications })),
);
const Fines = lazy(() =>
  import("./pages/Account").then((m) => ({ default: m.Fines })),
);
const Profile = lazy(() =>
  import("./pages/Account").then((m) => ({ default: m.Profile })),
);
const Admin = lazy(() => import("./pages/Admin"));

function ReaderLayout() {
  const { user, logout, pending } = useAuth();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const unread = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/me/notifications"),
    enabled: !!user,
    refetchInterval: 60000,
  });
  const exit = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/");
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setLoggingOut(false);
    }
  };
  const accountItems = [
    { key: "profile", label: <Link to="/account">账号与设置</Link> },
    { key: "fines", label: <Link to="/fines">借阅账单</Link> },
    ...(user?.role === "ADMIN"
      ? [{ key: "admin", label: <Link to="/admin">管理工作台</Link> }]
      : []),
    { type: "divider" as const },
    {
      key: "logout",
      label: loggingOut ? "正在退出…" : "退出登录",
      onClick: exit,
      disabled: loggingOut,
    },
  ];
  return (
    <div className="reader-app">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <div className="announcement">
        <span>为好奇心，留一处栖息地。</span>
        <span>
          YOUR NEXT CHAPTER, ALWAYS WITHIN REACH{" "}
          <span className="announcement-star">✳</span>
        </span>
      </div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="栖页 Folio 首页">
          <span className="brand-mark">
            <BookOutlined />
          </span>
          <strong>
            栖页<span>FOLIO</span>
          </strong>
        </Link>
        <nav className="desktop-nav" aria-label="主要导航">
          <NavLink to="/books">发现好书</NavLink>
          <NavLink to="/shelf">我的书架</NavLink>
          <NavLink to="/notifications">
            阅读来信
            {unread.data?.some((n) => !n.read) && <i className="nav-dot" />}
          </NavLink>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link
                className="notification-link"
                to="/notifications"
                aria-label="查看通知"
              >
                <Badge
                  count={unread.data?.filter((n) => !n.read).length || 0}
                  size="small"
                >
                  <BellOutlined />
                </Badge>
              </Link>
              <Dropdown menu={{ items: accountItems }} trigger={["click"]}>
                <Button className="account-button" icon={<UserOutlined />}>
                  {user.displayName}
                </Button>
              </Dropdown>
            </>
          ) : (
            <Link to="/login">
              <Button
                className="login-button"
                type="primary"
                disabled={pending}
              >
                登录 / 加入 <ArrowRightOutlined />
              </Button>
            </Link>
          )}
          <Button
            className="mobile-menu-button"
            type="text"
            icon={<MenuOutlined />}
            aria-label="打开导航"
            onClick={() => setMenuOpen(true)}
          />
        </div>
      </header>
      <Drawer
        title="栖页 Folio"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        placement="right"
      >
        <nav className="mobile-nav" onClick={() => setMenuOpen(false)}>
          <Link to="/books">发现好书</Link>
          <Link to="/shelf">我的书架</Link>
          <Link to="/notifications">阅读来信</Link>
          <Link to="/fines">借阅账单</Link>
          <Link to="/account">账号与设置</Link>
          {user?.role === "ADMIN" && <Link to="/admin">管理工作台</Link>}
        </nav>
      </Drawer>
      <main id="main-content" className="reader-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <Link className="footer-wordmark" to="/">
            栖页 <span>FOLIO</span>
          </Link>
          <p>让阅读，自然而然地发生。</p>
        </div>
        <div className="footer-links">
          <Link to="/books">探索馆藏</Link>
          <Link to="/shelf">我的书架</Link>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            API 文档 ↗
          </a>
        </div>
        <div className="footer-colophon">
          <span>A QUIET PLACE FOR CURIOUS MINDS.</span>
          <small>FOLIO DIGITAL LIBRARY · 2026</small>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <RequireAuth admin>
              <Admin />
            </RequireAuth>
          }
        />
        <Route element={<ReaderLayout />}>
          <Route index element={<Catalog />} />
          <Route path="books" element={<Catalog />} />
          <Route path="books/:id" element={<BookDetail />} />
          <Route
            path="shelf"
            element={
              <RequireAuth>
                <Shelf />
              </RequireAuth>
            }
          />
          <Route
            path="notifications"
            element={
              <RequireAuth>
                <Notifications />
              </RequireAuth>
            }
          />
          <Route
            path="fines"
            element={
              <RequireAuth>
                <Fines />
              </RequireAuth>
            }
          />
          <Route
            path="account"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route path="login" element={<Authentication mode="login" />} />
          <Route path="register" element={<Authentication mode="register" />} />
          <Route
            path="forgot-password"
            element={<Authentication mode="forgot" />}
          />
          <Route
            path="reset-password"
            element={<Authentication mode="reset" />}
          />
          <Route
            path="verify-email"
            element={<Authentication mode="verify" />}
          />
          <Route
            path="*"
            element={
              <ErrorState
                title="这一页，暂时没有故事"
                description="页面不存在，你可以通过上方导航回到馆藏。"
              />
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

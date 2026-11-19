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
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./language";
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
  const { t } = useTranslation("common");
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
    { key: "profile", label: <Link to="/account">{t("nav.account")}</Link> },
    { key: "fines", label: <Link to="/fines">{t("nav.fines")}</Link> },
    ...(user?.role === "ADMIN"
      ? [{ key: "admin", label: <Link to="/admin">{t("nav.admin")}</Link> }]
      : []),
    { type: "divider" as const },
    {
      key: "logout",
      label: t(loggingOut ? "nav.loggingOut" : "nav.logout"),
      onClick: exit,
      disabled: loggingOut,
    },
  ];
  return (
    <div className="reader-app">
      <a className="skip-link" href="#main-content">
        {t("nav.skip")}
      </a>
      <div className="announcement">
        <span>{t("announcement")}</span>
        <span>
          {t("announcement.secondary")}{" "}
          <span className="announcement-star">✳</span>
        </span>
      </div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label={t("brand.home")}>
          <span className="brand-mark">
            <BookOutlined />
          </span>
          <strong>
            {t("brand.name")}
            <span>{t("brand.subtitle")}</span>
          </strong>
        </Link>
        <nav className="desktop-nav" aria-label={t("nav.main")}>
          <NavLink to="/books">{t("nav.catalog")}</NavLink>
          <NavLink to="/shelf">{t("nav.shelf")}</NavLink>
          <NavLink to="/notifications">
            {t("nav.notifications")}
            {unread.data?.some((n) => !n.read) && <i className="nav-dot" />}
          </NavLink>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link
                className="notification-link"
                to="/notifications"
                aria-label={t("nav.viewNotifications")}
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
                <span className="login-label-full">{t("nav.login")}</span>
                <span className="login-label-short">{t("nav.loginShort")}</span>
                <ArrowRightOutlined />
              </Button>
            </Link>
          )}
          <Button
            className="mobile-menu-button"
            type="text"
            icon={<MenuOutlined />}
            aria-label={t("nav.open")}
            onClick={() => setMenuOpen(true)}
          />
        </div>
      </header>
      <Drawer
        title={t("brand.name")}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        placement="right"
      >
        <nav className="mobile-nav" onClick={() => setMenuOpen(false)}>
          <Link to="/books">{t("nav.catalog")}</Link>
          <Link to="/shelf">{t("nav.shelf")}</Link>
          <Link to="/notifications">{t("nav.notifications")}</Link>
          <Link to="/fines">{t("nav.fines")}</Link>
          <Link to="/account">{t("nav.account")}</Link>
          {user?.role === "ADMIN" && <Link to="/admin">{t("nav.admin")}</Link>}
        </nav>
      </Drawer>
      <main id="main-content" className="reader-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <Link className="footer-wordmark" to="/">
            {t("brand.name")} <span>{t("brand.subtitle")}</span>
          </Link>
          <p>{t("footer.tagline")}</p>
        </div>
        <div className="footer-links">
          <Link to="/books">{t("footer.catalog")}</Link>
          <Link to="/shelf">{t("nav.shelf")}</Link>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            {t("footer.api")}
          </a>
        </div>
        <div className="footer-colophon">
          <span>{t("footer.quiet")}</span>
          <small>{t("footer.colophon")}</small>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const { t } = useTranslation("common");
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
                title={t("error.notFoundTitle")}
                description={t("error.notFoundDescription")}
              />
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

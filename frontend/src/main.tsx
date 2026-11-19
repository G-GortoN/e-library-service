import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, Button, ConfigProvider, Result } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "./i18n";
import App from "./App";
import { ApiError } from "./api";
import { AuthProvider } from "./auth";
import "./styles.css";

class ErrorBoundary extends Component<
  {
    children: ReactNode;
    title: string;
    description: string;
    refreshLabel: string;
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Result
        status="error"
        title={this.props.title}
        subTitle={this.props.description}
        extra={
          <Button onClick={() => window.location.reload()}>
            {this.props.refreshLabel}
          </Button>
        }
      />
    ) : (
      this.props.children
    );
  }
}
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      retry: (count, error) =>
        count < 1 &&
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
function ApplicationRoot() {
  const { t, i18n: language } = useTranslation("common");
  return (
    <ErrorBoundary
      title={t("error.title")}
      description={t("error.description")}
      refreshLabel={t("error.refresh")}
    >
      <ConfigProvider
        locale={language.resolvedLanguage === "en" ? enUS : zhCN}
        theme={{
          token: {
            colorPrimary: "#123d35",
            colorInfo: "#486e64",
            colorSuccess: "#4b7258",
            colorWarning: "#b57b3d",
            colorError: "#ad4c38",
            colorText: "#233b33",
            colorTextSecondary: "#758078",
            colorBgLayout: "#f7f5ef",
            colorBorder: "#e1e4dc",
            borderRadius: 8,
            fontFamily:
              'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
            controlHeight: 38,
          },
          components: {
            Button: { primaryShadow: "none" },
            Card: { paddingLG: 24 },
            Table: {
              headerBg: "#f5f7f3",
              headerColor: "#68736b",
              rowHoverBg: "#f7f8f4",
            },
            Tabs: { inkBarColor: "#123d35" },
            Input: { activeShadow: "0 0 0 2px #123d3510" },
          },
        }}
      >
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <ApplicationRoot />
  </I18nextProvider>,
);

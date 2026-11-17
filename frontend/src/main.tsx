import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, Button, ConfigProvider, Result } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import { ApiError } from "./api";
import { AuthProvider } from "./auth";
import "./styles.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
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
        title="页面遇到了一点问题"
        subTitle="请刷新后重试。已经提交的操作请先确认当前状态，再决定是否重复操作。"
        extra={
          <Button onClick={() => window.location.reload()}>刷新页面</Button>
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
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ConfigProvider
      locale={zhCN}
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
  </ErrorBoundary>,
);

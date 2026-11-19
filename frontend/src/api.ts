import i18n, { currentLanguage, localizeText } from "./i18n.ts";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let csrf: { token: string; headerName: string } | undefined;
let csrfPromise: Promise<void> | undefined;
export function clearCsrf() {
  csrf = undefined;
}
export async function ensureCsrf() {
  if (csrf) return;
  if (!csrfPromise)
    csrfPromise = fetch("/api/v1/auth/csrf", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new ApiError(
            response.status,
            "Unable to establish a secure session / 无法建立安全连接，请稍后重试。",
            "CSRF_FAILED",
          );
        csrf = await response.json();
      })
      .catch((error) => {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          0,
          "The library is unreachable / 暂时无法连接图书馆服务。",
          "NETWORK_ERROR",
        );
      })
      .finally(() => {
        csrfPromise = undefined;
      });
  await csrfPromise;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method || "GET";
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Accept-Language", currentLanguage());
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    await ensureCsrf();
    if (csrf) headers.set(csrf.headerName, csrf.token);
  }
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      0,
      "The library is unreachable / 暂时无法连接图书馆服务。",
      "NETWORK_ERROR",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 403) clearCsrf();
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("folio:session-expired"));
    throw new ApiError(
      response.status,
      body.detail ||
        body.message ||
        (response.status === 401
          ? "Your session has expired / 登录已失效，请重新登录。"
          : "The action could not be completed / 操作未完成，请稍后重试。"),
      body.code ||
        (!body.detail && !body.message
          ? response.status === 401
            ? "SESSION_EXPIRED"
            : "REQUEST_FAILED"
          : undefined),
    );
  }
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<T>(path, { method: "POST", body });
  },
};
export function queryString(
  params: Record<string, string | number | boolean | undefined>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, String(v));
  });
  return search.toString();
}
export function errorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    error.code &&
    [
      "NETWORK_ERROR",
      "CSRF_FAILED",
      "SESSION_EXPIRED",
      "REQUEST_FAILED",
    ].includes(error.code)
  ) {
    return i18n.t(`errors.${error.code}`);
  }
  return error instanceof Error
    ? localizeText(error.message)
    : i18n.t("errors.REQUEST_FAILED");
}

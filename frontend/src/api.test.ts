import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { api, ApiError, clearCsrf } from "./api.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrf();
});

test("a failed lending write carries CSRF and is never replayed automatically", async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  globalThis.fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    if (String(input).endsWith("/auth/csrf"))
      return Response.json({
        token: "session-token",
        headerName: "X-CSRF-TOKEN",
      });
    return Response.json(
      {
        status: 409,
        code: "BORROW_CONFLICT",
        detail: "The license is already in use.",
      },
      { status: 409 },
    );
  };

  await assert.rejects(
    api.post("/loans", { bookId: "book-1" }),
    (error) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === "BORROW_CONFLICT",
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/v1/auth/csrf");
  assert.equal(calls[1].url, "/api/v1/loans");
  assert.equal(
    new Headers(calls[1].options?.headers).get("X-CSRF-TOKEN"),
    "session-token",
  );
  assert.equal(calls[1].options?.credentials, "include");
  assert.deepEqual(JSON.parse(String(calls[1].options?.body)), {
    bookId: "book-1",
  });
});

test("cover uploads use CSRF without overriding the browser multipart boundary", async () => {
  let uploadOptions: RequestInit | undefined;
  globalThis.fetch = async (input, options) => {
    if (String(input).endsWith("/auth/csrf"))
      return Response.json({
        token: "upload-token",
        headerName: "X-XSRF-TOKEN",
      });
    uploadOptions = options;
    return Response.json({ id: "book-1" });
  };

  const file = new File(["cover"], "cover.png", { type: "image/png" });
  await api.upload("/admin/books/book-1/cover", file);
  assert.equal(
    new Headers(uploadOptions?.headers).get("X-XSRF-TOKEN"),
    "upload-token",
  );
  assert.equal(new Headers(uploadOptions?.headers).has("Content-Type"), false);
  assert.ok(uploadOptions?.body instanceof FormData);
  assert.equal((uploadOptions.body.get("file") as File).name, "cover.png");
});

test("a failed CSRF handshake prevents the write entirely", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ status: 503 }, { status: 503 });
  };
  await assert.rejects(
    api.put("/loans/loan-1/return"),
    (error) => error instanceof ApiError && error.status === 503,
  );
  assert.equal(calls, 1);
});

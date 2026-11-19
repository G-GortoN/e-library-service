import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import i18n, { localizeText, normalizeLanguage, resources } from "./i18n.ts";
import { ApiError, errorMessage } from "./api.ts";

afterEach(async () => {
  await i18n.changeLanguage("zh-CN");
});

test("every UI namespace has complete translations with matching interpolation arguments", () => {
  let checked = 0;
  const argumentsIn = (text: string) =>
    [...text.matchAll(/{{\s*([^},\s]+)(?:,[^}]*)?}}/g)].map((m) => m[1]).sort();
  for (const namespace of Object.keys(
    resources.en,
  ) as (keyof typeof resources.en)[]) {
    const english = resources.en[namespace] as Record<string, string>;
    const chinese = resources["zh-CN"][namespace] as Record<string, string>;
    assert.deepEqual(
      Object.keys(english).sort(),
      Object.keys(chinese).sort(),
      namespace,
    );
    for (const key of Object.keys(english)) {
      assert.ok(
        english[key].trim() && chinese[key].trim(),
        namespace + ":" + key,
      );
      assert.deepEqual(
        argumentsIn(english[key]),
        argumentsIn(chinese[key]),
        namespace + ":" + key,
      );
      checked++;
    }
  }
  assert.ok(checked > 400);
});

test("English counts select the correct plural without exposing translation keys", async () => {
  await i18n.changeLanguage("en");
  assert.equal(
    i18n.t("catalog.bookCount", { ns: "reader", count: 1 }),
    "1 book",
  );
  assert.equal(
    i18n.t("catalog.bookCount", { ns: "reader", count: 2 }),
    "2 books",
  );
  assert.equal(
    i18n.t("catalog.bookCount", { ns: "reader", count: 0 }),
    "0 books",
  );
  await i18n.changeLanguage("zh-CN");
  assert.equal(
    i18n.t("catalog.bookCount", { ns: "reader", count: 2 }),
    "2 本藏书",
  );
});

test("cached API errors and persisted notification messages follow the selected language", async () => {
  const conflict = new ApiError(
    409,
    "Book already borrowed / 图书已被借阅",
    "BORROW_CONFLICT",
  );
  const network = new ApiError(
    0,
    "The library is unreachable / 暂时无法连接图书馆服务。",
    "NETWORK_ERROR",
  );
  await i18n.changeLanguage("en");
  assert.equal(errorMessage(conflict), "Book already borrowed");
  assert.match(errorMessage(network), /Check your connection/);
  assert.equal(
    localizeText("Borrow within 48 hours. / 请在 48 小时内借阅。"),
    "Borrow within 48 hours.",
  );
  await i18n.changeLanguage("zh-CN");
  assert.equal(errorMessage(conflict), "图书已被借阅");
  assert.match(errorMessage(network), /检查网络/);
  assert.equal(
    localizeText("Borrow within 48 hours. / 请在 48 小时内借阅。"),
    "请在 48 小时内借阅。",
  );
  assert.equal(localizeText("Novel / Essays"), "Novel / Essays");
  assert.equal(localizeText("中文书名 / 作者"), "中文书名 / 作者");
});

test("browser language variants resolve to the two supported locales", () => {
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("en-GB"), "en");
  assert.equal(normalizeLanguage("zh-TW"), "zh-CN");
  assert.equal(normalizeLanguage("fr"), "zh-CN");
});

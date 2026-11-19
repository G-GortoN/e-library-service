import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { commonEn, commonZh } from "./locales/common.ts";
import { readerEn, readerZh } from "./locales/reader.ts";
import { adminEn, adminZh } from "./locales/admin.ts";
import {
  authenticationEn,
  authenticationZh,
} from "./locales/authentication.ts";

export type Language = "zh-CN" | "en";
export const languageStorageKey = "folio-language";
export const resources = {
  "zh-CN": {
    common: commonZh,
    reader: readerZh,
    admin: adminZh,
    authentication: authenticationZh,
  },
  en: {
    common: commonEn,
    reader: readerEn,
    admin: adminEn,
    authentication: authenticationEn,
  },
};
export function normalizeLanguage(value?: string): Language {
  return /^en(?:-|$)/i.test(value || "") ? "en" : "zh-CN";
}
function initialLanguage(): Language {
  if (typeof window === "undefined") return "zh-CN";
  try {
    const saved = globalThis.localStorage?.getItem(languageStorageKey);
    if (saved === "en" || saved === "zh-CN") return saved;
  } catch {
    /* Storage may be disabled; language switching still works in memory. */
  }
  return normalizeLanguage(
    typeof navigator === "undefined" ? undefined : navigator.language,
  );
}
void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: "zh-CN",
  supportedLngs: ["zh-CN", "en"],
  defaultNS: "common",
  keySeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export function currentLanguage(): Language {
  return normalizeLanguage(i18n.resolvedLanguage || i18n.language);
}
function syncLanguage() {
  const language = currentLanguage();
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(languageStorageKey, language);
  } catch {
    /* Optional persistence. */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
    document.title = i18n.t("app.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", i18n.t("app.description"));
  }
}
i18n.on("languageChanged", syncLanguage);
syncLanguage();
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (
      event.key === languageStorageKey &&
      (event.newValue === "en" || event.newValue === "zh-CN")
    ) {
      void i18n.changeLanguage(event.newValue);
    }
  });
}

/** Select a language from the API's existing English / Chinese messages. Data is left intact. */
export function localizeText(
  value: string,
  language = currentLanguage(),
): string {
  const split = value.indexOf(" / ");
  if (split < 0) return value;
  const english = value.slice(0, split).trim();
  const chinese = value.slice(split + 3).trim();
  if (!/[\u3400-\u9fff]/u.test(chinese) || /[\u3400-\u9fff]/u.test(english))
    return value;
  return language === "en" ? english : chinese;
}

export default i18n;

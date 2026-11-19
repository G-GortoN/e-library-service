import { useEffect } from "react";
import { Button, Dropdown, type FormInstance } from "antd";
import { GlobalOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        selectedKeys: [i18n.resolvedLanguage || i18n.language],
        items: [
          { key: "zh-CN", label: <span lang="zh-CN">简体中文</span> },
          { key: "en", label: <span lang="en">English</span> },
        ],
        onClick: ({ key }) => void i18n.changeLanguage(key),
      }}
    >
      <Button
        className="language-switcher"
        type="text"
        icon={<GlobalOutlined />}
        aria-label={t("language.switch")}
      >
        {t("language.current")}
      </Button>
    </Dropdown>
  );
}

/** Refresh only existing validation errors when the reader switches language. */
export function useLocalizedValidation(form: FormInstance) {
  const { i18n } = useTranslation();
  useEffect(() => {
    const fields = form
      .getFieldsError()
      .filter((field) => field.errors.length)
      .map((field) => field.name);
    if (fields.length) void form.validateFields(fields).catch(() => {});
  }, [form, i18n.resolvedLanguage]);
}

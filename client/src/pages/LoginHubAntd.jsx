// client/src/pages/LoginHubAntd.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Tabs, Form, Input, Button, Card, Typography, message } from "antd";
import { LockOutlined, UserOutlined, InfoCircleOutlined, LinkedinOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./loginHub.css";

const { Text } = Typography;

const TAB_ITEMS = [
  { key: "student", label: "Öğrenci Girişi" },
  { key: "teacher", label: "Gözlemci Girişi" },
  { key: "admin", label: "Admin Panel" },
];

export default function LoginHubAntd() {
  const nav = useNavigate();
  const [activeKey, setActiveKey] = useState("student");
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const [siteTitle, setSiteTitle] = useState("Mesleki Uygulama Yönetim Sistemi (V2)");
  const [siteSlogan, setSiteSlogan] = useState("Sisteme giriş");
  const [homeImageUrl, setHomeImageUrl] = useState("");
  const [orgTitle, setOrgTitle] = useState("KARABÜK ÜNİVERSİTESİ · SHMYO");
  const [orgSubtitle, setOrgSubtitle] = useState("Tıbbi Dokümantasyon ve Sekreterlik Programı");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/system-settings/public");
        if (data?.siteTitle) setSiteTitle(String(data.siteTitle));
        if (data?.siteSlogan) setSiteSlogan(String(data.siteSlogan));
        if (data?.homeImageUrl) setHomeImageUrl(String(data.homeImageUrl));
        if (data?.orgTitle) setOrgTitle(String(data.orgTitle));
        if (data?.orgSubtitle) setOrgSubtitle(String(data.orgSubtitle));
      } catch {
        // sessiz geç
      }
    })();
  }, []);

  const placeholders = useMemo(() => {
    if (activeKey === "student") {
      return { idLabel: "Öğrenci No", idPh: "2405405xxx", pinLabel: "PIN", pinPh: "****" };
    }
    if (activeKey === "teacher") {
      return { idLabel: "Telefon", idPh: "05xx...", pinLabel: "PIN", pinPh: "****" };
    }
    return { idLabel: "Kullanıcı", idPh: "admin", pinLabel: "PIN", pinPh: "****" };
  }, [activeKey]);

  async function onSubmit(values) {
    setLoading(true);
    try {
      const payload = { type: activeKey, identifier: values.identifier, pin: values.pin };
      const { data } = await api.post("/auth/login", payload);

      // ✅ backend farklı isimlerle döndürebilir
      const token = data?.accessToken || data?.token || data?.access_token;
      const userType = data?.userType || data?.user_type || activeKey;

      if (!token) throw new Error("Giriş başarılı ama token dönmedi (accessToken/token/access_token yok).");

      // ✅ Tek standart: accessToken + userType
      localStorage.setItem("accessToken", token);
      localStorage.setItem("userType", userType);

      // ✅ Eski anahtarlar varsa temizle (karışıklığı bitir)
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_type");

      // ✅ Sayfa yenilenmeden de çalışsın (anlık)
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      message.success("Giriş başarılı");

      if (userType === "admin") nav("/admin", { replace: true });
      else if (userType === "student") nav("/student", { replace: true });
      else nav("/teacher", { replace: true });
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loginhub-root">
      <a
        className="loginhub-sign"
        href="https://www.linkedin.com/in/mtankul/"
        target="_blank"
        rel="noreferrer"
        title="LinkedIn (MTANKUL)"
      >
        <LinkedinOutlined className="loginhub-sign-ico" />
        <span className="loginhub-sign-txt">MTANKUL</span>
      </a>

      <div className="loginhub-topbar">
        <div className="loginhub-brand">
          <div className="loginhub-brand-title">{orgTitle}</div>
          <div className="loginhub-brand-sub">{orgSubtitle}</div>
        </div>
      </div>

      <div className="loginhub-body">
        <div className="loginhub-left">
          <Card className="loginhub-card" variant="borderless">
            <div className="loginhub-card-hero">
              <img className="loginhub-logo-big" src="/logo/kbu-logo.png" alt="KBÜ Logo" />
              <div className="loginhub-card-hero-title">{siteTitle}</div>
              <div className="loginhub-card-hero-sub">{siteSlogan}</div>
            </div>

            <div className="loginhub-login-area">
              <Text type="secondary">Giriş türünü seçin ve PIN ile doğrulayın</Text>

              <Tabs
                activeKey={activeKey}
                onChange={(k) => {
                  setActiveKey(k);
                  form.resetFields();
                }}
                items={TAB_ITEMS.map((t) => ({
                  key: t.key,
                  label: t.label,
                  children: (
                    <Form layout="vertical" form={form} onFinish={onSubmit}>
                      <Form.Item
                        name="identifier"
                        label={placeholders.idLabel}
                        rules={[{ required: true, message: `${placeholders.idLabel} zorunlu` }]}
                      >
                        <Input
                          size="large"
                          prefix={<UserOutlined />}
                          placeholder={placeholders.idPh}
                          autoComplete="username"
                        />
                      </Form.Item>

                      <Form.Item name="pin" label={placeholders.pinLabel} rules={[{ required: true, message: "PIN zorunlu" }]}>
                        <Input.Password
                          size="large"
                          prefix={<LockOutlined />}
                          placeholder={placeholders.pinPh}
                          autoComplete="current-password"
                        />
                      </Form.Item>

                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                        style={{ borderRadius: 12 }}
                      >
                        Giriş Yap
                      </Button>

                      <div className="loginhub-info">
                        <InfoCircleOutlined />
                        <div>
                          <div style={{ fontWeight: 600 }}>Bilgilendirme</div>
                          <div style={{ opacity: 0.85, fontSize: 13 }}>
                            Giriş yaptıktan sonra yalnızca tanımlı görevlerinize ait içerikler listelenir.
                          </div>
                        </div>
                      </div>

                      <div className="loginhub-footer">© {new Date().getFullYear()} KBÜ · V2</div>
                    </Form>
                  ),
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="loginhub-right">
          <div
            className="loginhub-hero"
            style={
              homeImageUrl
                ? { backgroundImage: `url(${homeImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : undefined
            }
          >
            <div className="loginhub-hero-overlay" />
            <div className="loginhub-hero-caption">
              <div className="loginhub-hero-title">{orgTitle}</div>
              <div className="loginhub-hero-sub">{orgSubtitle}</div>
            </div>
          </div>
          <div className="loginhub-right-gap" />
        </div>
      </div>
    </div>
  );
}
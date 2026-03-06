// D:\staj-sistem-v2\client\src\pages\Settings.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Select,
  Divider,
  message,
  Typography,
  Popconfirm,
  InputNumber,
  Alert,
} from "antd";
import api from "../api";
import { useAppConfig } from "../context/AppConfigContext";

const THEME_PRESETS = [
  { value: "blue", label: "Mavi" },
  { value: "navy", label: "Lacivert" },
  { value: "red", label: "Kırmızı" },
  { value: "green", label: "Yeşil" },
];

const MENU_PRESETS = [
  { value: "dark", label: "Koyu" },
  { value: "light", label: "Açık" },
];

// UI defaultları (backend boş dönse bile form boş kalmasın)
const DEFAULT_SITE_FORM = {
  siteTitle: "Mesleki Uygulama Takip Sistemi",
  siteSlogan: "Şeffaf • İzlenebilir • Ölçülebilir",
  homeImageUrl: "",
  orgTitle: "KARABÜK ÜNİVERSİTESİ · SHMYO",
  orgSubtitle: "Tıbbi Dokümantasyon ve Sekreterlik Programı",
  themePreset: "blue",
  menuPreset: "dark",
};

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);

  const [formSite] = Form.useForm();
  const [formLogs] = Form.useForm();

  const { reloadConfig } = useAppConfig();
  const { Text } = Typography;

  const load = async () => {
    setLoading(true);
    try {
      /**
       * Tercih edilen okuma endpoint’i:
       * - /system-settings/public (LoginHubAntd da bunu kullanıyor)
       * Admin ekranında da aynı kaynaktan okuyabiliriz.
       *
       * Eğer backend admin için ayrı bir endpoint dönüyorsa (/system-settings),
       * onu da fallback olarak deneyebiliriz; ama şimdilik public yeterli.
       */
      const { data } = await api.get("/system-settings/public");

      // data alanlarını form’a map’le (fallback defaultlar)
      formSite.setFieldsValue({
        siteTitle: data?.siteTitle ?? DEFAULT_SITE_FORM.siteTitle,
        siteSlogan: data?.siteSlogan ?? DEFAULT_SITE_FORM.siteSlogan,
        homeImageUrl: data?.homeImageUrl ?? DEFAULT_SITE_FORM.homeImageUrl,
        orgTitle: data?.orgTitle ?? DEFAULT_SITE_FORM.orgTitle,
        orgSubtitle: data?.orgSubtitle ?? DEFAULT_SITE_FORM.orgSubtitle,
        themePreset: data?.themePreset ?? DEFAULT_SITE_FORM.themePreset,
        menuPreset: data?.menuPreset ?? DEFAULT_SITE_FORM.menuPreset,
      });

      formLogs.setFieldsValue({ olderThanDays: 180 });
    } catch (e) {
      message.error(e?.response?.data?.error || "Sistem ayarları yüklenemedi");
      // yine de defaultlarla dolduralım:
      formSite.setFieldsValue(DEFAULT_SITE_FORM);
      formLogs.setFieldsValue({ olderThanDays: 180 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ✅ Direktif (en kritik):
   * Kaydet BUTONU doğru endpoint’e yazacak:
   * POST /system-settings/bulk
   * {
   *   values: { siteTitle, siteSlogan, homeImageUrl, orgTitle, orgSubtitle }
   * }
   *
   * Ayrıca reloadConfig ile canlı güncelleme.
   */
  const onSave = async () => {
    setSavingSite(true);
    try {
      const values = formSite.getFieldsValue();

      await api.post("/system-settings/bulk", {
        values: {
          siteTitle: values.siteTitle,
          siteSlogan: values.siteSlogan,
          homeImageUrl: values.homeImageUrl,
          orgTitle: values.orgTitle,
          orgSubtitle: values.orgSubtitle,

          // İstersen backend destekliyorsa bunları da bulk’a ekleyebilirsin:
          themePreset: values.themePreset,
          menuPreset: values.menuPreset,
        },
      });

      message.success("Kaydedildi");
      reloadConfig?.();
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydetme hatası");
    } finally {
      setSavingSite(false);
    }
  };

  // --- Danger ops (endpointler yoksa da UI bozulmasın) ---
  const clearOldLogs = async () => {
    const { olderThanDays } = formLogs.getFieldsValue();
    setDangerBusy(true);
    try {
      const { data } = await api.delete(
        `/logs/cleanup?olderThanDays=${Number(olderThanDays || 180)}`
      );
      message.success(`Log temizlendi: ${data?.deleted ?? 0}`);
    } catch (e) {
      message.error(
        e?.response?.data?.error ||
          "Log temizleme endpointi henüz ekli değil. (Bir sonraki adımda ekleyeceğiz)"
      );
    } finally {
      setDangerBusy(false);
    }
  };

  const backupDb = async () => {
    setDangerBusy(true);
    try {
      const { data } = await api.post("/admin/backup");
      message.success(data?.message || "Yedekleme başlatıldı");
    } catch (e) {
      message.error(
        e?.response?.data?.error ||
          "Yedekleme endpointi henüz ekli değil. (Bir sonraki adımda ekleyeceğiz)"
      );
    } finally {
      setDangerBusy(false);
    }
  };

  const resetSystem = async ({ pin, confirmText }) => {
    setDangerBusy(true);
    try {
      if (String(confirmText || "").trim().toUpperCase() !== "SIFIRLA") {
        message.error('Onay metni "SIFIRLA" olmalı');
        return;
      }
      const { data } = await api.post("/admin/reset", { pin, confirmText });
      message.success(data?.message || "Sistem sıfırlandı");
    } catch (e) {
      message.error(
        e?.response?.data?.error ||
          "Sistem sıfırlama endpointi henüz ekli değil. (Bir sonraki adımda ekleyeceğiz)"
      );
    } finally {
      setDangerBusy(false);
    }
  };

  const dangerResetForm = useMemo(() => ({ pin: "", confirmText: "" }), []);

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Alert
        type="info"
        showIcon
        title="Not: Not ağırlıkları / devamsızlık / kura kuralları dönem bazlıdır."
        description="Bu sayfa sadece kurumsal sistem ayarları (başlık/slogan/kurum metni/tema vb.) ve operasyonel işlemler (log/backup/reset) içindir."
      />

      {/* Kurumsal Ayarlar */}
      <Card title="Kurumsal Ayarlar" loading={loading}>
        <Form
          form={formSite}
          layout="vertical"
          initialValues={DEFAULT_SITE_FORM}
          onFinish={onSave}
        >
          <Form.Item
            label="Site Başlık"
            name="siteTitle"
            rules={[{ required: true, message: "Başlık zorunlu" }]}
          >
            <Input placeholder="Örn: KBÜ Mesleki Uygulama Takip Sistemi" />
          </Form.Item>

          <Form.Item label="Site Slogan" name="siteSlogan">
            <Input placeholder="Örn: Şeffaf • İzlenebilir • Ölçülebilir" />
          </Form.Item>

          <Form.Item label="Ana Sayfa Foto Linki" name="homeImageUrl">
            <Input placeholder="/images/login-hero.jpg veya https://..." />
          </Form.Item>

          <Divider />

          <Form.Item
            label="Üst Kurum Başlığı (Login/Üst Bar)"
            name="orgTitle"
            rules={[{ required: true, message: "Kurum başlığı zorunlu" }]}
          >
            <Input placeholder="Örn: KARABÜK ÜNİVERSİTESİ · SHMYO" />
          </Form.Item>

          <Form.Item label="Alt Başlık" name="orgSubtitle">
            <Input placeholder="Örn: Tıbbi Dokümantasyon ve Sekreterlik Programı" />
          </Form.Item>

          <Space wrap>
            <Form.Item label="Tema Rengi (Preset)" name="themePreset">
              <Select style={{ minWidth: 220 }} options={THEME_PRESETS} />
            </Form.Item>

            <Form.Item label="Admin Menü Stili" name="menuPreset">
              <Select style={{ minWidth: 220 }} options={MENU_PRESETS} />
            </Form.Item>
          </Space>

          <Button type="primary" htmlType="submit" loading={savingSite}>
            Kaydet
          </Button>

          <Divider />

          <Text type="secondary">
            İpucu: Kaydettikten sonra üst header/login ekranı otomatik güncellensin diye{" "}
            <b>reloadConfig()</b> çağırıyoruz.
          </Text>
        </Form>
      </Card>

      {/* Log Yönetimi */}
      <Card title="Log Yönetimi" loading={loading}>
        <Form form={formLogs} layout="inline" initialValues={{ olderThanDays: 180 }}>
          <Form.Item
            label="Şu günden eski logları sil (gün)"
            name="olderThanDays"
            rules={[{ required: true }]}
          >
            <InputNumber min={7} step={1} />
          </Form.Item>

          <Popconfirm
            title="Eski logları silmek istiyor musunuz?"
            description="Bu işlem geri alınamaz."
            okText="Evet, sil"
            cancelText="Vazgeç"
            onConfirm={clearOldLogs}
          >
            <Button danger loading={dangerBusy}>
              Log Temizle
            </Button>
          </Popconfirm>
        </Form>

        <Divider />

        <Text type="secondary">
          Not: Audit log ekranı ayrı bir menü olarak gelecek (arama/filtreleme).
        </Text>
      </Card>

      {/* Operasyon */}
      <Card title="Operasyon" loading={loading}>
        <Space wrap>
          <Button onClick={backupDb} loading={dangerBusy}>
            Veritabanı Yedekle
          </Button>
        </Space>

        <Divider />

        <Alert
          type="warning"
          showIcon
          title="Sistemi Sıfırla (Tehlikeli)"
          description="Bu işlem tüm tablolardaki verileri siler ve sistemi sıfırdan başlatır. Super Admin PIN doğrulaması ve 'SIFIRLA' onayı gerekir."
        />

        <div style={{ marginTop: 12 }}>
          <DangerReset onReset={resetSystem} busy={dangerBusy} initial={dangerResetForm} />
        </div>
      </Card>
    </Space>
  );
}

function DangerReset({ onReset, busy, initial }) {
  const [form] = Form.useForm();

  return (
    <Form
      form={form}
      layout="inline"
      initialValues={initial}
      onFinish={onReset}
      style={{ gap: 12 }}
    >
      <Form.Item
        label="Admin PIN"
        name="pin"
        rules={[{ required: true, message: "PIN zorunlu" }]}
      >
        <Input.Password placeholder="PIN" style={{ width: 180 }} />
      </Form.Item>

      <Form.Item
        label='Onay ("SIFIRLA")'
        name="confirmText"
        rules={[{ required: true, message: 'Onay metni "SIFIRLA" olmalı' }]}
      >
        <Input placeholder="SIFIRLA" style={{ width: 180 }} />
      </Form.Item>

      <Popconfirm
        title="Sistemi SIFIRLAMAK istiyor musunuz?"
        description="Bu işlem geri alınamaz."
        okText="Evet, sıfırla"
        cancelText="Vazgeç"
        onConfirm={() => form.submit()}
      >
        <Button danger loading={busy}>
          Sistemi Sıfırla
        </Button>
      </Popconfirm>
    </Form>
  );
}
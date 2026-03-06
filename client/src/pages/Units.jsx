import { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, message, Typography } from "antd";
import api from "../api";

const GENDER_ALL = "ALL";

const genderOptions = [
  { value: GENDER_ALL, label: "Yok (Karma)" }, // ✅ null yok
  { value: "E", label: "Erkek" },
  { value: "K", label: "Kadın" },
];

export default function Units() {
  const [hospitals, setHospitals] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);

  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const loadHospitals = useCallback(async () => {
    const { data } = await api.get("/hospitals");
    setHospitals(data || []);
    if (!hospitalId && (data || []).length) setHospitalId(data[0].id);
  }, [hospitalId]);

  const loadUnits = useCallback(async (hid) => {
    if (!hid) return;
    const { data } = await api.get(`/units?hospitalId=${hid}`);
    setRows(data || []);
  }, []);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  useEffect(() => {
    loadUnits(hospitalId);
  }, [hospitalId, loadUnits]);

  const hospitalOptions = useMemo(
    () => (hospitals || []).filter((h) => h?.id != null).map((h) => ({ value: h.id, label: `${h.priorityOrder}. ${h.name}` })),
    [hospitals]
  );

  // ✅ Modal açılınca formu doldur (Modal kapalıyken setFieldsValue yapma)
  useEffect(() => {
    if (!open) return;

    if (editing) {
      form.setFieldsValue({
        ...editing,
        // backend null/undefined ise UI'de ALL göster
        genderRule: editing.genderRule ?? GENDER_ALL,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        isActive: true,
        dailyQuota: 0,
        priorityOrder: 999,
        genderRule: GENDER_ALL,
      });
    }
  }, [open, editing, form]);

  const columns = useMemo(
    () => [
      { title: "Öncelik", dataIndex: "priorityOrder", width: 90 },
      { title: "Birim", dataIndex: "name" },
      { title: "Günlük Kont.", dataIndex: "dailyQuota", width: 120 },
      {
        title: "Cinsiyet",
        dataIndex: "genderRule",
        width: 110,
        render: (v) => (v === "E" ? "Erkek" : v === "K" ? "Kadın" : "Karma"),
      },
      { title: "Aktif", dataIndex: "isActive", width: 80, render: (v) => (v ? "Evet" : "Hayır") },
      {
        title: "İşlem",
        width: 200,
        render: (_, r) => (
          <Space>
            <Button
              onClick={() => {
                setEditing(r);
                setOpen(true);
              }}
            >
              Düzenle
            </Button>

            <Button
              danger
              onClick={() => {
                Modal.confirm({
                  title: "Silmek istiyor musunuz?",
                  content: "Bu işlem geri alınamaz.",
                  okText: "Sil",
                  okButtonProps: { danger: true },
                  cancelText: "Vazgeç",
                  onOk: async () => {
                    await api.delete(`/units/${r.id}`);
                    message.success("Silindi");
                    await loadUnits(hospitalId);
                  },
                });
              }}
            >
              Sil
            </Button>
          </Space>
        ),
      },
    ],
    [hospitalId, loadUnits]
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const onFinish = async (values) => {
    if (!hospitalId) return message.error("Önce hastane seçmelisin.");

    // ✅ UI ALL -> backend null
    const genderRuleForApi = values.genderRule === GENDER_ALL ? null : values.genderRule;

    const payload = {
      ...values,
      hospitalId,
      genderRule: genderRuleForApi,
    };

    if (editing) {
      await api.put(`/units/${editing.id}`, payload);
      message.success("Güncellendi");
    } else {
      await api.post("/units", payload);
      message.success("Eklendi");
    }

    closeModal();
    await loadUnits(hospitalId);
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Birimler
      </Typography.Title>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap align="start">
          <div style={{ minWidth: 320 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Hastane</div>
            <Select style={{ width: "100%" }} options={hospitalOptions} value={hospitalId} onChange={setHospitalId} />
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Yeni Birim</div>
            <Button type="primary" onClick={openCreate}>
              Ekle
            </Button>
          </div>
        </Space>
      </Card>

      <Table rowKey="id" columns={columns} dataSource={rows} />

      <Modal
        title={editing ? "Birim Düzenle" : "Yeni Birim"}
        open={open}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Birim Adı" rules={[{ required: true, message: "Birim adı zorunlu" }]}>
            <Input placeholder="GENEL / Dahiliye / Radyoloji ..." />
          </Form.Item>

          <Space style={{ width: "100%" }} wrap>
            <Form.Item name="dailyQuota" label="Günlük Kontenjan" rules={[{ required: true, message: "Kontenjan zorunlu" }]}>
              <InputNumber min={0} />
            </Form.Item>

            <Form.Item name="priorityOrder" label="Öncelik (1 en yüksek)" rules={[{ required: true, message: "Öncelik zorunlu" }]}>
              <InputNumber min={1} />
            </Form.Item>

            <Form.Item name="genderRule" label="Cinsiyet Kuralı">
              <Select options={genderOptions} />
            </Form.Item>

            <Form.Item name="isActive" label="Aktif" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
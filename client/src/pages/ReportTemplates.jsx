// client/src/pages/ReportTemplates.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Space,
  Select,
  Button,
  Input,
  InputNumber,
  Table,
  Divider,
  Typography,
  Popconfirm,
  Switch,
  message,
  Modal,
  Form,
  Tag,
} from "antd";
import { PlusOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import api from "../api";

const clone = (obj) => {
  // structuredClone yoksa fallback
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
};

export default function ReportTemplates() {
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);

  const [activeTpl, setActiveTpl] = useState(null);
  const [draftTpl, setDraftTpl] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  async function loadList(preserveSelected = true) {
    try {
      const { data } = await api.get("/report-templates");
      const list = data || [];
      setTemplates(list);

      // seçili yoksa ilkini seç
      if (!templateId && list.length) {
        setTemplateId(list[0].id);
        return;
      }

      // seçili şablon silindiyse/gelmiyorsa ilkine düş
      if (preserveSelected && templateId && list.length) {
        const exists = list.some((t) => t.id === templateId);
        if (!exists) setTemplateId(list[0].id);
      }
    } catch (e) {
      message.error(e?.response?.data?.error || "Şablon listesi yüklenemedi");
    }
  }

  async function loadOne(id) {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/report-templates/${id}`);
      setActiveTpl(data);
      setDraftTpl(clone(data));
      setDirty(false);
    } catch (e) {
      message.error(e?.response?.data?.error || "Şablon detayı yüklenemedi");
      setActiveTpl(null);
      setDraftTpl(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadOne(templateId);
  }, [templateId]);

  const options = useMemo(
    () =>
      (templates || []).map((t) => ({
        value: t.id,
        label: `${t.name} (v${t.version})${t.isActive ? " · Aktif" : ""}`,
      })),
    [templates]
  );

  const total = useMemo(() => {
    const qs = draftTpl?.questions || [];
    return qs
      .filter((q) => q.isActive)
      .reduce((a, b) => a + Number(b.points || 0), 0);
  }, [draftTpl]);

  const canActivate = total === 100;

  function markDirty() {
    setDirty(true);
  }

  function patchQuestion(id, patch) {
    setDraftTpl((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      const q = (next.questions || []).find((x) => x.id === id);
      if (q) Object.assign(q, patch);
      return next;
    });
    markDirty();
  }

  async function updateTemplate(patch) {
    if (!templateId) return;
    await api.put(`/report-templates/${templateId}`, patch);
    await loadList();
    await loadOne(templateId);
  }

  async function addQuestion() {
    if (!templateId) return message.error("Önce şablon seç");
    try {
      setLoading(true);
      await api.post(`/report-templates/${templateId}/questions`, {
        text: "Yeni Soru",
        points: 0,
        orderNo: (draftTpl?.questions?.length || 0) + 1,
        isActive: true,
      });
      await loadOne(templateId);
    } catch (e) {
      message.error(e?.response?.data?.error || "Soru eklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuestion(questionId) {
    try {
      setLoading(true);
      await api.delete(`/report-templates/questions/${questionId}`);
      await loadOne(templateId);
    } catch (e) {
      message.error(e?.response?.data?.error || "Soru silinemedi");
    } finally {
      setLoading(false);
    }
  }

  async function createTemplate(values) {
    try {
      setLoading(true);
      const { data } = await api.post("/report-templates", values);
      message.success("Rapor şablonu oluşturuldu");
      setCreateOpen(false);
      createForm.resetFields();

      await loadList(false);

      // backend bazen {item:{id}} bazen direkt {id} döndürebilir
      const newId = data?.item?.id || data?.id;
      if (newId) setTemplateId(newId);
    } catch (e) {
      message.error(e?.response?.data?.error || "Şablon oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!draftTpl || !activeTpl || !templateId) return;

    try {
      setLoading(true);

      // template üst
      const tplPatch = {};
      if ((draftTpl.name || "") !== (activeTpl.name || "")) tplPatch.name = draftTpl.name || "";
      if ((draftTpl.description || "") !== (activeTpl.description || "")) tplPatch.description = draftTpl.description || "";

      if (Object.keys(tplPatch).length) {
        await api.put(`/report-templates/${templateId}`, tplPatch);
      }

      // questions patch
      for (const q of draftTpl.questions || []) {
        const old = (activeTpl.questions || []).find((x) => x.id === q.id);
        if (!old) continue;

        const qPatch = {};
        if ((q.text || "") !== (old.text || "")) qPatch.text = q.text || "";
        if (Number(q.points || 0) !== Number(old.points || 0)) qPatch.points = Number(q.points || 0);
        if (Number(q.orderNo || 1) !== Number(old.orderNo || 1)) qPatch.orderNo = Number(q.orderNo || 1);
        if (!!q.isActive !== !!old.isActive) qPatch.isActive = !!q.isActive;

        if (Object.keys(qPatch).length) {
          await api.put(`/report-templates/questions/${q.id}`, qPatch);
        }
      }

      message.success("Kaydedildi");
      await loadList();
      await loadOne(templateId);
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydetme başarısız");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    const qs = draftTpl?.questions || [];
    // orderNo'ya göre sırala (UI daha tutarlı)
    const sorted = [...qs].sort((a, b) => Number(a.orderNo || 0) - Number(b.orderNo || 0));
    return sorted.map((q) => ({ key: q.id, ...q }));
  }, [draftTpl]);

  const columns = [
    {
      title: "Sıra",
      width: 110,
      render: (_, r) => (
        <InputNumber
          min={1}
          value={r.orderNo}
          style={{ width: "100%" }}
          onChange={(v) => patchQuestion(r.id, { orderNo: Number(v || 1) })}
        />
      ),
    },
    {
      title: "Soru (Açık Uçlu)",
      render: (_, r) => <Input value={r.text} onChange={(e) => patchQuestion(r.id, { text: e.target.value })} />,
    },
    {
      title: "Ağırlık",
      width: 140,
      render: (_, r) => (
        <InputNumber
          min={0}
          max={100}
          value={r.points}
          style={{ width: "100%" }}
          onChange={(v) => patchQuestion(r.id, { points: Number(v || 0) })}
        />
      ),
    },
    {
      title: "Aktif",
      width: 110,
      render: (_, r) => <Switch checked={!!r.isActive} onChange={(v) => patchQuestion(r.id, { isActive: !!v })} />,
    },
    {
      title: "İşlem",
      width: 160,
      render: (_, r) => (
        <Popconfirm title="Soru silinsin mi?" okText="Sil" cancelText="Vazgeç" onConfirm={() => deleteQuestion(r.id)}>
          <Button danger icon={<DeleteOutlined />}>
            Sil
          </Button>
        </Popconfirm>
      ),
    },
  ];

  function requestChangeTemplate(id) {
    if (!dirty) {
      setTemplateId(id);
      return;
    }

    Modal.confirm({
      title: "Kaydedilmemiş değişiklik var",
      content: "Şablonu değiştirirsen kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?",
      okText: "Değiştir",
      cancelText: "Vazgeç",
      onOk: () => setTemplateId(id),
    });
  }

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Card
        title={
          <Space>
            <span>Rapor Şablonları (Açık Uçlu)</span>
            {dirty ? <Tag color="orange">Kaydedilmemiş değişiklik</Tag> : <Tag color="green">Kaydedildi</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Yeni Şablon
            </Button>
            <Button onClick={addQuestion} disabled={!templateId}>
              Soru Ekle
            </Button>
            <Button icon={<SaveOutlined />} type="primary" disabled={!dirty} loading={loading} onClick={saveDraft}>
              Kaydet
            </Button>
          </Space>
        }
      >
        <Space wrap style={{ width: "100%" }}>
          <div style={{ minWidth: 420 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Şablon seç</div>
            <Select style={{ width: "100%" }} value={templateId} options={options} onChange={requestChangeTemplate} />
          </div>

          {draftTpl && (
            <>
              <div style={{ minWidth: 320 }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Şablon Adı</div>
                <Input
                  value={draftTpl.name}
                  onChange={(e) => {
                    setDraftTpl((p) => ({ ...p, name: e.target.value }));
                    markDirty();
                  }}
                />
              </div>

              <div style={{ minWidth: 260 }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Aktif</div>
                <Switch
                  checked={!!draftTpl.isActive}
                  disabled={!draftTpl.isActive && !canActivate}
                  onChange={async (v) => {
                    try {
                      await updateTemplate({ isActive: !!v });
                      message.success(v ? "Şablon aktif" : "Şablon pasif");
                    } catch (e) {
                      message.error(e?.response?.data?.error || "İşlem başarısız");
                      await loadOne(templateId);
                    }
                  }}
                />
                {!canActivate && !draftTpl.isActive && (
                  <div style={{ marginTop: 6, color: "#cf1322", fontWeight: 600 }}>
                    Aktif sorular toplamı 100 olmalı (şu an {total})
                  </div>
                )}
              </div>
            </>
          )}
        </Space>

        <Divider />

        {draftTpl ? (
          <>
            <Card size="small" title="Toplam Kontrol">
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Aktif sorular toplamı</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{total}</div>
                </div>
                <Typography.Text type="secondary">Kural: Aktif soruların ağırlık toplamı 100 olmalı.</Typography.Text>
              </Space>
            </Card>

            <Divider />

            <Table columns={columns} dataSource={rows} size="small" pagination={false} loading={loading} />
          </>
        ) : (
          <Typography.Text type="secondary">Şablon seç veya “Yeni Şablon” oluştur.</Typography.Text>
        )}
      </Card>

      <Modal
        title="Yeni Rapor Şablonu"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Oluştur"
        confirmLoading={loading}
      >
        <Form form={createForm} layout="vertical" onFinish={createTemplate}>
          <Form.Item name="name" label="Şablon Adı" rules={[{ required: true, message: "Zorunlu" }]}>
            <Input placeholder="Örn: Haftalık Uygulama Raporu v1" />
          </Form.Item>
          <Form.Item name="description" label="Açıklama">
            <Input placeholder="Opsiyonel" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
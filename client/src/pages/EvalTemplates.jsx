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

export default function EvalTemplates() {
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [activeTpl, setActiveTpl] = useState(null);
  const [draftTpl, setDraftTpl] = useState(null); // ✅ kullanıcı burada düzenler
  const [dirty, setDirty] = useState(false);

  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  async function loadList() {
    const { data } = await api.get("/eval-templates");
    setTemplates(data || []);
    if (!templateId && (data || []).length) setTemplateId(data[0].id);
  }

  async function loadOne(id) {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/eval-templates/${id}`);
      setActiveTpl(data);
      setDraftTpl(structuredClone(data)); // ✅ her yüklemede draft sıfırlansın
      setDirty(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const options = useMemo(
    () =>
      (templates || []).map((t) => ({
        value: t.id,
        label: `${t.name} (v${t.version})${t.isActive ? " · Aktif" : ""}`,
      })),
    [templates]
  );

  const totals = useMemo(() => {
    if (!draftTpl?.groups) return { sum: 0, byGroup: [] };
    const byGroup = draftTpl.groups.map((g) => {
      const sum = (g.items || [])
        .filter((i) => i.isActive)
        .reduce((a, b) => a + Number(b.points || 0), 0);
      return { id: g.id, title: g.title, target: g.totalPoints, sum };
    });
    const sum = byGroup.reduce((a, b) => a + b.sum, 0);
    return { sum, byGroup };
  }, [draftTpl]);

  const canActivate = totals.sum === 100;

  // ------------------------
  // ✅ CRUD: DB’ye anlık değil, aksiyonla
  // ------------------------
  async function updateTemplate(patch) {
    if (!templateId) return;
    await api.put(`/eval-templates/${templateId}`, patch);
    await loadList();
    await loadOne(templateId);
  }

  async function addGroup() {
    if (!templateId) return message.error("Önce şablon seç");
    await api.post(`/eval-templates/${templateId}/groups`, {
      title: "Yeni Grup",
      totalPoints: 0,
      orderNo: (draftTpl?.groups?.length || 0) + 1,
    });
    await loadOne(templateId);
  }

  async function deleteGroup(groupId) {
    await api.delete(`/eval-templates/groups/${groupId}`);
    await loadOne(templateId);
  }

  async function addItem(groupId) {
    await api.post(`/eval-templates/groups/${groupId}/items`, {
      text: "Yeni Madde",
      points: 0,
      orderNo: 1,
      isActive: true,
    });
    await loadOne(templateId);
  }

  async function deleteItem(itemId) {
    await api.delete(`/eval-templates/items/${itemId}`);
    await loadOne(templateId);
  }

  async function createTemplate(values) {
    const { data } = await api.post("/eval-templates", values);
    message.success("Şablon oluşturuldu");
    setCreateOpen(false);
    createForm.resetFields();
    await loadList();
    setTemplateId(data.item.id);
  }

  // ------------------------
  // ✅ DRAFT edit helpers
  // ------------------------
  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function patchGroup(groupId, patch) {
    setDraftTpl((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const g = next.groups?.find((x) => x.id === groupId);
      if (g) Object.assign(g, patch);
      return next;
    });
    markDirty();
  }

  function patchItem(itemId, patch) {
    setDraftTpl((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      for (const g of next.groups || []) {
        const it = (g.items || []).find((x) => x.id === itemId);
        if (it) {
          Object.assign(it, patch);
          break;
        }
      }
      return next;
    });
    markDirty();
  }

  // ------------------------
  // ✅ KAYDET: Toplu güncelle
  // ------------------------
  async function saveDraft() {
    if (!draftTpl || !activeTpl) return;

    try {
      setLoading(true);

      // 1) Template üst alanları (name, openQuestionText)
      const tplPatch = {};
      if (draftTpl.name !== activeTpl.name) tplPatch.name = draftTpl.name;
      if ((draftTpl.openQuestionText || "") !== (activeTpl.openQuestionText || ""))
        tplPatch.openQuestionText = draftTpl.openQuestionText || "";

      if (Object.keys(tplPatch).length) {
        await api.put(`/eval-templates/${templateId}`, tplPatch);
      }

      // 2) Grup patch’leri
      for (const g of draftTpl.groups || []) {
        const old = (activeTpl.groups || []).find((x) => x.id === g.id);
        if (!old) continue;
        const gPatch = {};
        if (g.title !== old.title) gPatch.title = g.title;
        if (Number(g.totalPoints || 0) !== Number(old.totalPoints || 0)) gPatch.totalPoints = Number(g.totalPoints || 0);
        if (Number(g.orderNo || 1) !== Number(old.orderNo || 1)) gPatch.orderNo = Number(g.orderNo || 1);
        if (Object.keys(gPatch).length) {
          await api.put(`/eval-templates/groups/${g.id}`, gPatch);
        }
      }

      // 3) Item patch’leri
      for (const g of draftTpl.groups || []) {
        for (const it of g.items || []) {
          const oldG = (activeTpl.groups || []).find((x) => x.id === g.id);
          const old = (oldG?.items || []).find((x) => x.id === it.id);
          if (!old) continue;
          const iPatch = {};
          if (it.text !== old.text) iPatch.text = it.text;
          if (Number(it.points || 0) !== Number(old.points || 0)) iPatch.points = Number(it.points || 0);
          if (Number(it.orderNo || 1) !== Number(old.orderNo || 1)) iPatch.orderNo = Number(it.orderNo || 1);
          if (!!it.isActive !== !!old.isActive) iPatch.isActive = !!it.isActive;
          if (Object.keys(iPatch).length) {
            await api.put(`/eval-templates/items/${it.id}`, iPatch);
          }
        }
      }

      message.success("Değişiklikler kaydedildi");
      await loadList();
      await loadOne(templateId);
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydetme başarısız");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!draftTpl?.groups) return [];
    const out = [];
    for (const g of draftTpl.groups) {
      out.push({
        key: `g_${g.id}`,
        rowType: "group",
        groupId: g.id,
        title: g.title,
        orderNo: g.orderNo,
        totalPoints: g.totalPoints,
      });
      for (const it of g.items || []) {
        out.push({
          key: it.id,
          rowType: "item",
          groupId: g.id,
          itemId: it.id,
          text: it.text,
          points: it.points,
          orderNo: it.orderNo,
          isActive: it.isActive,
          groupTitle: g.title,
        });
      }
    }
    return out;
  }, [draftTpl]);

  const columns = [
    {
      title: "Tür",
      width: 110,
      render: (_, r) => (r.rowType === "group" ? <b>GRUP</b> : "Madde"),
    },
    {
      title: "Başlık / Madde",
      render: (_, r) => {
        if (r.rowType === "group") {
          return (
            <Input
              value={r.title}
              onChange={(e) => patchGroup(r.groupId, { title: e.target.value })}
              placeholder="Grup başlığı"
            />
          );
        }
        return (
          <Input
            value={r.text}
            onChange={(e) => patchItem(r.itemId, { text: e.target.value })}
            placeholder="Madde"
          />
        );
      },
    },
    {
      title: "Sıra",
      width: 110,
      render: (_, r) => (
        <InputNumber
          min={1}
          value={r.orderNo}
          style={{ width: "100%" }}
          onChange={(v) =>
            r.rowType === "group"
              ? patchGroup(r.groupId, { orderNo: Number(v || 1) })
              : patchItem(r.itemId, { orderNo: Number(v || 1) })
          }
        />
      ),
    },
    {
      title: "Puan / Hedef",
      width: 160,
      render: (_, r) => {
        if (r.rowType === "group") {
          return (
            <InputNumber
              min={0}
              value={r.totalPoints}
              style={{ width: "100%" }}
              onChange={(v) => patchGroup(r.groupId, { totalPoints: Number(v || 0) })}
            />
          );
        }
        return (
          <InputNumber
            min={0}
            value={r.points}
            style={{ width: "100%" }}
            onChange={(v) => patchItem(r.itemId, { points: Number(v || 0) })}
          />
        );
      },
    },
    {
      title: "Aktif",
      width: 110,
      render: (_, r) =>
        r.rowType === "item" ? (
          <Switch checked={!!r.isActive} onChange={(v) => patchItem(r.itemId, { isActive: !!v })} />
        ) : (
          "-"
        ),
    },
    {
      title: "İşlem",
      width: 210,
      render: (_, r) => {
        if (r.rowType === "group") {
          return (
            <Space>
              <Button onClick={() => addItem(r.groupId)} icon={<PlusOutlined />}>
                Madde Ekle
              </Button>
              <Popconfirm
                title="Grubu sil?"
                description="Altındaki maddeler de silinir."
                okText="Sil"
                cancelText="Vazgeç"
                onConfirm={() => deleteGroup(r.groupId)}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          );
        }

        return (
          <Popconfirm
            title="Madde silinsin mi?"
            okText="Sil"
            cancelText="Vazgeç"
            onConfirm={() => deleteItem(r.itemId)}
          >
            <Button danger icon={<DeleteOutlined />}>
              Sil
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Card
        title={
          <Space>
            <span>Değerlendirme Şablonları</span>
            {dirty ? <Tag color="orange">Kaydedilmemiş değişiklik</Tag> : <Tag color="green">Kaydedildi</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button onClick={() => setCreateOpen(true)} type="primary" icon={<PlusOutlined />}>
              Yeni Şablon
            </Button>
            <Button onClick={addGroup} disabled={!templateId}>
              Grup Ekle
            </Button>
            <Button
              icon={<SaveOutlined />}
              type="primary"
              disabled={!dirty}
              loading={loading}
              onClick={saveDraft}
            >
              Kaydet
            </Button>
          </Space>
        }
      >
        <Space wrap style={{ width: "100%" }}>
          <div style={{ minWidth: 420 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Şablon seç</div>
            <Select
              style={{ width: "100%" }}
              value={templateId}
              options={options}
              placeholder="Şablon seç"
              onChange={(id) => {
                if (dirty) message.info("Kaydedilmemiş değişiklikler var. İstersen önce Kaydet.");
                setTemplateId(id);
              }}
            />
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

              <div style={{ minWidth: 240 }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Aktif</div>
                <Switch
                  checked={!!draftTpl.isActive}
                  disabled={!draftTpl.isActive && !canActivate}
                  onChange={async (v) => {
                    // ✅ Aktif/pasif işlemi yine direkt DB’de olsun (kural kontrolü server’da)
                    try {
                      await updateTemplate({ isActive: !!v });
                      message.success(v ? "Şablon aktif" : "Şablon pasif");
                    } catch (e) {
                      message.error(e?.response?.data?.error || "İşlem başarısız");
                      await loadOne(templateId);
                    }
                  }}
                />
                {!canActivate && (
                  <div style={{ marginTop: 6, color: "#cf1322", fontWeight: 600 }}>
                    Şablon aktif edilemez: Aktif maddelerin toplamı 100 olmalı (şu an {totals.sum})
                  </div>
                )}
              </div>
            </>
          )}
        </Space>

        <Divider />

        {draftTpl ? (
          <>
            <Card size="small" title="Açık Uçlu Alan (opsiyonel)">
              <Input.TextArea
                rows={2}
                value={draftTpl.openQuestionText || ""}
                placeholder="Örn: Staj yürütücüsünün öğrenci hakkındaki görüşleri / notları"
                onChange={(e) => {
                  setDraftTpl((p) => ({ ...p, openQuestionText: e.target.value }));
                  markDirty();
                }}
              />
            </Card>

            <Divider />

            <Card size="small" title="Toplam Kontrol">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Aktif maddeler toplamı</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{totals.sum}</div>
                </div>
                <div style={{ flex: 1, minWidth: 320 }}>
                  {totals.byGroup.map((g) => (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{g.title}</span>
                      <b>
                        {g.sum} / {g.target}
                      </b>
                    </div>
                  ))}
                </div>
                <Typography.Text type="secondary">
                  Not: “Hedef” (grup toplamı) uyarı amaçlıdır. Asıl kural: Aktif maddelerin toplamı 100 olmalı.
                </Typography.Text>
              </div>
            </Card>

            <Divider />

            <Table columns={columns} dataSource={rows} size="small" pagination={false} loading={loading} />
          </>
        ) : (
          <Typography.Text type="secondary">Şablon seç veya “Yeni Şablon” oluştur.</Typography.Text>
        )}
      </Card>

      <Modal
        title="Yeni Şablon"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Oluştur"
      >
        <Form form={createForm} layout="vertical" onFinish={createTemplate}>
          <Form.Item name="name" label="Şablon Adı" rules={[{ required: true, message: "Zorunlu" }]}>
            <Input placeholder="Örn: TDS Staj Değerlendirme v1" />
          </Form.Item>
          <Form.Item name="description" label="Açıklama">
            <Input placeholder="Opsiyonel" />
          </Form.Item>
          <Form.Item name="openQuestionText" label="Açık Uçlu Alan Metni">
            <Input placeholder="Opsiyonel" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
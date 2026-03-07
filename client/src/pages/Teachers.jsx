import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Checkbox, Form, Input, message, Modal, Select, Space, Switch, Table, Tag } from "antd";
import api from "../api";

const DAY_LABEL_TR = {
  MON: "Pazartesi",
  TUE: "Salı",
  WED: "Çarşamba",
  THU: "Perşembe",
  FRI: "Cuma",
  SAT: "Cumartesi",
  SUN: "Pazar",
};

const TERM_TR = { GUZ: "Güz", BAHAR: "Bahar", YAZ: "Yaz" };

function dayOptionsFromPeriod(period) {
  const days =
    Array.isArray(period?.practiceDays) && period.practiceDays.length ? period.practiceDays : ["WED", "FRI"];
  return days.map((d) => ({ value: d, label: DAY_LABEL_TR[d] || d }));
}

export default function Teachers({ periodId, setPeriodId, periods, hospitals, reloadCommon }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const period = useMemo(() => periods?.find((p) => p.id === periodId) || null, [periods, periodId]);

  // ✅ Period label: academicYear + term + course.name
  const periodOptions = useMemo(() => {
    return (periods || []).map((p) => {
      const termLabel = TERM_TR[String(p.term || "").toUpperCase()] || p.term || "";
      const courseName = p.course?.name || "";
      const label = `${p.academicYear || ""} ${termLabel} — ${courseName}`.trim();
      return { value: p.id, label: label || p.id };
    });
  }, [periods]);

  const dayOptions = useMemo(() => dayOptionsFromPeriod(period), [period]);

  const hospitalOptions = useMemo(
    () => (hospitals || []).map((h) => ({ value: h.id, label: h.name })),
    [hospitals]
  );

  const load = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/teachers?periodId=${periodId}`);
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  }, [form]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      // ✅ Roller sade: sadece gözlemci + koordinatör
      isObserver: true,
      isCoordinator: false,

      isActive: true,
      practiceDays: period?.practiceDays?.length ? period.practiceDays : ["WED", "FRI"],
      hospitalIds: [],
      messageFlag: "A",
      resetPin: false,
    });
    setOpen(true);
  }

  function openEdit(rec) {
    setEditing(rec);
    form.resetFields();
    form.setFieldsValue({
      nameSurname: rec.nameSurname,
      phone: rec.phone,
      email: rec.email,
      photoUrl: rec.photoUrl,
      isObserver: rec.isObserver,
      isCoordinator: rec.isCoordinator,
      isActive: rec.isActive,
      messageFlag: rec.messageFlag,
      practiceDays: rec.practiceDays || [],
      hospitalIds: (rec.hospitals || []).map((x) => x.hospitalId),
      resetPin: false,
    });
    setOpen(true);
  }

  // ✅ Form submit: AntD Form onFinish kullan
  const onFinish = useCallback(
    async (v) => {
      if (!periodId) return message.error("Önce dönem seç");

      const payload = {
        periodId,
        nameSurname: v.nameSurname,
        phone: v.phone,
        email: v.email || null,
        photoUrl: v.photoUrl || null,
        practiceDays: v.practiceDays || [],
        hospitalIds: v.hospitalIds || [],

        // ✅ Roller sade: backend'e sadece bunları gönder
        isObserver: !!v.isObserver,
        isCoordinator: !!v.isCoordinator,

        isActive: !!v.isActive,
        messageFlag: v.messageFlag,
        resetPin: !!v.resetPin,
      };

      if (editing) {
        await api.put(`/teachers/${editing.id}`, payload);
        message.success("Güncellendi");
      } else {
        await api.post(`/teachers`, payload);
        message.success("Eklendi (PIN=telefon son 4)");
      }

      closeModal();
      await load();
      if (typeof reloadCommon === "function") await reloadCommon();
    },
    [periodId, editing, load, closeModal, reloadCommon]
  );

  async function resetPin(id) {
    Modal.confirm({
      title: "PIN sıfırlansın mı?",
      content: "PIN, telefon numarasının son 4 hanesine sıfırlanacak. İlk giriş uyarısı tekrar gösterilecek.",
      okText: "Evet",
      cancelText: "Vazgeç",
      onOk: async () => {
        await api.post(`/teachers/${id}/reset-pin`);
        message.success("PIN sıfırlandı");
        await load();
      },
    });
  }

  async function remove(id) {
    Modal.confirm({
      title: "Silmek istiyor musunuz?",
      content: "Bu işlem geri alınamaz.",
      okText: "Sil",
      okButtonProps: { danger: true },
      cancelText: "Vazgeç",
      onOk: async () => {
        await api.delete(`/teachers/${id}`);
        message.success("Silindi");
        await load();
      },
    });
  }

  /* ===============================
     ✅ TALİMAT 4: Eval Snapshot UI
     - "Değerlendir" butonu -> snapshot getir -> dinamik alt kırılım göster
  ================================ */
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalTeacher, setEvalTeacher] = useState(null);
  const [evalSnap, setEvalSnap] = useState(null);

  const closeEval = useCallback(() => {
    setEvalOpen(false);
    setEvalTeacher(null);
    setEvalSnap(null);
    setEvalLoading(false);
  }, []);

  const openEval = useCallback(
    async (teacherRow) => {
      if (!periodId) return message.error("Önce dönem seç");
      setEvalOpen(true);
      setEvalTeacher(teacherRow);
      setEvalSnap(null);
      setEvalLoading(true);
      try {
        const { data } = await api.get(`/teacher/eval-snapshot?periodId=${encodeURIComponent(periodId)}`);
        setEvalSnap(data);
      } catch (e) {
        message.error(e?.response?.data?.error || "Değerlendirme şablonu (snapshot) alınamadı");
      } finally {
        setEvalLoading(false);
      }
    },
    [periodId]
  );

  const columns = useMemo(
    () => [
      {
        title: "Ad Soyad",
        dataIndex: "nameSurname",
        key: "nameSurname",
        render: (v, r) => (
          <Space>
            <span style={{ fontWeight: 600 }}>{v}</span>
            {!r.isActive && <Tag color="default">Pasif</Tag>}
          </Space>
        ),
      },
      { title: "Telefon", dataIndex: "phone", key: "phone" },
      { title: "E-posta", dataIndex: "email", key: "email" },
      {
        title: "Roller",
        key: "roles",
        render: (_, r) => (
          <Space wrap>
            {r.isObserver && <Tag color="blue">Gözlemci</Tag>}
            {r.isCoordinator && <Tag color="green">Koordinatör</Tag>}
          </Space>
        ),
      },
      {
        title: "Günler",
        dataIndex: "practiceDays",
        key: "practiceDays",
        render: (arr) => (
          <Space wrap>
            {(arr || []).map((d) => (
              <Tag key={d}>{DAY_LABEL_TR[d] || d}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: "Hastaneler",
        key: "hospitals",
        render: (_, r) => (
          <div style={{ maxWidth: 320 }}>
            {(r.hospitals || [])
              .map((x) => x.hospital?.name)
              .filter(Boolean)
              .join(", ")}
          </div>
        ),
      },
      {
        title: "İlk giriş uyarısı",
        dataIndex: "messageFlag",
        key: "messageFlag",
        render: (v) => (v === "A" ? <Tag color="orange">A (Göster)</Tag> : <Tag>P (Gösterme)</Tag>),
      },
      {
        title: "İşlemler",
        key: "actions",
        render: (_, r) => (
          <Space>
            {/* ✅ Yeni: dinamik şablon görüntüle */}            
            <Button size="small" onClick={() => openEdit(r)}>
              Düzenle
            </Button>
            <Button size="small" onClick={() => resetPin(r.id)}>
              PIN Sıfırla
            </Button>
            <Button size="small" danger onClick={() => remove(r.id)}>
              Sil
            </Button>
          </Space>
        ),
      },
    ],
    [openEdit, openEval, periodId]
  );

  return (
    <div style={{ padding: 16 }}>
      {/* Dönem Seçimi */}
      <div style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 420 }}
          value={periodId}
          placeholder="Dönem seç"
          options={periodOptions}
          onChange={(v) => setPeriodId?.(v)}
        />
      </div>

      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Gözlemciler (Gözetmenler)</div>
          <div style={{ opacity: 0.7 }}>PIN varsayılan: telefonun son 4 hanesi</div>
        </div>
        <Button type="primary" onClick={openCreate} disabled={!periodId}>
          Yeni Gözlemci
        </Button>
      </Space>

      <div style={{ marginTop: 12 }}>
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 10 }} />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editing ? "Gözlemci Düzenle" : "Yeni Gözlemci"}
        open={open}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="nameSurname" label="Ad Soyad" rules={[{ required: true, message: "Ad Soyad zorunlu" }]}>
            <Input placeholder="Örn: Öğr. Gör. Ali Veli" />
          </Form.Item>

          <Form.Item name="phone" label="Telefon" rules={[{ required: true, message: "Telefon zorunlu" }]}>
            <Input placeholder="05xx..." />
          </Form.Item>

          <Form.Item name="email" label="E-posta">
            <Input placeholder="opsiyonel" />
          </Form.Item>

          <Form.Item name="photoUrl" label="Fotoğraf URL">
            <Input placeholder="opsiyonel" />
          </Form.Item>

          <Form.Item name="practiceDays" label="Uygulama Günleri">
            <Select mode="multiple" options={dayOptions} placeholder="Gün seç" />
          </Form.Item>

          <Form.Item name="hospitalIds" label="Hastaneler">
            <Select mode="multiple" options={hospitalOptions} placeholder="Hastane seç" />
          </Form.Item>

          {/* ✅ Roller sade: Gözlemci + Koordinatör */}
          <Form.Item label="Roller">
            <Space wrap>
              <Form.Item name="isObserver" valuePropName="checked" noStyle>
                <Checkbox>Gözlemci</Checkbox>
              </Form.Item>
              <Form.Item name="isCoordinator" valuePropName="checked" noStyle>
                <Checkbox>Koordinatör</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item name="isActive" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>

          {editing && (
            <>
              <Form.Item name="messageFlag" label="İlk giriş uyarısı (A/P)">
                <Select
                  options={[
                    { value: "A", label: "A (Uyarı göster)" },
                    { value: "P", label: "P (Uyarı gösterme)" },
                  ]}
                />
              </Form.Item>

              <Form.Item name="resetPin" valuePropName="checked">
                <Checkbox>PIN’i telefona göre sıfırla (son 4) + uyarıyı tekrar aç</Checkbox>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* ✅ Eval Snapshot Modal */}
      <Modal
        title={evalTeacher ? `Değerlendirme Şablonu · ${evalTeacher.nameSurname}` : "Değerlendirme Şablonu"}
        open={evalOpen}
        onCancel={closeEval}
        footer={[
          <Button key="close" onClick={closeEval}>
            Kapat
          </Button>,
        ]}
        width={760}
        destroyOnHidden
      >
        {evalLoading ? (
          <div style={{ padding: 12 }}>Şablon yükleniyor…</div>
        ) : !evalSnap ? (
          <div style={{ padding: 12, opacity: 0.75 }}>
            Şablon bulunamadı / yüklenemedi. (PeriodEvalSnapshot dönmüyor olabilir.)
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Snapshot: <b>{evalSnap.id}</b> · Period: <b>{evalSnap.periodId}</b>
            </div>

            {(evalSnap.groups || []).map((g) => (
              <div key={g.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>{g.title || g.name || `Grup ${g.orderNo}`}</div>
                  <Tag>{g.weight != null ? `Ağırlık: ${g.weight}` : `Sıra: ${g.orderNo}`}</Tag>
                </div>

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {(g.items || []).map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{it.title || it.label || `Madde ${it.orderNo}`}</div>
                        {it.description && <div style={{ opacity: 0.75, fontSize: 12 }}>{it.description}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {it.weight != null && <Tag>Ağırlık: {it.weight}</Tag>}
                        {it.maxScore != null && <Tag>Max: {it.maxScore}</Tag>}
                      </div>
                    </div>
                  ))}
                  {!g.items?.length && <div style={{ opacity: 0.7 }}>Bu grupta madde yok.</div>}
                </div>
              </div>
            ))}

            {!evalSnap.groups?.length && <div style={{ opacity: 0.7 }}>Snapshot içinde grup yok.</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
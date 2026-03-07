// D:\staj-sistem-v2\client\src\pages\Periods.jsx
import { useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Space,
  message,
  InputNumber,
  Checkbox,
  Divider,
  Row,
  Col,
  Alert,
} from "antd";
import api from "../api";

const termOptions = [
  { value: "GUZ", label: "Güz" },
  { value: "BAHAR", label: "Bahar" },
  { value: "YAZ", label: "Yaz" },
];

const dayOptions = [
  { value: "MON", label: "Pazartesi" },
  { value: "TUE", label: "Salı" },
  { value: "WED", label: "Çarşamba" },
  { value: "THU", label: "Perşembe" },
  { value: "FRI", label: "Cuma" },
  { value: "SAT", label: "Cumartesi" },
  { value: "SUN", label: "Pazar" },
];

function toNum(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function inRange(x, s, e) {
  if (x == null || s == null || e == null) return false;
  return x >= s && x <= e;
}

export default function Periods() {
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  async function load() {
    const [p, c] = await Promise.all([api.get("/periods"), api.get("/courses")]);
    setRows(p.data || []);
    setCourses(c.data || []);
  }

  useEffect(() => {
    load();
  }, []);

  function rowToFormValues(r) {
    return {
      ...r,
      courseId: r.courseId,
      currentWeekNo: r.currentWeekNo ?? 1,

      // DB -> UI mapping
      reportWeight: r.reportWeight ?? 0.5,
      evaluationWeight: r.evalWeight ?? 0.5,
      practicePenaltyPerWeek: r.practicePenaltyCoef ?? 5,
      theoryPenaltyPerWeek: r.theoryPenaltyCoef ?? 2.5,
      rotation1Weight: r.rot1Weight ?? 0.4,
      rotation2Weight: r.rot2Weight ?? 0.6,

      lotteryRules: r.lotteryRules || {},
    };
  }

  function formToPayload(values) {
    const rc = Number(values.rotationCount ?? 1);

    const lotteryRules =
      rc === 1
        ? {
            ...(values.lotteryRules || {}),
            rot2PreferDifferentDay: false,
            rot2PreferDifferentHospital: false,
            fallbackPreferHospitalDifferent: false,
          }
        : (values.lotteryRules || {});

    return {
      academicYear: values.academicYear,
      term: values.term,
      courseId: values.courseId,

      practiceDays: values.practiceDays || [],
      rotationCount: Number(values.rotationCount ?? 1),
      isActive: !!values.isActive,

      rot1StartWeek: toNum(values.rot1StartWeek, null),
      rot1EndWeek: toNum(values.rot1EndWeek, null),
      rot2StartWeek: rc === 2 ? toNum(values.rot2StartWeek, null) : null,
      rot2EndWeek: rc === 2 ? toNum(values.rot2EndWeek, null) : null,

      midtermWeek: toNum(values.midtermWeek, null),
      finalWeek1: toNum(values.finalWeek1, null),
      finalWeek2: toNum(values.finalWeek2, null),
      currentWeekNo: toNum(values.currentWeekNo, 1),

      lotteryRules,

      // UI -> DB mapping
      reportWeight: Number(values.reportWeight ?? 0.5),
      evalWeight: Number(values.evaluationWeight ?? 0.5),
      practicePenaltyCoef: Number(values.practicePenaltyPerWeek ?? 5),
      theoryPenaltyCoef: Number(values.theoryPenaltyPerWeek ?? 2.5),
      rot1Weight: Number(values.rotation1Weight ?? 0.4),
      rot2Weight: Number(values.rotation2Weight ?? 0.6),
    };
  }

  const columns = [
    { title: "Akademik Yıl", dataIndex: "academicYear" },
    { title: "Dönem", dataIndex: "term" },
    { title: "Ders", render: (_, r) => r.course?.name },
    { title: "Aktif", dataIndex: "isActive", render: (v) => (v ? "Evet" : "Hayır") },
    {
      title: "Aktif Hafta",
      dataIndex: "currentWeekNo",
      render: (v) => v ?? 1,
    },
    {
      title: "İşlem",
      render: (_, r) => (
        <Space>
          <Button
            onClick={() => {
              setEditing(r);
              form.setFieldsValue(rowToFormValues(r));
              setOpen(true);
            }}
          >
            Düzenle
          </Button>

          <Button
            danger
            onClick={async () => {
              try {
                await api.delete(`/periods/${r.id}`);
                message.success("Silindi");
                load();
              } catch (e) {
                message.error(e?.response?.data?.error || "Silinemedi");
              }
            }}
          >
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();

            form.setFieldsValue({
              isActive: false,

              currentWeekNo: 1,

              // UI alan isimleri
              reportWeight: 0.5,
              evaluationWeight: 0.5,
              practicePenaltyPerWeek: 5,
              theoryPenaltyPerWeek: 2.5,
              rotation1Weight: 0.4,
              rotation2Weight: 0.6,

              practiceDays: ["WED", "FRI"],
              rotationCount: 2,

              rot1StartWeek: 3,
              rot1EndWeek: 9,
              rot2StartWeek: 10,
              rot2EndWeek: 17,

              midtermWeek: 8,
              finalWeek1: 16,
              finalWeek2: 17,

              lotteryRules: {
                rot2PreferDifferentDay: false,
                rot2PreferDifferentHospital: false,
                fallbackPreferHospitalDifferent: false,
              },
            });

            setOpen(true);
          }}
        >
          Yeni Dönem
        </Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={rows} />

      <Modal
        title={editing ? "Dönem Düzenle" : "Yeni Dönem"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const payload = formToPayload(values);

            if (editing) {
              await api.put(`/periods/${editing.id}`, payload);
              message.success("Güncellendi");
            } else {
              await api.post("/periods", payload);
              message.success("Eklendi");
            }

            setOpen(false);
            load();
          } catch (e) {
            message.error(e?.response?.data?.error || e?.message || "Kaydedilemedi");
          }
        }}
        width={860}
        okText="OK"
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: "100%" }} wrap align="start">
            <Form.Item name="academicYear" label="Akademik Yıl" rules={[{ required: true }]}>
              <Input placeholder="2025-2026" style={{ width: 220 }} />
            </Form.Item>

            <Form.Item name="term" label="Dönem" rules={[{ required: true }]}>
              <Select options={termOptions} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item name="courseId" label="Ders" rules={[{ required: true }]}>
              <Select
                style={{ width: 320 }}
                options={courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
              />
            </Form.Item>

            <Form.Item
              name="practiceDays"
              label="Uygulama Günleri (Dönem Bazlı)"
              rules={[{ required: true, message: "En az 1 gün seç" }]}
              style={{ minWidth: 360 }}
            >
              <Select
                mode="multiple"
                options={dayOptions}
                placeholder="Örn: Çarşamba, Cuma"
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item name="rotationCount" label="Rotasyon Sayısı" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 1, label: "1 Rotasyon" },
                  { value: 2, label: "2 Rotasyon" },
                ]}
                style={{ width: 200 }}
              />
            </Form.Item>

            <Form.Item name="isActive" label="Aktif" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Divider style={{ margin: "10px 0" }} />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Rotasyon Haftaları</div>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const rc = Number(getFieldValue("rotationCount") ?? 1);

              const r1s = toNum(getFieldValue("rot1StartWeek"));
              const r1e = toNum(getFieldValue("rot1EndWeek"));
              const r2s = toNum(getFieldValue("rot2StartWeek"));
              const r2e = toNum(getFieldValue("rot2EndWeek"));

              const mid = toNum(getFieldValue("midtermWeek"));
              const f1 = toNum(getFieldValue("finalWeek1"));
              const f2 = toNum(getFieldValue("finalWeek2"));

              const clash =
                inRange(mid, r1s, r1e) ||
                inRange(f1, r1s, r1e) ||
                inRange(f2, r1s, r1e) ||
                (rc === 2 &&
                  (inRange(mid, r2s, r2e) ||
                    inRange(f1, r2s, r2e) ||
                    inRange(f2, r2s, r2e)));

              return (
                <>
                  <Row gutter={12}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        name="rot1StartWeek"
                        label="Rotasyon 1 Başlangıç"
                        rules={[{ required: true, message: "Zorunlu" }]}
                      >
                        <InputNumber min={1} max={30} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        name="rot1EndWeek"
                        label="Rotasyon 1 Bitiş"
                        rules={[{ required: true, message: "Zorunlu" }]}
                      >
                        <InputNumber min={1} max={30} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        name="rot2StartWeek"
                        label="Rotasyon 2 Başlangıç"
                        rules={rc === 2 ? [{ required: true, message: "Zorunlu" }] : []}
                      >
                        <InputNumber
                          min={1}
                          max={30}
                          style={{ width: "100%" }}
                          disabled={rc !== 2}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        name="rot2EndWeek"
                        label="Rotasyon 2 Bitiş"
                        rules={rc === 2 ? [{ required: true, message: "Zorunlu" }] : []}
                      >
                        <InputNumber
                          min={1}
                          max={30}
                          style={{ width: "100%" }}
                          disabled={rc !== 2}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: -6 }}>
                    Senaryo: 1 rotasyon → <b>3–17</b> | 2 rotasyon → <b>3–9</b> ve <b>10–17</b>
                  </div>

                  {clash && (
                    <Alert
                      style={{ marginTop: 10 }}
                      type="warning"
                      showIcon
                      title="Not: Rotasyon başlangıç/bitiş haftaları sınav haftalarıyla çakışıyor. Bu normal olabilir."
                      description="Sistem sınav haftalarında rotasyonu otomatik “yok” sayar (sınav haftası rotasyonu ezer)."
                    />
                  )}
                </>
              );
            }}
          </Form.Item>

          <Divider style={{ margin: "10px 0" }} />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Sınav ve Aktif Hafta</div>
          <Row gutter={12}>
            <Col xs={24} md={6}>
              <Form.Item name="midtermWeek" label="Vize Haftası" rules={[{ required: true }]}>
                <InputNumber min={1} max={30} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="finalWeek1" label="Final Haftası" rules={[{ required: true }]}>
                <InputNumber min={1} max={30} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="finalWeek2" label="Final (2) Haftası" rules={[{ required: true }]}>
                <InputNumber min={1} max={30} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="Aktif Hafta"
                name="currentWeekNo"
                rules={[{ required: true, message: "Aktif hafta zorunlu" }]}
              >
                <InputNumber min={1} max={17} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "10px 0" }} />

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue, setFieldsValue }) => {
              const rc = Number(getFieldValue("rotationCount") ?? 1);
              const disabled = rc === 1;

              if (disabled) {
                const lr = getFieldValue("lotteryRules") || {};
                if (
                  lr.rot2PreferDifferentDay ||
                  lr.rot2PreferDifferentHospital ||
                  lr.fallbackPreferHospitalDifferent
                ) {
                  setFieldsValue({
                    lotteryRules: {
                      ...lr,
                      rot2PreferDifferentDay: false,
                      rot2PreferDifferentHospital: false,
                      fallbackPreferHospitalDifferent: false,
                    },
                  });
                }
              }

              return (
                <Form.Item label="Kura Kuralları (Seçilirse uygulanır)">
                  <Form.Item
                    name={["lotteryRules", "rot2PreferDifferentDay"]}
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox disabled={disabled}>
                      Rotasyon 2: Gün mümkünse farklı olsun
                    </Checkbox>
                  </Form.Item>
                  <br />
                  <Form.Item
                    name={["lotteryRules", "rot2PreferDifferentHospital"]}
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox disabled={disabled}>
                      Rotasyon 2: Hastane mümkünse farklı olsun
                    </Checkbox>
                  </Form.Item>
                  <br />
                  <Form.Item
                    name={["lotteryRules", "fallbackPreferHospitalDifferent"]}
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox disabled={disabled}>
                      İkisi birlikte seçilirse öncelik: <b>önce ikisi de farklı</b>; çıkmazda{" "}
                      <b>hastane farklı</b>, gün aynı kalabilir
                    </Checkbox>
                  </Form.Item>

                  {disabled && (
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                      Not: Rotasyon 2 olmadığında bu kurallar uygulanmaz.
                    </div>
                  )}
                </Form.Item>
              );
            }}
          </Form.Item>

          <Divider style={{ margin: "10px 0" }} />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Puanlama Ayarları</div>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Rapor Ağırlığı"
                name="reportWeight"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
              >
                <InputNumber min={0} max={100} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Değerlendirme Ağırlığı"
                name="evaluationWeight"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
              >
                <InputNumber min={0} max={100} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Uyg. Ceza (hafta)"
                name="practicePenaltyPerWeek"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
              >
                <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Teori Ceza (hafta)"
                name="theoryPenaltyPerWeek"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
              >
                <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Rot1 Ağırlık"
                name="rotation1Weight"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
              >
                <InputNumber min={0} max={100} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Rot2 Ağırlık"
                name="rotation2Weight"
                labelCol={{ span: 10 }}
                wrapperCol={{ span: 14 }}
              >
                <InputNumber min={0} max={100} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
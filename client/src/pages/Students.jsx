import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Divider,
  Select,
  Table,
  Upload,
  message,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Popconfirm,
  Image,
  Switch,
  Row,
  Col
} from "antd";
import { UploadOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import api from "../api";

function normalizePhotoUrl(studentNo, photoUrl) {
  const raw = String(photoUrl || "").trim();
  if (raw) return raw;
  return studentNo ? `/ogr/${studentNo}.png` : "";
}

export default function Students() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pinResettingId, setPinResettingId] = useState(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form] = Form.useForm();

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    const list = data || [];
    setPeriods(list);

    if (!periodId && list.length) {
      const active = list.find((p) => p.isActive);
      setPeriodId(active?.id || list[0].id);
    }
  }

  async function loadStudents(pid) {
    if (!pid) return;
    const { data } = await api.get(`/students?periodId=${pid}`);
    setRows(data || []);
  }

  useEffect(() => {
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStudents(periodId);
  }, [periodId]);

  const periodOptions = useMemo(
    () =>
      periods.map((p) => ({
        value: p.id,
        label: `${p.academicYear} ${p.term} — ${p.course?.code ?? ""} ${p.course?.name ?? ""}${
          p.isActive ? " (AKTİF)" : ""
        }`,
      })),
    [periods]
  );

  async function handleFile(file) {
    try {
      setLoading(true);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const payloadRows = json.map((r) => {
        const studentNo = r.student_no ?? r.StudentNo ?? r.studentNo ?? r["student_no"];
        const photoUrlRaw = r.photo_url ?? r.PhotoUrl ?? r.photoUrl ?? r["photo_url"];

        return {
          student_no: studentNo,
          name_surname: r.name_surname ?? r.NameSurname ?? r.nameSurname ?? r["name_surname"],
          sex: r.sex ?? r.Sex ?? r["sex"],
          photo_url: normalizePhotoUrl(studentNo, photoUrlRaw),
        };
      });

      if (!periodId) {
        message.error("Önce dönem seçmelisin.");
        return false;
      }

      const { data } = await api.post("/students/import", {
        periodId,
        rows: payloadRows,
      });

      message.success(
        `Import tamam ✅ Insert: ${data.inserted}, Update: ${data.updated}, Skipped: ${data.skipped}`
      );
      await loadStudents(periodId);
      return false;
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.error || "Import başarısız. Excel kolonlarını kontrol et.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    if (!periodId) {
      message.warning("Önce dönem seçmelisin.");
      return;
    }

    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      periodId,
      sex: "F",
      shareContact: false,
      phone: "",
      email: "",
      photoUrl: "",
    });
    setOpen(true);
  }

  function openEditModal(row) {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue({
      periodId: row.periodId || periodId,
      studentNo: row.studentNo,
      nameSurname: row.nameSurname,
      sex: row.sex,
      phone: row.phone || "",
      email: row.email || "",
      shareContact: !!row.shareContact,
      photoUrl: row.photoUrl || "",
    });
    setOpen(true);
  }

  async function handleSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const finalPeriodId = values.periodId || periodId;
      const finalStudentNo = String(values.studentNo || "").trim();

      const payload = {
        periodId: finalPeriodId,
        studentNo: finalStudentNo,
        nameSurname: String(values.nameSurname || "").trim(),
        sex: String(values.sex || "").trim(),
        phone: String(values.phone || "").trim() || null,
        email: String(values.email || "").trim() || null,
        shareContact: !!values.shareContact,
        photoUrl: normalizePhotoUrl(finalStudentNo, values.photoUrl),
        // istek: PIN default öğrenci no olsun
        pin: finalStudentNo,
      };

      if (editing) {
        await api.put(`/students/${editing.id}`, payload);
        message.success("Öğrenci güncellendi");
      } else {
        await api.post("/students", payload);
        message.success("Öğrenci eklendi");
      }

      setOpen(false);
      await loadStudents(finalPeriodId);
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.error || e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    try {
      await api.delete(`/students/${row.id}`);
      message.success("Öğrenci silindi");
      await loadStudents(periodId);
    } catch (e) {
      console.error(e);
      message.error(e?.response?.data?.error || "Silinemedi");
    }
  }

  const columns = [
    {
      title: "Foto",
      dataIndex: "photoUrl",
      width: 90,
      render: (v, r) =>
        v ? (
          <Image
            src={v}
            alt={r.studentNo}
            width={42}
            height={42}
            style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
            fallback="https://placehold.co/40x40"
            preview={false}
          />
        ) : (
          "-"
        ),
    },
    { title: "No", dataIndex: "studentNo", width: 140 },
    { title: "Ad Soyad", dataIndex: "nameSurname" },
    { title: "Cinsiyet", dataIndex: "sex", width: 100 },
    { title: "Telefon", dataIndex: "phone", width: 140, render: (v) => v || "-" },
    { title: "E-posta", dataIndex: "email", width: 220, render: (v) => v || "-" },
    {
      title: "Paylaşım",
      dataIndex: "shareContact",
      width: 100,
      render: (v) => (v ? "Evet" : "Hayır"),
    },
    {
      title: "Foto Linki",
      dataIndex: "photoUrl",
      width: 240,
      render: (v) => v || "-",
    },
    {
      title: "Aksiyon",
      key: "actions",
      width: 320,
      render: (_, r) => (
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(r)}>
            Düzenle
          </Button>

          <Button
            onClick={async () => {
              try {
                setPinResettingId(r.id);
                await api.put(`/students/${r.id}/reset-pin`);
                message.success("PIN öğrenci no olarak sıfırlandı. Öğrenci ilk girişte değiştirmek zorunda.");
              } catch (e) {
                console.error(e);
                message.error(e?.response?.data?.error || "PIN reset başarısız.");
              } finally {
                setPinResettingId(null);
              }
            }}
            loading={pinResettingId === r.id}
          >
            PIN Reset
          </Button>

          <Popconfirm
            title="Öğrenci silinsin mi?"
            description={`${r.nameSurname} kaydı silinecek.`}
            okText="Sil"
            cancelText="Vazgeç"
            onConfirm={() => handleDelete(r)}
          >
            <Button danger icon={<DeleteOutlined />}>
              Sil
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Öğrenci Import / Öğrenci Listesi
      </Typography.Title>

      <Card>
        <Space wrap align="start">
          <div style={{ minWidth: 360 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Dönem Seç</div>
            <Select
              style={{ width: "100%" }}
              options={periodOptions}
              value={periodId}
              onChange={setPeriodId}
              placeholder="Dönem seçiniz"
            />
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Excel Yükle</div>
            <Upload beforeUpload={handleFile} showUploadList={false} accept=".xlsx,.xls">
              <Button icon={<UploadOutlined />} loading={loading} disabled={!periodId}>
                Excel Seç
              </Button>
            </Upload>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
              Beklenen kolonlar: <b>student_no</b>, <b>name_surname</b>, <b>sex</b>, <b>photo_url</b>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Manuel Kayıt</div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={!periodId}>
              Yeni Öğrenci
            </Button>
          </div>
        </Space>
      </Card>

      <Divider />

      <Table rowKey="id" columns={columns} dataSource={rows} scroll={{ x: 1300 }} />

      <Modal
        title={editing ? "Öğrenci Düzenle" : "Yeni Öğrenci"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={760}
        okText="Kaydet"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="periodId" label="Dönem" rules={[{ required: true, message: "Dönem seçiniz" }]}>
                <Select options={periodOptions} placeholder="Dönem seçiniz" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="studentNo"
                label="Öğrenci No"
                rules={[{ required: true, message: "Öğrenci no zorunlu" }]}
              >
                <Input
                  placeholder="2405405013"
                  onChange={(e) => {
                    const no = String(e.target.value || "").trim();
                    const currentPhoto = form.getFieldValue("photoUrl");
                    if (!currentPhoto) {
                      form.setFieldValue("photoUrl", no ? `/ogr/${no}.png` : "");
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="nameSurname"
                label="Ad Soyad"
                rules={[{ required: true, message: "Ad soyad zorunlu" }]}
              >
                <Input placeholder="Ad Soyad" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="sex"
                label="Cinsiyet"
                rules={[{ required: true, message: "Cinsiyet zorunlu" }]}
              >
                <Select
                  options={[
                    { value: "F", label: "Kadın" },
                    { value: "M", label: "Erkek" },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Telefon">
                <Input placeholder="05..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="email" label="E-posta">
                <Input placeholder="ogrenci@..." />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="photoUrl" label="Foto Linki">
                <Input placeholder="/ogr/2405405013.png" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="shareContact" label="İletişim Paylaşımı" valuePropName="checked">
                <Switch checkedChildren="Evet" unCheckedChildren="Hayır" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Varsayılan PIN">
                <Input value={form.getFieldValue("studentNo") || ""} disabled />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Select, Table, Upload, message, Space, Typography } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import api from "../api";

export default function Students() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pinResettingId, setPinResettingId] = useState(null);

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    setPeriods(data);
    const active = data.find((p) => p.isActive);
    if (active) setPeriodId(active.id);
  }

  async function loadStudents(pid) {
    if (!pid) return;
    const { data } = await api.get(`/students?periodId=${pid}`);
    setRows(data);
  }

  useEffect(() => {
    loadPeriods();
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

      const payloadRows = json.map((r) => ({
        student_no: r.student_no ?? r.StudentNo ?? r.studentNo ?? r["student_no"],
        name_surname: r.name_surname ?? r.NameSurname ?? r.nameSurname ?? r["name_surname"],
        sex: r.sex ?? r.Sex ?? r["sex"],
        photo_url: r.photo_url ?? r.PhotoUrl ?? r.photoUrl ?? r["photo_url"],
      }));

      if (!periodId) {
        message.error("Önce dönem seçmelisin.");
        return false;
      }

      const { data } = await api.post("/students/import", {
        periodId,
        rows: payloadRows,
      });

      message.success(`Import tamam ✅ Insert: ${data.inserted}, Update: ${data.updated}, Skipped: ${data.skipped}`);
      await loadStudents(periodId);
      return false;
    } catch (e) {
      console.error(e);
      message.error("Import başarısız. Excel kolonlarını kontrol et.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { title: "No", dataIndex: "studentNo" },
    { title: "Ad Soyad", dataIndex: "nameSurname" },
    { title: "Cinsiyet", dataIndex: "sex" },
    { title: "Foto", dataIndex: "photoUrl", render: (v) => (v ? "Var" : "-") },
    {
      title: "Aksiyon",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Button
            onClick={async () => {
              try {
                setPinResettingId(r.id);
                await api.put(`/students/${r.id}/reset-pin`);
                message.success("PIN öğrenci no olarak sıfırlandı. Öğrenci ilk girişte değiştirmek zorunda.");
              } catch (e) {
                console.error(e);
                message.error("PIN reset başarısız.");
              } finally {
                setPinResettingId(null);
              }
            }}
            loading={pinResettingId === r.id}
          >
            PIN Reset
          </Button>
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
        <Space wrap>
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
        </Space>
      </Card>

      <Divider />

      <Table rowKey="id" columns={columns} dataSource={rows} />
    </div>
  );
}
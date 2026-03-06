// client/src/pages/Assignments.jsx
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Form, Modal, Select, Space, Table, Typography, message, Popconfirm } from "antd";
import api from "../api";

const dayOptionsAll = [
  { value: "MON", label: "Pazartesi" },
  { value: "TUE", label: "Salı" },
  { value: "WED", label: "Çarşamba" },
  { value: "THU", label: "Perşembe" },
  { value: "FRI", label: "Cuma" },
  { value: "SAT", label: "Cumartesi" },
  { value: "SUN", label: "Pazar" },
];

const dayLabelShort = (v) => {
  const key = String(v ?? "").toUpperCase();
  const map = {
    MON: "PZT",
    TUE: "SAL",
    WED: "ÇRŞ",
    THU: "PRŞ",
    FRI: "CUMA",
    SAT: "CMT",
    SUN: "PAZ",
  };
  return map[key] ?? v ?? "";
};

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const dayOrderIndex = (d) => {
  const k = String(d ?? "").toUpperCase();
  const i = DAY_ORDER.indexOf(k);
  return i === -1 ? 999 : i;
};

export default function Assignments() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);
  const [students, setStudents] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [units, setUnits] = useState([]);
  const [rows, setRows] = useState([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const period = useMemo(() => periods.find((p) => p.id === periodId) ?? null, [periods, periodId]);

  const practiceDayOptions = useMemo(() => {
    const allowed = period?.practiceDays;
    if (Array.isArray(allowed) && allowed.length) {
      return dayOptionsAll.filter((d) => allowed.includes(d.value));
    }
    return dayOptionsAll;
  }, [period]);

  const rotationOptions = useMemo(() => {
    const rc = period?.rotationCount ?? 1;
    const arr = [];
    for (let i = 1; i <= rc; i++) arr.push({ value: i, label: `Rotasyon ${i}` });
    return arr;
  }, [period]);

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    setPeriods(data);
    const active = data.find((p) => p.isActive);
    if (active) setPeriodId(active.id);
  }

  async function loadHospitals() {
    const { data } = await api.get("/hospitals");
    setHospitals(data);
  }

  async function loadStudents(pid) {
    if (!pid) return;
    const { data } = await api.get(`/students?periodId=${pid}`);
    setStudents(data);
  }

  const loadAssignments = async (pid = periodId) => {
    if (!pid) return;
    const { data } = await api.get(`/assignments?periodId=${pid}`);
    setRows(data || []);
  };

  async function loadUnitsForHospital(hospitalId) {
    if (!hospitalId) return setUnits([]);
    const { data } = await api.get(`/units?hospitalId=${hospitalId}`);
    setUnits(data);
  }

  useEffect(() => {
    loadPeriods();
    loadHospitals();
  }, []);

  useEffect(() => {
    if (periodId) {
      loadStudents(periodId);
      loadAssignments(periodId);
    }
  }, [periodId]);

  const periodOptions = useMemo(
    () => periods.map((p) => ({ value: p.id, label: `${p.academicYear} ${p.term}${p.isActive ? " (AKTİF)" : ""}` })),
    [periods]
  );

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: `${s.studentNo} — ${s.nameSurname}` })),
    [students]
  );

  const hospitalOptions = useMemo(
    () => hospitals.map((h) => ({ value: h.id, label: `${h.priorityOrder}. ${h.name}` })),
    [hospitals]
  );

  function genderLabel(v) {
    if (!v) return "";
    const s = String(v).trim().toUpperCase();
    if (s === "E" || s === "M") return "— Erkek";
    if (s === "K" || s === "F") return "— Kadın";
    return "";
  }

  const unitOptions = useMemo(
    () =>
      units.map((u) => ({
        value: u.id,
        label: `${u.priorityOrder}. ${u.name} (kota:${u.dailyQuota ?? 0})${genderLabel(u.genderRule)}`,
      })),
    [units]
  );

  // ✅ ÖZET: Rotasyon -> Gün -> Hastane -> count
  const summaryByRotation = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return null;

    const rotMap = new Map(); // rot -> day -> hosp -> count

    for (const r of list) {
      const rot = Number(r.rotationNo ?? 0) || 0;
      const day = String(r.dayOfWeek ?? "").toUpperCase();
      const hosp = (r.hospital?.name || "—").trim();

      if (!rotMap.has(rot)) rotMap.set(rot, new Map());
      const dayMap = rotMap.get(rot);

      if (!dayMap.has(day)) dayMap.set(day, new Map());
      const hospMap = dayMap.get(day);

      hospMap.set(hosp, (hospMap.get(hosp) || 0) + 1);
    }

    const rots = Array.from(rotMap.entries())
      .map(([rot, dayMap]) => {
        const days = Array.from(dayMap.entries())
          .map(([day, hospMap]) => {
            const lines = Array.from(hospMap.entries())
              .map(([hospitalName, count]) => ({
                key: `${rot}__${day}__${hospitalName}`,
                label: `${dayLabelShort(day)} - ${hospitalName} : ${count}`,
                hospitalName,
                count,
              }))
              .sort((a, b) => a.hospitalName.localeCompare(b.hospitalName, "tr"));
            return { day, lines };
          })
          .sort((a, b) => dayOrderIndex(a.day) - dayOrderIndex(b.day));

        return { rot, lines: days.flatMap((d) => d.lines) };
      })
      .sort((a, b) => a.rot - b.rot);

    return rots;
  }, [rows]);

  const columns = [
    { title: "Rot", dataIndex: "rotationNo", width: 70 },
    { title: "Gün", dataIndex: "dayOfWeek", width: 100, render: (v) => dayLabelShort(v) },
    { title: "Öğrenci No", render: (_, r) => r.student?.studentNo },
    { title: "Ad Soyad", render: (_, r) => r.student?.nameSurname },
    { title: "Hastane", render: (_, r) => r.hospital?.name },
    { title: "Birim", render: (_, r) => r.unit?.name },
    {
      title: "İşlem",
      width: 200,
      render: (_, r) => (
        <Space>
          <Button
            onClick={() => {
              setEditing(r);
              form.setFieldsValue({
                studentId: r.studentId,
                rotationNo: r.rotationNo,
                dayOfWeek: r.dayOfWeek,
                hospitalId: r.hospitalId,
                unitId: r.unitId,
              });
              loadUnitsForHospital(r.hospitalId);
              setOpen(true);
            }}
          >
            Düzenle
          </Button>
          <Button
            danger
            onClick={async () => {
              await api.delete(`/assignments/${r.id}`);
              message.success("Silindi");
              loadAssignments(periodId);
            }}
          >
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  const activePeriodLabel = useMemo(() => {
    const p = periods.find((x) => x.id === periodId);
    if (!p) return "—";
    return `${p.academicYear} · ${p.term}${p.isActive ? " · AKTİF" : ""}`;
  }, [periods, periodId]);

  const totalAssignments = rows?.length || 0;

  return (
    <div>
      {/* ✅ ÜST BAR / HEADER */}
      <Card style={{ marginBottom: 12 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <Typography.Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
              Atamalar
            </Typography.Title>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              {activePeriodLabel} · Toplam kayıt: {totalAssignments}
            </div>
          </div>

          <Space wrap>
            <div style={{ minWidth: 340 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Dönem</div>
              <Select
                style={{ width: "100%" }}
                placeholder="Dönem seç"
                value={periodId}
                options={periodOptions}
                onChange={(v) => {
                  setPeriodId(v);
                  loadAssignments(v);
                }}
              />
            </div>

            <Button
              type="primary"
              disabled={!periodId}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                form.setFieldsValue({ rotationNo: 1 });
                setUnits([]);
                setOpen(true);
              }}
            >
              Yeni Atama
            </Button>

            <Popconfirm
              title="Seçili dönemin TÜM atamalarını silmek istiyor musunuz?"
              description="Bu işlem geri alınamaz."
              okText="Evet, sil"
              cancelText="Vazgeç"
              onConfirm={async () => {
                if (!periodId) return message.error("Önce dönem seç");
                await api.delete(`/assignments/clear?periodId=${periodId}`);
                setRows([]);
                message.success("Tüm atamalar silindi");
                await loadAssignments(periodId);
              }}
            >
              <Button danger disabled={!periodId}>
                Tümünü Sil
              </Button>
            </Popconfirm>
          </Space>
        </div>

        <Divider style={{ margin: "14px 0" }} />

        {/* ✅ ÖZET ALANI (daha yumuşak) */}
        <div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>Rotasyon bazlı Gün + Hastane öğrenci sayısı</div>

          {!rows?.length ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Atama yok</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(summaryByRotation || []).map((rotBlock) => (
                <div
                  key={`rot_${rotBlock.rot}`}
                  style={{
                    minWidth: 300,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.06)",
                    background: "rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <div style={{ fontWeight: 800 }}>Rotasyon {rotBlock.rot}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{rotBlock.lines.length} satır</div>
                  </div>

                  {!rotBlock.lines.length ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Atama yok</div>
                  ) : (
                    <div style={{ display: "grid", gap: 4 }}>
                      {rotBlock.lines.map((line) => (
                        <div key={line.key} style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
                          {line.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ✅ TABLO */}
      <Table rowKey="id" columns={columns} dataSource={rows} />

      {/* ✅ MODAL */}
      <Modal
        title={editing ? "Atama Düzenle" : "Yeni Atama"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            await api.post("/assignments", {
              periodId,
              ...values,
              method: "MANUAL",
            });
            message.success("Kaydedildi");
            setOpen(false);
            loadAssignments(periodId);
          } catch (e) {
            const msg = e?.response?.data?.error || "Kaydetme hatası";
            message.error(msg);
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="studentId" label="Öğrenci" rules={[{ required: true }]}>
            <Select showSearch options={studentOptions} placeholder="Öğrenci seç" />
          </Form.Item>

          <Space wrap style={{ width: "100%" }}>
            <Form.Item name="rotationNo" label="Rotasyon" rules={[{ required: true }]}>
              <Select style={{ width: 160 }} options={rotationOptions} />
            </Form.Item>

            <Form.Item name="dayOfWeek" label="Gün" rules={[{ required: true }]}>
              <Select style={{ width: 200 }} options={practiceDayOptions} />
            </Form.Item>
          </Space>

          <Form.Item name="hospitalId" label="Hastane" rules={[{ required: true }]}>
            <Select
              options={hospitalOptions}
              placeholder="Hastane seç"
              onChange={(hid) => {
                form.setFieldsValue({ unitId: undefined });
                loadUnitsForHospital(hid);
              }}
            />
          </Form.Item>

          <Form.Item name="unitId" label="Birim" rules={[{ required: true }]}>
            <Select options={unitOptions} placeholder="Birim seç" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, InputNumber, Select, Space, Table, Typography, message } from "antd";
import api from "../api";

export default function TeacherReportScoring() {
  const [me, setMe] = useState(null);

  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);
  const [weekNo, setWeekNo] = useState(1);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null); // OK | EXAM | NO_ROTATION | NO_SNAPSHOT
  const [rows, setRows] = useState([]);

  // satır bazlı draft score (InputNumber anlık yazılır, Kaydet'e basınca API)
  const [draft, setDraft] = useState({}); // studentId -> number
  const [saving, setSaving] = useState({}); // studentId -> boolean

  async function loadMe() {
    const { data } = await api.get("/teacher/me");
    setMe(data?.user ?? data);
  }

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    const list = data || [];
    setPeriods(list);
    if (!periodId && list.length) setPeriodId(list[0].id);
  }

  async function loadList() {
    if (!periodId || !weekNo) return;

    setLoading(true);
    try {
      const { data } = await api.get(`/teacher/report-scores?periodId=${periodId}&weekNo=${weekNo}`);

      setMode(data?.mode || null);
      const items = data?.items || [];
      setRows(items);

      // draft initial değerleri: totalScore varsa onu yaz, yoksa boş bırak
      const d = {};
      for (const r of items) {
        d[r.studentId] = r.totalScore ?? null;
      }
      setDraft(d);

      if (data?.mode === "EXAM") message.info("Sınav haftası: rapor puanlama kapalı.");
      if (data?.mode === "NO_ROTATION") message.info("Rotasyon haftası değil: rapor puanlama yok.");
      if (data?.mode === "NO_SNAPSHOT") message.warning("Bu dönem için rapor snapshot yok.");
    } catch (e) {
      message.error(e?.response?.data?.error || "Liste alınamadı");
      setRows([]);
      setDraft({});
      setMode(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadMe(), loadPeriods()]);
      } catch {
        message.error("Başlangıç verileri alınamadı");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, weekNo]);

  const canGrade = !!me?.isCoordinator;

  const periodOptions = useMemo(
    () => (periods || []).map((p) => ({ value: p.id, label: `${p.academicYear} · ${p.term}` })),
    [periods]
  );

  const totalWeeks = useMemo(() => {
    const p = periods.find((x) => x.id === periodId);
    return p?.totalWeeks || 17;
  }, [periods, periodId]);

  const weekOptions = useMemo(
    () =>
      Array.from({ length: totalWeeks }, (_, i) => ({
        value: i + 1,
        label: `Hafta ${i + 1}`,
      })),
    [totalWeeks]
  );

  async function saveRow(r) {
    const val = draft[r.studentId];

    // boş bırakıldıysa: kaydetme (istersen 0 yapıp kaydedebiliriz)
    if (val === null || val === undefined || val === "") {
      message.warning("Puan boş olamaz.");
      return;
    }

    // server zaten doğruluyor ama UI tarafında da mantıklı limit
    const maxPoints = Number.isFinite(Number(r.totalPoints)) ? Number(r.totalPoints) : 100;
    const scoreVal = Number(val);

    if (!Number.isFinite(scoreVal)) {
      message.error("Puan sayısal olmalı.");
      return;
    }
    if (scoreVal < 0 || scoreVal > maxPoints) {
      message.error(`Puan 0 - ${maxPoints} aralığında olmalı.`);
      return;
    }

    setSaving((s) => ({ ...s, [r.studentId]: true }));
    try {
      await api.put("/teacher/report-scores/upsert", {
        periodId,
        studentId: r.studentId,
        weekNo,
        rotationNo: r.rotationNo,
        score: scoreVal,
      });
      message.success("Kaydedildi");
      await loadList();
    } catch (e) {
      message.error(e?.response?.data?.error || "Hata");
    } finally {
      setSaving((s) => ({ ...s, [r.studentId]: false }));
    }
  }

  const disabledByMode = mode && mode !== "OK";

  const cols = [
    {
      title: "Öğrenci",
      dataIndex: "nameSurname",
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    { title: "No", dataIndex: "studentNo", width: 120 },
    {
      title: "Toplam Puan",
      width: 260,
      render: (_, r) => {
        const maxPoints = Number.isFinite(Number(r.totalPoints)) ? Number(r.totalPoints) : 100;

        return (
          <Space>
            <InputNumber
              min={0}
              max={maxPoints}
              value={draft[r.studentId]}
              onChange={(v) => setDraft((d) => ({ ...d, [r.studentId]: v }))}
              style={{ width: 120 }}
              disabled={!canGrade || disabledByMode}
            />
            <Typography.Text type="secondary">/ {maxPoints}</Typography.Text>

            <Button
              type="primary"
              onClick={() => saveRow(r)}
              loading={!!saving[r.studentId]}
              disabled={!canGrade || disabledByMode}
            >
              Kaydet
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Card
      title="Haftalık Rapor Puanlama (Koordinatör)"
      extra={
        <Space>
          <Select
            value={periodId}
            onChange={setPeriodId}
            options={periodOptions}
            style={{ width: 260 }}
          />
          <Select
            value={weekNo}
            onChange={setWeekNo}
            options={weekOptions}
            style={{ width: 160 }}
          />
        </Space>
      }
    >
      {!canGrade && (
        <Alert
          type="warning"
          showIcon
          message="Bu ekran sadece Koordinatör yetkisindeki öğretmenler içindir."
          style={{ marginBottom: 12 }}
        />
      )}

      {mode === "EXAM" && (
        <Alert type="info" showIcon message="Sınav haftası: rapor puanlama kapalı." style={{ marginBottom: 12 }} />
      )}
      {mode === "NO_ROTATION" && (
        <Alert type="info" showIcon message="Rotasyon haftası değil: rapor puanlama yok." style={{ marginBottom: 12 }} />
      )}
      {mode === "NO_SNAPSHOT" && (
        <Alert type="warning" showIcon message="Bu dönem için rapor snapshot yok." style={{ marginBottom: 12 }} />
      )}

      <Table
        rowKey="studentId"
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={cols}
      />
    </Card>
  );
}
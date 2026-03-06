import React, { useEffect, useMemo, useState } from "react";
import { Card, Space, Select, Table, Button, Drawer, InputNumber, Input, Typography, message } from "antd";
import api from "../api";

const WEEK_OPTIONS = Array.from({ length: 17 }, (_, i) => ({ value: i + 1, label: `Hafta ${i + 1}` }));
const ROT_OPTIONS = [{ value: 1, label: "Rotasyon 1" }, { value: 2, label: "Rotasyon 2" }];

export default function ReportScoring() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);
  const [weekNo, setWeekNo] = useState(1);
  const [rotationNo, setRotationNo] = useState(1);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [draftScore, setDraftScore] = useState(0);
  const [draftNote, setDraftNote] = useState("");

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    const list = data || [];
    setPeriods(list);
    if (!periodId && list.length) setPeriodId(list[0].id);
  }

  async function loadList() {
    if (!periodId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/report-scores/list?periodId=${periodId}&weekNo=${weekNo}&rotationNo=${rotationNo}`);
      setRows(data?.items || []);
    } catch (e) {
      message.error(e?.response?.data?.error || "Liste alınamadı");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods().catch(() => message.error("Dönemler alınamadı"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, weekNo, rotationNo]);

  const periodOptions = useMemo(
    () => (periods || []).map((p) => ({ value: p.id, label: `${p.academicYear} · ${p.term}` })),
    [periods]
  );

  async function openDetail(r) {
    setActiveRow(r);
    setDrawerOpen(true);
    setDetail(null);
    try {
      const { data } = await api.get(
        `/admin/report-scores/detail?periodId=${periodId}&studentId=${r.studentId}&weekNo=${weekNo}&rotationNo=${rotationNo}`
      );
      setDetail(data);
      setDraftScore(data?.score?.score ?? r.score ?? 0);
      setDraftNote(data?.score?.note ?? r.note ?? "");
    } catch (e) {
      message.error(e?.response?.data?.error || "Detay alınamadı");
    }
  }

  async function saveScore() {
    if (!activeRow) return;
    try {
      await api.put("/admin/report-scores/grade", {
        periodId,
        studentId: activeRow.studentId,
        weekNo,
        rotationNo,
        score: Number(draftScore || 0),
        note: draftNote || "",
        status: "SUBMITTED",
      });
      message.success("Puan kaydedildi");
      setDrawerOpen(false);
      await loadList();
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydedilemedi");
    }
  }

  const cols = [
    { title: "No", dataIndex: "studentNo", width: 110 },
    { title: "Ad Soyad", dataIndex: "nameSurname" },
    { title: "Gün", dataIndex: "dayOfWeek", width: 90 },
    { title: "Hastane", dataIndex: "hospitalName" },
    { title: "Birim", dataIndex: "unitName" },
    { title: "Puan", dataIndex: "score", width: 90, render: (v) => (v === null || v === undefined ? "—" : v) },
    { title: "İşlem", width: 140, render: (_, r) => <Button type="primary" onClick={() => openDetail(r)}>Aç</Button> },
  ];

  return (
    <Card
      title="Rapor Puanlama (Admin)"
      extra={
        <Space>
          <Select style={{ width: 260 }} value={periodId} options={periodOptions} onChange={setPeriodId} />
          <Select style={{ width: 140 }} value={weekNo} options={WEEK_OPTIONS} onChange={setWeekNo} />
          <Select style={{ width: 160 }} value={rotationNo} options={ROT_OPTIONS} onChange={setRotationNo} />
        </Space>
      }
    >
      <Table rowKey={(r) => r.studentId} dataSource={rows} columns={cols} loading={loading} size="small" />

      <Drawer
        title={activeRow ? `${activeRow.nameSurname} · Hafta ${weekNo} · Rotasyon ${rotationNo}` : "Detay"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        extra={<Button type="primary" onClick={saveScore}>Kaydet</Button>}
      >
        {!detail ? (
          <Typography.Text type="secondary">Yükleniyor…</Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Card size="small" title="Cevaplar">
              {(detail.questions || []).map((q) => (
                <div key={q.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700 }}>
                    {q.orderNo}. {q.text} <span style={{ opacity: 0.6 }}>({q.points}p)</span>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 6, padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                    {q.answerText || <span style={{ opacity: 0.6 }}>— boş —</span>}
                  </div>
                </div>
              ))}
            </Card>

            <Card size="small" title="Puan">
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <InputNumber min={0} max={100} value={draftScore} onChange={setDraftScore} style={{ width: 180 }} />
                <Input.TextArea rows={3} value={draftNote} onChange={(e) => setDraftNote(e.target.value)} placeholder="Not (opsiyonel)" />
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>
    </Card>
  );
}
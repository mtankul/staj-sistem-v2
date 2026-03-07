//\staj-sistem-v2\client\src\pages/TeacherReportScoring.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Drawer,
  InputNumber,
  Input,
  Space,
  Select,
  Typography,
  message,
  Tag,
  Divider,
  Alert,
} from "antd";
import ReactMarkdown from "react-markdown";
import api from "../api";

const { TextArea } = Input;
const { Text } = Typography;

const WEEK_OPTIONS = Array.from({ length: 17 }, (_, i) => ({
  value: i + 1,
  label: `Hafta ${i + 1}`,
}));

export default function TeacherReportScoring() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);
  const [weekNo, setWeekNo] = useState(1);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [student, setStudent] = useState(null);

  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const selectedPeriod = useMemo(
    () => (periods || []).find((p) => p.id === periodId) || null,
    [periods, periodId]
  );

  const loadPeriods = useCallback(async () => {
    try {
      const { data } = await api.get("/periods");
      const list = data || [];
      setPeriods(list);

      if (!periodId && list.length) {
        const first = list[0];
        setPeriodId(first.id);
        setWeekNo(first.currentWeekNo || 1);
      }
    } catch (e) {
      message.error(e?.response?.data?.error || "Dönemler alınamadı");
    }
  }, [periodId]);

  const loadList = useCallback(async () => {
    if (!periodId || !weekNo) return;

    setLoading(true);
    try {
      const { data } = await api.get(
        `/teacher/report-scores?periodId=${encodeURIComponent(periodId)}&weekNo=${encodeURIComponent(weekNo)}`
      );
      setRows(data?.items || []);
    } catch (e) {
      message.error(e?.response?.data?.error || "Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, [periodId, weekNo]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!periodId || !periods.length) return;
    const p = periods.find((x) => x.id === periodId);
    if (p?.currentWeekNo) setWeekNo(p.currentWeekNo);
  }, [periodId, periods]);

  const closeDrawer = () => {
    setOpen(false);
    setDetail(null);
    setStudent(null);
    setDraft({});
  };

  async function openDetail(row) {
    try {
      const { data } = await api.get(
        `/teacher/report-scores/detail?periodId=${encodeURIComponent(periodId)}&studentId=${encodeURIComponent(
          row.studentId
        )}&weekNo=${encodeURIComponent(weekNo)}`
      );

      setDetail(data || null);

      const d = {};
      (data?.questions || []).forEach((q) => {
        d[q.id] = {
          score: q.score ?? 0,
          comment: q.comment ?? "",
        };
      });

      setDraft(d);
      setStudent(row);
      setOpen(true);
    } catch (e) {
      message.error(e?.response?.data?.error || "Rapor alınamadı");
    }
  }

  function updateScore(id, val) {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        score: val ?? 0,
      },
    }));
  }

  function updateComment(id, val) {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        comment: val,
      },
    }));
  }

  const totalScore = useMemo(() => {
    return Object.values(draft).reduce((s, x) => s + Number(x?.score || 0), 0);
  }, [draft]);

  async function saveDraft(showSuccess = true) {
    if (!student?.studentId || !detail?.rotationNo) {
      message.error("Öğrenci veya rapor detayı bulunamadı");
      return false;
    }

    try {
      setSaving(true);

      const items = Object.entries(draft).map(([qid, v]) => ({
        questionId: qid,
        score: Number(v?.score || 0),
        comment: v?.comment || "",
      }));

      await api.put("/teacher/report-scores/save-items", {
        periodId,
        studentId: student.studentId,
        weekNo,
        rotationNo: detail.rotationNo,
        items,
      });

      if (showSuccess) {
        message.success("Kaydedildi");
      }

      return true;
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydedilemedi");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!student?.studentId || !detail?.rotationNo) return;

    setActionLoading(true);
    try {
      const ok = await saveDraft(false);
      if (!ok) return;

      await api.put("/teacher/report-scores/approve", {
        periodId,
        studentId: student.studentId,
        weekNo,
        rotationNo: detail.rotationNo,
      });

      message.success("Rapor onaylandı");
      closeDrawer();
      loadList();
    } catch (e) {
      message.error(e?.response?.data?.error || "Onaylanamadı");
    } finally {
      setActionLoading(false);
    }
  }

  async function revision() {
    if (!student?.studentId || !detail?.rotationNo) return;

    setActionLoading(true);
    try {
      const ok = await saveDraft(false);
      if (!ok) return;

      await api.put("/teacher/report-scores/request-revision", {
        periodId,
        studentId: student.studentId,
        weekNo,
        rotationNo: detail.rotationNo,
      });

      message.success("Düzeltmeye gönderildi");
      closeDrawer();
      loadList();
    } catch (e) {
      message.error(e?.response?.data?.error || "İşlem başarısız");
    } finally {
      setActionLoading(false);
    }
  }

  const columns = [
    {
      title: "Öğrenci",
      render: (_, r) => (
        <Space>
          <img
            src={r.photoUrl || "/logo/user.png"}
            alt="pp"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid #e5e7eb",
            }}
          />

          <div>
            <div style={{ fontWeight: 700 }}>{r.nameSurname}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{r.studentNo}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "Toplam Puan",
      dataIndex: "totalScore",
      width: 150,
      render: (v) => <b>{Number(v || 0)}</b>,
    },
    {
      title: "Durum",
      dataIndex: "status",
      width: 180,
      render: (v) => {
        if (v === "APPROVED") return <Tag color="green">Onaylandı</Tag>;
        if (v === "REVISION") return <Tag color="orange">Düzeltme İstendi</Tag>;
        if (v === "DRAFT") return <Tag color="blue">Taslak</Tag>;
        if (v === "SUBMITTED") return <Tag color="purple">Gönderildi</Tag>;
        return <Tag>{v || "—"}</Tag>;
      },
    },
    {
      title: "İşlem",
      width: 200,
      render: (_, r) => (
        <Button type="primary" onClick={() => openDetail(r)}>
          İncele / Puanla
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="Rapor Puanlama"
      extra={
        <Space>
          <Select
            value={periodId}
            onChange={setPeriodId}
            style={{ width: 260 }}
            options={periods.map((p) => ({
              value: p.id,
              label: `${p.academicYear} - ${p.term}`,
            }))}
          />

          <Select
            value={weekNo}
            onChange={setWeekNo}
            options={WEEK_OPTIONS}
            style={{ width: 140 }}
          />
        </Space>
      }
    >
      {periodId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Aktif Hafta: Hafta ${selectedPeriod?.currentWeekNo || "-"}`}
        />
      ) : null}

      <Table
        rowKey="studentId"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 30 }}
      />

      <Drawer
        open={open}
        width={900}
        onClose={closeDrawer}
        title="Rapor İnceleme"
        destroyOnClose
      >
        {detail && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{student?.nameSurname}</div>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                Öğrenci No: {student?.studentNo || "-"}
              </div>
            </div>

            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Toplam Puan: ${totalScore}`}
            />

            {(detail?.questions || []).length === 0 ? (
              <Text type="secondary">Bu rapora ait soru bulunamadı.</Text>
            ) : (
              <>
                {detail.questions.map((q, index) => (
                  <Card key={q.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      {index + 1}. {q.text}
                    </div>

                    <div
                      style={{
                        background: "#fafafa",
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid #f0f0f0",
                        marginBottom: 12,
                      }}
                    >
                      <ReactMarkdown>{q.answerText || ""}</ReactMarkdown>
                    </div>

                    <Space direction="vertical" style={{ width: "100%" }} size={10}>
                      <Space align="center" wrap>
                        <Text style={{ minWidth: 110 }}>Puan</Text>
                        <InputNumber
                          min={0}
                          max={Number(q.points || 0)}
                          value={draft[q.id]?.score}
                          onChange={(v) => updateScore(q.id, v)}
                        />
                        <Text type="secondary">/ {Number(q.points || 0)}</Text>
                      </Space>

                      <div>
                        <Text style={{ display: "block", marginBottom: 6 }}>Yorum</Text>
                        <TextArea
                          placeholder="Yorum yazınız"
                          value={draft[q.id]?.comment}
                          onChange={(e) => updateComment(q.id, e.target.value)}
                          rows={4}
                        />
                      </div>
                    </Space>
                  </Card>
                ))}

                <Divider />

                <Space wrap>
                  <Button loading={saving} onClick={() => saveDraft(true)}>
                    Taslak Kaydet
                  </Button>

                  <Button loading={actionLoading} onClick={revision}>
                    Düzeltmeye Gönder
                  </Button>

                  <Button type="primary" loading={actionLoading} onClick={approve}>
                    Onayla
                  </Button>
                </Space>
              </>
            )}
          </>
        )}
      </Drawer>
    </Card>
  );
}
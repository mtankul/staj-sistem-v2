// client/src/pages/ReportSetup.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, Select, Space, Button, Table, InputNumber, Switch, Input, Typography, message, Divider, Tag } from "antd";
import api from "../api";

export default function ReportSetup() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);

  const [snapshot, setSnapshot] = useState(null);
  const [weekSettings, setWeekSettings] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    const list = data || [];
    setPeriods(list);
    if (!periodId && list.length) setPeriodId(list[0].id);
  }

  async function loadTemplates() {
    const { data } = await api.get("/report-templates");
    const list = data || [];
    setTemplates(list);
    const active = list.find((x) => x.isActive);
    if (!templateId && active) setTemplateId(active.id);
  }

  async function loadSnapshot(pid) {
    if (!pid) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/period-report?periodId=${encodeURIComponent(pid)}`);
      setSnapshot(data || null);
    } catch (e) {
      message.error(e?.response?.data?.error || "Snapshot yüklenemedi");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadWeekSettings(pid) {
    if (!pid) return;
    try {
      const { data } = await api.get(`/period-report/week-settings?periodId=${encodeURIComponent(pid)}`);
      setWeekSettings(data || []);
    } catch (e) {
      setWeekSettings([]);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadPeriods(), loadTemplates()]);
      } catch (e) {
        message.error("Başlangıç verileri alınamadı");
      }
    })();
  }, []);

  useEffect(() => {
    if (!periodId) return;
    loadSnapshot(periodId);
    loadWeekSettings(periodId);
  }, [periodId]);

  const periodOptions = useMemo(
    () => (periods || []).map((p) => ({ value: p.id, label: `${p.academicYear} · ${p.term} · ${p.course?.name || ""}` })),
    [periods]
  );

  const templateOptions = useMemo(
    () => (templates || []).map((t) => ({ value: t.id, label: `${t.name} (v${t.version})${t.isActive ? " · Aktif" : ""}` })),
    [templates]
  );

  const total = useMemo(() => {
    const qs = snapshot?.questions ?? [];
    return qs.filter((q) => q.isActive).reduce((a, b) => a + Number(b.points || 0), 0);
  }, [snapshot]);

  async function applyTemplate() {
    if (!periodId) return message.error("Önce dönem seç");
    if (!templateId) return message.error("Şablon seç");
    setLoading(true);
    try {
      const { data } = await api.post("/period-report/apply", { periodId, templateId });
      message.success("Rapor şablonu döneme uygulandı (snapshot alındı).");
      setSnapshot(data?.snapshot || null);
    } catch (e) {
      message.error(e?.response?.data?.error || "Uygulama hatası");
    } finally {
      setLoading(false);
    }
  }

  async function updateQuestion(id, patch) {
    try {
      const { data } = await api.put(`/period-report/question/${id}`, patch);
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        const q = (next.questions || []).find((x) => x.id === id);
        if (q) Object.assign(q, data?.question || {});
        return next;
      });
    } catch (e) {
      message.error(e?.response?.data?.error || "Güncelleme hatası");
    }
  }

  async function setWeekVisible(weekNo, visible) {
    try {
      await api.put("/period-report/week-setting", { periodId, weekNo, studentCanSeeReportScore: !!visible });
      await loadWeekSettings(periodId);
    } catch (e) {
      message.error(e?.response?.data?.error || "Hafta ayarı kaydedilemedi");
    }
  }

  const questionCols = [
    { title: "Sıra", dataIndex: "orderNo", width: 90 },
    {
      title: "Soru",
      dataIndex: "text",
      render: (_, r) => (
        <Input value={r.text} onChange={(e) => updateQuestion(r.id, { text: e.target.value })} />
      ),
    },
    {
      title: "Ağırlık",
      dataIndex: "points",
      width: 140,
      render: (_, r) => (
        <InputNumber min={0} max={100} value={r.points} style={{ width: "100%" }}
          onChange={(v) => updateQuestion(r.id, { points: Number(v || 0) })} />
      ),
    },
    {
      title: "Aktif",
      dataIndex: "isActive",
      width: 110,
      render: (_, r) => (
        <Switch checked={!!r.isActive} onChange={(v) => updateQuestion(r.id, { isActive: !!v })} />
      ),
    },
  ];

  const questionsData = useMemo(() => {
    const qs = snapshot?.questions ?? [];
    return qs.slice().sort((a, b) => Number(a.orderNo || 1) - Number(b.orderNo || 1)).map((q) => ({ key: q.id, ...q }));
  }, [snapshot]);

  // Week settings UI: 1..17 (istersen period.totalWeeks alanı da ekleyebiliriz; şimdilik 17)
  const weekRows = useMemo(() => {
    const m = new Map((weekSettings || []).map((x) => [x.weekNo, x]));
    return Array.from({ length: 17 }, (_, i) => {
      const w = i + 1;
      const item = m.get(w);
      return {
        key: w,
        weekNo: w,
        studentCanSeeReportScore: item ? !!item.studentCanSeeReportScore : false,
      };
    });
  }, [weekSettings]);

  const weekCols = [
    { title: "Hafta", dataIndex: "weekNo", width: 120, render: (v) => `Hafta ${v}` },
    {
      title: "Öğrenci haftalık rapor skorunu görsün",
      dataIndex: "studentCanSeeReportScore",
      render: (_, r) => (
        <Switch checked={!!r.studentCanSeeReportScore} onChange={(v) => setWeekVisible(r.weekNo, v)} />
      ),
    },
  ];

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Card title="Rapor Tanımı (Dinamik - Snapshot)">
        <Space wrap>
          <div style={{ minWidth: 420 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Dönem</div>
            <Select style={{ width: "100%" }} value={periodId} options={periodOptions} onChange={setPeriodId} />
          </div>

          <div style={{ minWidth: 420 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Rapor Şablonu</div>
            <Select style={{ width: "100%" }} value={templateId} options={templateOptions} onChange={setTemplateId} />
          </div>

          <Button type="primary" onClick={applyTemplate} loading={loading}>
            Şablonu Döneme Uygula (Snapshot)
          </Button>
        </Space>

        <Divider />

        {!snapshot ? (
          <Typography.Text type="secondary">
            Bu dönem için rapor snapshot yok. Şablon seçip “Şablonu Döneme Uygula” ile başlat.
          </Typography.Text>
        ) : (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Tag color={total === 100 ? "green" : "red"}>Aktif soru toplamı: {total}</Tag>
              <Typography.Text type="secondary">Kural: Aktif sorular toplamı 100 olmalı.</Typography.Text>
            </Space>

            <Card size="small" title="Sorular">
              <Table columns={questionCols} dataSource={questionsData} pagination={false} size="small" loading={loading} />
            </Card>

            <Divider />

            <Card size="small" title="Haftalık Görünürlük (Koordinatör Aç/Kapat)">
              <Table columns={weekCols} dataSource={weekRows} pagination={false} size="small" />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Not: Bu toggle sadece “öğrencinin haftalık rapor skorunu görmesi” içindir.
              </Typography.Text>
            </Card>
          </>
        )}
      </Card>
    </Space>
  );
}
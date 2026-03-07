import React, { useEffect, useState } from "react";
import { Card, Table, Switch, Space, Select, message } from "antd";
import api from "../../api";

const WEEK_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 1);

export default function ReportVisibilitySettings() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const [global, setGlobal] = useState({});
  const [weeks, setWeeks] = useState([]);

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    setPeriods(data);
    if (data?.length) setPeriodId(data[0].id);
  }

  async function loadSettings() {
    if (!periodId) return;

    const { data } = await api.get(`/admin/report-visibility?periodId=${periodId}`);

    setGlobal(data.global);
    setWeeks(data.weeks);
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    loadSettings();
  }, [periodId]);

  async function updateGlobal(key, value) {
    const next = { ...global, [key]: value };
    setGlobal(next);

    try {
      await api.put("/admin/report-visibility/global", {
        periodId,
        showScores: next.showScores,
        showComments: next.showComments,
        showRevisionNotes: next.showRevisionNotes,
      });
    } catch {
      message.error("Kaydedilemedi");
    }
  }

  async function updateWeek(weekNo, key, value) {
    const row = weeks.find((w) => w.weekNo === weekNo) || {};

    const next = {
      showScore: key === "score" ? value : row.studentCanSeeReportScore,
      showComment: key === "comment" ? value : row.studentCanSeeReportComment,
      showRevision: key === "revision" ? value : row.studentCanSeeRevisionNote,
    };

    try {
      await api.put("/admin/report-visibility/week", {
        periodId,
        weekNo,
        ...next,
      });

      loadSettings();
    } catch {
      message.error("Kaydedilemedi");
    }
  }

  const columns = [
    {
      title: "Hafta",
      dataIndex: "weekNo",
    },
    {
      title: "Puan",
      render: (_, r) => (
        <Switch
          checked={r.studentCanSeeReportScore}
          onChange={(v) => updateWeek(r.weekNo, "score", v)}
        />
      ),
    },
    {
      title: "Yorum",
      render: (_, r) => (
        <Switch
          checked={r.studentCanSeeReportComment}
          onChange={(v) => updateWeek(r.weekNo, "comment", v)}
        />
      ),
    },
    {
      title: "Düzeltme Notu",
      render: (_, r) => (
        <Switch
          checked={r.studentCanSeeRevisionNote}
          onChange={(v) => updateWeek(r.weekNo, "revision", v)}
        />
      ),
    },
  ];

  const dataSource = WEEK_OPTIONS.map((w) => ({
    weekNo: w,
    ...(weeks.find((x) => x.weekNo === w) || {}),
  }));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Card title="Dönem">
          <Select
            style={{ width: 300 }}
            value={periodId}
            onChange={setPeriodId}
            options={(periods || []).map((p) => ({
              value: p.id,
              label: `${p.academicYear} ${p.term}`,
            }))}
          />
        </Card>

        <Card title="Genel Ayarlar">
          <Space direction="vertical">
            <Space>
              Öğrenci puanları görebilsin
              <Switch
                checked={global.showScores}
                onChange={(v) => updateGlobal("showScores", v)}
              />
            </Space>

            <Space>
              Öğrenci yorumları görebilsin
              <Switch
                checked={global.showComments}
                onChange={(v) => updateGlobal("showComments", v)}
              />
            </Space>

            <Space>
              Öğrenci düzeltme notunu görebilsin
              <Switch
                checked={global.showRevisionNotes}
                onChange={(v) => updateGlobal("showRevisionNotes", v)}
              />
            </Space>
          </Space>
        </Card>

        <Card title="Hafta Bazlı Ayarlar">
          <Table
            rowKey="weekNo"
            columns={columns}
            dataSource={dataSource}
            pagination={false}
          />
        </Card>
      </Space>
    </div>
  );
}
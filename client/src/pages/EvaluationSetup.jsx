import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Select,
  Space,
  Button,
  Table,
  InputNumber,
  Switch,
  Input,
  Typography,
  message,
  Divider,
} from "antd";
import api from "../api";

const DAY_LABEL = {
  MON: "Pazartesi",
  TUE: "Salı",
  WED: "Çarşamba",
  THU: "Perşembe",
  FRI: "Cuma",
  SAT: "Cumartesi",
  SUN: "Pazar",
};

export default function EvaluationSetup() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadPeriods() {
    try {
      const { data } = await api.get("/periods");
      const list = data || [];
      setPeriods(list);
      if (!periodId && list.length) setPeriodId(list[0].id);
    } catch (e) {
      message.error(e?.response?.data?.error || "Dönemler yüklenemedi");
    }
  }

  async function loadTemplates() {
    try {
      const { data } = await api.get("/eval-templates");
      const list = data || [];
      setTemplates(list);
      const active = list.find((x) => x.isActive);
      if (!templateId && active) setTemplateId(active.id);
    } catch (e) {
      message.error(e?.response?.data?.error || "Şablonlar yüklenemedi");
    }
  }

  async function loadSnapshot(pid) {
    if (!pid) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/period-eval?periodId=${pid}`);
      // ✅ Direktif: API null dönebilir -> snap null kalsın
      const snap = data || null;
      setSnapshot(snap);
    } catch (e) {
      message.error(e?.response?.data?.error || "Snapshot yüklenemedi");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (periodId) loadSnapshot(periodId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  const periodOptions = useMemo(
    () =>
      (periods || []).map((p) => ({
        value: p.id,
        label: `${p.academicYear} · ${p.term} · ${p.course?.name || ""}`,
      })),
    [periods]
  );

  const templateOptions = useMemo(
    () =>
      (templates || []).map((t) => ({
        value: t.id,
        label: `${t.name} (v${t.version})${t.isActive ? " · Aktif" : ""}`,
      })),
    [templates]
  );

  // ✅ Direktif: snapshot null olabilir, groups yoksa [] ile çalış
  const totals = useMemo(() => {
    const groups = snapshot?.groups ?? [];
    const byGroup = groups.map((g) => {
      const items = g.items ?? [];
      const sum = items
        .filter((x) => x.isActive)
        .reduce((a, b) => a + Number(b.points || 0), 0);
      return { groupId: g.id, title: g.title, target: g.totalPoints, sum };
    });
    const total = byGroup.reduce((a, b) => a + b.sum, 0);
    return { total, byGroup };
  }, [snapshot]);

  async function applyTemplate() {
    if (!periodId) return message.error("Önce dönem seç");
    if (!templateId) return message.error("Şablon seç");
    setLoading(true);
    try {
      const { data } = await api.post("/period-eval/apply", { periodId, templateId });
      message.success("Şablon döneme uygulandı (snapshot alındı).");
      setSnapshot(data?.snapshot || null);
    } catch (e) {
      message.error(e?.response?.data?.error || "Uygulama hatası");
    } finally {
      setLoading(false);
    }
  }

  async function updateItem(id, patch) {
    try {
      const { data } = await api.put(`/period-eval/item/${id}`, patch);

      // ✅ local update (snapshot null ise dokunma)
      setSnapshot((prev) => {
        if (!prev) return prev;

        // structuredClone her ortamda yoksa diye güvenli kopya:
        const next = typeof structuredClone === "function" ? structuredClone(prev) : JSON.parse(JSON.stringify(prev));

        for (const g of next.groups ?? []) {
          const it = (g.items ?? []).find((x) => x.id === id);
          if (it) Object.assign(it, data?.item || {});
        }
        return next;
      });
    } catch (e) {
      message.error(e?.response?.data?.error || "Güncelleme hatası");
    }
  }

  async function updateOpenQuestion(text) {
    if (!periodId) return;
    try {
      await api.put("/period-eval/snapshot", { periodId, openQuestionText: text });
      setSnapshot((p) => (p ? { ...p, openQuestionText: text } : p));
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydetme hatası");
    }
  }

  const columns = [
    { title: "Grup", dataIndex: "groupTitle", width: 260 },
    { title: "Madde", dataIndex: "text" },
    {
      title: "Puan",
      dataIndex: "points",
      width: 120,
      render: (_, r) => (
        <InputNumber
          min={0}
          max={100}
          value={r.points}
          onChange={(v) => updateItem(r.id, { points: Number(v || 0) })}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Aktif",
      dataIndex: "isActive",
      width: 110,
      render: (_, r) => (
        <Switch checked={!!r.isActive} onChange={(v) => updateItem(r.id, { isActive: !!v })} />
      ),
    },
  ];

  const dataSource = useMemo(() => {
    const groups = snapshot?.groups ?? [];
    const rows = [];
    for (const g of groups) {
      for (const it of g.items ?? []) {
        rows.push({
          key: it.id,
          id: it.id,
          groupTitle: `${g.orderNo}. ${g.title} (hedef ${g.totalPoints})`,
          text: it.text,
          points: it.points,
          isActive: it.isActive,
        });
      }
    }
    return rows;
  }, [snapshot]);

  // ✅ Direktif: “Sayfa açılıp 1 saniye sonra boşalıyor” kalkanı
  // periodId henüz set edilmeden render/map işlemlerine girmesin
  if (!periodId) {
    return <div style={{ padding: 16 }}>Önce dönem seçiniz…</div>;
  }

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Card title="Değerlendirme Tanımı (Dinamik)">
        <Space wrap>
          <div style={{ minWidth: 420 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Dönem</div>
            <Select
              style={{ width: "100%" }}
              value={periodId}
              options={periodOptions}
              placeholder="Dönem seç"
              onChange={(v) => setPeriodId(v)}
            />
          </div>

          <div style={{ minWidth: 420 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Şablon</div>
            <Select
              style={{ width: "100%" }}
              value={templateId}
              options={templateOptions}
              placeholder="Şablon seç"
              onChange={(v) => setTemplateId(v)}
            />
          </div>

          <Button type="primary" onClick={applyTemplate} loading={loading}>
            Şablonu Döneme Uygula (Snapshot)
          </Button>
        </Space>

        <Divider />

        {!snapshot ? (
          <Typography.Text type="secondary">
            Bu dönem için snapshot yok. Bir şablon seçip “Şablonu Döneme Uygula” diyerek başlat.
          </Typography.Text>
        ) : (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Card size="small" title="Toplam Kontrol">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Aktif maddeler toplamı</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{totals.total}</div>
                </div>
                <div style={{ flex: 1 }}>
                  {totals.byGroup.map((g) => (
                    <div key={g.groupId} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{g.title}</span>
                      <b>
                        {g.sum} / {g.target}
                      </b>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Table columns={columns} dataSource={dataSource} pagination={false} size="small" loading={loading} />

            <Card size="small" title="Açık Uçlu Alan (Staj yürütücüsünün görüşleri / notları)">
              <Input.TextArea
                rows={3}
                value={snapshot.openQuestionText || ""}
                placeholder="Örn: Staj yürütücüsünün öğrenci hakkındaki görüşleri / notları"
                onChange={(e) =>
                  setSnapshot((p) => (p ? { ...p, openQuestionText: e.target.value } : p))
                }
                onBlur={() => updateOpenQuestion(snapshot.openQuestionText || "")}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Not: Bu alan puan toplamına dahil değildir.
              </Typography.Text>
            </Card>
          </Space>
        )}
      </Card>
    </Space>
  );
}
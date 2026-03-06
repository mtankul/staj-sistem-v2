// client/src/pages/TeacherScoring.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Card,
  Space,
  Select,
  Table,
  Switch,
  Drawer,
  Typography,
  Button,
  message,
  Alert,
  Collapse,
  Checkbox,
  Rate,
  Tag,
  Divider,
} from "antd";
import api from "../api";

const DAY_LABEL_TR = {
  MON: "Pazartesi",
  TUE: "Salı",
  WED: "Çarşamba",
  THU: "Perşembe",
  FRI: "Cuma",
  SAT: "Cumartesi",
  SUN: "Pazar",
};

const WEEK_OPTIONS = Array.from({ length: 17 }, (_, i) => ({ value: i + 1, label: `Hafta ${i + 1}` }));

function attendanceLabelFromAbsent(absent) {
  if (absent == null) return { text: "Alınmadı", color: "default" };
  if (absent === false) return { text: "Geldi", color: "green" };
  return { text: "Yok", color: "red" };
}

export default function TeacherScoring() {
  const [me, setMe] = useState(null);

  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const [scope, setScope] = useState("observer"); // observer | coordinator
  const [weekNo, setWeekNo] = useState(1);

  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);

  // Drawer state
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalStudentId, setEvalStudentId] = useState(null);
  const [evalRotationNo, setEvalRotationNo] = useState(null);

  const [evalSnapshot, setEvalSnapshot] = useState(null);
  const [rotationWeeks, setRotationWeeks] = useState([]);
  const [scoresByWeek, setScoresByWeek] = useState({});
  const [draft, setDraft] = useState({});

  const savingTimers = useRef(new Map());

  const isCoordinatorUser = !!me?.isCoordinator;
  const canEditTheory = !!me?.isCoordinator && scope === "coordinator";

  const activeStudent = useMemo(() => {
    if (!evalStudentId) return null;
    return rows.find((r) => r.studentId === evalStudentId) || null;
  }, [rows, evalStudentId]);

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

  const loadList = useCallback(async () => {
    if (!periodId || !weekNo) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/teacher/students?periodId=${encodeURIComponent(periodId)}&weekNo=${encodeURIComponent(weekNo)}&scope=${encodeURIComponent(scope)}`
      );

      setMode(data?.mode || null);
      setRows((data?.items || []).map((x) => ({ key: `${x.studentId}_${x.rotationNo}_${x.weekNo}`, ...x })));
    } catch (e) {
      message.error(e?.response?.data?.error || "Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, [periodId, weekNo, scope]);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadMe(), loadPeriods()]);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function updateAttendance(row, patch) {
    try {
      await api.put("/teacher/attendance", {
        periodId,
        studentId: row.studentId,
        weekNo,
        rotationNo: row.rotationNo,
        ...patch,
      });

      setRows((prev) =>
        prev.map((r) => {
          if (r.studentId !== row.studentId) return r;
          if (patch.theoryAbsent !== undefined) return { ...r, theoryAbsent: !!patch.theoryAbsent };
          if (patch.practiceAbsent !== undefined) return { ...r, practiceAbsent: !!patch.practiceAbsent };
          return r;
        })
      );
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydedilemedi");
    }
  }

  async function markAllTheoryPresent() {
    if (!canEditTheory) return;
    try {
      setLoading(true);
      await api.put("/teacher/attendance/bulk-theory", { periodId, weekNo, theoryAbsent: false });
      setRows((prev) => prev.map((r) => ({ ...r, theoryAbsent: false })));
      message.success("Teorik: tüm öğrenciler 'Geldi' işaretlendi.");
    } catch (e) {
      message.error(e?.response?.data?.error || "Toplu işlem başarısız");
    } finally {
      setLoading(false);
    }
  }

  const openEval = useCallback(
    async (studentId, rotNo) => {
      if (!periodId) return;
      try {
        const { data } = await api.get(
          `/teacher/eval-form?periodId=${encodeURIComponent(periodId)}&studentId=${encodeURIComponent(studentId)}&weekNo=${encodeURIComponent(
            weekNo
          )}&rotationNo=${encodeURIComponent(rotNo)}`
        );

        setEvalSnapshot(data?.snapshot || null);
        setRotationWeeks(data?.rotationWeeks || []);
        setScoresByWeek(data?.scoresByWeek || {});
        setDraft(data?.currentWeekScores || {});

        setEvalStudentId(studentId);
        setEvalRotationNo(rotNo);
        setEvalOpen(true);
      } catch (e) {
        message.error(e?.response?.data?.error || "Değerlendirme formu yüklenemedi");
      }
    },
    [periodId, weekNo]
  );

  const infoBanner = useMemo(() => {
    if (mode === "EXAM") return <Alert type="info" showIcon message="Sınav haftası: uygulama + teori yoklama kapalı." />;
    if (mode === "NO_ROTATION") return <Alert type="warning" showIcon message="Rotasyon haftası değil: gözetmen listesi kapalı." />;
    if (mode === "THEORY_ONLY") return <Alert type="info" showIcon message="Rotasyon yok: sadece teorik yoklama (koordinatör) açık." />;
    return null;
  }, [mode]);

  const coverageCount = useCallback(
    (itemId) => {
      const weeks = rotationWeeks?.length ? rotationWeeks : [];
      let c = 0;
      for (const w of weeks) {
        const s = scoresByWeek?.[w]?.[itemId] ?? 0;
        if (Number(s) > 0) c++;
      }
      return c;
    },
    [rotationWeeks, scoresByWeek]
  );

  const saveItemDebounced = useCallback(
    (itemId, score) => {
      setDraft((p) => ({ ...p, [itemId]: score }));

      setScoresByWeek((prev) => {
        const next = { ...(prev || {}) };
        const w = Number(weekNo);
        next[w] = { ...(next[w] || {}), [itemId]: score };
        return next;
      });

      // ✅ Anlık UX: bu hafta en az 1 madde >0 ise evalDone = true
      if (evalStudentId) {
        if (Number(score || 0) > 0) {
          setRows((prev) => prev.map((r) => (r.studentId === evalStudentId ? { ...r, evalDone: true } : r)));
        } else {
          const w = Number(weekNo);
          const weekMap = { ...(scoresByWeek?.[w] || {}), [itemId]: 0 };
          const anyPositive = Object.values(weekMap).some((v) => Number(v || 0) > 0);
          setRows((prev) => prev.map((r) => (r.studentId === evalStudentId ? { ...r, evalDone: anyPositive } : r)));
        }
      }

      const timers = savingTimers.current;
      if (timers.has(itemId)) clearTimeout(timers.get(itemId));

      const t = setTimeout(async () => {
        try {
          await api.put("/teacher/eval-item", {
            periodId,
            studentId: evalStudentId,
            weekNo,
            rotationNo: evalRotationNo,
            itemId,
            score,
          });
        } catch (e) {
          message.error(e?.response?.data?.error || "Kaydedilemedi");
        }
      }, 450);

      timers.set(itemId, t);
    },
    [periodId, evalStudentId, evalRotationNo, weekNo, scoresByWeek]
  );

  const columns = useMemo(() => {
    const cols = [
      {
        title: "Öğrenci",
        render: (_, r) => (
          <Space>
            <img
              src={r.photoUrl || "/logo/user.png"}
              alt="pp"
              style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #e6f4ff" }}
            />
            <div>
              <div style={{ fontWeight: 800 }}>{r.nameSurname}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{r.studentNo}</div>
            </div>
          </Space>
        ),
      },
      {
        title: "Gün",
        width: 140,
        render: (_, r) => (r.dayOfWeek ? DAY_LABEL_TR[r.dayOfWeek] : "—"),
      },
      { title: "Hastane", dataIndex: "hospitalName", width: 220 },
      { title: "Birim", dataIndex: "unitName", width: 220 },

      {
        title: (
          <Space>
            <span>Teorik Yoklama</span>
            {canEditTheory && (
              <Button size="small" onClick={markAllTheoryPresent} disabled={loading}>
                Tümü Geldi
              </Button>
            )}
          </Space>
        ),
        key: "theory",
        hidden: !canEditTheory,
        width: 260,
        render: (_, r) => {
          const notTaken = r.theoryAbsent == null;
          const checked = r.theoryAbsent === false;
          const tag = attendanceLabelFromAbsent(r.theoryAbsent);

          return (
            <Space>
              <Switch
                checkedChildren="Geldi"
                unCheckedChildren={notTaken ? "—" : "Yok"}
                checked={checked}
                disabled={!canEditTheory}
                onChange={(v) => updateAttendance({ ...r, rotationNo: 0 }, { theoryAbsent: !v })}
              />
              <Tag color={tag.color} style={{ fontWeight: 700 }}>
                {tag.text}
              </Tag>
            </Space>
          );
        },
      },

      {
        title: "Uygulama",
        width: 300,
        render: (_, r) => {
          const disabled = !r.practiceEnabled;
          const notTaken = !disabled && r.practiceAbsent == null;
          const checked = !disabled && r.practiceAbsent === false;

          let tag = { text: "Kapalı", color: "default" };
          if (!disabled) tag = attendanceLabelFromAbsent(r.practiceAbsent);

          return (
            <Space>
              <Switch
                checkedChildren="Geldi"
                unCheckedChildren={notTaken ? "—" : "Yok"}
                checked={checked}
                disabled={disabled}
                onChange={(v) => updateAttendance({ ...r, rotationNo: r.rotationNo }, { practiceAbsent: !v })}
              />
              <Tag color={tag.color} style={{ fontWeight: 700 }}>
                {tag.text}
              </Tag>
            </Space>
          );
        },
      },

      {
        title: "Değerlendirme",
        width: 230,
        render: (_, r) => {
          const practicePresent = r.practiceEnabled && r.practiceAbsent === false;
          const done = !!r.evalDone;

          if (!practicePresent) {
            return (
              <Space direction="vertical" size={2}>
                <Button disabled block>
                  Değerlendir
                </Button>
                <Tag color="default" style={{ width: "fit-content" }}>
                  Uygulamaya gelmedi
                </Tag>
              </Space>
            );
          }

          if (!done) {
            return (
              <Space direction="vertical" size={2}>
                <Button type="primary" block onClick={() => openEval(r.studentId, r.rotationNo)}>
                  Değerlendir
                </Button>
                <Tag color="orange" style={{ width: "fit-content", fontWeight: 700 }}>
                  Bekliyor
                </Tag>
              </Space>
            );
          }

          return (
            <Space direction="vertical" size={2}>
              <Button type="default" block onClick={() => openEval(r.studentId, r.rotationNo)}>
                Değerlendirildi (Düzenle)
              </Button>
              <Tag color="green" style={{ width: "fit-content", fontWeight: 700 }}>
                Tamamlandı
              </Tag>
            </Space>
          );
        },
      },
    ];

    return cols.filter((c) => !c.hidden);
  }, [canEditTheory, loading, openEval]);

  const rowClassName = useCallback((r) => {
    const practicePresent = r.practiceEnabled && r.practiceAbsent === false;
    if (!practicePresent) return "";
    return r.evalDone ? "row-eval-done" : "row-eval-pending";
  }, []);

  const activeGroups = useMemo(() => {
    const gs = evalSnapshot?.groups || [];
    return gs
      .map((g) => ({
        ...g,
        items: (g.items || []).filter((it) => it.isActive),
      }))
      .filter((g) => g.items?.length);
  }, [evalSnapshot]);

  const headerCard = useMemo(() => {
    if (!activeStudent) return null;
    return (
      <div
        style={{
          display: "flex",
          gap: 14,
          padding: 14,
          borderRadius: 14,
          background: "linear-gradient(90deg, #e6f4ff 0%, #f6ffed 100%)",
          border: "1px solid #d6e4ff",
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <img
          src={activeStudent.photoUrl || "/logo/user.png"}
          alt="pp_big"
          style={{
            width: 78,
            height: 78,
            borderRadius: 16,
            objectFit: "cover",
            border: "3px solid #1677ff",
            background: "#fff",
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0b1e3a" }}>{activeStudent.nameSurname}</div>
          <div style={{ marginTop: 4, color: "#334155" }}>
            <b>No:</b> {activeStudent.studentNo} &nbsp;|&nbsp; <b>Hafta:</b> {weekNo} &nbsp;|&nbsp; <b>Rotasyon:</b> {evalRotationNo}
          </div>
          <div style={{ marginTop: 4, color: "#475569" }}>
            <b>Hastane:</b> {activeStudent.hospitalName || "-"} &nbsp;|&nbsp; <b>Birim:</b> {activeStudent.unitName || "-"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <Tag color="blue">0 = Değerlendirilmedi</Tag>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
            Hedef: rotasyon boyunca tüm alt kırılımlar en az 1 kez değerlendirilsin.
          </div>
        </div>
      </div>
    );
  }, [activeStudent, weekNo, evalRotationNo]);

  return (
    <>
      <style>{`
        .row-eval-done td { background: #f6ffed !important; }
        .row-eval-pending td { background: #fff7e6 !important; }
        .row-eval-done:hover td, .row-eval-pending:hover td { filter: brightness(0.99); }
      `}</style>

      <Card
        title="Devamsızlık & Notlar"
        extra={
          <Space>
            <Select
              value={periodId}
              onChange={setPeriodId}
              style={{ width: 320 }}
              options={periods.map((p) => ({
                value: p.id,
                label: `${p.academicYear} · ${p.term} · ${p.course?.name || ""}`,
              }))}
            />
            <Select value={weekNo} onChange={setWeekNo} style={{ width: 140 }} options={WEEK_OPTIONS} />
            <Select
              value={scope}
              onChange={setScope}
              style={{ width: 180 }}
              options={[
                { value: "observer", label: "Gözetmen Görünümü" },
                { value: "coordinator", label: "Koordinatör Görünümü" },
              ]}
              disabled={!isCoordinatorUser}
            />
          </Space>
        }
      >
        {infoBanner}

        <Table
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowClassName={rowClassName}
          pagination={{ pageSize: 50 }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Drawer
        title="Haftalık Değerlendirme"
        open={evalOpen}
        onClose={() => {
          setEvalOpen(false);
          loadList(); // ✅ backend’den evalDone’ı tekrar çek (artık 500 yoksa kesin doğru gelecek)
        }}
        width={980}
        destroyOnClose
      >
        {headerCard}

        {!evalSnapshot ? (
          <Typography.Text type="secondary">
            Bu dönem için değerlendirme snapshot’ı yok. (Admin: Eval Template → “Döneme Uygula (Snapshot)”)
          </Typography.Text>
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              message="Değerlendirme (Madde Bazlı)"
              description="Checkbox ile maddeyi aktif et → 1–5 puan ver. İşaretli değilse 0 (=değerlendirilmedi)."
              style={{ marginBottom: 12 }}
            />

            <Collapse
              accordion
              defaultActiveKey={activeGroups?.[0]?.id}
              items={activeGroups.map((g) => ({
                key: g.id,
                label: (
                  <Space>
                    <span style={{ fontWeight: 900, color: "#0b1e3a" }}>{`${g.orderNo ?? ""}. ${g.title}`}</span>
                    <Tag color="geekblue">{(g.items || []).length} madde</Tag>
                  </Space>
                ),
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(g.items || []).map((it) => {
                      const val = Number(draft?.[it.id] || 0);
                      const active = val > 0;

                      const covered = coverageCount(it.id);
                      const totalWeeks = rotationWeeks?.length || 0;

                      return (
                        <div
                          key={it.id}
                          style={{
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            background: active ? "linear-gradient(90deg, #f0f9ff 0%, #ffffff 65%)" : "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Checkbox
                              checked={active}
                              onChange={(e) => {
                                const on = e.target.checked;
                                saveItemDebounced(it.id, on ? 5 : 0);
                              }}
                            >
                              <span style={{ fontWeight: 800, color: "#0f172a" }}>{it.text}</span>
                            </Checkbox>

                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                              <Tag color={covered > 0 ? "green" : "default"}>
                                Kapsam: {covered}/{totalWeeks || "-"}
                              </Tag>
                              <Tag color="blue">Ağırlık: {Number(it.points || 0)}</Tag>
                            </div>
                          </div>

                          <Divider style={{ margin: "10px 0" }} />

                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Typography.Text style={{ width: 110, fontWeight: 800, color: "#334155" }}>Puan (1–5)</Typography.Text>

                            <Rate
                              count={5}
                              value={active ? val : 0}
                              disabled={!active}
                              onChange={(v) => saveItemDebounced(it.id, Number(v || 0))}
                            />

                            <div style={{ marginLeft: "auto" }}>
                              {active ? <Tag color="blue">Seçili: {val}/5</Tag> : <Tag>Değerlendirilmedi (0)</Tag>}
                            </div>
                          </div>

                          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                            Not: Bu alt kırılım rotasyon boyunca hiç değerlendirilmezse, rotasyon sonunda <b>tam puan (5)</b> kabul edilecek.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
    </>
  );
}
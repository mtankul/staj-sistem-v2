import { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Card, Checkbox, Divider, Select, Space, Table, Typography, message, Tag } from "antd";
import api from "../api";

const dayTr = {
  MON: "Pazartesi",
  TUE: "Salı",
  WED: "Çarşamba",
  THU: "Perşembe",
  FRI: "Cuma",
  SAT: "Cumartesi",
  SUN: "Pazar",
};

const dayShortTr = {
  MON: "PZT",
  TUE: "SAL",
  WED: "ÇRŞ",
  THU: "PRŞ",
  FRI: "CUMA",
  SAT: "CMT",
  SUN: "PAZ",
};

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const dayOrderIndex = (d) => {
  const k = String(d ?? "").toUpperCase();
  const i = DAY_ORDER.indexOf(k);
  return i === -1 ? 999 : i;
};

export default function Lottery() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const [includeRot1, setIncludeRot1] = useState(true);
  const [includeRot2, setIncludeRot2] = useState(true);
  const [replace, setReplace] = useState(true);

  const [preview, setPreview] = useState([]);

  const [studentMap, setStudentMap] = useState({});
  const [hospitalMap, setHospitalMap] = useState({});
  const [unitMap, setUnitMap] = useState({});

  const [lastSeed, setLastSeed] = useState(null);

  const loadPeriods = useCallback(async () => {
    const { data } = await api.get("/periods");
    setPeriods(data || []);
    const active = (data || []).find((p) => p.isActive);
    if (active) setPeriodId(active.id);
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const periodOptions = useMemo(
    () =>
      (periods || []).map((p) => ({
        value: p.id,
        label: `${p.academicYear} ${p.term}${p.isActive ? " (AKTİF)" : ""}`,
      })),
    [periods]
  );

  useEffect(() => {
    if (!periodId) return;

    (async () => {
      try {
        // öğrenciler period bazlı
        const sRes = await api.get(`/students?periodId=${periodId}`);
        const sMap = {};
        for (const s of sRes.data || []) {
          sMap[s.id] = {
            studentNo: s.studentNo,
            nameSurname: s.nameSurname,
          };
        }
        setStudentMap(sMap);

        // hastaneler
        const hRes = await api.get("/hospitals");
        const hMap = {};
        for (const h of hRes.data || []) {
          hMap[h.id] = h.name;
        }
        setHospitalMap(hMap);

        // birimler (genel)
        const uRes = await api.get("/units");
        const uMap = {};
        for (const u of uRes.data || []) {
          uMap[u.id] = u.name;
        }
        setUnitMap(uMap);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [periodId]);

  // ✅ Preview tablo kolonları (sıra: Rot, Gün, Hastane, Öğrenci)
  const columns = useMemo(
    () => [
      { title: "Rot", dataIndex: "rotationNo", width: 70 },
      { title: "Gün", dataIndex: "dayLabel", width: 120 },
      { title: "Hastane", dataIndex: "hospitalLabel", width: 260 },
      { title: "Öğrenci", dataIndex: "studentName", width: 260 },
      { title: "Numara", dataIndex: "studentNo", width: 140 },
      { title: "Birim", dataIndex: "unitLabel", width: 240 },
      {
        title: "Durum",
        render: (_, r) => (r.error ? <Tag color="red">HATA</Tag> : <Tag color="green">OK</Tag>),
        width: 100,
      },
      { title: "Hata", dataIndex: "error" },
    ],
    []
  );

  // ✅ ÖNEMLİ: Preview listeyi UI’da sıralayalım
  const sortedPreview = useMemo(() => {
    const list = Array.isArray(preview) ? preview.slice() : [];
    list.sort((a, b) => {
      // önce hatasızları üste al (isteğe bağlı); istersen kaldır
      const ea = a.error ? 1 : 0;
      const eb = b.error ? 1 : 0;
      if (ea !== eb) return ea - eb;

      // 1) Rot
      const ra = Number(a.rotationNo ?? 0);
      const rb = Number(b.rotationNo ?? 0);
      if (ra !== rb) return ra - rb;

      // 2) Gün (MON..SUN)
      const da = String(a.dayOfWeek ?? "").toUpperCase();
      const db = String(b.dayOfWeek ?? "").toUpperCase();
      const di = dayOrderIndex(da) - dayOrderIndex(db);
      if (di !== 0) return di;

      // 3) Hastane
      const ha = String(a.hospitalLabel ?? "");
      const hb = String(b.hospitalLabel ?? "");
      const hc = ha.localeCompare(hb, "tr");
      if (hc !== 0) return hc;

      // 4) Ad Soyad
      const na = String(a.studentName ?? "");
      const nb = String(b.studentName ?? "");
      const nc = na.localeCompare(nb, "tr");
      if (nc !== 0) return nc;

      // stabil
      return String(a.studentNo ?? "").localeCompare(String(b.studentNo ?? ""), "tr");
    });
    return list;
  }, [preview]);

  // ✅ ÖZET: Rotasyon -> Gün -> Hastane -> count (hatalı satırları sayma)
  const summaryByRotation = useMemo(() => {
    const list = Array.isArray(sortedPreview) ? sortedPreview : [];
    const good = list.filter((x) => !x.error && x.rotationNo && x.dayOfWeek && x.hospitalLabel);

    if (!good.length) return null;

    const rotMap = new Map(); // rot -> day -> hosp -> count

    for (const r of good) {
      const rot = Number(r.rotationNo ?? 0) || 0;
      const day = String(r.dayOfWeek ?? "").toUpperCase();
      const hosp = String(r.hospitalLabel ?? "—").trim();

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
                label: `${dayShortTr[day] || day} - ${hospitalName} : ${count}`,
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
  }, [sortedPreview]);

  async function doPreview() {
    if (!periodId) return message.error("Dönem seç");

    const { data } = await api.post("/lottery/preview", {
      periodId,
      includeRot1,
      includeRot2,
      seed: lastSeed ?? undefined,
    });

    if (data?.seed) setLastSeed(data.seed);
    if (!data?.ok) return message.error("Preview hatası");

    const plan = data.plan || [];
    const display = plan.map((p) => ({
      ...p,

      // ham alanlar (sıralama/özet için)
      dayOfWeek: p.dayOfWeek,

      // UI alanları
      dayLabel: dayTr[p.dayOfWeek] || p.dayOfWeek,
      studentNo: studentMap[p.studentId]?.studentNo || "",
      studentName: studentMap[p.studentId]?.nameSurname || "",
      hospitalLabel: hospitalMap[p.hospitalId] || p.hospitalId,
      unitLabel: unitMap[p.unitId] || p.unitId,

      _rowKey: `${p.rotationNo}-${p.studentId}-${p.hospitalId}-${p.unitId}-${p.dayOfWeek}-${p.error || "OK"}`,
    }));

    setPreview(display);
    message.success("Önizleme oluşturuldu");
  }

  async function doApply() {
    if (!periodId) return message.error("Dönem seç");

    const { data } = await api.post("/lottery/apply", {
      periodId,
      includeRot1,
      includeRot2,
      replace,
      seed: lastSeed ?? undefined,
    });

    if (data?.seed) setLastSeed(data.seed);
    if (!data?.ok) return message.error(data?.error || "Apply hatası");

    if (data.errors?.length) {
      message.warning(`Uygulandı. Insert: ${data.inserted}. Hata: ${data.errors.length}`);
    } else {
      message.success(`Uygulandı ✅ Insert: ${data.inserted}`);
    }
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Kura
      </Typography.Title>

      <Card>
        <Space wrap align="start" style={{ width: "100%" }}>
          <div style={{ minWidth: 320 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Dönem</div>
            <Select style={{ width: "100%" }} options={periodOptions} value={periodId} onChange={setPeriodId} />
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Kapsam</div>
            <Space>
              <Checkbox checked={includeRot1} onChange={(e) => setIncludeRot1(e.target.checked)}>
                Rotasyon 1
              </Checkbox>
              <Checkbox checked={includeRot2} onChange={(e) => setIncludeRot2(e.target.checked)}>
                Rotasyon 2
              </Checkbox>
            </Space>

            <div style={{ marginTop: 8 }}>
              <Checkbox checked={replace} onChange={(e) => setReplace(e.target.checked)}>
                Var olan atamaları silip yeniden üret (replace)
              </Checkbox>
            </div>
          </div>

          {/* ✅ İşlemler + SEED sağda */}
          <div style={{ minWidth: 540, flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>İşlemler</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <Space>
                <Button onClick={() => setLastSeed(Date.now())}>Karıştır</Button>
                <Button onClick={doPreview}>Önizleme</Button>
                <Button type="primary" onClick={doApply} disabled={!lastSeed}>
                  Uygula
                </Button>
              </Space>

              <div style={{ marginLeft: 18, textAlign: "right", whiteSpace: "nowrap" }}>
                {lastSeed ? (
                  <span>
                    <b>Geçerli kura kimliği:</b> SEED={lastSeed}
                  </span>
                ) : (
                  <span style={{ opacity: 0.7 }}>
                    Önce <b>Önizleme</b> yapın
                  </span>
                )}
              </div>
            </div>
          </div>
        </Space>

        {/* ✅ ÖZET: Rotasyon bazlı Gün + Hastane sayıları (preview üzerinden) */}
        {!!periodId && (
          <div style={{ marginTop: 14 }}>
            <Divider style={{ margin: "10px 0" }} />
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
              Rotasyon bazlı Gün + Hastane öğrenci sayısı (Önizleme)
            </div>

            {!sortedPreview?.length ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Önizleme yok</div>
            ) : !summaryByRotation ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Atama yok</div>
            ) : (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {summaryByRotation.map((rotBlock) => (
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
        )}
      </Card>

      <Divider />

      <Table rowKey={(r) => r._rowKey} columns={columns} dataSource={sortedPreview} />
    </div>
  );
}
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Input,
  Space,
  Table,
  Tag,
  Drawer,
  Typography,
  Divider,
  Empty,
  Alert,
  Collapse,
  Rate,
  Spin,
} from "antd";
import api from "../api";

const { Title, Text } = Typography;

const WEEK_COUNT = 17;

const WEEK_OPTIONS = [{ value: "ALL", label: "Tüm Haftalar" }].concat(
  Array.from({ length: WEEK_COUNT }, (_, i) => ({
    value: i + 1,
    label: `Hafta ${i + 1}`,
  }))
);

function cellStyle(item) {
  if (item?.isExam) return { background: "#fffbe6", border: "1px solid #ffe58f" };
  if (item?.evalDone) return { background: "#f6ffed", border: "1px solid #b7eb8f" };
  if (item?.practiceAbsent) return { background: "#fff1f0", border: "1px solid #ffa39e" };
  if (item?.practicePresent && !item?.evalDone) {
    return { background: "#fff7e6", border: "1px solid #ffd591" };
  }
  return { background: "#fafafa", border: "1px solid #f0f0f0" };
}

function buildWeekCell(item) {
  if (!item) {
    return (
      <div
        style={{
          borderRadius: 8,
          padding: 6,
          minHeight: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          background: "#fafafa",
          border: "1px solid #f0f0f0",
        }}
      >
        -
      </div>
    );
  }

  if (item.isExam) {
    return (
      <div
        style={{
          ...cellStyle(item),
          borderRadius: 8,
          padding: 6,
          minHeight: 68,
          fontSize: 11,
        }}
      >
        <div style={{ fontWeight: 700, color: "#ad6800" }}>Sınav</div>
        <div>{item.examLabel || "-"}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...cellStyle(item),
        borderRadius: 8,
        padding: 6,
        minHeight: 68,
        fontSize: 11,
        lineHeight: 1.25,
      }}
    >
      <div>
        <b>UY:</b> {item.practicePresent ? "Geldi" : item.practiceAbsent ? "Yok" : "-"}
      </div>
      <div>
        <b>D:</b> {item.evalDone ? "Var" : "-"}
      </div>
      <div>
        <b>P:</b> {item.evalScore ?? "-"}
      </div>
    </div>
  );
}

export default function EvalControlPanel() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const [weekFilter, setWeekFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [periodMeta, setPeriodMeta] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);

  const [weekDetailOpen, setWeekDetailOpen] = useState(false);
  const [weekDetailLoading, setWeekDetailLoading] = useState(false);
  const [weekDetail, setWeekDetail] = useState(null);
  const [weekDetailMeta, setWeekDetailMeta] = useState(null);

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    const list = data || [];
    setPeriods(list);

    if (!periodId && list.length) {
      const first = list[0];
      setPeriodId(first.id);
      setWeekFilter(first.currentWeekNo || "ALL");
    }
  }

  async function loadPanel() {
    if (!periodId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/teacher/eval-control?periodId=${encodeURIComponent(periodId)}`
      );
      setRows(data?.items || []);
      setStats(data?.stats || null);
      setPeriodMeta(data?.period || null);
    } catch {
      setRows([]);
      setStats(null);
      setPeriodMeta(null);
    } finally {
      setLoading(false);
    }
  }

  const openWeekDetail = useCallback(
    async (row, weekItem) => {
      if (!row || !weekItem) return;
      if (!weekItem.rotationNo) return;
      if (weekItem.isExam) return;
      if (!weekItem.practiceRelevant) return;
      if (!periodId) return;

      setWeekDetailLoading(true);
      setWeekDetailOpen(true);
      setWeekDetail(null);
      setWeekDetailMeta({
        studentId: row.studentId,
        studentNo: row.studentNo,
        nameSurname: row.nameSurname,
        weekNo: weekItem.weekNo,
        rotationNo: weekItem.rotationNo,
        rot1HospitalName: row.rot1HospitalName,
        rot2HospitalName: row.rot2HospitalName,
        rot1UnitName: row.rot1UnitName,
        rot2UnitName: row.rot2UnitName,
      });

      try {
        const { data } = await api.get(
          `/teacher/eval-form?periodId=${encodeURIComponent(
            periodId
          )}&studentId=${encodeURIComponent(
            row.studentId
          )}&weekNo=${encodeURIComponent(
            weekItem.weekNo
          )}&rotationNo=${encodeURIComponent(weekItem.rotationNo)}`
        );

        setWeekDetail(data || null);
      } catch {
        setWeekDetail(null);
      } finally {
        setWeekDetailLoading(false);
      }
    },
    [periodId]
  );

  useEffect(() => {
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!periodId || !periods.length) return;
    const p = periods.find((x) => x.id === periodId);
    if (p?.currentWeekNo) setWeekFilter(p.currentWeekNo);
  }, [periodId, periods]);

  useEffect(() => {
    loadPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  const filteredRows = useMemo(() => {
    let list = [...rows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          String(r.nameSurname || "").toLowerCase().includes(q) ||
          String(r.studentNo || "").toLowerCase().includes(q) ||
          String(r.rot1HospitalName || "").toLowerCase().includes(q) ||
          String(r.rot2HospitalName || "").toLowerCase().includes(q)
      );
    }

    if (weekFilter !== "ALL") {
      const w = Number(weekFilter);
      list = list.filter((r) => (r.weeks || []).some((x) => Number(x.weekNo) === w));
    }

    return list;
  }, [rows, search, weekFilter]);

  const columns = useMemo(() => {
    const weekCols =
      weekFilter === "ALL"
        ? Array.from({ length: WEEK_COUNT }, (_, i) => i + 1).map((w) => ({
            title: `H${w}`,
            width: 82,
            render: (_, row) => {
              const item = (row.weeks || []).find((x) => Number(x.weekNo) === w);
              return (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    openWeekDetail(row, item);
                  }}
                >
                  {buildWeekCell(item)}
                </div>
              );
            },
          }))
        : [
            {
              title: `H${weekFilter}`,
              width: 90,
              render: (_, row) => {
                const item = (row.weeks || []).find(
                  (x) => Number(x.weekNo) === Number(weekFilter)
                );
                return (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openWeekDetail(row, item);
                    }}
                  >
                    {buildWeekCell(item)}
                  </div>
                );
              },
            },
          ];

    return [
      {
        title: "Öğrenci",
        width: 150,
        fixed: "left",
        render: (_, r) => (
          <div>
            <div style={{ fontWeight: 700 }}>{r.nameSurname}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{r.studentNo}</div>
          </div>
        ),
      },
      {
        title: "R1",
        width: 140,
        render: (_, r) => (
          <div>
            <div>{r.rot1HospitalName || "-"}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{r.rot1UnitName || "-"}</div>
          </div>
        ),
      },
      {
        title: "R2",
        width: 140,
        render: (_, r) => (
          <div>
            <div>{r.rot2HospitalName || "-"}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{r.rot2UnitName || "-"}</div>
          </div>
        ),
      },
      ...weekCols,
      {
        title: "Genel",
        width: 150,
        fixed: "right",
        render: (_, r) => (
          <div style={{ fontSize: 12 }}>
            <div>
              <b>Ort:</b> {r.summary?.evalAverage ?? "-"}
            </div>
            <div>
              <b>Eksik:</b> {r.summary?.missingEvalCount ?? 0}
            </div>
            <div>
              <b>R1 Kapsam:</b> {r.summary?.rot1Coverage ?? 0}
            </div>
            <div>
              <b>R2 Kapsam:</b> {r.summary?.rot2Coverage ?? 0}
            </div>
            <div style={{ marginTop: 4 }}>
              {r.summary?.riskLabel ? (
                <Tag color="red">{r.summary.riskLabel}</Tag>
              ) : (
                <Tag color="green">Normal</Tag>
              )}
            </div>
          </div>
        ),
      },
    ];
  }, [weekFilter, openWeekDetail]);

  const weeklyTotalScore = useMemo(() => {
    if (!weekDetail?.snapshot) return 0;

    return Number(
      (weekDetail.snapshot?.groups || [])
        .reduce((groupAcc, g) => {
          const groupEarned = (g.items || []).reduce((itemAcc, it) => {
            const rawScore = Number(weekDetail.currentWeekScores?.[it.id] || 0);
            const weight = Number(it.points || 0);
            return itemAcc + (rawScore / 5) * weight;
          }, 0);

          return groupAcc + groupEarned;
        }, 0)
        .toFixed(2)
    );
  }, [weekDetail]);

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card>
          <Space wrap>
            <Select
              style={{ width: 280 }}
              value={periodId}
              onChange={setPeriodId}
              options={(periods || []).map((p) => ({
                value: p.id,
                label: `${p.academicYear} · ${p.term} · ${p.course?.name || ""}`,
              }))}
            />

            <Select
              style={{ width: 160 }}
              value={weekFilter}
              onChange={setWeekFilter}
              options={WEEK_OPTIONS}
            />

            <Input.Search
              allowClear
              placeholder="Öğrenci / no / hastane ara"
              style={{ width: 280 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {periodMeta ? (
              <Tag color="purple">Aktif Hafta: {periodMeta.currentWeekNo}</Tag>
            ) : null}
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic title="Toplam Öğrenci" value={stats?.totalStudents ?? 0} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title="Tamamlanan Değerlendirme"
                value={stats?.completedEvalCount ?? 0}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title="Bekleyen Değerlendirme"
                value={stats?.pendingEvalCount ?? 0}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title="Eksik Değerlendirme"
                value={stats?.missingEvalCount ?? 0}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Değerlendirme Kontrol Paneli">
          <Alert
            showIcon
            type="info"
            style={{ marginBottom: 12 }}
            message="Bir satıra tıklayarak öğrencinin değerlendirme detaylarını sağ panelde açabilirsiniz."
          />

          <Table
            rowKey="studentId"
            loading={loading}
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 2100 }}
            onRow={(record) => ({
              onClick: () => {
                setActiveRow(record);
                setDrawerOpen(true);
              },
              style: { cursor: "pointer" },
            })}
          />
        </Card>
      </Space>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={960}
        title="Öğrenci Değerlendirme Detayı"
        destroyOnClose
      >
        {!activeRow ? (
          <Empty description="Öğrenci seçilmedi" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card>
              <Title level={4} style={{ marginTop: 0 }}>
                {activeRow.nameSurname}
              </Title>
              <Space wrap>
                <Tag>{activeRow.studentNo}</Tag>
                <Tag color="blue">R1: {activeRow.rot1HospitalName || "-"}</Tag>
                <Tag color="purple">R2: {activeRow.rot2HospitalName || "-"}</Tag>
                {activeRow.summary?.riskLabel ? (
                  <Tag color="red">{activeRow.summary.riskLabel}</Tag>
                ) : null}
              </Space>

              <Divider />

              <Row gutter={[12, 12]}>
                <Col span={6}>
                  <Statistic
                    title="Eval Ortalaması"
                    value={activeRow.summary?.evalAverage ?? "-"}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Eksik Eval"
                    value={activeRow.summary?.missingEvalCount ?? 0}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="R1 Kapsam"
                    value={activeRow.summary?.rot1Coverage ?? 0}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="R2 Kapsam"
                    value={activeRow.summary?.rot2Coverage ?? 0}
                  />
                </Col>
              </Row>
            </Card>

            <Card title="Hafta Durumları">
              <Row gutter={[12, 12]}>
                {Array.from({ length: WEEK_COUNT }, (_, i) => i + 1).map((w) => {
                  const item = (activeRow.weeks || []).find((x) => Number(x.weekNo) === w);
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={w}>
                      <Card size="small" bodyStyle={{ padding: 10 }}>
                        <div style={{ marginBottom: 6, fontWeight: 700 }}>Hafta {w}</div>
                        <div
                          onClick={() => openWeekDetail(activeRow, item)}
                          style={{
                            cursor:
                              item?.practiceRelevant && !item?.isExam
                                ? "pointer"
                                : "default",
                          }}
                        >
                          {buildWeekCell(item)}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          {item?.isExam ? (
                            <Tag color="gold">{item.examLabel || "Sınav"}</Tag>
                          ) : item?.evalDone ? (
                            <Tag color="green">Değerlendirildi</Tag>
                          ) : item?.practicePresent ? (
                            <Tag color="orange">Bekliyor</Tag>
                          ) : (
                            <Tag>İşlem Yok</Tag>
                          )}
                        </div>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        open={weekDetailOpen}
        onClose={() => setWeekDetailOpen(false)}
        width={900}
        title="Haftalık Değerlendirme Detayı"
        destroyOnClose
      >
        {weekDetailLoading ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <Spin />
          </div>
        ) : !weekDetailMeta ? (
          <Empty description="Hafta seçilmedi" />
        ) : !weekDetail?.snapshot ? (
          <Empty description="Bu hafta için değerlendirme formu bulunamadı" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card>
              <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                {weekDetailMeta.nameSurname}
              </Title>

              <Space wrap>
                <Tag>{weekDetailMeta.studentNo}</Tag>
                <Tag color="blue">Hafta {weekDetailMeta.weekNo}</Tag>
                <Tag color="purple">Rotasyon {weekDetailMeta.rotationNo}</Tag>
                <Tag>
                  {weekDetailMeta.rotationNo === 1
                    ? `${weekDetailMeta.rot1HospitalName || "-"} / ${weekDetailMeta.rot1UnitName || "-"}`
                    : `${weekDetailMeta.rot2HospitalName || "-"} / ${weekDetailMeta.rot2UnitName || "-"}`}
                </Tag>

                <Tag color="green">Haftalık Toplam: {weeklyTotalScore}</Tag>
              </Space>

              <Divider />

              <Space wrap>
                <Tag color="geekblue">
                  Rotasyon Haftaları: {(weekDetail.rotationWeeks || []).join(", ") || "-"}
                </Tag>
              </Space>
            </Card>

            <Card title="Madde Bazlı Değerlendirme">
              <Collapse
                accordion={false}
                items={(weekDetail.snapshot?.groups || []).map((g) => {
                  const groupEarned = (g.items || []).reduce((acc, it) => {
                    const rawScore = Number(weekDetail.currentWeekScores?.[it.id] || 0);
                    const weight = Number(it.points || 0);
                    return acc + (rawScore / 5) * weight;
                  }, 0);

                  return {
                    key: g.id,
                    label: (
                      <Space wrap>
                        <span style={{ fontWeight: 700 }}>{`${g.orderNo ?? ""}. ${g.title}`}</span>
                        <Tag color="blue">Toplam: {g.totalPoints ?? 0}</Tag>
                        <Tag color="green">Alınan: {Number(groupEarned.toFixed(2))}</Tag>
                      </Space>
                    ),
                    children: (
                      <Space direction="vertical" style={{ width: "100%" }} size={12}>
                        {(g.items || []).map((it) => {
                          const score = Number(weekDetail.currentWeekScores?.[it.id] || 0);

                          let coveredCount = 0;
                          for (const w of weekDetail.rotationWeeks || []) {
                            const s = Number(weekDetail.scoresByWeek?.[w]?.[it.id] || 0);
                            if (s > 0) coveredCount++;
                          }

                          return (
                            <Card
                              key={it.id}
                              size="small"
                              bodyStyle={{ padding: 12 }}
                              style={{
                                background: score > 0 ? "#f6ffed" : "#fafafa",
                                borderColor: score > 0 ? "#b7eb8f" : "#f0f0f0",
                              }}
                            >
                              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
                                  <Text strong>{it.text}</Text>
                                  <Space wrap>
                                    <Tag color={score > 0 ? "green" : "default"}>
                                      Bu Hafta: {score}/5
                                    </Tag>
                                    <Tag color="blue">Ağırlık: {it.points ?? 0}</Tag>
                                    <Tag color={coveredCount > 0 ? "green" : "default"}>
                                      Kapsam: {coveredCount}/{(weekDetail.rotationWeeks || []).length || "-"}
                                    </Tag>
                                  </Space>
                                </Space>

                                <div>
                                  <Rate count={5} value={score} disabled />
                                </div>
                              </Space>
                            </Card>
                          );
                        })}
                      </Space>
                    ),
                  };
                })}
              />
            </Card>

            {weekDetail.snapshot?.openQuestionText ? (
              <Card title="Açık Soru / Serbest Not Alanı">
                <Text>{weekDetail.snapshot.openQuestionText}</Text>
              </Card>
            ) : null}
          </Space>
        )}
      </Drawer>
    </div>
  );
}
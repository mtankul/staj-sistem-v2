//:\staj-sistem-v2\client\src\pages\CoordinatorControlPanel.jsx

import React, { useEffect, useMemo, useState } from "react";
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
  Spin,
} from "antd";
import api from "../api";

const { Text, Title } = Typography;

const WEEK_COUNT = 17;

const STATUS_META = {
  DRAFT: { color: "default", label: "Taslak" },
  SUBMITTED: { color: "blue", label: "Gönderildi" },
  RESUBMITTED: { color: "cyan", label: "Yeniden Gönderildi" },
  REVISION_REQUESTED: { color: "orange", label: "Düzeltme" },
  APPROVED: { color: "green", label: "Onaylandı" },
};

function LegendBadge({ color, label, borderColor = color }) {
  return (
    <Space size={8}>
      <span
        style={{
          width: 14,
          height: 14,
          display: "inline-block",
          borderRadius: 4,
          background: color,
          border: `1px solid ${borderColor}`,
        }}
      />
      <span style={{ fontSize: 12, color: "#334155" }}>{label}</span>
    </Space>
  );
}


function statusTag(status) {
  const meta = STATUS_META[status] || { color: "default", label: status || "-" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function getWeekKind(item, currentWeekNo) {
  const current = Number(currentWeekNo || 0);
  const weekNo = Number(item?.weekNo || 0);

  if (!item) return "EMPTY";
  if (item?.isExam) return "EXAM";
  if (current > 0 && weekNo > current) return "FUTURE";
  if (item?.practiceRelevant === false) return "OUTSIDE_ROTATION";
  return "NORMAL";
}

function cellStyle(item, currentWeekNo) {
  const kind = getWeekKind(item, currentWeekNo);

  if (kind === "EXAM") {
    return { background: "#fffbe6", border: "1px solid #ffe58f" };
  }

  if (kind === "OUTSIDE_ROTATION") {
    return { background: "#f9f0ff", border: "1px solid #d3adf7" };
  }

  if (kind === "FUTURE") {
    return { background: "#f0f5ff", border: "1px solid #adc6ff" };
  }

  if (item?.reportStatus === "APPROVED") {
    return { background: "#f6ffed", border: "1px solid #b7eb8f" };
  }

  if (item?.reportStatus === "REVISION_REQUESTED") {
    return { background: "#fff7e6", border: "1px solid #ffd591" };
  }

  if (item?.reportStatus === "SUBMITTED" || item?.reportStatus === "RESUBMITTED") {
    return { background: "#e6f4ff", border: "1px solid #91caff" };
  }

  if (item?.practiceAbsent === true) {
    return { background: "#fff1f0", border: "1px solid #ffa39e" };
  }

  return { background: "#fafafa", border: "1px solid #f0f0f0" };
}

function tinyBadge(label, value, color = "#555") {
  return (
    <div style={{ fontSize: 11, color, lineHeight: 1.2 }}>
      <b>{label}:</b> {value}
    </div>
  );
}

function buildWeekCell(weekItem, currentWeekNo) {
  const kind = getWeekKind(weekItem, currentWeekNo);

  if (kind === "EMPTY") {
    return (
      <div
        style={{
          borderRadius: 8,
          padding: 6,
          minHeight: 72,
          fontSize: 12,
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

  if (kind === "EXAM") {
    return (
      <div
        style={{
          ...cellStyle(weekItem, currentWeekNo),
          borderRadius: 8,
          padding: 6,
          minHeight: 72,
          fontSize: 11,
        }}
      >
        <div style={{ fontWeight: 700, color: "#ad6800" }}>Sınav</div>
        <div>{weekItem?.examLabel || "-"}</div>
        <div>Rapor Yok</div>
      </div>
    );
  }

  if (kind === "OUTSIDE_ROTATION") {
    return (
      <div
        style={{
          ...cellStyle(weekItem, currentWeekNo),
          borderRadius: 8,
          padding: 6,
          minHeight: 72,
          fontSize: 11,
          lineHeight: 1.25,
        }}
      >
        <div style={{ fontWeight: 700, color: "#531dab" }}>Rotasyon Dışı</div>
        <div>Uygulama yok</div>
        <div>Rapor yazılmaz</div>
      </div>
    );
  }

  if (kind === "FUTURE") {
    return (
      <div
        style={{
          ...cellStyle(weekItem, currentWeekNo),
          borderRadius: 8,
          padding: 6,
          minHeight: 72,
          fontSize: 11,
          lineHeight: 1.25,
        }}
      >
        <div style={{ fontWeight: 700, color: "#1d39c4" }}>Gelecek Hafta</div>
        <div>Henüz gelinmedi</div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...cellStyle(weekItem, currentWeekNo),
        borderRadius: 8,
        padding: 6,
        minHeight: 72,
        fontSize: 11,
        lineHeight: 1.25,
      }}
    >
      {tinyBadge("TY", weekItem.theoryPresent ? "Geldi" : weekItem.theoryAbsent ? "Yok" : "-", "#444")}
      {tinyBadge("UY", weekItem.practicePresent ? "Geldi" : weekItem.practiceAbsent ? "Yok" : "-", "#444")}
      {tinyBadge(
        "R",
        weekItem.reportStatus === "APPROVED"
          ? "Onay"
          : weekItem.reportStatus === "REVISION_REQUESTED"
            ? "Düzelt"
            : weekItem.reportStatus === "SUBMITTED"
              ? "Gönder"
              : weekItem.reportStatus === "RESUBMITTED"
                ? "Tekrar"
                : "-",
        "#444"
      )}
      {tinyBadge("P", weekItem.reportScore ?? "-", "#444")}
    </div>
  );
}

export default function CoordinatorControlPanel() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [periodMeta, setPeriodMeta] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);

  const [reportDetailOpen, setReportDetailOpen] = useState(false);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportDetail, setReportDetail] = useState(null);
  const [reportDetailMeta, setReportDetailMeta] = useState(null);

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    const list = data || [];
    setPeriods(list);

    if (!periodId && list.length) {
      const first = list[0];
      setPeriodId(first.id);
    }
  }

  async function openReportDetail(row, weekItem) {
    const kind = getWeekKind(weekItem, periodMeta?.currentWeekNo);

    if (!row || !weekItem) return;
    if (kind === "EXAM") return;
    if (kind === "OUTSIDE_ROTATION") return;
    if (kind === "FUTURE") return;
    if (!weekItem.weekNo) return;
    if (!periodId) return;

    setReportDetailLoading(true);
    setReportDetailOpen(true);
    setReportDetail(null);

    setReportDetailMeta({
      studentId: row.studentId,
      nameSurname: row.nameSurname,
      studentNo: row.studentNo,
      weekNo: weekItem.weekNo,
    });

    try {
      const { data } = await api.get(
        `/teacher/report-scores/detail?periodId=${encodeURIComponent(periodId)}&studentId=${encodeURIComponent(
          row.studentId
        )}&weekNo=${encodeURIComponent(weekItem.weekNo)}`
      );

      setReportDetail(data || null);
    } catch {
      setReportDetail(null);
    } finally {
      setReportDetailLoading(false);
    }
  }

  async function loadPanel() {
    if (!periodId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/teacher/coordinator-control?periodId=${encodeURIComponent(periodId)}`
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

  useEffect(() => {
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          String(r.rot2HospitalName || "").toLowerCase().includes(q) ||
          String(r.rot1UnitName || "").toLowerCase().includes(q) ||
          String(r.rot2UnitName || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "ALL") {
      list = list.filter((r) =>
        (r.weeks || []).some((x) => {
          const kind = getWeekKind(x, periodMeta?.currentWeekNo);

          if (statusFilter === "MISSING_REPORT") {
            return kind === "NORMAL" && x.practicePresent && !x.reportStatus;
          }

          if (statusFilter === "ABSENT") {
            return kind === "NORMAL" && x.practiceAbsent === true;
          }

          return kind === "NORMAL" && x.reportStatus === statusFilter;
        })
      );
    }

    return list;
  }, [rows, search, statusFilter, periodMeta]);

  const columns = useMemo(() => {
    const weekCols = Array.from({ length: WEEK_COUNT }, (_, i) => {
      const w = i + 1;

      return {
        title: `H${w}`,
        dataIndex: `week_${w}`,
        width: 82,
        render: (_, row) => {
          const item = (row.weeks || []).find((x) => Number(x.weekNo) === w);
          const kind = getWeekKind(item, periodMeta?.currentWeekNo);
          const clickable = kind === "NORMAL";

          return (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (clickable) {
                  openReportDetail(row, item);
                }
              }}
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              {buildWeekCell(item, periodMeta?.currentWeekNo)}
            </div>
          );
        },
      };
    });

    return [
      {
        title: "Öğrenci",
        width: 150,
        fixed: "left",
        ellipsis: true,
        render: (_, r) => (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={r.nameSurname}
            >
              {r.nameSurname}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#666",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={r.studentNo}
            >
              {r.studentNo}
            </div>
          </div>
        ),
      },
      {
        title: "Rot-1",
        width: 140,
        ellipsis: true,
        render: (_, r) => (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={r.rot1HospitalName || "-"}
            >
              {r.rot1HospitalName || "-"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#666",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={r.rot1UnitName || "-"}
            >
              {r.rot1UnitName || "-"}
            </div>
          </div>
        ),
      },
      {
        title: "Rot-2",
        width: 140,
        ellipsis: true,
        render: (_, r) => (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={r.rot2HospitalName || "-"}
            >
              {r.rot2HospitalName || "-"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#666",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={r.rot2UnitName || "-"}
            >
              {r.rot2UnitName || "-"}
            </div>
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
              <b>Ort:</b> {r.summary?.reportAverage ?? "-"}
            </div>
            <div>
              <b>TY Eksik:</b> {r.summary?.theoryMissingCount ?? 0}
            </div>
            <div>
              <b>UY Eksik:</b> {r.summary?.practiceMissingCount ?? 0}
            </div>
            <div>
              <b>Rapor Eksik:</b> {r.summary?.missingReports ?? 0}
            </div>
            <div style={{ marginTop: 4 }}>
              {r.summary?.riskLabel ? <Tag color="red">{r.summary.riskLabel}</Tag> : <Tag color="green">Normal</Tag>}
            </div>
          </div>
        ),
      },
    ];
  }, [openReportDetail, periodMeta?.currentWeekNo]);

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card>
          <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
            <Space wrap>
              <Select
                style={{ width: 280 }}
                value={periodId}
                onChange={setPeriodId}
                placeholder="Dönem seç"
                options={(periods || []).map((p) => ({
                  value: p.id,
                  label: `${p.academicYear} · ${p.term} · ${p.course?.name || ""}`,
                }))}
              />

              <Select
                style={{ width: 220 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "ALL", label: "Tüm Durumlar" },
                  { value: "SUBMITTED", label: "Gönderildi" },
                  { value: "RESUBMITTED", label: "Yeniden Gönderildi" },
                  { value: "REVISION_REQUESTED", label: "Düzeltme Bekliyor" },
                  { value: "APPROVED", label: "Onaylandı" },
                  { value: "MISSING_REPORT", label: "Rapor Eksik" },
                  { value: "ABSENT", label: "Devamsız" },
                ]}
              />

              <Input.Search
                allowClear
                placeholder="Öğrenci / no / hastane / birim ara"
                style={{ width: 280 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {periodMeta ? <Tag color="purple">Aktif Hafta: {periodMeta.currentWeekNo}</Tag> : null}
            </Space>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card><Statistic title="Toplam Öğrenci" value={stats?.totalStudents ?? 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card><Statistic title="Gönderilen" value={stats?.submittedCount ?? 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card><Statistic title="Düzeltme" value={stats?.revisionCount ?? 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card><Statistic title="Onaylanan" value={stats?.approvedCount ?? 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card><Statistic title="Eksik TY" value={stats?.theoryMissingCount ?? 0} /></Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card><Statistic title="Eksik UY" value={stats?.practiceMissingCount ?? 0} /></Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card><Statistic title="Eksik Rapor" value={stats?.missingReports ?? 0} /></Card>
          </Col>
        </Row>

        <Card title="Koordinatör Kontrol Paneli">

          <Space wrap size={[16, 10]} style={{ marginBottom: 12 }}>
            <LegendBadge color="#fffbe6" borderColor="#ffe58f" label="Sınav Haftası" />
            <LegendBadge color="#f9f0ff" borderColor="#d3adf7" label="Rotasyon Dışı" />
            <LegendBadge color="#f0f5ff" borderColor="#adc6ff" label="Gelecek Hafta" />

            <LegendBadge color="#e6f4ff" borderColor="#91caff" label="Rapor Gönderildi" />
            <LegendBadge color="#f6ffed" borderColor="#b7eb8f" label="Onaylandı" />
            <LegendBadge color="#fff7e6" borderColor="#ffd591" label="Düzeltme İstendi" />

            <LegendBadge color="#fff1f0" borderColor="#ffa39e" label="Devamsız" />
            <LegendBadge color="#fafafa" borderColor="#f0f0f0" label="Rapor Yok" />
          </Space>

          <Alert
            showIcon
            type="info"
            style={{ marginBottom: 12 }}
            message="Bir satıra tıklayarak öğrencinin haftalık detaylarını sağ panelde açabilirsiniz."
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
        width={980}
        title="Öğrenci Detayı"
        destroyOnClose
      >
        {!activeRow ? (
          <Empty description="Öğrenci seçilmedi" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card>
              <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                {activeRow.nameSurname}
              </Title>
              <Space wrap>
                <Tag>{activeRow.studentNo}</Tag>
                <Tag color="blue">R1: {activeRow.rot1HospitalName || "-"}</Tag>
                <Tag color="purple">R2: {activeRow.rot2HospitalName || "-"}</Tag>
                {activeRow.summary?.riskLabel ? <Tag color="red">{activeRow.summary.riskLabel}</Tag> : null}
              </Space>

              <Divider />

              <Row gutter={[12, 12]}>
                <Col span={6}>
                  <Statistic title="Rapor Ortalaması" value={activeRow.summary?.reportAverage ?? "-"} />
                </Col>
                <Col span={6}>
                  <Statistic title="Eksik TY" value={activeRow.summary?.theoryMissingCount ?? 0} />
                </Col>
                <Col span={6}>
                  <Statistic title="Eksik UY" value={activeRow.summary?.practiceMissingCount ?? 0} />
                </Col>
                <Col span={6}>
                  <Statistic title="Eksik Rapor" value={activeRow.summary?.missingReports ?? 0} />
                </Col>
              </Row>
            </Card>

            <Card title="Hafta Durumları">
              <Row gutter={[12, 12]}>
                {Array.from({ length: WEEK_COUNT }, (_, i) => i + 1).map((w) => {
                  const item = (activeRow.weeks || []).find((x) => Number(x.weekNo) === w);
                  const kind = getWeekKind(item, periodMeta?.currentWeekNo);
                  const clickable = kind === "NORMAL";

                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={w}>
                      <Card size="small" bodyStyle={{ padding: 10 }}>
                        <div style={{ marginBottom: 6, fontWeight: 700 }}>Hafta {w}</div>

                        <div
                          onClick={() => {
                            if (clickable) openReportDetail(activeRow, item);
                          }}
                          style={{ cursor: clickable ? "pointer" : "default" }}
                        >
                          {buildWeekCell(item, periodMeta?.currentWeekNo)}
                        </div>

                        <div style={{ marginTop: 8 }}>
                          {kind === "EXAM" ? (
                            <Tag color="gold">{item?.examLabel || "Sınav"}</Tag>
                          ) : kind === "OUTSIDE_ROTATION" ? (
                            <Tag color="purple">Rotasyon Dışı</Tag>
                          ) : kind === "FUTURE" ? (
                            <Tag color="blue">Gelecek Hafta</Tag>
                          ) : item?.reportStatus ? (
                            statusTag(item.reportStatus)
                          ) : (
                            <Tag>Rapor Yok</Tag>
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
        open={reportDetailOpen}
        onClose={() => setReportDetailOpen(false)}
        width={900}
        title="Haftalık Rapor Detayı"
        destroyOnClose
      >
        {reportDetailLoading ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <Spin />
          </div>
        ) : !reportDetailMeta ? (
          <Empty description="Hafta seçilmedi" />
        ) : !reportDetail?.questions ? (
          <Empty description="Rapor bulunamadı" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card>
              <Title level={4} style={{ marginTop: 0 }}>
                {reportDetailMeta.nameSurname}
              </Title>

              <Space wrap>
                <Tag>{reportDetailMeta.studentNo}</Tag>
                <Tag color="blue">Hafta {reportDetailMeta.weekNo}</Tag>
                <Tag color="green">Toplam Puan: {reportDetail.totalScore ?? 0}</Tag>
              </Space>
            </Card>

            <Card title="Rapor Soruları">
              {(reportDetail.questions || []).map((q, index) => (
                <Card key={q.id} size="small" style={{ marginBottom: 12 }}>
                  <Text strong>
                    {index + 1}. {q.text}
                  </Text>

                  <Divider />

                  <div
                    style={{
                      background: "#fafafa",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #f0f0f0",
                      marginBottom: 12,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {q.answerText || "-"}
                  </div>

                  <Space wrap>
                    <Tag color="blue">Max: {q.points ?? 0}</Tag>
                    <Tag color="green">Puan: {q.score ?? 0}</Tag>
                  </Space>
                </Card>
              ))}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
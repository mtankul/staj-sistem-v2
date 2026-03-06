// client/src/pages/StudentWeeklyReport.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Select, Space, Typography, Button, message, Tag, Divider, Input, Alert, Switch } from "antd";
import api from "../api";
import ReactMarkdown from "react-markdown";

const { Title, Text } = Typography;

const WEEK_OPTIONS = Array.from({ length: 17 }, (_, i) => ({ value: i + 1, label: `Hafta ${i + 1}` }));

function getTextAreaDom(refObj) {
  return refObj?.resizableTextArea?.textArea || refObj?.textArea || refObj?.input || refObj || null;
}

function wrapSelection(textareaRefObj, wrapper) {
  const textareaEl = getTextAreaDom(textareaRefObj);
  if (!textareaEl) return null;

  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? 0;
  const value = textareaEl.value ?? "";

  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const next = `${before}${wrapper}${selected || ""}${wrapper}${after}`;

  const caretStart = start + wrapper.length;
  const caretEnd = caretStart + (selected ? selected.length : 0);

  requestAnimationFrame(() => {
    try {
      textareaEl.focus();
      textareaEl.setSelectionRange(caretStart, caretEnd);
    } catch {
      // noop
    }
  });

  return next;
}

function statusTag(status) {
  return <Tag>{status}</Tag>;
}

export default function StudentWeeklyReport() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState(null);
  const [weekNo, setWeekNo] = useState(1);

  const [loading, setLoading] = useState(false);

  const [meta, setMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);

  const [draft, setDraft] = useState({});

  // ✅ Preview toggle
  const [showPreview, setShowPreview] = useState(true);

  const textareaRefs = useRef({});

  async function loadPeriods() {
    const { data } = await api.get("/periods");
    const list = data || [];
    setPeriods(list);
    if (!periodId && list.length) setPeriodId(list[0].id);
  }

  async function loadWeek() {
    if (!periodId || !weekNo) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/student/report-week?periodId=${periodId}&weekNo=${weekNo}`);
      if (!data?.ok) throw new Error("Sunucu yanıtı geçersiz");

      setMeta(data.meta || null);
      setQuestions(data.questions || []);
      setAnswers(data.answers || []);

      const nextDraft = {};
      for (const a of data.answers || []) {
        if (a?.questionId) nextDraft[a.questionId] = a.answerText ?? a.answerMd ?? "";
      }
      setDraft(nextDraft);
    } catch (e) {
      message.error(e?.response?.data?.error || e.message || "Rapor yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, weekNo]);

  const canEdit = !!meta?.canEdit;
  const canSeeScores = !!meta?.canSeeScores;
  const hasQuestions = (questions || []).length > 0;

  const periodOptions = useMemo(
    () =>
      (periods || []).map((p) => ({
        value: p.id,
        label: `${p.academicYear} - ${String(p.term || "")}`,
      })),
    [periods]
  );

  async function onSave() {
    if (!periodId || !weekNo) return;
    if (!canEdit) return message.warning("Rapor kilitli. Düzenleme yapılamaz.");

    const payloadAnswers = (questions || []).map((q) => ({
      questionId: q.id,
      answerText: String(draft[q.id] ?? ""),
    }));

    setLoading(true);
    try {
      await api.put("/student/report-week", { periodId, weekNo, answers: payloadAnswers });
      message.success("Taslak kaydedildi");
      await loadWeek();
    } catch (e) {
      message.error(e?.response?.data?.error || "Kaydetme başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (!periodId || !weekNo) return;
    if (!canEdit) return message.warning("Rapor kilitli. Gönderilemez.");

    setLoading(true);
    try {
      await api.post("/student/report-week/submit", { periodId, weekNo });
      message.success("Rapor gönderildi ve kilitlendi");
      await loadWeek();
    } catch (e) {
      message.error(e?.response?.data?.error || "Gönderme başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Card>
          <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
            <Space wrap>
              <div>
                <Text type="secondary">Dönem</Text>
                <div style={{ marginTop: 6 }}>
                  <Select
                    style={{ width: 260 }}
                    value={periodId}
                    onChange={setPeriodId}
                    options={periodOptions}
                    placeholder="Dönem seç"
                  />
                </div>
              </div>

              <div>
                <Text type="secondary">Hafta</Text>
                <div style={{ marginTop: 6 }}>
                  <Select style={{ width: 160 }} value={weekNo} onChange={setWeekNo} options={WEEK_OPTIONS} />
                </div>
              </div>

              <div>
                <Text type="secondary">Durum</Text>
                <div style={{ marginTop: 10 }}>{statusTag(meta?.status || "DRAFT")}</div>
              </div>

              {meta?.exam ? (
                <div>
                  <Text type="secondary">Sınav</Text>
                  <div style={{ marginTop: 10 }}>
                    <Tag>{meta.exam}</Tag>
                  </div>
                </div>
              ) : null}

              {canSeeScores && (meta?.totalScore ?? null) !== null ? (
                <div>
                  <Text type="secondary">Toplam</Text>
                  <div style={{ marginTop: 10 }}>
                    <Tag>{meta.totalScore}</Tag>
                  </div>
                </div>
              ) : null}
            </Space>

            <Space>
              <Space align="center">
                <Text type="secondary">Önizleme</Text>
                <Switch checked={showPreview} onChange={setShowPreview} />
              </Space>

              <Button onClick={loadWeek} loading={loading}>
                Yenile
              </Button>
              <Button onClick={onSave} disabled={!canEdit || loading || !hasQuestions}>
                Kaydet
              </Button>
              <Button type="primary" onClick={onSubmit} disabled={!canEdit || loading || !hasQuestions}>
                Gönder
              </Button>
            </Space>
          </Space>

          {!canEdit ? (
            <div style={{ marginTop: 12 }}>
              <Alert
                type="info"
                showIcon
                message="Bu rapor kilitli. Öğretmen düzeltmeye gönderirse tekrar düzenleyebilirsiniz."
              />
            </div>
          ) : null}

          {meta?.revisionNote ? (
            <div style={{ marginTop: 12 }}>
              <Alert type="warning" showIcon message="Düzeltme Notu" description={meta.revisionNote} />
            </div>
          ) : null}
        </Card>

        <Card>
          <Title level={4} style={{ marginTop: 0 }}>
            Haftalık Rapor
          </Title>

          {!hasQuestions ? (
            <Alert type="warning" showIcon message="Bu döneme ait rapor soruları bulunamadı (snapshot yok)." />
          ) : (
            <>
              {(questions || []).map((q, idx) => {
                const existing = (answers || []).find((a) => a.questionId === q.id);
                const value = String(draft[q.id] ?? "");

                return (
                  <Card key={q.id} style={{ marginBottom: 12 }}>
                    <Space direction="vertical" style={{ width: "100%" }} size={10}>
                      <div>
                        <Text type="secondary">Soru {idx + 1}</Text>
                        <div style={{ fontSize: 16, marginTop: 4 }}>{q.text}</div>
                      </div>

                      <Space wrap>
                        <Button
                          size="small"
                          disabled={!canEdit}
                          onClick={() => {
                            const refObj = textareaRefs.current[q.id];
                            const next = wrapSelection(refObj, "**");
                            if (typeof next === "string") setDraft((p) => ({ ...p, [q.id]: next }));
                          }}
                        >
                          B
                        </Button>

                        <Button
                          size="small"
                          disabled={!canEdit}
                          onClick={() => {
                            const refObj = textareaRefs.current[q.id];
                            const next = wrapSelection(refObj, "*");
                            if (typeof next === "string") setDraft((p) => ({ ...p, [q.id]: next }));
                          }}
                        >
                          I
                        </Button>

                        <Text type="secondary">Not: Bu editör Markdown yazar. Aşağıda önizlemede kalın/italik görünür.</Text>
                      </Space>

                      <div>
                        <Text type="secondary">Cevap</Text>
                        <Input.TextArea
                          ref={(el) => (textareaRefs.current[q.id] = el)}
                          value={value}
                          onChange={(e) => setDraft((p) => ({ ...p, [q.id]: e.target.value }))}
                          autoSize={{ minRows: 4, maxRows: 10 }}
                          disabled={!canEdit}
                          placeholder="Cevabınızı yazınız..."
                          style={{ marginTop: 6 }}
                        />
                      </div>

                      {showPreview ? (
                        <div style={{ marginTop: 6 }}>
                          <Text type="secondary">Önizleme</Text>
                          <div
                            style={{
                              marginTop: 6,
                              padding: 12,
                              border: "1px solid rgba(0,0,0,.08)",
                              borderRadius: 8,
                              background: "#fafafa",
                              whiteSpace: "normal",
                            }}
                          >
                            {value?.trim() ? <ReactMarkdown>{value}</ReactMarkdown> : <Text type="secondary">-</Text>}
                          </div>
                        </div>
                      ) : null}

                      {canSeeScores ? (
                        <>
                          <Divider style={{ margin: "10px 0" }} />

                          <Space wrap>
                            <Text type="secondary">Soru Puanı:</Text>
                            <Tag>{existing?.teacherScore ?? "-"}</Tag>
                          </Space>

                          <div>
                            <Text type="secondary">Hoca Yorumu</Text>
                            <div style={{ marginTop: 6 }}>
                              {existing?.teacherComment ? (
                                <div style={{ whiteSpace: "pre-wrap" }}>{existing.teacherComment}</div>
                              ) : (
                                <Text type="secondary">-</Text>
                              )}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </Space>
                  </Card>
                );
              })}
            </>
          )}
        </Card>
      </Space>
    </div>
  );
}
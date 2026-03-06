// server/src/routes/periodReport.js
import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

function calcActiveTotal(tpl) {
  return (tpl.questions || [])
    .filter((q) => q.isActive)
    .reduce((a, b) => a + Number(b.points || 0), 0);
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// GET /api/period-report?periodId=...
router.get("/", async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const snap = await prisma.periodReportSnapshot.findUnique({
    where: { periodId: String(periodId) },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });

  res.json(snap || null);
});

// POST /api/period-report/apply { periodId, templateId }
router.post("/apply", async (req, res) => {
  const { periodId, templateId } = req.body || {};
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  if (!templateId) return res.status(400).json({ error: "templateId zorunlu" });

  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const tpl = await prisma.reportTemplate.findUnique({
    where: { id: String(templateId) },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });
  if (!tpl) return res.status(404).json({ error: "Şablon bulunamadı" });

  // ✅ aktif sorular toplamı 100
  const total = calcActiveTotal(tpl);
  if (Number(total) !== 100) {
    return res.status(400).json({
      error: `Şablon döneme uygulanamaz. Aktif soruların toplamı 100 olmalı. Şu an: ${total}`,
      total,
    });
  }

  // eski snapshot varsa sil
  await prisma.periodReportSnapshot.deleteMany({
    where: { periodId: String(periodId) },
  });

  const created = await prisma.periodReportSnapshot.create({
    data: {
      periodId: String(periodId),
      totalPoints: 100,
      questions: {
        create: (tpl.questions || []).map((q) => ({
          text: q.text,
          points: q.points,
          orderNo: q.orderNo,
          isActive: q.isActive,
        })),
      },
    },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });

  res.json({ ok: true, snapshot: created });
});

// PUT /api/period-report/question/:id  (text/points/isActive/orderNo)
router.put("/question/:id", async (req, res) => {
  const { id } = req.params;
  const { text, points, isActive, orderNo } = req.body || {};

  const updated = await prisma.periodReportQuestion.update({
    where: { id: String(id) },
    data: {
      ...(text !== undefined ? { text: String(text) } : {}),
      ...(points !== undefined ? { points: num(points, 0) } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      ...(orderNo !== undefined ? { orderNo: num(orderNo, 1) } : {}),
    },
  });

  res.json({ ok: true, question: updated });
});

// GET /api/period-report/week-settings?periodId=...
router.get("/week-settings", async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const list = await prisma.periodWeekSetting.findMany({
    where: { periodId: String(periodId) },
    orderBy: { weekNo: "asc" },
  });

  res.json(list);
});

// PUT /api/period-report/week-setting  { periodId, weekNo, studentCanSeeReportScore }
router.put("/week-setting", async (req, res) => {
  const { periodId, weekNo, studentCanSeeReportScore } = req.body || {};
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  const w = Number(weekNo);
  if (!w) return res.status(400).json({ error: "weekNo zorunlu" });

  const item = await prisma.periodWeekSetting.upsert({
    where: {
      uniq_period_week: {
        periodId: String(periodId),
        weekNo: Number(w),
      },
    },
    create: {
      periodId: String(periodId),
      weekNo: Number(w),
      studentCanSeeReportScore: !!studentCanSeeReportScore,
    },
    update: {
      studentCanSeeReportScore: !!studentCanSeeReportScore,
    },
  });

  res.json({ ok: true, item });
});

export default router;
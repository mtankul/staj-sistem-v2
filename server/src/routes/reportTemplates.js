// server/src/routes/reportTemplates.js
import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

async function calcTemplateTotal(templateId) {
  const tpl = await prisma.reportTemplate.findUnique({
    where: { id: String(templateId) },
    include: { questions: true },
  });
  if (!tpl) return { ok: false, error: "Şablon bulunamadı" };

  const total = (tpl.questions || [])
    .filter((q) => q.isActive)
    .reduce((a, b) => a + Number(b.points || 0), 0);

  return { ok: true, total };
}

// GET /api/report-templates
router.get("/", async (req, res) => {
  const list = await prisma.reportTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });
  res.json(list);
});

// GET /api/report-templates/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.reportTemplate.findUnique({
    where: { id: String(id) },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });
  if (!item) return res.status(404).json({ error: "Şablon bulunamadı" });
  res.json(item);
});

// POST /api/report-templates
// body: { name, description, questions?: [{text, points, orderNo, isActive}] }
router.post("/", async (req, res) => {
  const { name, description, questions } = req.body || {};
  if (!name) return res.status(400).json({ error: "name zorunlu" });

  const created = await prisma.reportTemplate.create({
    data: {
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      questions: {
        create:
          Array.isArray(questions) && questions.length
            ? questions.map((q, idx) => ({
                text: String(q.text || `Soru ${idx + 1}`).trim(),
                points: num(q.points, 0),
                orderNo: num(q.orderNo, idx + 1),
                isActive: q.isActive === undefined ? true : !!q.isActive,
              }))
            : [
                { text: "Soru 1", points: 25, orderNo: 1, isActive: true },
                { text: "Soru 2", points: 25, orderNo: 2, isActive: true },
                { text: "Soru 3", points: 25, orderNo: 3, isActive: true },
                { text: "Soru 4", points: 25, orderNo: 4, isActive: true },
              ],
      },
    },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });

  res.json({ ok: true, item: created });
});

// PUT /api/report-templates/:id
// body: { name?, description?, isActive? }
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive } = req.body || {};

  // ✅ 100 kuralı: aktif edilirken
  if (isActive === true) {
    const chk = await calcTemplateTotal(id);
    if (!chk.ok) return res.status(404).json({ error: chk.error });
    if (Number(chk.total) !== 100) {
      return res.status(400).json({
        error: `Şablon aktif edilemez. Aktif soruların toplam ağırlığı 100 olmalı. Şu an: ${chk.total}`,
      });
    }
  }

  const updated = await prisma.reportTemplate.update({
    where: { id: String(id) },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      version: { increment: 1 },
    },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });

  res.json({ ok: true, item: updated });
});

// DELETE /api/report-templates/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.reportTemplate.delete({ where: { id: String(id) } });
  res.json({ ok: true });
});

// POST /api/report-templates/:id/questions
router.post("/:id/questions", async (req, res) => {
  const { id } = req.params;
  const { text, points, orderNo, isActive } = req.body || {};
  if (!text) return res.status(400).json({ error: "text zorunlu" });

  const q = await prisma.reportTemplateQuestion.create({
    data: {
      templateId: String(id),
      text: String(text).trim(),
      points: num(points, 0),
      orderNo: num(orderNo, 1),
      isActive: isActive === undefined ? true : !!isActive,
    },
  });

  res.json({ ok: true, question: q });
});

// PUT /api/report-templates/questions/:questionId
router.put("/questions/:questionId", async (req, res) => {
  const { questionId } = req.params;
  const { text, points, orderNo, isActive } = req.body || {};

  const q = await prisma.reportTemplateQuestion.update({
    where: { id: String(questionId) },
    data: {
      ...(text !== undefined ? { text: String(text).trim() } : {}),
      ...(points !== undefined ? { points: num(points, 0) } : {}),
      ...(orderNo !== undefined ? { orderNo: num(orderNo, 1) } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    },
  });

  res.json({ ok: true, question: q });
});

// DELETE /api/report-templates/questions/:questionId
router.delete("/questions/:questionId", async (req, res) => {
  const { questionId } = req.params;
  await prisma.reportTemplateQuestion.delete({ where: { id: String(questionId) } });
  res.json({ ok: true });
});

export default router;
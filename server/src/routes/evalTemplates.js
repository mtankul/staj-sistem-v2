import { Router } from "express";
import { prisma } from "../prisma.js";

async function calcTemplateTotal(templateId) {
  const tpl = await prisma.evalTemplate.findUnique({
    where: { id: templateId },
    include: { groups: { include: { items: true } } },
  });
  if (!tpl) return { ok: false, error: "Şablon bulunamadı" };

  const total = (tpl.groups || []).reduce((acc, g) => {
    const sumItems = (g.items || [])
      .filter((i) => i.isActive)
      .reduce((a, b) => a + Number(b.points || 0), 0);
    return acc + sumItems;
  }, 0);

  return { ok: true, total };
}


const router = Router();

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// GET /api/eval-templates
router.get("/", async (req, res) => {
  const list = await prisma.evalTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      groups: {
        orderBy: { orderNo: "asc" },
        include: { items: { orderBy: { orderNo: "asc" } } },
      },
    },
  });
  res.json(list);
});

// GET /api/eval-templates/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.evalTemplate.findUnique({
    where: { id },
    include: {
      groups: {
        orderBy: { orderNo: "asc" },
        include: { items: { orderBy: { orderNo: "asc" } } },
      },
    },
  });
  if (!item) return res.status(404).json({ error: "Şablon bulunamadı" });
  res.json(item);
});

// POST /api/eval-templates
router.post("/", async (req, res) => {
  const { name, description, openQuestionText } = req.body || {};
  if (!name) return res.status(400).json({ error: "name zorunlu" });

  const created = await prisma.evalTemplate.create({
    data: {
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      openQuestionText: openQuestionText ? String(openQuestionText) : null,
    },
  });
  res.json({ ok: true, item: created });
});

// PUT /api/eval-templates/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, openQuestionText } = req.body || {};

  // ✅ ZORUNLU 100 KURALI
  if (isActive === true) {
    const chk = await calcTemplateTotal(id);
    if (!chk.ok) return res.status(404).json({ error: chk.error });
    if (Number(chk.total) !== 100) {
      return res.status(400).json({
        error: `Şablon aktif edilemez. Aktif maddelerin toplam puanı 100 olmalı. Şu an: ${chk.total}`,
      });
    }
  }

  const updated = await prisma.evalTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      ...(openQuestionText !== undefined ? { openQuestionText: openQuestionText ? String(openQuestionText) : null } : {}),
      version: { increment: 1 },
    },
  });

  res.json({ ok: true, item: updated });
});

// DELETE /api/eval-templates/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.evalTemplate.delete({ where: { id } });
  res.json({ ok: true });
});

// POST /api/eval-templates/:id/groups
router.post("/:id/groups", async (req, res) => {
  const { id } = req.params;
  const { title, totalPoints, orderNo } = req.body || {};
  if (!title) return res.status(400).json({ error: "title zorunlu" });

  const g = await prisma.evalTemplateGroup.create({
    data: {
      templateId: id,
      title: String(title).trim(),
      totalPoints: num(totalPoints, 0),
      orderNo: num(orderNo, 1),
    },
  });

  res.json({ ok: true, group: g });
});

// PUT /api/eval-templates/groups/:groupId
router.put("/groups/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const { title, totalPoints, orderNo } = req.body || {};

  const g = await prisma.evalTemplateGroup.update({
    where: { id: groupId },
    data: {
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(totalPoints !== undefined ? { totalPoints: num(totalPoints, 0) } : {}),
      ...(orderNo !== undefined ? { orderNo: num(orderNo, 1) } : {}),
    },
  });

  res.json({ ok: true, group: g });
});

// DELETE /api/eval-templates/groups/:groupId
router.delete("/groups/:groupId", async (req, res) => {
  const { groupId } = req.params;
  await prisma.evalTemplateGroup.delete({ where: { id: groupId } }); // cascade items
  res.json({ ok: true });
});

// POST /api/eval-templates/groups/:groupId/items
router.post("/groups/:groupId/items", async (req, res) => {
  const { groupId } = req.params;
  const { text, points, orderNo, isActive } = req.body || {};
  if (!text) return res.status(400).json({ error: "text zorunlu" });

  const it = await prisma.evalTemplateItem.create({
    data: {
      groupId,
      text: String(text).trim(),
      points: num(points, 0),
      orderNo: num(orderNo, 1),
      isActive: isActive === undefined ? true : !!isActive,
    },
  });

  res.json({ ok: true, item: it });
});

// PUT /api/eval-templates/items/:itemId
router.put("/items/:itemId", async (req, res) => {
  const { itemId } = req.params;
  const { text, points, orderNo, isActive } = req.body || {};

  const it = await prisma.evalTemplateItem.update({
    where: { id: itemId },
    data: {
      ...(text !== undefined ? { text: String(text).trim() } : {}),
      ...(points !== undefined ? { points: num(points, 0) } : {}),
      ...(orderNo !== undefined ? { orderNo: num(orderNo, 1) } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    },
  });

  res.json({ ok: true, item: it });
});

// DELETE /api/eval-templates/items/:itemId
router.delete("/items/:itemId", async (req, res) => {
  const { itemId } = req.params;
  await prisma.evalTemplateItem.delete({ where: { id: itemId } });
  res.json({ ok: true });
});

export default router;
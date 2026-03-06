//periodEval.js
import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

/** Aktif item puanlarının toplamını hesapla */
function calcActiveTotal(tpl) {
  return (tpl.groups || []).reduce((acc, g) => {
    const sumItems = (g.items || [])
      .filter((i) => i.isActive)
      .reduce((a, b) => a + Number(b.points || 0), 0);
    return acc + sumItems;
  }, 0);
}

/** (Opsiyonel) Grup totalPoints ile item toplamı uyum kontrolü */
function calcGroupMismatches(tpl) {
  const mismatches = [];
  for (const g of tpl.groups || []) {
    const sumItems = (g.items || [])
      .filter((i) => i.isActive)
      .reduce((a, b) => a + Number(b.points || 0), 0);

    // totalPoints null/0 ise kıyaslamayı atlayalım
    if (g.totalPoints !== null && g.totalPoints !== undefined) {
      const expected = Number(g.totalPoints || 0);
      if (expected > 0 && expected !== Number(sumItems)) {
        mismatches.push({
          groupTitle: g.title,
          expected,
          actual: Number(sumItems),
        });
      }
    }
  }
  return mismatches;
}

// GET /api/period-eval?periodId=...
router.get("/", async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const snap = await prisma.periodEvalSnapshot.findUnique({
    where: { periodId: String(periodId) },
    include: {
      groups: {
        orderBy: { orderNo: "asc" },
        include: { items: { orderBy: { orderNo: "asc" } } },
      },
    },
  });

  res.json(snap || null);
});

// POST /api/period-eval/apply { periodId, templateId }
router.post("/apply", async (req, res) => {
  const { periodId, templateId } = req.body || {};
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  if (!templateId) return res.status(400).json({ error: "templateId zorunlu" });

  const period = await prisma.period.findUnique({
    where: { id: String(periodId) },
  });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  // (İstersen açarsın)
  // if (period.status === "ACTIVE") {
  //   return res.status(400).json({ error: "Aktif dönemde şablon yeniden uygulanamaz" });
  // }

  const tpl = await prisma.evalTemplate.findUnique({
    where: { id: String(templateId) },
    include: {
      groups: {
        orderBy: { orderNo: "asc" },
        include: { items: { orderBy: { orderNo: "asc" } } },
      },
    },
  });
  if (!tpl) return res.status(404).json({ error: "Şablon bulunamadı" });

  // ✅ ZORUNLU KURAL: aktif maddelerin toplamı 100 olmalı
  const total = calcActiveTotal(tpl);
  if (Number(total) !== 100) {
    return res.status(400).json({
      error: `Şablon döneme uygulanamaz. Aktif maddelerin toplam puanı 100 olmalı. Şu an: ${total}`,
      total,
    });
  }

  // (Opsiyonel) Grup uyumsuzluklarını uyarı olarak döndür (ENGELLEMEZ)
  const groupMismatches = calcGroupMismatches(tpl);

  // eski snapshot varsa sil (yeniden oluştur)
  await prisma.periodEvalSnapshot.deleteMany({
    where: { periodId: String(periodId) },
  });

  const created = await prisma.periodEvalSnapshot.create({
    data: {
      periodId: String(periodId),
      sourceTemplateId: tpl.id,
      sourceTemplateVersion: tpl.version,
      openQuestionText: tpl.openQuestionText || null,
      groups: {
        create: tpl.groups.map((g) => ({
          title: g.title,
          orderNo: g.orderNo,
          totalPoints: g.totalPoints,
          items: {
            create: g.items.map((it) => ({
              text: it.text,
              points: it.points,
              orderNo: it.orderNo,
              isActive: it.isActive,
            })),
          },
        })),
      },
    },
    include: {
      groups: {
        orderBy: { orderNo: "asc" },
        include: { items: { orderBy: { orderNo: "asc" } } },
      },
    },
  });

  res.json({ ok: true, snapshot: created, warnings: { groupMismatches } });
});

// PUT /api/period-eval/snapshot { periodId, openQuestionText }
router.put("/snapshot", async (req, res) => {
  const { periodId, openQuestionText } = req.body || {};
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const updated = await prisma.periodEvalSnapshot.update({
    where: { periodId: String(periodId) },
    data: { openQuestionText: openQuestionText ?? null },
  });

  res.json({ ok: true, snapshot: updated });
});

// PUT /api/period-eval/item/:id  (text/points/isActive/orderNo)
router.put("/item/:id", async (req, res) => {
  const { id } = req.params;
  const { text, points, isActive, orderNo } = req.body || {};

  const updated = await prisma.periodEvalItem.update({
    where: { id },
    data: {
      ...(text !== undefined ? { text } : {}),
      ...(points !== undefined ? { points: Number(points) } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      ...(orderNo !== undefined ? { orderNo: Number(orderNo) } : {}),
    },
  });

  res.json({ ok: true, item: updated });
});

export default router;
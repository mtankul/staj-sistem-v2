import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// GET /api/units?hospitalId=...
router.get("/", async (req, res) => {
  const { hospitalId } = req.query;

  const where = hospitalId ? { hospitalId: String(hospitalId) } : {};
  const items = await prisma.unit.findMany({
    where,
    include: { hospital: true },
    orderBy: [{ hospital: { priorityOrder: "asc" } }, { priorityOrder: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

// POST /api/units
router.post("/", async (req, res) => {
  const { hospitalId, name, dailyQuota = 0, genderRule = null, priorityOrder = 999, isActive = true } = req.body || {};
  if (!hospitalId || !name) return res.status(400).json({ error: "hospitalId ve name zorunlu" });

  const created = await prisma.unit.create({
    data: {
      hospitalId: String(hospitalId),
      name: String(name),
      dailyQuota: Number(dailyQuota),
      genderRule: genderRule ? String(genderRule) : null, // "M" | "F" | null
      priorityOrder: Number(priorityOrder),
      isActive: !!isActive,
    },
  });

  res.json(created);
});

// PUT /api/units/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, dailyQuota, genderRule, priorityOrder, isActive } = req.body || {};

  const updated = await prisma.unit.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(dailyQuota !== undefined ? { dailyQuota: Number(dailyQuota) } : {}),
      ...(genderRule !== undefined ? { genderRule: genderRule ? String(genderRule) : null } : {}),
      ...(priorityOrder !== undefined ? { priorityOrder: Number(priorityOrder) } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    },
  });

  res.json(updated);
});

// DELETE /api/units/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.unit.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
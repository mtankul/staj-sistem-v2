import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// GET /api/hospitals
router.get("/", async (req, res) => {
  const items = await prisma.hospital.findMany({
    include: { contacts: true, units: true },
    orderBy: [{ priorityOrder: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

// POST /api/hospitals
router.post("/", async (req, res) => {
  const { name, priorityOrder = 999, isActive = true } = req.body || {};
  if (!name) return res.status(400).json({ error: "name zorunlu" });

  const created = await prisma.hospital.create({
    data: { name: String(name), priorityOrder: Number(priorityOrder), isActive: !!isActive },
  });
  res.json(created);
});

// PUT /api/hospitals/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, priorityOrder, isActive } = req.body || {};

  const updated = await prisma.hospital.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(priorityOrder !== undefined ? { priorityOrder: Number(priorityOrder) } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    },
  });
  res.json(updated);
});

// DELETE /api/hospitals/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.hospital.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
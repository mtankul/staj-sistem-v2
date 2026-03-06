import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// GET /api/courses
router.get("/", async (req, res) => {
  const items = await prisma.course.findMany({ orderBy: { createdAt: "desc" } });
  res.json(items);
});

// POST /api/courses
router.post("/", async (req, res) => {
  const { code, name, isActive = true } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: "code ve name zorunlu" });

  const created = await prisma.course.create({
    data: { code: String(code).toUpperCase(), name: String(name), isActive: !!isActive },
  });
  res.json(created);
});

// PUT /api/courses/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { code, name, isActive } = req.body || {};

  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(code !== undefined ? { code: String(code).toUpperCase() } : {}),
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    },
  });
  res.json(updated);
});

// DELETE /api/courses/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.course.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
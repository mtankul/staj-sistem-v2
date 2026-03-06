import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// GET /api/settings -> tüm ayarlar (key->value)
router.get("/", async (req, res) => {
  const list = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  const out = {};
  for (const s of list) out[s.key] = s.value;
  res.json(out);
});

// PUT /api/settings/:key  { value: {...} }
router.put("/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  if (!key) return res.status(400).json({ error: "key zorunlu" });
  if (value === undefined) return res.status(400).json({ error: "value zorunlu" });

  // basit validation (core kurallar)
  if (key === "grading_weights") {
    const rw = Number(value?.reportWeight);
    const ow = Number(value?.observerWeight);
    const r1 = Number(value?.rot1Weight);
    const r2 = Number(value?.rot2Weight);
    if (!Number.isFinite(rw) || !Number.isFinite(ow) || rw + ow !== 100) {
      return res.status(400).json({ error: "Rapor+Gözetmen toplamı 100 olmalı" });
    }
    // 0.4 + 0.6 gibi float
    if (!Number.isFinite(r1) || !Number.isFinite(r2) || Math.abs((r1 + r2) - 1) > 0.0001) {
      return res.status(400).json({ error: "Rot1+Rot2 toplamı 1.0 olmalı" });
    }
  }

  const saved = await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  res.json({ ok: true, key: saved.key, value: saved.value });
});

export default router;
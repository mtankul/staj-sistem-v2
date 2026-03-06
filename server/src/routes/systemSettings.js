import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

function rowsToObj(rows) {
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// Login ekranı için PUBLIC okuma
router.get("/public", async (req, res) => {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: ["siteTitle","siteSlogan","homeImageUrl","orgTitle","orgSubtitle"] } },
  });
  res.json(rowsToObj(rows));
});

// Admin okuma
router.get("/", async (req, res) => {
  const rows = await prisma.systemSetting.findMany();
  res.json(rowsToObj(rows));
});

// Toplu kaydet (tek request ile)
router.post("/bulk", async (req, res) => {
  const { values } = req.body || {};
  if (!values || typeof values !== "object") {
    return res.status(400).json({ error: "values object zorunlu" });
  }

  const entries = Object.entries(values);

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  res.json({ ok: true, saved: entries.length });
});

export default router;
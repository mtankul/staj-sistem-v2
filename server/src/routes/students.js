import { Router } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import * as XLSX from "xlsx";
import { hashPin } from "../utils/pin.js";

const router = Router();

/* =========================
   CİNSİYET NORMALIZE (E/K)
   ========================= */
function normalizeSexEK(v) {
  if (v === null || v === undefined) return null;

  const s = String(v).trim().toLowerCase();

  // TR
  if (s === "e" || s === "erkek") return "E";
  if (s === "k" || s === "kadın" || s === "kadin") return "K";

  // Yanlışlıkla M/F gelirse dönüştür
  if (s === "m" || s === "male") return "E";
  if (s === "f" || s === "female") return "K";

  return null; // tanınmıyorsa karma kabul
}

// GET /api/students?periodId=...
router.get("/", async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const items = await prisma.student.findMany({
    where: { periodId: String(periodId) },
    orderBy: { studentNo: "asc" },
  });
  res.json(items);
});

// POST /api/students/import
router.post("/import", async (req, res) => {
  const { periodId, rows } = req.body || {};
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "rows boş" });

  // normalize + validate
  const cleaned = rows
    .map((r) => ({
      studentNo: String(r.student_no ?? r.studentNo ?? "").trim(),
      nameSurname: String(r.name_surname ?? r.nameSurname ?? "").trim(),
      sex: normalizeSexEK(r.sex),
      photoUrl: r.photo_url ? String(r.photo_url).trim() : null,
    }))
    .filter((r) => r.studentNo && r.nameSurname);

  if (cleaned.length === 0) return res.status(400).json({ error: "Geçerli satır bulunamadı" });

  const results = {
    inserted: 0,
    updated: 0,
    skipped: rows.length - cleaned.length,
  };

  for (const s of cleaned) {
    const username = s.studentNo;

    // Not: import'ta da hashPin kullanmak istersen bcrypt.hash yerine bunu tercih et.
    const pinHash = await bcrypt.hash(s.studentNo, 10);

    const existing = await prisma.student.findUnique({
      where: {
        periodId_studentNo: {
          periodId: String(periodId),
          studentNo: s.studentNo,
        },
      },
    });

    if (existing) {
      await prisma.student.update({
        where: { id: existing.id },
        data: {
          nameSurname: s.nameSurname,
          sex: s.sex,
          photoUrl: s.photoUrl,
        },
      });
      results.updated += 1;
    } else {
      await prisma.student.create({
        data: {
          periodId: String(periodId),
          studentNo: s.studentNo,
          nameSurname: s.nameSurname,
          sex: s.sex,
          photoUrl: s.photoUrl,
          username,
          pinHash,
          // istersen import'ta da ilk girişte PIN değişsin:
          // mustChangePin: true,
        },
      });
      results.inserted += 1;
    }
  }

  res.json({ ok: true, ...results });
});

// PUT /api/students/:id/reset-pin
router.put("/:id/reset-pin", async (req, res) => {
  const { id } = req.params;

  const s = await prisma.student.findUnique({ where: { id: String(id) } });
  if (!s) return res.status(404).json({ error: "Öğrenci bulunamadı" });

  await prisma.student.update({
    where: { id: String(id) },
    data: {
      pinHash: await hashPin(s.studentNo), // ✅ tekrar öğrenci no
      mustChangePin: true,                // ✅ ilk girişte zorunlu değişsin
    },
  });

  res.json({ ok: true });
});

export default router;
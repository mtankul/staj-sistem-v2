import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

function ensureDayAllowed(period, dayOfWeek) {
  const days = period?.practiceDays;
  if (!days) return true; // tanımlı değilse şimdilik serbest
  if (!Array.isArray(days)) return true;
  return days.includes(dayOfWeek);
}

// GET /api/assignments?periodId=...
router.get("/", async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const items = await prisma.studentAssignment.findMany({
    where: { periodId: String(periodId) },
    include: {
      student: true,
      hospital: true,
      unit: true,
    },
    // ✅ İstenen sıra: 1-Gün 2-Hastane 3-Ad Soyad
    orderBy: [
      { rotationNo: "asc" },
      { dayOfWeek: "asc" },
      { hospital: { name: "asc" } },
      { student: { nameSurname: "asc" } },

      // aynı gün+hastane+adsoyad çakışırsa stabil kalsın diye ekstra:
      { rotationNo: "asc" },
      { student: { studentNo: "asc" } },
    ],
  });

  res.json(items);
});

// POST /api/assignments  (upsert)
router.post("/", async (req, res) => {
  const {
    periodId,
    studentId,
    rotationNo,
    dayOfWeek,
    hospitalId,
    unitId,
    method = "MANUAL",
  } = req.body || {};

  if (!periodId || !studentId || !rotationNo || !dayOfWeek || !hospitalId || !unitId) {
    return res
      .status(400)
      .json({ error: "periodId, studentId, rotationNo, dayOfWeek, hospitalId, unitId zorunlu" });
  }

  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  // rotasyon kontrol (period.rotationCount)
  const rc = period.rotationCount ?? 1;
  if (Number(rotationNo) < 1 || Number(rotationNo) > Number(rc)) {
    return res.status(400).json({ error: `rotationNo 1..${rc} olmalı` });
  }

  // gün kontrol (practiceDays)
  if (!ensureDayAllowed(period, String(dayOfWeek))) {
    return res.status(400).json({ error: "Seçilen gün bu dönemde uygulama günü değil" });
  }

  // student + unit çek
  const student = await prisma.student.findUnique({ where: { id: String(studentId) } });
  if (!student) return res.status(404).json({ error: "Öğrenci bulunamadı" });

  const unit = await prisma.unit.findUnique({ where: { id: String(unitId) } });
  if (!unit) return res.status(404).json({ error: "Birim bulunamadı" });

  // Birim hastaneye bağlı mı?
  if (String(unit.hospitalId) !== String(hospitalId)) {
    return res.status(400).json({ error: "Birim, seçilen hastaneye ait değil" });
  }

  // Cinsiyet kuralı
  const us = student.sex ? String(student.sex).trim().toUpperCase() : null; // E/K
  const ug = unit.genderRule ? String(unit.genderRule).trim().toUpperCase() : null; // E/K
  if (ug && us && ug !== us) {
    return res.status(400).json({ error: "Cinsiyet kuralı nedeniyle bu birime atama yapılamaz" });
  }

  // Kota kontrolü: aynı (period+rotation+day+unit) say
  const quota = Number(unit.dailyQuota ?? 0);
  if (quota > 0) {
    const currentCount = await prisma.studentAssignment.count({
      where: {
        periodId: String(periodId),
        rotationNo: Number(rotationNo),
        dayOfWeek: String(dayOfWeek),
        unitId: String(unitId),
      },
    });

    // upsert ile aynı öğrenci aynı rotasyonda zaten varsa, sayım şişmesin diye:
    const existing = await prisma.studentAssignment.findUnique({
      where: {
        period_student_rotation_unique: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rotationNo),
        },
      },
    });

    const effectiveCount = existing ? currentCount - 1 : currentCount;
    if (effectiveCount >= quota) {
      return res.status(400).json({ error: "Kontenjan dolu (günlük kota)" });
    }
  }

  // upsert: (periodId, studentId, rotationNo) benzersiz
  const saved = await prisma.studentAssignment.upsert({
    where: {
      period_student_rotation_unique: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
      },
    },
    update: {
      dayOfWeek: String(dayOfWeek),
      hospitalId: String(hospitalId),
      unitId: String(unitId),
      method: String(method),
    },
    create: {
      periodId: String(periodId),
      studentId: String(studentId),
      rotationNo: Number(rotationNo),
      dayOfWeek: String(dayOfWeek),
      hospitalId: String(hospitalId),
      unitId: String(unitId),
      method: String(method),
    },
    include: { student: true, hospital: true, unit: true },
  });

  res.json(saved);
});

// DELETE /api/assignments/clear?periodId=...&rotationNo=...
router.delete("/clear", async (req, res) => {
  const { periodId, rotationNo } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const where = { periodId: String(periodId) };
  if (rotationNo) where.rotationNo = Number(rotationNo);

  const out = await prisma.studentAssignment.deleteMany({ where });
  res.json({ ok: true, deleted: out.count });
});

// DELETE /api/assignments/:id  (tekil silme)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.studentAssignment.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
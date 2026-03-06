/**
 * CANONICAL: Teachers CRUD (Admin side)
 * Location: server/src/routes/teacher/teachers.js
 * Base: /api/teachers
 */

import { Router } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";

const router = Router();

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function normDays(arr) {
  const a = Array.isArray(arr) ? arr.map(String) : [];
  const set = new Set(a.map((x) => x.trim().toUpperCase()).filter(Boolean));
  return DAY_ORDER.filter((d) => set.has(d));
}

function last4Digits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.slice(-4);
}

// GET /api/teachers?periodId=...
router.get("/", async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const list = await prisma.teacher.findMany({
    where: { periodId: String(periodId) },
    orderBy: [{ isActive: "desc" }, { nameSurname: "asc" }],
    include: { hospitals: { include: { hospital: true } } },
  });

  res.json(list);
});

// GET /api/teachers/options?periodId=...
router.get("/options", async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const list = await prisma.teacher.findMany({
    where: { periodId: String(periodId), isActive: true },
    select: { id: true, nameSurname: true },
    orderBy: { nameSurname: "asc" },
  });

  res.json(list.map((x) => ({ value: x.id, label: x.nameSurname })));
});

// POST /api/teachers
router.post("/", async (req, res) => {
  const {
    periodId,
    nameSurname,
    phone,
    email,
    photoUrl,
    practiceDays,
    hospitalIds,
    isObserver = true,
    isCoordinator = false,
    isResponsible = false,
  } = req.body || {};

  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  if (!nameSurname?.trim()) return res.status(400).json({ error: "Ad Soyad zorunlu" });
  if (!phone?.trim()) return res.status(400).json({ error: "Telefon zorunlu" });

  const pin = last4Digits(phone);
  if (!pin || pin.length < 4) return res.status(400).json({ error: "Telefon son 4 hane bulunamadı" });

  const pinHash = await bcrypt.hash(pin, 10);
  const days = normDays(practiceDays);

  const created = await prisma.teacher.create({
    data: {
      periodId: String(periodId),
      nameSurname: String(nameSurname).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim() : null,
      photoUrl: photoUrl ? String(photoUrl).trim() : null,
      pinHash,
      messageFlag: "A",
      isObserver: !!isObserver,
      isCoordinator: !!isCoordinator,
      isResponsible: !!isResponsible,
      practiceDays: days,
      hospitals: {
        create: (Array.isArray(hospitalIds) ? hospitalIds : [])
          .filter(Boolean)
          .map((hid) => ({ hospitalId: String(hid) })),
      },
    },
    include: { hospitals: { include: { hospital: true } } },
  });

  res.json({ ok: true, item: created });
});

// PUT /api/teachers/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    nameSurname,
    phone,
    email,
    photoUrl,
    practiceDays,
    hospitalIds,
    isObserver,
    isCoordinator,
    isResponsible,
    isActive,
    messageFlag,
    resetPin = false,
  } = req.body || {};

  const existing = await prisma.teacher.findUnique({ where: { id: String(id) } });
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const days = practiceDays !== undefined ? normDays(practiceDays) : undefined;
  const doHospUpdate = hospitalIds !== undefined;

  const data = {
    ...(nameSurname !== undefined ? { nameSurname: String(nameSurname).trim() } : {}),
    ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
    ...(email !== undefined ? { email: email ? String(email).trim() : null } : {}),
    ...(photoUrl !== undefined ? { photoUrl: photoUrl ? String(photoUrl).trim() : null } : {}),
    ...(days !== undefined ? { practiceDays: days } : {}),
    ...(isObserver !== undefined ? { isObserver: !!isObserver } : {}),
    ...(isCoordinator !== undefined ? { isCoordinator: !!isCoordinator } : {}),
    ...(isResponsible !== undefined ? { isResponsible: !!isResponsible } : {}),
    ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    ...(messageFlag !== undefined ? { messageFlag: String(messageFlag) } : {}),
  };

  if (resetPin) {
    const pin = last4Digits(phone ?? existing.phone);
    if (!pin || pin.length < 4) return res.status(400).json({ error: "Telefon son 4 hane bulunamadı" });
    data.pinHash = await bcrypt.hash(pin, 10);
    data.messageFlag = "A";
  }

  const updated = await prisma.teacher.update({
    where: { id: String(id) },
    data: {
      ...data,
      ...(doHospUpdate
        ? {
            hospitals: {
              deleteMany: {},
              create: (Array.isArray(hospitalIds) ? hospitalIds : [])
                .filter(Boolean)
                .map((hid) => ({ hospitalId: String(hid) })),
            },
          }
        : {}),
    },
    include: { hospitals: { include: { hospital: true } } },
  });

  res.json({ ok: true, item: updated });
});

// POST /api/teachers/:id/reset-pin
router.post("/:id/reset-pin", async (req, res) => {
  const { id } = req.params;
  const t = await prisma.teacher.findUnique({ where: { id: String(id) } });
  if (!t) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const pin = last4Digits(t.phone);
  if (!pin || pin.length < 4) return res.status(400).json({ error: "Telefon son 4 hane bulunamadı" });

  const pinHash = await bcrypt.hash(pin, 10);

  await prisma.teacher.update({
    where: { id: String(id) },
    data: { pinHash, messageFlag: "A" },
  });

  res.json({ ok: true });
});

// DELETE /api/teachers/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.teacher.delete({ where: { id: String(id) } });
  res.json({ ok: true });
});

export default router;
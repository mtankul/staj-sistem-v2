import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// GET /api/hospitals/:id/contacts
router.get("/hospitals/:id/contacts", async (req, res) => {
  const { id } = req.params;

  const list = await prisma.hospitalContact.findMany({
    where: { hospitalId: String(id) },
    orderBy: [{ isActive: "desc" }, { nameSurname: "asc" }],
  });

  res.json(list);
});

// POST /api/hospitals/:id/contacts
router.post("/hospitals/:id/contacts", async (req, res) => {
  try {
    const { id } = req.params;
    const { nameSurname, title, phone, email, note, isActive = true } = req.body || {};

    const ns = String(nameSurname || "").trim();
    if (!ns) return res.status(400).json({ error: "Ad Soyad zorunlu" });

    const item = await prisma.hospitalContact.create({
      data: {
        hospitalId: String(id),
        nameSurname: ns,
        title: title ? String(title).trim() : null,
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim() : null,
        note: note ? String(note).trim() : null,
        isActive: !!isActive,
      },
    });

    res.json({ ok: true, item });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "İşlem başarısız" });
  }
});

// PUT /api/hospital-contacts/:id
router.put("/hospital-contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nameSurname, title, phone, email, note, isActive } = req.body || {};

    const item = await prisma.hospitalContact.update({
      where: { id: String(id) },
      data: {
        ...(nameSurname !== undefined ? { nameSurname: String(nameSurname || "").trim() } : {}),
        ...(title !== undefined ? { title: title ? String(title).trim() : null } : {}),
        ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        ...(email !== undefined ? { email: email ? String(email).trim() : null } : {}),
        ...(note !== undefined ? { note: note ? String(note).trim() : null } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      },
    });

    res.json({ ok: true, item });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "İşlem başarısız" });
  }
});

// DELETE /api/hospital-contacts/:id
router.delete("/hospital-contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.hospitalContact.delete({ where: { id: String(id) } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Silme başarısız" });
  }
});

export default router;
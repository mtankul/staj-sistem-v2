import { Router } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import { hashPin } from "../utils/pin.js";

const router = Router();

/* =========================
   HELPERS
========================= */
function normalizeSexEK(v) {
  if (v === null || v === undefined) return null;

  const s = String(v).trim().toLowerCase();

  if (s === "e" || s === "erkek") return "E";
  if (s === "k" || s === "kadın" || s === "kadin") return "K";

  if (s === "m" || s === "male") return "E";
  if (s === "f" || s === "female") return "K";

  return null;
}

function normalizePhotoUrl(studentNo, photoUrl) {
  const raw = String(photoUrl || "").trim();
  if (raw) return raw;
  return studentNo ? `/ogr/${studentNo}.png` : null;
}

/* =========================
   GET /api/students?periodId=...
========================= */
router.get("/", async (req, res) => {
  try {
    const { periodId } = req.query;
    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

    const items = await prisma.student.findMany({
      where: { periodId: String(periodId) },
      orderBy: { studentNo: "asc" },
    });

    res.json(items);
  } catch (e) {
    console.error("GET /students error:", e);
    res.status(500).json({ error: "Öğrenciler alınamadı" });
  }
});

/* =========================
   POST /api/students/import
========================= */
router.post("/import", async (req, res) => {
  try {
    const { periodId, rows } = req.body || {};
    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "rows boş" });
    }

    const cleaned = rows
      .map((r) => {
        const studentNo = String(r.student_no ?? r.studentNo ?? "").trim();

        return {
          studentNo,
          nameSurname: String(r.name_surname ?? r.nameSurname ?? "").trim(),
          sex: normalizeSexEK(r.sex),
          photoUrl: normalizePhotoUrl(studentNo, r.photo_url ?? r.photoUrl),
        };
      })
      .filter((r) => r.studentNo && r.nameSurname);

    if (cleaned.length === 0) {
      return res.status(400).json({ error: "Geçerli satır bulunamadı" });
    }

    const results = {
      inserted: 0,
      updated: 0,
      skipped: rows.length - cleaned.length,
    };

    for (const s of cleaned) {
      const username = s.studentNo;
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
            mustChangePin: true,
          },
        });
        results.inserted += 1;
      }
    }

    res.json({ ok: true, ...results });
  } catch (e) {
    console.error("POST /students/import error:", e);
    res.status(500).json({ error: "Import başarısız" });
  }
});

/* =========================
   POST /api/students
   Manuel öğrenci ekleme
========================= */
router.post("/", async (req, res) => {
  try {
    const {
      periodId,
      studentNo,
      nameSurname,
      sex,
      phone,
      email,
      shareContact,
      photoUrl,
      pin,
    } = req.body || {};

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    if (!studentNo) return res.status(400).json({ error: "studentNo zorunlu" });
    if (!nameSurname) return res.status(400).json({ error: "nameSurname zorunlu" });

    const normalizedStudentNo = String(studentNo).trim();
    const normalizedName = String(nameSurname).trim();
    const normalizedSex = normalizeSexEK(sex);

    if (!normalizedSex) {
      return res.status(400).json({ error: "Cinsiyet E/K olmalıdır" });
    }

    const existing = await prisma.student.findUnique({
      where: {
        periodId_studentNo: {
          periodId: String(periodId),
          studentNo: normalizedStudentNo,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: "Bu dönemde aynı öğrenci numarası zaten kayıtlı" });
    }

    const rawPin = String(pin || normalizedStudentNo).trim();
    const pinHash = await hashPin(rawPin);

    const created = await prisma.student.create({
      data: {
        periodId: String(periodId),
        studentNo: normalizedStudentNo,
        nameSurname: normalizedName,
        sex: normalizedSex,
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim() : null,
        shareContact: !!shareContact,
        photoUrl: normalizePhotoUrl(normalizedStudentNo, photoUrl),
        username: normalizedStudentNo,
        pinHash,
        mustChangePin: true,
      },
    });

    res.json({ ok: true, item: created });
  } catch (e) {
    console.error("POST /students error:", e);
    res.status(500).json({ error: "Öğrenci eklenemedi" });
  }
});

/* =========================
   PUT /api/students/:id
   Öğrenci güncelleme
========================= */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      periodId,
      studentNo,
      nameSurname,
      sex,
      phone,
      email,
      shareContact,
      photoUrl,
    } = req.body || {};

    const existing = await prisma.student.findUnique({
      where: { id: String(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Öğrenci bulunamadı" });
    }

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    if (!studentNo) return res.status(400).json({ error: "studentNo zorunlu" });
    if (!nameSurname) return res.status(400).json({ error: "nameSurname zorunlu" });

    const normalizedStudentNo = String(studentNo).trim();
    const normalizedName = String(nameSurname).trim();
    const normalizedSex = normalizeSexEK(sex);

    if (!normalizedSex) {
      return res.status(400).json({ error: "Cinsiyet E/K olmalıdır" });
    }

    const duplicate = await prisma.student.findUnique({
      where: {
        periodId_studentNo: {
          periodId: String(periodId),
          studentNo: normalizedStudentNo,
        },
      },
    });

    if (duplicate && duplicate.id !== String(id)) {
      return res.status(409).json({ error: "Bu dönemde aynı öğrenci numarası zaten kayıtlı" });
    }

    const updated = await prisma.student.update({
      where: { id: String(id) },
      data: {
        periodId: String(periodId),
        studentNo: normalizedStudentNo,
        nameSurname: normalizedName,
        sex: normalizedSex,
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim() : null,
        shareContact: !!shareContact,
        photoUrl: normalizePhotoUrl(normalizedStudentNo, photoUrl),

        // öğrenci no değişirse username de aynı kalsın
        username: normalizedStudentNo,
      },
    });

    res.json({ ok: true, item: updated });
  } catch (e) {
    console.error("PUT /students/:id error:", e);
    res.status(500).json({ error: "Öğrenci güncellenemedi" });
  }
});

/* =========================
   PUT /api/students/:id/reset-pin
========================= */
router.put("/:id/reset-pin", async (req, res) => {
  try {
    const { id } = req.params;

    const s = await prisma.student.findUnique({ where: { id: String(id) } });
    if (!s) return res.status(404).json({ error: "Öğrenci bulunamadı" });

    await prisma.student.update({
      where: { id: String(id) },
      data: {
        pinHash: await hashPin(s.studentNo),
        mustChangePin: true,
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /students/:id/reset-pin error:", e);
    res.status(500).json({ error: "PIN reset başarısız" });
  }
});

/* =========================
   DELETE /api/students/:id
   Attendance varsa silinemez
========================= */
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");

    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        studentNo: true,
        nameSurname: true,
      },
    });

    if (!student) {
      return res.status(404).json({ error: "Öğrenci bulunamadı" });
    }

    const attendanceCount = await prisma.attendance.count({
      where: { studentId: id },
    });

    if (attendanceCount > 0) {
      return res.status(409).json({
        error:
          "Bu öğrenciye ait teorik/uygulama yoklama kaydı bulunduğu için silinemez.",
      });
    }

    await prisma.student.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /students/:id error:", e);
    res.status(500).json({ error: "Öğrenci silinemedi" });
  }
});

export default router;
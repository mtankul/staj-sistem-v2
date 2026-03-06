/**
 * CANONICAL: Student Panel Routes
 * Location: server/src/routes/student/panel.js
 * Responsibilities:
 *   - GET  /api/student/me
 *   - POST /api/student/pin/change
 * Notes:
 *   - Student report endpoints MUST NOT be added here.
 */

import { Router } from "express";
import { prisma } from "../../prisma.js";
import { hashPin, verifyPin } from "../../utils/pin.js";

const router = Router();

/* ===============================
   SWAGGER
================================ */

/**
 * @openapi
 * /api/student/me:
 *   get:
 *     tags: [Student]
 *     summary: Get logged-in student profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student profile info
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Student not found
 */

/**
 * @openapi
 * /api/student/pin/change:
 *   post:
 *     tags: [Student]
 *     summary: Change student PIN
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPin, newPin]
 *             properties:
 *               currentPin:
 *                 type: string
 *                 example: "1234"
 *               newPin:
 *                 type: string
 *                 example: "5678"
 *     responses:
 *       200:
 *         description: PIN changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Current PIN incorrect
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Student not found
 */

/* ===============================
   AUTH
================================ */
function requireStudent(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  const t = u.userType || u.type;
  if (t !== "student") return res.status(403).json({ error: "Forbidden" });

  if (!u.studentId) return res.status(401).json({ error: "studentId missing in token" });
  next();
}

/* ===============================
   GET /api/student/me
================================ */
router.get("/me", requireStudent, async (req, res) => {
  const studentId = String(req.user.studentId);

  const s = await prisma.student.findUnique({
    where: { id: studentId },
    include: { period: { include: { course: true } } },
  });

  if (!s) return res.status(404).json({ error: "Öğrenci bulunamadı" });

  res.json({
    id: s.id,
    studentNo: s.studentNo,
    nameSurname: s.nameSurname,
    photoUrl: s.photoUrl,
    mustChangePin: !!s.mustChangePin,
    period: {
      id: s.period?.id,
      academicYear: s.period?.academicYear,
      term: s.period?.term,
      courseName: s.period?.course?.name,
    },
  });
});

/* ===============================
   POST /api/student/pin/change
================================ */
router.post("/pin/change", requireStudent, async (req, res) => {
  const studentId = String(req.user.studentId);
  const { currentPin, newPin } = req.body || {};

  if (!currentPin || !newPin) {
    return res.status(400).json({ error: "currentPin ve newPin zorunlu" });
  }
  if (String(newPin).length < 4) {
    return res.status(400).json({ error: "PIN en az 4 haneli olmalı" });
  }

  const s = await prisma.student.findUnique({ where: { id: studentId } });
  if (!s) return res.status(404).json({ error: "Öğrenci bulunamadı" });

  const ok = await verifyPin(currentPin, s.pinHash);
  if (!ok) return res.status(401).json({ error: "Mevcut PIN hatalı" });

  if (String(currentPin) === String(newPin)) {
    return res.status(400).json({ error: "Yeni PIN eski PIN ile aynı olamaz" });
  }

  await prisma.student.update({
    where: { id: studentId },
    data: {
      pinHash: await hashPin(newPin),
      mustChangePin: false,
    },
  });

  res.json({ ok: true });
});

export default router;
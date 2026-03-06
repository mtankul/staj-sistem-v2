/**
 * CANONICAL: Admin Report Scoring Routes
 * Location: server/src/routes/admin/reportScoring.js
 * Base: /api/admin/report-scoring
 *
 * Endpoints:
 *  - GET  /list?periodId=...&weekNo=...&rotationNo=...
 *  - GET  /detail?periodId=...&studentId=...&weekNo=...&rotationNo=...
 *  - PUT  /grade
 */

import { Router } from "express";
import { prisma } from "../../prisma.js";

const router = Router();

/* ===============================
   SWAGGER
================================ */

/**
 * @openapi
 * /api/admin/report-scoring/list:
 *   get:
 *     tags: [Admin]
 *     summary: List report scores for a rotation week
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: weekNo
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: rotationNo
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of student report scores
 *       400:
 *         description: Missing parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @openapi
 * /api/admin/report-scoring/detail:
 *   get:
 *     tags: [Admin]
 *     summary: Get report answers and score for a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: weekNo
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: rotationNo
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Student report detail
 *       400:
 *         description: Missing parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Snapshot not found
 */

/**
 * @openapi
 * /api/admin/report-scoring/grade:
 *   put:
 *     tags: [Admin]
 *     summary: Grade or update a student weekly report
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [periodId, studentId, weekNo, rotationNo, score]
 *             properties:
 *               periodId:
 *                 type: string
 *               studentId:
 *                 type: string
 *               weekNo:
 *                 type: integer
 *               rotationNo:
 *                 type: integer
 *               score:
 *                 type: number
 *               status:
 *                 type: string
 *                 example: APPROVED
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Score saved
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/* ===============================
   AUTH
================================ */
function getUserType(u) {
  return (u?.role || u?.userType || u?.type || "").toString().toLowerCase();
}

function requireAdmin(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  const t = getUserType(u);
  if (t !== "admin") return res.status(403).json({ error: "Forbidden" });

  next();
}

function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/* ===============================
   GET /api/admin/report-scoring/list
================================ */
router.get("/list", requireAdmin, async (req, res) => {
  const { periodId, weekNo, rotationNo } = req.query;
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const w = toInt(weekNo, null);
  const rot = toInt(rotationNo, null);
  if (!w || !rot) return res.status(400).json({ error: "weekNo + rotationNo zorunlu" });

  const assignments = await prisma.studentAssignment.findMany({
    where: { periodId: String(periodId), rotationNo: Number(rot) },
    include: { student: true, hospital: true, unit: true },
    orderBy: [{ dayOfWeek: "asc" }, { hospital: { name: "asc" } }, { student: { nameSurname: "asc" } }],
  });

  const studentIds = assignments.map((a) => a.studentId);

  const scores = await prisma.weeklyReportScore.findMany({
    where: {
      periodId: String(periodId),
      weekNo: Number(w),
      rotationNo: Number(rot),
      studentId: { in: studentIds },
    },
  });
  const scoreMap = new Map(scores.map((s) => [s.studentId, s]));

  res.json({
    items: assignments.map((a) => {
      const sc = scoreMap.get(a.studentId) || null;
      return {
        assignmentId: a.id,
        studentId: a.studentId,
        studentNo: a.student.studentNo,
        nameSurname: a.student.nameSurname,
        photoUrl: a.student.photoUrl,
        dayOfWeek: a.dayOfWeek,
        hospitalName: a.hospital?.name,
        unitName: a.unit?.name,
        weekNo: w,
        rotationNo: rot,
        score: sc?.score ?? null,
        status: sc?.status ?? null,
        note: sc?.note ?? null,
        updatedAt: sc?.updatedAt ?? null,
      };
    }),
  });
});

/* ===============================
   GET /api/admin/report-scoring/detail
================================ */
router.get("/detail", requireAdmin, async (req, res) => {
  const { periodId, studentId, weekNo, rotationNo } = req.query;
  if (!periodId || !studentId) return res.status(400).json({ error: "periodId + studentId zorunlu" });

  const w = toInt(weekNo, null);
  const rot = toInt(rotationNo, null);
  if (!w || !rot) return res.status(400).json({ error: "weekNo + rotationNo zorunlu" });

  const snap = await prisma.periodReportSnapshot.findUnique({
    where: { periodId: String(periodId) },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });
  if (!snap) return res.status(404).json({ error: "Bu dönem için rapor snapshot yok" });

  const answers = await prisma.weeklyReportAnswer.findMany({
    where: { periodId: String(periodId), studentId: String(studentId), weekNo: Number(w), rotationNo: Number(rot) },
  });
  const aMap = new Map(answers.map((a) => [a.questionId, a]));

  const score = await prisma.weeklyReportScore.findUnique({
    where: {
      uniq_reportscore_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(w),
        rotationNo: Number(rot),
      },
    },
  });

  res.json({
    questions: (snap.questions || [])
      .filter((q) => q.isActive)
      .map((q) => ({
        id: q.id,
        orderNo: q.orderNo,
        text: q.text,
        points: q.points,
        answerText: aMap.get(q.id)?.answerText ?? "",
      })),
    score: score || null,
  });
});

/* ===============================
   PUT /api/admin/report-scoring/grade
================================ */
router.put("/grade", requireAdmin, async (req, res) => {
  const { periodId, studentId } = req.body || {};
  const w = toInt(req.body?.weekNo, null);
  const rot = toInt(req.body?.rotationNo, null);
  const scoreVal = Number(req.body?.score);

  if (!periodId || !studentId) return res.status(400).json({ error: "periodId + studentId zorunlu" });
  if (!w || !rot) return res.status(400).json({ error: "weekNo + rotationNo zorunlu" });
  if (!Number.isFinite(scoreVal)) return res.status(400).json({ error: "score sayısal olmalı" });

  const status = req.body?.status ? String(req.body.status) : "SUBMITTED";
  const note = req.body?.note !== undefined ? String(req.body.note || "") : null;

  const item = await prisma.weeklyReportScore.upsert({
    where: {
      uniq_reportscore_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(w),
        rotationNo: Number(rot),
      },
    },
    create: {
      periodId: String(periodId),
      studentId: String(studentId),
      weekNo: Number(w),
      rotationNo: Number(rot),
      score: scoreVal,
      status,
      note,
      gradedBy: "admin",
    },
    update: {
      score: scoreVal,
      status,
      note,
      gradedBy: "admin",
    },
  });

  res.json({ ok: true, item });
});

export default router;
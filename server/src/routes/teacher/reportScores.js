/**
 * CANONICAL: Teacher Report Scoring Routes (Coordinator Only)
 * Location: server/src/routes/teacher/reportScores.js
 *
 * Includes:
 *  - GET  /api/teacher/report-scores?periodId&weekNo
 *  - GET  /api/teacher/report-scores/detail?periodId&studentId&weekNo
 *  - PUT  /api/teacher/report-scores/upsert
 *
 * Notes:
 *  - Coordinator only (DB check)
 */

import { Router } from "express";
import { prisma } from "../../prisma.js";
import { examInfo, rotationByWeek, toInt } from "../../utils/periodWeek.js";

const router = Router();

/* ===============================
   SWAGGER (REPORT SCORES)
================================ */

/**
 * @openapi
 * /api/teacher/report-scores:
 *   get:
 *     tags: [Teacher]
 *     summary: Coordinator - list weekly report answers + totalScore for all students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: weekNo
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: OK (mode + items) }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Coordinator only }
 *       404: { description: Not found }
 */

/**
 * @openapi
 * /api/teacher/report-scores/detail:
 *   get:
 *     tags: [Teacher]
 *     summary: Coordinator - detail for a single student (questions + answers + score)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: studentId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: weekNo
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: OK (mode + questions + score) }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Coordinator only }
 *       404: { description: Not found }
 */

/**
 * @openapi
 * /api/teacher/report-scores/upsert:
 *   put:
 *     tags: [Teacher]
 *     summary: Coordinator - upsert weekly report total score (0..totalPoints)
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
 *               periodId: { type: string }
 *               studentId: { type: string }
 *               weekNo: { type: integer, minimum: 1 }
 *               rotationNo: { type: integer, enum: [1, 2] }
 *               score: { type: number }
 *               note: { type: string, nullable: true }
 *     responses:
 *       200: { description: Upsert OK }
 *       400: { description: Validation / business rule }
 *       401: { description: Unauthorized }
 *       403: { description: Coordinator only }
 *       404: { description: Not found }
 */

/* ===============================
   AUTH (ONLY COORDINATOR)
================================ */
async function requireCoordinator(req, res, next) {
  try {
    const teacherId = req.user?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const t = await prisma.teacher.findUnique({
      where: { id: String(teacherId) },
      select: { isCoordinator: true },
    });

    if (!t?.isCoordinator) return res.status(403).json({ error: "Sadece koordinatör erişebilir" });
    next();
  } catch (e) {
    console.error("requireCoordinator error:", e);
    return res.status(500).json({ error: "Yetki kontrolü başarısız" });
  }
}

/* =========================================================
   GET /api/teacher/report-scores?periodId&weekNo
========================================================= */
router.get("/", requireCoordinator, async (req, res) => {
  const { periodId, weekNo } = req.query;

  const w = toInt(weekNo, null);
  if (!periodId || !w) return res.status(400).json({ error: "periodId + weekNo zorunlu" });

  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const ex = examInfo(period, w);
  if (ex) return res.json({ mode: "EXAM", exam: ex, items: [] });

  const rot = rotationByWeek(period, w);
  if (!rot) return res.json({ mode: "NO_ROTATION", items: [] });

  const snap = await prisma.periodReportSnapshot.findUnique({
    where: { periodId: String(periodId) },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });
  if (!snap) return res.json({ mode: "NO_SNAPSHOT", items: [] });

  const qs = (snap.questions || []).filter((q) => q.isActive);

  const answers = await prisma.weeklyReportAnswer.findMany({
    where: { periodId: String(periodId), weekNo: w, rotationNo: rot },
  });

  const byStudent = new Map();
  for (const a of answers) {
    if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, new Map());
    byStudent.get(a.studentId).set(a.questionId, a.answerText ?? "");
  }

  const students = await prisma.student.findMany({
    where: { periodId: String(periodId) },
    orderBy: { nameSurname: "asc" },
  });

  const scores = await prisma.weeklyReportScore.findMany({
    where: { periodId: String(periodId), weekNo: w, rotationNo: rot },
  });
  const scoreMap = new Map(scores.map((s) => [s.studentId, s]));

  const items = students.map((s) => {
    const amap = byStudent.get(s.id) || new Map();
    const sc = scoreMap.get(s.id) || null;

    return {
      studentId: s.id,
      studentNo: s.studentNo,
      nameSurname: s.nameSurname,
      photoUrl: s.photoUrl,
      weekNo: w,
      rotationNo: rot,
      totalPoints: snap.totalPoints,
      answers: qs.map((q) => ({
        questionId: q.id,
        orderNo: q.orderNo,
        text: q.text,
        maxPoints: q.points,
        answerText: amap.get(q.id) || "",
      })),
      totalScore: sc?.score ?? null,
      status: sc?.status ?? null,
      note: sc?.note ?? null,
      gradedBy: sc?.gradedBy ?? null,
      updatedAt: sc?.updatedAt ?? null,
    };
  });

  res.json({ mode: "OK", items });
});

/* =========================================================
   GET /api/teacher/report-scores/detail?periodId&studentId&weekNo
========================================================= */
router.get("/detail", requireCoordinator, async (req, res) => {
  const { periodId, studentId, weekNo } = req.query;

  const w = toInt(weekNo, null);
  if (!periodId || !studentId || !w)
    return res.status(400).json({ error: "periodId + studentId + weekNo zorunlu" });

  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const ex = examInfo(period, w);
  if (ex) return res.json({ mode: "EXAM", exam: ex });

  const rot = rotationByWeek(period, w);
  if (!rot) return res.json({ mode: "NO_ROTATION" });

  const snap = await prisma.periodReportSnapshot.findUnique({
    where: { periodId: String(periodId) },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });
  if (!snap) return res.status(404).json({ error: "Bu dönem için rapor snapshot yok" });

  const answers = await prisma.weeklyReportAnswer.findMany({
    where: { periodId: String(periodId), studentId: String(studentId), weekNo: w, rotationNo: rot },
  });
  const aMap = new Map(answers.map((a) => [a.questionId, a.answerText ?? ""]));

  const score = await prisma.weeklyReportScore.findUnique({
    where: {
      uniq_report_score: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: w,
        rotationNo: rot,
      },
    },
  });

  const questions = (snap.questions || [])
    .filter((q) => q.isActive)
    .map((q) => ({
      id: q.id,
      orderNo: q.orderNo,
      text: q.text,
      points: q.points,
      answerText: aMap.get(q.id) || "",
    }));

  res.json({
    mode: "OK",
    rotationNo: rot,
    snapshotId: snap.id,
    totalPoints: snap.totalPoints,
    questions,
    score: score || null,
  });
});

/* =========================================================
   PUT /api/teacher/report-scores/upsert
========================================================= */
router.put("/upsert", requireCoordinator, async (req, res) => {
  const { periodId, studentId, weekNo, rotationNo, score, note } = req.body || {};

  const w = toInt(weekNo, null);
  const rotBody = toInt(rotationNo, null);

  if (!periodId || !studentId || !w || !rotBody) return res.status(400).json({ error: "Eksik parametre" });

  const scoreVal = Number(score);
  if (!Number.isFinite(scoreVal)) return res.status(400).json({ error: "score sayısal olmalı" });

  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const ex = examInfo(period, w);
  if (ex) return res.status(400).json({ error: "Sınav haftasında puan girilemez" });

  const rotComputed = rotationByWeek(period, w);
  if (!rotComputed) return res.status(400).json({ error: "Bu hafta rotasyon haftası değil" });

  if (Number(rotBody) !== Number(rotComputed))
    return res.status(400).json({ error: "rotationNo bu haftanın rotasyonu ile uyuşmuyor" });

  const snap = await prisma.periodReportSnapshot.findUnique({ where: { periodId: String(periodId) } });
  if (!snap) return res.status(400).json({ error: "Snapshot yok" });

  if (scoreVal > Number(snap.totalPoints))
    return res.status(400).json({ error: `Toplam puan ${snap.totalPoints} üstüne çıkamaz` });

  const item = await prisma.weeklyReportScore.upsert({
    where: {
      uniq_report_score: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(w),
        rotationNo: Number(rotBody),
      },
    },
    create: {
      periodId: String(periodId),
      studentId: String(studentId),
      weekNo: Number(w),
      rotationNo: Number(rotBody),
      score: scoreVal,
      status: "GRADED",
      note: note !== undefined ? String(note || "") : null,
      gradedBy: String(req.user.teacherId),
    },
    update: {
      score: scoreVal,
      status: "GRADED",
      note: note !== undefined ? String(note || "") : null,
      gradedBy: String(req.user.teacherId),
    },
  });

  res.json({ ok: true, item });
});

export default router;
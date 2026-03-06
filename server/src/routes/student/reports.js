/**
 * CANONICAL: Student Weekly Report Routes
 * Location: server/src/routes/student/reports.js
 * Responsibilities:
 *   - GET  /api/student/questions?periodId=...
 *   - GET  /api/student/report-week?periodId=...&weekNo=...
 *   - PUT  /api/student/report-week
 *   - POST /api/student/report-week/submit
 * Notes:
 *   - Student profile/pin endpoints MUST NOT be added here.
 */

import { Router } from "express";
import { prisma } from "../../prisma.js";

const router = Router();

/* ===============================
   SWAGGER
================================ */

/**
 * @openapi
 * /api/student/questions:
 *   get:
 *     tags: [Student]
 *     summary: Get weekly report questions (snapshot) for a period
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         required: true
 *         schema:
 *           type: string
 *         description: Period ID
 *     responses:
 *       200:
 *         description: Snapshot + questions
 *       400:
 *         description: Missing periodId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (period mismatch)
 *       404:
 *         description: Student not found
 */

/**
 * @openapi
 * /api/student/report-week:
 *   get:
 *     tags: [Student]
 *     summary: Get weekly report state (questions + answers + meta)
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
 *           example: 3
 *     responses:
 *       200:
 *         description: Weekly report payload
 *       400:
 *         description: Missing periodId/weekNo
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (period mismatch)
 *       404:
 *         description: Student/Period not found
 */

/**
 * @openapi
 * /api/student/report-week:
 *   put:
 *     tags: [Student]
 *     summary: Save weekly report answers (only when status is editable)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [periodId, weekNo, answers]
 *             properties:
 *               periodId:
 *                 type: string
 *               weekNo:
 *                 type: integer
 *                 example: 3
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [questionId, answerText]
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     answerText:
 *                       type: string
 *     responses:
 *       200:
 *         description: Saved
 *       400:
 *         description: Validation error / snapshot missing
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (period mismatch)
 *       404:
 *         description: Student/Period not found
 *       409:
 *         description: Report locked (status not editable)
 */

/**
 * @openapi
 * /api/student/report-week/submit:
 *   post:
 *     tags: [Student]
 *     summary: Submit weekly report (DRAFT->SUBMITTED, REVISION_REQUESTED->RESUBMITTED)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [periodId, weekNo]
 *             properties:
 *               periodId:
 *                 type: string
 *               weekNo:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       200:
 *         description: Submitted
 *       400:
 *         description: Validation error / no answers
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (period mismatch)
 *       404:
 *         description: Student/Period not found
 *       409:
 *         description: Already submitted/locked or invalid status
 */

/* ===============================
   AUTH
================================ */
function requireStudent(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  const t = u.userType || u.type; // uyumluluk
  if (t !== "student") return res.status(403).json({ error: "Forbidden" });

  if (!u.studentId) return res.status(401).json({ error: "studentId missing in token" });
  next();
}

/* ===============================
   HELPERS
================================ */
function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function examInfo(period, weekNo) {
  const w = toInt(weekNo, null);
  if (!w) return null;

  const mid = toInt(period?.midtermWeek, null);
  const f1 = toInt(period?.finalWeek1, null);
  const f2 = toInt(period?.finalWeek2, null);

  if (mid != null && w === mid) return { type: "MIDTERM", label: "Vize" };
  if (f1 != null && w === f1) return { type: "FINAL", label: "Final" };
  if (f2 != null && w === f2) return { type: "FINAL", label: "Final" };
  return null;
}

function rotationByWeek(period, weekNo) {
  const w = toInt(weekNo, null);
  if (!w) return null;

  const rc = toInt(period?.rotationCount, 1) || 1;
  if (rc <= 1) return 1;

  const r1s = toInt(period?.rot1StartWeek, null);
  const r1e = toInt(period?.rot1EndWeek, null);
  const r2s = toInt(period?.rot2StartWeek, null);
  const r2e = toInt(period?.rot2EndWeek, null);

  if (r1s != null && r1e != null && w >= r1s && w <= r1e) return 1;
  if (r2s != null && r2e != null && w >= r2s && w <= r2e) return 2;

  return 1;
}

function canEditByStatus(status) {
  return status === "DRAFT" || status === "REVISION_REQUESTED";
}

/* ===============================
   GET /api/student/questions?periodId=...
================================ */
router.get("/questions", requireStudent, async (req, res) => {
  const studentId = String(req.user.studentId);
  const periodId = String(req.query.periodId || "");
  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ error: "Öğrenci bulunamadı" });
  if (student.periodId !== periodId) return res.status(403).json({ error: "Bu döneme erişim yok" });

  const snap = await prisma.periodReportSnapshot.findUnique({
    where: { periodId },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });

  return res.json({
    ok: true,
    periodId,
    snapshot: snap || null,
    questions: snap?.questions || [],
    totalPoints: snap?.totalPoints ?? null,
  });
});

/* ===============================
   GET /api/student/report-week?periodId=...&weekNo=...
================================ */
router.get("/report-week", requireStudent, async (req, res) => {
  const studentId = String(req.user.studentId);
  const periodId = String(req.query.periodId || "");
  const weekNo = toInt(req.query.weekNo, null);

  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  if (!weekNo) return res.status(400).json({ error: "weekNo zorunlu" });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ error: "Öğrenci bulunamadı" });
  if (student.periodId !== periodId) return res.status(403).json({ error: "Bu döneme erişim yok" });

  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: {
      periodReportSnapshot: { include: { questions: { orderBy: { orderNo: "asc" } } } },
      weekSettings: { where: { weekNo } },
    },
  });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const rotationNo = rotationByWeek(period, weekNo);
  const ex = examInfo(period, weekNo);

  const header = await prisma.weeklyReportScore.findUnique({
    where: {
      uniq_reportscore_week: { periodId, studentId, rotationNo, weekNo },
    },
  });

  const answers = await prisma.weeklyReportAnswer.findMany({
    where: { periodId, studentId, rotationNo, weekNo },
  });

  const status = header?.status || "DRAFT";
  const canEdit = canEditByStatus(status);

  const weekSetting = period.weekSettings?.[0] || null;
  const canSeeScores = !!period.studentCanSeeReportScores && !!weekSetting?.studentCanSeeReportScore;

  return res.json({
    ok: true,
    meta: {
      periodId,
      weekNo,
      rotationNo,
      exam: ex ? ex.label : null,
      status,
      canEdit,
      canSeeScores,
      totalScore: header?.score ?? null,
      teacherNote: header?.note ?? null,
    },
    questions: period.periodReportSnapshot?.questions || [],
    answers: answers || [],
  });
});

/* ===============================
   PUT /api/student/report-week
================================ */
router.put("/report-week", requireStudent, async (req, res) => {
  const studentId = String(req.user.studentId);
  const periodId = String(req.body?.periodId || "");
  const weekNo = toInt(req.body?.weekNo, null);
  const answersIn = Array.isArray(req.body?.answers) ? req.body.answers : [];

  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  if (!weekNo) return res.status(400).json({ error: "weekNo zorunlu" });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ error: "Öğrenci bulunamadı" });
  if (student.periodId !== periodId) return res.status(403).json({ error: "Bu döneme erişim yok" });

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const rotationNo = rotationByWeek(period, weekNo);

  const header = await prisma.weeklyReportScore.upsert({
    where: { uniq_reportscore_week: { periodId, studentId, rotationNo, weekNo } },
    create: { periodId, studentId, rotationNo, weekNo, score: 0, status: "DRAFT" },
    update: {},
  });

  if (!canEditByStatus(header.status)) {
    return res.status(409).json({ error: `Rapor kilitli. Durum: ${header.status}` });
  }

  const snapshot = await prisma.periodReportSnapshot.findUnique({
    where: { periodId },
    include: { questions: true },
  });
  if (!snapshot) return res.status(400).json({ error: "Dönem rapor şablonu (snapshot) yok" });

  const validQuestionIds = new Set(snapshot.questions.map((q) => q.id));

  const tx = [];
  for (const a of answersIn) {
    const qid = String(a?.questionId || "");
    if (!qid || !validQuestionIds.has(qid)) continue;

    const answerText = String(a?.answerText ?? "");

    tx.push(
      prisma.weeklyReportAnswer.upsert({
        where: {
          uniq_weekly_answer: { periodId, studentId, rotationNo, weekNo, questionId: qid },
        },
        create: { periodId, studentId, rotationNo, weekNo, questionId: qid, answerText },
        update: { answerText },
      })
    );
  }

  await prisma.$transaction(tx);

  return res.json({ ok: true, status: header.status, savedCount: tx.length });
});

/* ===============================
   POST /api/student/report-week/submit
================================ */
router.post("/report-week/submit", requireStudent, async (req, res) => {
  const studentId = String(req.user.studentId);
  const periodId = String(req.body?.periodId || "");
  const weekNo = toInt(req.body?.weekNo, null);

  if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
  if (!weekNo) return res.status(400).json({ error: "weekNo zorunlu" });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return res.status(404).json({ error: "Öğrenci bulunamadı" });
  if (student.periodId !== periodId) return res.status(403).json({ error: "Bu döneme erişim yok" });

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const rotationNo = rotationByWeek(period, weekNo);

  const header = await prisma.weeklyReportScore.upsert({
    where: { uniq_reportscore_week: { periodId, studentId, rotationNo, weekNo } },
    create: { periodId, studentId, rotationNo, weekNo, score: 0, status: "DRAFT" },
    update: {},
  });

  if (["SUBMITTED", "RESUBMITTED", "APPROVED"].includes(header.status)) {
    return res.status(409).json({ error: `Zaten gönderilmiş/kilitli. Durum: ${header.status}` });
  }

  if (header.status !== "DRAFT" && header.status !== "REVISION_REQUESTED") {
    return res.status(409).json({ error: `Gönderilemez durum: ${header.status}` });
  }

  const answerCount = await prisma.weeklyReportAnswer.count({
    where: { periodId, studentId, rotationNo, weekNo },
  });
  if (answerCount === 0) return res.status(400).json({ error: "Göndermek için en az 1 cevap girilmeli" });

  const nextStatus = header.status === "DRAFT" ? "SUBMITTED" : "RESUBMITTED";

  const updated = await prisma.weeklyReportScore.update({
    where: { id: header.id },
    data: { status: nextStatus },
  });

  return res.json({ ok: true, status: updated.status });
});

export default router;
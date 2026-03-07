/**
 * CANONICAL: Teacher Reports/Evaluation Routes
 * Location: server/src/routes/teacher/reports.js
 *
 * Includes:
 *  - GET  /api/teacher/eval-form-snapshot
 *  - GET  /api/teacher/eval-form
 *  - PUT  /api/teacher/eval-item
 *  - GET  /api/teacher/reports
 *  - GET  /api/teacher/eval
 *  - PUT  /api/teacher/eval/upsert
 *
 * NOTE:
 *  - /api/teacher/attendance/bulk-theory MUST live in teacher/panel.js only (avoid duplicates).
 */

import { Router } from "express";
import { prisma } from "../../prisma.js";
import { examInfo, rotationByWeek, isPracticeOpen, toInt } from "../../utils/periodWeek.js";

const router = Router();

/* ===============================
   AUTH
================================ */
function requireTeacher(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  const t = u.userType || u.type;
  if (t !== "teacher") return res.status(403).json({ error: "Forbidden" });

  if (!u.teacherId) return res.status(401).json({ error: "teacherId missing in token" });
  next();
}

/* ===============================
   HELPERS
================================ */
function getRotationWeeks(period, rotationNo) {
  const rot = Number(rotationNo);
  const s = rot === 1 ? Number(period?.rot1StartWeek) : Number(period?.rot2StartWeek);
  const e = rot === 1 ? Number(period?.rot1EndWeek) : Number(period?.rot2EndWeek);
  if (!s || !e) return [];

  const mid = Number(period?.midtermWeek || 0);
  const f1 = Number(period?.finalWeek1 || 0);
  const f2 = Number(period?.finalWeek2 || 0);

  const weeks = [];
  for (let w = s; w <= e; w++) {
    if (w === mid || w === f1 || w === f2) continue;
    weeks.push(w);
  }
  return weeks;
}

// 0..5 aralığı clamp
function clamp05(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return Math.round(n);
}

const VISIBLE_REPORT_STATUSES = [
  "SUBMITTED",
  "RESUBMITTED",
  "REVISION_REQUESTED",
  "APPROVED",
];

/**
 * ✅ GET /api/teacher/eval-form-snapshot?periodId=...
 */
router.get("/eval-form-snapshot", requireTeacher, async (req, res) => {
  try {
    const { periodId } = req.query;
    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

    const snap = await prisma.periodEvalSnapshot.findUnique({
      where: { periodId: String(periodId) },
      include: {
        groups: {
          orderBy: { orderNo: "asc" },
          include: { items: { orderBy: { orderNo: "asc" } } },
        },
      },
    });

    if (!snap) return res.json(null);

    return res.json({
      id: snap.id,
      periodId: snap.periodId,
      openQuestionText: snap.openQuestionText || "",
      groups: (snap.groups || []).map((g) => ({
        id: g.id,
        title: g.title,
        orderNo: g.orderNo,
        totalPoints: g.totalPoints,
        items: (g.items || []).map((it) => ({
          id: it.id,
          text: it.text,
          points: it.points,
          isActive: it.isActive,
          orderNo: it.orderNo,
        })),
      })),
    });
  } catch (e) {
    console.error("eval-form-snapshot error:", e);
    return res.status(500).json({ error: "Form snapshot yüklenemedi" });
  }
});

// GET /api/teacher/eval-form?periodId=&studentId=&weekNo=&rotationNo=
router.get("/eval-form", requireTeacher, async (req, res) => {
  try {
    const { periodId, studentId, weekNo, rotationNo } = req.query;

    if (!periodId || !studentId || !weekNo || !rotationNo) {
      return res.status(400).json({ error: "periodId, studentId, weekNo, rotationNo zorunlu" });
    }

    const w = Number(weekNo);
    const rot = Number(rotationNo);
    if (!w || !rot) return res.status(400).json({ error: "weekNo/rotationNo geçersiz" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında değerlendirme açılamaz" });

    const snap = await prisma.periodEvalSnapshot.findUnique({
      where: { periodId: String(periodId) },
      include: {
        groups: { orderBy: { orderNo: "asc" }, include: { items: { orderBy: { orderNo: "asc" } } } },
      },
    });
    if (!snap) return res.json({ snapshot: null });

    const weeks = getRotationWeeks(period, rot);

    const itemScores = await prisma.weeklyEvaluationItemScore.findMany({
      where: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rot),
        weekNo: { in: weeks.length ? weeks : [w] },
      },
      select: { weekNo: true, itemId: true, score: true },
    });

    const byWeek = {};
    for (const s of itemScores) {
      if (!byWeek[s.weekNo]) byWeek[s.weekNo] = {};
      byWeek[s.weekNo][s.itemId] = s.score ?? 0;
    }

    const current = byWeek[w] || {};

    return res.json({
      snapshot: {
        id: snap.id,
        periodId: snap.periodId,
        openQuestionText: snap.openQuestionText || "",
        groups: (snap.groups || []).map((g) => ({
          id: g.id,
          title: g.title,
          orderNo: g.orderNo,
          totalPoints: g.totalPoints,
          items: (g.items || []).map((it) => ({
            id: it.id,
            text: it.text,
            points: it.points,
            orderNo: it.orderNo,
            isActive: it.isActive,
          })),
        })),
      },
      rotationWeeks: weeks,
      scoresByWeek: byWeek,
      currentWeekScores: current,
    });
  } catch (e) {
    console.error("eval-form error:", e);
    return res.status(500).json({ error: "Eval form yüklenemedi" });
  }
});

// PUT /api/teacher/eval-item  { periodId, studentId, weekNo, rotationNo, itemId, score }
router.put("/eval-item", requireTeacher, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, studentId, itemId } = req.body || {};
    const w = toInt(req.body?.weekNo, null);
    const rot = toInt(req.body?.rotationNo, null);
    const score = clamp05(req.body?.score);

    if (!periodId || !studentId || !itemId)
      return res.status(400).json({ error: "periodId + studentId + itemId zorunlu" });
    if (!w) return res.status(400).json({ error: "weekNo zorunlu" });
    if (!rot) return res.status(400).json({ error: "rotationNo zorunlu" });

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { hospitals: true },
    });
    if (!teacher) return res.status(404).json({ error: "Gözlemci bulunamadı" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında değerlendirme yapılamaz" });

    const computedRot = rotationByWeek(period, w);
    if (!computedRot || Number(computedRot) !== Number(rot)) {
      return res.status(400).json({ error: "Bu hafta rotasyon/rotationNo uyuşmuyor" });
    }

    const practiceEnabled = isPracticeOpen(period, rot, w);
    if (!practiceEnabled) return res.status(400).json({ error: "Uygulama kapalı" });

    const att = await prisma.attendance.findUnique({
      where: {
        uniq_attendance_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rot),
          weekNo: Number(w),
        },
      },
    });

    const present = att ? !(att.practiceAbsent ?? false) : false;
    if (!present) return res.status(403).json({ error: "Uygulamaya gelmeyen öğrenci değerlendirilemez" });

    if (!teacher.isCoordinator) {
      const hospitalIds = (teacher.hospitals || []).map((x) => x.hospitalId);
      const dayFilter = Array.isArray(teacher.practiceDays) ? teacher.practiceDays : [];

      const assg = await prisma.studentAssignment.findFirst({
        where: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rot),
          hospitalId: { in: hospitalIds },
          dayOfWeek: { in: dayFilter },
        },
        select: { id: true },
      });

      if (!assg) {
        return res.status(403).json({ error: "Bu öğrenci için yetkin yok (gün/hastane eşleşmiyor)" });
      }
    }

    const snap = await prisma.periodEvalSnapshot.findUnique({
      where: { periodId: String(periodId) },
      include: { groups: { include: { items: true } } },
    });
    if (!snap) return res.status(400).json({ error: "Bu dönem için eval snapshot yok" });

    const allItems = (snap.groups || []).flatMap((g) => g.items || []);
    const it = allItems.find((x) => x.id === String(itemId));
    if (!it) return res.status(404).json({ error: "Madde bulunamadı (snapshot itemId)" });
    if (!it.isActive) return res.status(400).json({ error: "Madde pasif" });

    const saved = await prisma.weeklyEvaluationItemScore.upsert({
      where: {
        uniq_evalitem_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rot),
          weekNo: Number(w),
          itemId: String(itemId),
        },
      },
      create: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rot),
        weekNo: Number(w),
        itemId: String(itemId),
        score,
        gradedBy: teacherId,
      },
      update: { score, gradedBy: teacherId },
    });

    // weeklyEvaluationScore'u item'lardan türet
    const activeItems = allItems.filter((x) => x.isActive);
    const weekItemScores = await prisma.weeklyEvaluationItemScore.findMany({
      where: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rot),
        weekNo: Number(w),
      },
      select: { itemId: true, score: true },
    });

    const scoreMap = new Map(weekItemScores.map((x) => [x.itemId, x.score ?? 0]));
    const totalEarned = activeItems.reduce((acc, x) => {
      const s = Number(scoreMap.get(x.id) || 0);
      if (!s) return acc;
      return acc + (s / 5) * Number(x.points || 0);
    }, 0);

    await prisma.weeklyEvaluationScore.upsert({
      where: {
        uniq_evalscore_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rot),
          weekNo: Number(w),
        },
      },
      create: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rot),
        weekNo: Number(w),
        score: Number(totalEarned.toFixed(2)),
        note: null,
        gradedBy: teacherId,
      },
      update: { score: Number(totalEarned.toFixed(2)), gradedBy: teacherId },
    });

    return res.json({ ok: true, item: saved, weeklyTotal: Number(totalEarned.toFixed(2)) });
  } catch (e) {
    console.error("eval-item error:", e);
    return res.status(500).json({ error: "Kaydedilemedi" });
  }
});

// GET /api/teacher/reports?periodId=&weekNo=&scope=observer|coordinator
router.get("/reports", requireTeacher, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, weekNo, scope = "observer" } = req.query;

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    const w = toInt(weekNo, null);
    if (!w) return res.status(400).json({ error: "weekNo zorunlu" });

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { hospitals: true },
    });
    if (!teacher) return res.status(404).json({ error: "Gözlemci bulunamadı" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.json({ mode: "EXAM", exam: ex, items: [] });

    const isCoordinatorScope = scope === "coordinator" && teacher.isCoordinator;

    const rot = rotationByWeek(period, w);
    if (!rot) return res.json({ mode: "NO_ROTATION", items: [] });

    let scopedStudentIds = [];
    if (isCoordinatorScope) {
      const assg = await prisma.studentAssignment.findMany({
        where: { periodId: String(periodId), rotationNo: Number(rot) },
        select: { studentId: true },
      });
      scopedStudentIds = assg.map((x) => x.studentId);
    } else {
      const hospitalIds = (teacher.hospitals || []).map((x) => x.hospitalId);
      const dayFilter = Array.isArray(teacher.practiceDays) ? teacher.practiceDays : [];

      const assg = await prisma.studentAssignment.findMany({
        where: {
          periodId: String(periodId),
          rotationNo: Number(rot),
          hospitalId: { in: hospitalIds },
          dayOfWeek: { in: dayFilter },
        },
        select: { studentId: true },
      });
      scopedStudentIds = assg.map((x) => x.studentId);
    }

    if (!scopedStudentIds.length) {
      return res.json({ mode: isCoordinatorScope ? "COORDINATOR" : "OBSERVER", items: [] });
    }

    const snap = await prisma.periodReportSnapshot.findUnique({
      where: { periodId: String(periodId) },
      include: { questions: { orderBy: { orderNo: "asc" } } },
    });
    if (!snap) return res.json({ mode: "NO_SNAPSHOT", items: [] });

    const qs = (snap.questions || []).filter((q) => q.isActive);

    // Öğretmen sadece gönderilmiş raporları görsün
    const visibleHeaders = await prisma.weeklyReportScore.findMany({
      where: {
        periodId: String(periodId),
        rotationNo: Number(rot),
        weekNo: Number(w),
        studentId: { in: scopedStudentIds },
        status: { in: VISIBLE_REPORT_STATUSES },
      },
    });

    const visibleStudentIds = visibleHeaders.map((x) => x.studentId);
    if (!visibleStudentIds.length) {
      return res.json({ mode: isCoordinatorScope ? "COORDINATOR" : "OBSERVER", items: [] });
    }

    const answers = await prisma.weeklyReportAnswer.findMany({
      where: {
        periodId: String(periodId),
        rotationNo: Number(rot),
        weekNo: Number(w),
        studentId: { in: visibleStudentIds },
      },
    });

    const byStudent = new Map();
    for (const a of answers) {
      if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, new Map());
      byStudent.get(a.studentId).set(a.questionId, a.answerText || "");
    }

    const students = await prisma.student.findMany({
      where: { id: { in: visibleStudentIds } },
      orderBy: { nameSurname: "asc" },
    });

    const headerMap = new Map(visibleHeaders.map((x) => [x.studentId, x]));

    let questionScoreMap = new Map();
    if (isCoordinatorScope) {
      const questionScores = await prisma.weeklyReportQuestionScore.findMany({
        where: {
          periodId: String(periodId),
          rotationNo: Number(rot),
          weekNo: Number(w),
          studentId: { in: visibleStudentIds },
        },
      });

      questionScoreMap = new Map(
        questionScores.map((x) => [`${x.studentId}::${x.questionId}`, x])
      );
    }

    const out = students.map((s) => {
      const amap = byStudent.get(s.id) || new Map();
      const header = headerMap.get(s.id) || null;

      return {
        studentId: s.id,
        studentNo: s.studentNo,
        nameSurname: s.nameSurname,
        photoUrl: s.photoUrl,
        weekNo: w,
        rotationNo: Number(rot),
        status: header?.status ?? null,
        totalScore: isCoordinatorScope ? header?.score ?? null : null,
        note: isCoordinatorScope ? header?.note ?? null : null,
        answers: qs.map((q) => {
          const qScore = isCoordinatorScope
            ? questionScoreMap.get(`${s.id}::${q.id}`) || null
            : null;

          return {
            questionId: q.id,
            text: q.text,
            points: q.points,
            answerText: amap.get(q.id) || "",
            teacherScore: isCoordinatorScope ? qScore?.score ?? null : null,
            teacherComment: isCoordinatorScope ? qScore?.comment ?? null : null,
          };
        }),
      };
    });

    return res.json({
      mode: isCoordinatorScope ? "COORDINATOR" : "OBSERVER",
      items: out,
    });
  } catch (e) {
    console.error("GET /teacher/reports error:", e);
    return res.status(500).json({ error: "Rapor listesi alınamadı" });
  }
});

// GET /api/teacher/eval?periodId=&weekNo=&scope=observer|coordinator
router.get("/eval", requireTeacher, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, weekNo, scope = "observer" } = req.query;

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    const w = toInt(weekNo, null);
    if (!w) return res.status(400).json({ error: "weekNo zorunlu" });

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { hospitals: true },
    });
    if (!teacher) return res.status(404).json({ error: "Gözlemci bulunamadı" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.json({ mode: "EXAM", exam: ex, items: [] });

    const isCoordinatorScope = scope === "coordinator" && teacher.isCoordinator;

    const rot = rotationByWeek(period, w);
    if (!rot) return res.json({ mode: "NO_ROTATION", items: [] });

    const practiceEnabled = isPracticeOpen(period, rot, w);
    if (!practiceEnabled) return res.json({ mode: "PRACTICE_CLOSED", items: [] });

    const hospitalIds = (teacher.hospitals || []).map((x) => x.hospitalId);
    const dayFilter = Array.isArray(teacher.practiceDays) ? teacher.practiceDays : [];

    const where = {
      periodId: String(periodId),
      rotationNo: Number(rot),
      ...(isCoordinatorScope ? {} : { hospitalId: { in: hospitalIds } }),
      ...(isCoordinatorScope ? {} : { dayOfWeek: { in: dayFilter } }),
    };

    const assg = await prisma.studentAssignment.findMany({
      where,
      include: { student: true, hospital: true, unit: true },
      orderBy: [{ dayOfWeek: "asc" }, { hospital: { name: "asc" } }, { student: { nameSurname: "asc" } }],
    });

    const studentIds = assg.map((x) => x.studentId);

    const atts = await prisma.attendance.findMany({
      where: {
        periodId: String(periodId),
        rotationNo: Number(rot),
        weekNo: Number(w),
        studentId: { in: studentIds },
      },
    });
    const attMap = new Map(atts.map((a) => [a.studentId, a]));
    const presentIds = studentIds.filter((sid) => !(attMap.get(sid)?.practiceAbsent ?? true));

    const evals = await prisma.weeklyEvaluationScore.findMany({
      where: {
        periodId: String(periodId),
        rotationNo: Number(rot),
        weekNo: Number(w),
        studentId: { in: studentIds },
      },
    });
    const evalMap = new Map(evals.map((e) => [e.studentId, e]));

    const out = assg.map((a) => {
      const present = presentIds.includes(a.studentId);
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
        rotationNo: Number(rot),
        present,
        evalScore: evalMap.get(a.studentId)?.score ?? null,
        evalNote: evalMap.get(a.studentId)?.note ?? null,
      };
    });

    return res.json({
      mode: isCoordinatorScope ? "COORDINATOR" : "OBSERVER",
      rotationNo: Number(rot),
      items: out,
    });
  } catch (e) {
    console.error("GET /teacher/eval error:", e);
    return res.status(500).json({ error: "Değerlendirme listesi alınamadı" });
  }
});

// PUT /api/teacher/eval/upsert  { periodId, studentId, weekNo, rotationNo, score, note }
router.put("/eval/upsert", requireTeacher, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, studentId, score, note } = req.body || {};
    const w = toInt(req.body?.weekNo, null);
    const rot = toInt(req.body?.rotationNo, null);

    if (!periodId || !studentId) return res.status(400).json({ error: "periodId + studentId zorunlu" });
    if (!w) return res.status(400).json({ error: "weekNo zorunlu" });
    if (!rot) return res.status(400).json({ error: "rotationNo zorunlu" });
    if (score === undefined) return res.status(400).json({ error: "score zorunlu" });

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { hospitals: true },
    });
    if (!teacher) return res.status(404).json({ error: "Gözlemci bulunamadı" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında değerlendirme yapılamaz" });

    const computedRot = rotationByWeek(period, w);
    if (!computedRot || Number(computedRot) !== Number(rot)) {
      return res.status(400).json({ error: "Bu hafta rotasyon/rotationNo uyuşmuyor" });
    }

    const practiceEnabled = isPracticeOpen(period, rot, w);
    if (!practiceEnabled) return res.status(400).json({ error: "Uygulama kapalı" });

    const att = await prisma.attendance.findUnique({
      where: {
        uniq_attendance_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rot),
          weekNo: Number(w),
        },
      },
    });
    const present = att ? !(att.practiceAbsent ?? false) : false;
    if (!present) return res.status(403).json({ error: "Uygulamaya gelmeyen öğrenci değerlendirilemez" });

    if (!teacher.isCoordinator) {
      const hospitalIds = (teacher.hospitals || []).map((x) => x.hospitalId);
      const dayFilter = Array.isArray(teacher.practiceDays) ? teacher.practiceDays : [];

      const assg = await prisma.studentAssignment.findFirst({
        where: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rot),
          hospitalId: { in: hospitalIds },
          dayOfWeek: { in: dayFilter },
        },
        select: { id: true },
      });
      if (!assg) return res.status(403).json({ error: "Bu öğrenci için yetkin yok (gün/hastane eşleşmiyor)" });
    }

    const item = await prisma.weeklyEvaluationScore.upsert({
      where: {
        uniq_evalscore_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rot),
          weekNo: Number(w),
        },
      },
      create: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rot),
        weekNo: Number(w),
        score: Number(score),
        note: note ? String(note) : null,
        gradedBy: teacherId,
      },
      update: {
        score: Number(score),
        note: note !== undefined ? (note ? String(note) : null) : undefined,
        gradedBy: teacherId,
      },
    });

    return res.json({ ok: true, item });
  } catch (e) {
    console.error("PUT /teacher/eval/upsert error:", e);
    return res.status(500).json({ error: "Değerlendirme kaydedilemedi" });
  }
});

export default router;
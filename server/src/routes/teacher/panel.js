/**
 * CANONICAL: Teacher Panel Routes
 * Location: server/src/routes/teacher/panel.js
 * Responsibilities:
 *   - GET  /api/teacher/me
 *   - GET  /api/teacher/students
 *   - PUT  /api/teacher/attendance
 *   - PUT  /api/teacher/attendance/bulk-theory
 * Notes:
 *   - Report/Eval/Scoring endpoints MUST NOT be added here.
 */

import { Router } from "express";
import { prisma } from "../../prisma.js";

const router = Router();

/* ===============================
   SWAGGER (PANEL)
================================ */

/**
 * @openapi
 * /api/teacher/me:
 *   get:
 *     tags: [Teacher]
 *     summary: Teacher profile (me)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Teacher object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @openapi
 * /api/teacher/students:
 *   get:
 *     tags: [Teacher]
 *     summary: Teacher student list for given period/week (observer/coordinator scope)
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
 *       - in: query
 *         name: scope
 *         required: false
 *         schema:
 *           type: string
 *           enum: [observer, coordinator]
 *         description: coordinator scope requires teacher.isCoordinator
 *     responses:
 *       200:
 *         description: Student attendance/eval list
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /api/teacher/attendance:
 *   put:
 *     tags: [Teacher]
 *     summary: Mark attendance (theory or practice) for a student
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [periodId, studentId, weekNo]
 *             properties:
 *               periodId: { type: string }
 *               studentId: { type: string }
 *               weekNo: { type: integer, minimum: 1 }
 *               theoryAbsent: { type: boolean, nullable: true }
 *               practiceAbsent: { type: boolean, nullable: true }
 *           examples:
 *             theory:
 *               summary: Theory attendance (coordinator only)
 *               value: { periodId: "xxx", studentId: "yyy", weekNo: 3, theoryAbsent: false }
 *             practice:
 *               summary: Practice attendance (rotation week only)
 *               value: { periodId: "xxx", studentId: "yyy", weekNo: 5, practiceAbsent: false }
 *     responses:
 *       200:
 *         description: Attendance upsert result
 *       400:
 *         description: Validation/business rule error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /api/teacher/attendance/bulk-theory:
 *   put:
 *     tags: [Teacher]
 *     summary: Bulk mark theory attendance for all students in a period (coordinator only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [periodId, weekNo, theoryAbsent]
 *             properties:
 *               periodId: { type: string }
 *               weekNo: { type: integer, minimum: 1 }
 *               theoryAbsent: { type: boolean }
 *     responses:
 *       200:
 *         description: Bulk upsert summary
 *       400:
 *         description: Validation/business rule error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */

/* ===============================
   AUTH
================================ */
function getUserType(u) {
  return (u?.role || u?.userType || u?.type || "").toString().trim().toUpperCase();
}

function requireTeacher(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  const t = getUserType(u);
  if (t !== "TEACHER" && t !== "OBSERVER" && t !== "COORDINATOR") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!u.teacherId) return res.status(401).json({ error: "teacherId missing in token" });
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

  if (mid != null && w === mid) return { code: "MIDTERM", label: "Vize haftası" };
  if (f1 != null && w === f1) return { code: "FINAL", label: "Final haftası" };
  if (f2 != null && w === f2) return { code: "FINAL2", label: "Final haftası" };
  return null;
}

function rotationByWeek(period, weekNo) {
  const w = toInt(weekNo, null);
  if (!w) return null;
  if (examInfo(period, w)) return null;

  const r1s = toInt(period?.rot1StartWeek, null);
  const r1e = toInt(period?.rot1EndWeek, null);
  const r2s = toInt(period?.rot2StartWeek, null);
  const r2e = toInt(period?.rot2EndWeek, null);

  if (r1s != null && r1e != null && w >= r1s && w <= r1e) return 1;
  if (r2s != null && r2e != null && w >= r2s && w <= r2e) return 2;
  return null;
}

function isPracticeOpen(period, rotationNo, weekNo) {
  const w = toInt(weekNo, null);
  const rot = toInt(rotationNo, null);
  if (!w || !rot) return false;
  if (examInfo(period, w)) return false;

  const s = rot === 1 ? toInt(period?.rot1StartWeek, null) : toInt(period?.rot2StartWeek, null);
  const e = rot === 1 ? toInt(period?.rot1EndWeek, null) : toInt(period?.rot2EndWeek, null);
  if (s == null || e == null) return false;
  return w >= s && w <= e;
}

/* ===============================
   GET /api/teacher/me
================================ */
router.get("/me", requireTeacher, async (req, res) => {
  const teacherId = String(req.user.teacherId);

  const t = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { period: true, hospitals: { include: { hospital: true } } },
  });

  if (!t) return res.status(404).json({ error: "Gözlemci bulunamadı" });
  res.json(t);
});

/* ===============================
   GET /api/teacher/students
================================ */
router.get("/students", requireTeacher, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, weekNo, scope = "observer" } = req.query;

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    const w = Number(weekNo);
    if (!w) return res.status(400).json({ error: "weekNo zorunlu" });

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { hospitals: true },
    });
    if (!teacher) return res.status(404).json({ error: "Gözlemci bulunamadı" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.json({ mode: "EXAM", exam: ex, rotationNo: null, items: [] });

    const isCoordinatorScope = scope === "coordinator" && teacher.isCoordinator;
    const rot = rotationByWeek(period, w);

    // rotasyon yok
    if (!rot) {
      if (!isCoordinatorScope) return res.json({ mode: "NO_ROTATION", rotationNo: null, items: [] });

      const students = await prisma.student.findMany({
        where: { periodId: String(periodId) },
        orderBy: { nameSurname: "asc" },
      });

      const theoryAtt = await prisma.attendance.findMany({
        where: {
          periodId: String(periodId),
          weekNo: Number(w),
          rotationNo: 0,
          studentId: { in: students.map((s) => s.id) },
        },
      });
      const theoryMap = new Map(theoryAtt.map((a) => [a.studentId, a]));

      const out = students.map((s) => {
        const at = theoryMap.get(s.id) || null;
        return {
          assignmentId: null,
          studentId: s.id,
          studentNo: s.studentNo,
          nameSurname: s.nameSurname,
          photoUrl: s.photoUrl,
          sex: s.sex,
          dayOfWeek: null,
          hospitalName: null,
          unitName: null,
          weekNo: w,
          rotationNo: 0,

          theoryAbsent: at ? (at.theoryAbsent ?? null) : null,
          practiceAbsent: null,

          practiceEnabled: false,
          practicePresent: false,
          theoryEnabled: isCoordinatorScope,
          evalDone: false,
        };
      });

      return res.json({ mode: "THEORY_ONLY", rotationNo: null, items: out });
    }

    // rotasyon var
    const hospitalIds = Array.isArray(teacher.hospitals) ? teacher.hospitals.map((x) => x.hospitalId) : [];
    const dayFilter = Array.isArray(teacher.practiceDays) ? teacher.practiceDays : [];

    const where = {
      periodId: String(periodId),
      rotationNo: Number(rot),
      ...(isCoordinatorScope ? {} : { hospitalId: { in: hospitalIds } }),
      ...(isCoordinatorScope ? {} : { dayOfWeek: { in: dayFilter } }),
    };

    const assignments = await prisma.studentAssignment.findMany({
      where,
      include: { student: true, hospital: true, unit: true },
      orderBy: [{ dayOfWeek: "asc" }, { hospital: { name: "asc" } }, { student: { nameSurname: "asc" } }],
    });

    const studentIds = assignments.map((a) => a.studentId);
    const practiceEnabled = isPracticeOpen(period, Number(rot), w);

    const practiceAtt = await prisma.attendance.findMany({
      where: { periodId: String(periodId), weekNo: Number(w), rotationNo: Number(rot), studentId: { in: studentIds } },
    });

    const theoryAtt = await prisma.attendance.findMany({
      where: { periodId: String(periodId), weekNo: Number(w), rotationNo: 0, studentId: { in: studentIds } },
    });

    const practiceMap = new Map(practiceAtt.map((a) => [a.studentId, a]));
    const theoryMap = new Map(theoryAtt.map((a) => [a.studentId, a]));

    const evalDoneMap = new Map();
    if (studentIds.length) {
      const evalRows = await prisma.weeklyEvaluationScore.findMany({
        where: {
          periodId: String(periodId),
          rotationNo: Number(rot),
          weekNo: Number(w),
          studentId: { in: studentIds },
        },
        select: { studentId: true },
      });
      for (const r of evalRows) evalDoneMap.set(r.studentId, true);
    }

    const out = assignments.map((a) => {
      const ap = practiceMap.get(a.studentId) || null;
      const at = theoryMap.get(a.studentId) || null;

      const practiceAbsent = ap ? (ap.practiceAbsent ?? null) : null;
      const theoryAbsent = at ? (at.theoryAbsent ?? null) : null;

      return {
        assignmentId: a.id,
        studentId: a.studentId,
        studentNo: a.student.studentNo,
        nameSurname: a.student.nameSurname,
        photoUrl: a.student.photoUrl,
        sex: a.student.sex,
        dayOfWeek: a.dayOfWeek,
        hospitalName: a.hospital?.name,
        unitName: a.unit?.name,
        weekNo: w,
        rotationNo: Number(rot),

        theoryAbsent,
        practiceAbsent,

        practiceEnabled,
        practicePresent: practiceEnabled ? practiceAbsent === false : false,
        theoryEnabled: isCoordinatorScope,
        evalDone: !!evalDoneMap.get(a.studentId),
      };
    });

    return res.json({ mode: isCoordinatorScope ? "COORDINATOR" : "OBSERVER", rotationNo: Number(rot), items: out });
  } catch (e) {
    console.error("GET /teacher/students error:", e);
    return res.status(500).json({ error: "Server error (students)" });
  }
});

/* ===============================
   PUT /api/teacher/attendance
================================ */
router.put("/attendance", requireTeacher, async (req, res) => {
  const teacherId = String(req.user.teacherId);
  const { periodId, studentId } = req.body || {};
  const w = toInt(req.body?.weekNo, null);

  if (!periodId || !studentId) return res.status(400).json({ error: "periodId + studentId zorunlu" });
  if (!w) return res.status(400).json({ error: "weekNo zorunlu" });

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { hospitals: true },
  });
  if (!teacher) return res.status(404).json({ error: "Gözlemci bulunamadı" });

  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const ex = examInfo(period, w);
  if (ex) return res.status(400).json({ error: "Sınav haftasında yoklama alınamaz" });

  const computedRot = rotationByWeek(period, w);

  const wantsTheory = req.body.theoryAbsent !== undefined;
  const wantsPractice = req.body.practiceAbsent !== undefined;

  if (!wantsTheory && !wantsPractice) return res.status(400).json({ error: "theoryAbsent veya practiceAbsent gönder" });
  if (wantsTheory && wantsPractice)
    return res.status(400).json({ error: "Aynı anda theoryAbsent ve practiceAbsent gönderme" });

  let rotationNo = 0;
  let patch = {};
  let practiceOpen = false;

  if (wantsTheory) {
    if (!teacher.isCoordinator) return res.status(403).json({ error: "Teorik yoklama için koordinatör yetkisi gerekli" });
    rotationNo = 0;
    patch = { theoryAbsent: !!req.body.theoryAbsent };
  } else {
    if (!computedRot) return res.status(400).json({ error: "Rotasyon haftası değil: uygulama yoklaması alınamaz" });
    rotationNo = Number(computedRot);

    practiceOpen = isPracticeOpen(period, rotationNo, w);
    if (!practiceOpen) return res.status(400).json({ error: "Uygulama yoklaması bu haftada kapalı" });

    if (!teacher.isCoordinator) {
      const hospitalIds = Array.isArray(teacher.hospitals) ? teacher.hospitals.map((x) => x.hospitalId) : [];
      const dayFilter = Array.isArray(teacher.practiceDays) ? teacher.practiceDays : [];

      const assg = await prisma.studentAssignment.findFirst({
        where: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rotationNo),
          hospitalId: { in: hospitalIds },
          dayOfWeek: { in: dayFilter },
        },
        select: { id: true },
      });
      if (!assg) return res.status(403).json({ error: "Bu öğrenci için yetkin yok (gün/hastane eşleşmiyor)" });
    }

    patch = { practiceAbsent: !!req.body.practiceAbsent };
  }

  const a = await prisma.attendance.upsert({
    where: {
      uniq_attendance_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
        weekNo: Number(w),
      },
    },
    update: { ...patch, markedBy: teacherId },
    create: {
      periodId: String(periodId),
      studentId: String(studentId),
      rotationNo: Number(rotationNo),
      weekNo: Number(w),
      markedBy: teacherId,
      ...patch,
    },
  });

  return res.json({
    ok: true,
    attendance: a,
    enforced: {
      weekNo: w,
      rotationNo,
      exam: false,
      practiceOpen: wantsPractice ? practiceOpen : false,
      theoryOpen: wantsTheory ? !!teacher.isCoordinator : false,
    },
  });
});

/* ===============================
   PUT /api/teacher/attendance/bulk-theory
================================ */
router.put("/attendance/bulk-theory", requireTeacher, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, weekNo, theoryAbsent } = req.body || {};

    if (!periodId || !weekNo) return res.status(400).json({ error: "periodId ve weekNo zorunlu" });
    if (typeof theoryAbsent !== "boolean") return res.status(400).json({ error: "theoryAbsent boolean olmalı" });

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, isCoordinator: true },
    });
    if (!teacher) return res.status(404).json({ error: "Gözlemci bulunamadı" });
    if (!teacher.isCoordinator) return res.status(403).json({ error: "Koordinatör yetkisi gerekli" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const w = Number(weekNo);
    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında yoklama alınamaz" });

    const students = await prisma.student.findMany({
      where: { periodId: String(periodId) },
      select: { id: true },
    });
    const studentIds = students.map((s) => s.id);

    const rotationNo = 0;

    await prisma.$transaction(
      studentIds.map((studentId) =>
        prisma.attendance.upsert({
          where: {
            uniq_attendance_week: {
              periodId: String(periodId),
              studentId: String(studentId),
              rotationNo: Number(rotationNo),
              weekNo: Number(w),
            },
          },
          update: { theoryAbsent: Boolean(theoryAbsent), markedBy: teacherId },
          create: {
            periodId: String(periodId),
            studentId: String(studentId),
            rotationNo: Number(rotationNo),
            weekNo: Number(w),
            theoryAbsent: Boolean(theoryAbsent),
            markedBy: teacherId,
          },
        })
      )
    );

    return res.json({ ok: true, count: studentIds.length });
  } catch (e) {
    console.error("bulk-theory error:", e);
    return res.status(500).json({ error: "Toplu işlem başarısız" });
  }
});

export default router;
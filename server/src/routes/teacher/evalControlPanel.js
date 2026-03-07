import { Router } from "express";
import { prisma } from "../../prisma.js";

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
function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function examWeeks(period) {
  return [
    toInt(period?.midtermWeek, null),
    toInt(period?.finalWeek1, null),
    toInt(period?.finalWeek2, null),
  ].filter(Boolean);
}

function isExamWeek(period, weekNo) {
  return examWeeks(period).includes(Number(weekNo));
}

function getRotationByWeek(period, weekNo) {
  const w = Number(weekNo);

  const r1s = toInt(period?.rot1StartWeek, null);
  const r1e = toInt(period?.rot1EndWeek, null);
  const r2s = toInt(period?.rot2StartWeek, null);
  const r2e = toInt(period?.rot2EndWeek, null);

  if (r1s != null && r1e != null && w >= r1s && w <= r1e) return 1;
  if (r2s != null && r2e != null && w >= r2s && w <= r2e) return 2;
  return null;
}

function isPracticeRelevant(period, weekNo, currentWeekNo) {
  const w = Number(weekNo);
  if (w > Number(currentWeekNo || 1)) return false;
  if (isExamWeek(period, w)) return false;
  return !!getRotationByWeek(period, w);
}

/* ===============================
   GET EVAL CONTROL PANEL
================================ */
router.get("/eval-control", requireTeacher, async (req, res) => {
  try {
    const periodId = String(req.query.periodId || "");
    if (!periodId) {
      return res.status(400).json({ error: "periodId zorunlu" });
    }

    const period = await prisma.period.findUnique({
      where: { id: periodId },
    });
    if (!period) {
      return res.status(404).json({ error: "Dönem bulunamadı" });
    }

    const currentWeekNo = toInt(period.currentWeekNo, 1) || 1;

    const students = await prisma.student.findMany({
      where: { periodId },
      orderBy: { nameSurname: "asc" },
    });
    const studentIds = students.map((s) => s.id);

    const assignments = await prisma.studentAssignment.findMany({
      where: {
        periodId,
        studentId: { in: studentIds },
      },
      include: {
        hospital: true,
        unit: true,
      },
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        periodId,
        studentId: { in: studentIds },
        weekNo: { lte: currentWeekNo },
      },
    });

    const evalScores = await prisma.weeklyEvaluationScore.findMany({
      where: {
        periodId,
        studentId: { in: studentIds },
        weekNo: { lte: currentWeekNo },
      },
    });

    const evalItemScores = await prisma.weeklyEvaluationItemScore.findMany({
      where: {
        periodId,
        studentId: { in: studentIds },
        weekNo: { lte: currentWeekNo },
      },
      select: {
        studentId: true,
        weekNo: true,
        rotationNo: true,
        itemId: true,
        score: true,
      },
    });

    const assignmentMap = new Map();
    for (const a of assignments) {
      assignmentMap.set(`${a.studentId}_${a.rotationNo}`, a);
    }

    const attendanceMap = new Map();
    for (const a of attendances) {
      attendanceMap.set(`${a.studentId}_${a.rotationNo}_${a.weekNo}`, a);
    }

    const evalMap = new Map();
    for (const e of evalScores) {
      evalMap.set(`${e.studentId}_${e.rotationNo}_${e.weekNo}`, e);
    }

    const itemCoverageMap = new Map();
    for (const it of evalItemScores) {
      const key = `${it.studentId}_${it.rotationNo}`;
      if (!itemCoverageMap.has(key)) itemCoverageMap.set(key, new Set());
      if (Number(it.score || 0) > 0) {
        itemCoverageMap.get(key).add(it.itemId);
      }
    }

    const items = students.map((s) => {
      const rot1Assg = assignmentMap.get(`${s.id}_1`) || null;
      const rot2Assg = assignmentMap.get(`${s.id}_2`) || null;

      const weeks = [];

      let missingEvalCount = 0;
      let totalEval = 0;
      let evalCount = 0;

      for (let w = 1; w <= 17; w++) {
        const isExam = isExamWeek(period, w);
        const rotationNo = getRotationByWeek(period, w);

        const practiceRelevant = isPracticeRelevant(period, w, currentWeekNo);

        const attendance = rotationNo
          ? attendanceMap.get(`${s.id}_${rotationNo}_${w}`) || null
          : null;

        const present = attendance ? attendance.practiceAbsent === false : false;
        const absent = attendance ? attendance.practiceAbsent === true : null;

        const evalRow = rotationNo
          ? evalMap.get(`${s.id}_${rotationNo}_${w}`) || null
          : null;

        if (practiceRelevant && present && !evalRow) {
          missingEvalCount++;
        }

        if (evalRow?.score != null) {
          totalEval += Number(evalRow.score || 0);
          evalCount++;
        }

        weeks.push({
          weekNo: w,
          isExam,
          examLabel:
            w === toInt(period?.midtermWeek, null)
              ? "Vize"
              : w === toInt(period?.finalWeek1, null) || w === toInt(period?.finalWeek2, null)
              ? "Final"
              : null,
          rotationNo,
          practiceRelevant,
          practicePresent: present,
          practiceAbsent: absent,
          evalDone: !!evalRow,
          evalScore: evalRow?.score ?? null,
          evalNote: evalRow?.note ?? null,
        });
      }

      const evalAverage = evalCount > 0 ? Number((totalEval / evalCount).toFixed(2)) : null;

      const rot1Coverage = itemCoverageMap.get(`${s.id}_1`)?.size || 0;
      const rot2Coverage = itemCoverageMap.get(`${s.id}_2`)?.size || 0;

      let riskLabel = null;
      if (missingEvalCount >= 3) riskLabel = "Değerlendirme Riski";

      return {
        studentId: s.id,
        studentNo: s.studentNo,
        nameSurname: s.nameSurname,
        rot1HospitalName: rot1Assg?.hospital?.name || null,
        rot1UnitName: rot1Assg?.unit?.name || null,
        rot2HospitalName: rot2Assg?.hospital?.name || null,
        rot2UnitName: rot2Assg?.unit?.name || null,
        summary: {
          evalAverage,
          missingEvalCount,
          rot1Coverage,
          rot2Coverage,
          riskLabel,
        },
        weeks,
      };
    });

    const stats = {
      totalStudents: students.length,
      currentWeekNo,
      missingEvalCount: items.reduce((acc, x) => acc + Number(x.summary?.missingEvalCount || 0), 0),
      completedEvalCount: items.reduce(
        (acc, x) => acc + (x.weeks || []).filter((w) => w.evalDone).length,
        0
      ),
      pendingEvalCount: items.reduce(
        (acc, x) =>
          acc +
          (x.weeks || []).filter((w) => w.practiceRelevant && w.practicePresent && !w.evalDone).length,
        0
      ),
    };

    return res.json({
      ok: true,
      period: {
        id: period.id,
        currentWeekNo,
        midtermWeek: period.midtermWeek,
        finalWeek1: period.finalWeek1,
        finalWeek2: period.finalWeek2,
      },
      stats,
      items,
    });
  } catch (err) {
    console.error("eval-control error:", err);
    return res.status(500).json({ error: "Değerlendirme panel verileri yüklenemedi" });
  }
});

export default router;
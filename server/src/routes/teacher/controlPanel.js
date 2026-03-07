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

function isTheoryRelevant(period, weekNo, currentWeekNo) {
  const w = Number(weekNo);
  if (w > Number(currentWeekNo || 1)) return false;
  if (isExamWeek(period, w)) return false;
  return true;
}

function isPracticeRelevant(period, weekNo, currentWeekNo) {
  const w = Number(weekNo);
  if (w > Number(currentWeekNo || 1)) return false;
  if (isExamWeek(period, w)) return false;
  return !!getRotationByWeek(period, w);
}

/* ===============================
   GET CONTROL PANEL DATA
================================ */
router.get("/coordinator-control", requireTeacher, async (req, res) => {
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

    const reports = await prisma.weeklyReportScore.findMany({
      where: {
        periodId,
        studentId: { in: studentIds },
        weekNo: { lte: currentWeekNo },
      },
    });

    const attMap = new Map();
    for (const a of attendances) {
      const key = `${a.studentId}_${a.rotationNo}_${a.weekNo}`;
      attMap.set(key, a);
    }

    const reportMap = new Map();
    for (const r of reports) {
      const key = `${r.studentId}_${r.rotationNo}_${r.weekNo}`;
      reportMap.set(key, r);
    }

    const assignmentMap = new Map();
    for (const a of assignments) {
      const key = `${a.studentId}_${a.rotationNo}`;
      assignmentMap.set(key, a);
    }

    const items = students.map((s) => {
      const rot1Assg = assignmentMap.get(`${s.id}_1`) || null;
      const rot2Assg = assignmentMap.get(`${s.id}_2`) || null;

      const weeks = [];

      let theoryMissingCount = 0;
      let practiceMissingCount = 0;
      let missingReports = 0;
      let totalScore = 0;
      let scoreCount = 0;

      for (let w = 1; w <= 17; w++) {
        const exam = isExamWeek(period, w);
        const activeRotation = getRotationByWeek(period, w);

        const theoryAtt = attMap.get(`${s.id}_0_${w}`) || null;
        const practiceAtt = activeRotation ? attMap.get(`${s.id}_${activeRotation}_${w}`) || null : null;
        const report = activeRotation ? reportMap.get(`${s.id}_${activeRotation}_${w}`) || null : null;

        const theoryRelevant = isTheoryRelevant(period, w, currentWeekNo);
        const practiceRelevant = isPracticeRelevant(period, w, currentWeekNo);

        const theoryMarked = !!theoryAtt;
        const theoryAbsent = theoryAtt ? theoryAtt.theoryAbsent === true : null;
        const theoryPresent = theoryAtt ? theoryAtt.theoryAbsent === false : null;

        const practiceMarked = !!practiceAtt;
        const practiceAbsent = practiceAtt ? practiceAtt.practiceAbsent === true : null;
        const practicePresent = practiceAtt ? practiceAtt.practiceAbsent === false : null;

        if (theoryRelevant && !theoryMarked) theoryMissingCount++;
        if (practiceRelevant && !practiceMarked) practiceMissingCount++;
        if (practiceRelevant && practicePresent && !report) missingReports++;

        if (report?.score != null) {
          totalScore += Number(report.score || 0);
          scoreCount++;
        }

        weeks.push({
          weekNo: w,
          isExam: exam,
          examLabel:
            w === toInt(period?.midtermWeek, null)
              ? "Vize"
              : w === toInt(period?.finalWeek1, null) || w === toInt(period?.finalWeek2, null)
              ? "Final"
              : null,

          activeRotation,

          theoryRelevant,
          theoryMarked,
          theoryPresent,
          theoryAbsent,

          practiceRelevant,
          practiceMarked,
          practicePresent,
          practiceAbsent,

          reportStatus: report?.status || null,
          reportScore: report?.score ?? null,
        });
      }

      const reportAverage = scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(2)) : null;

      let riskLabel = null;
      if (practiceMissingCount >= 3) riskLabel = "Uygulama Yoklama Riski";
      if (missingReports >= 3) riskLabel = "Rapor Riski";

      return {
        studentId: s.id,
        studentNo: s.studentNo,
        nameSurname: s.nameSurname,
        rot1HospitalName: rot1Assg?.hospital?.name || null,
        rot1UnitName: rot1Assg?.unit?.name || null,
        rot2HospitalName: rot2Assg?.hospital?.name || null,
        rot2UnitName: rot2Assg?.unit?.name || null,
        summary: {
          reportAverage,
          theoryMissingCount,
          practiceMissingCount,
          missingReports,
          riskLabel,
        },
        weeks,
      };
    });

    const stats = {
      totalStudents: students.length,
      currentWeekNo,
      theoryMissingCount: items.reduce((acc, x) => acc + Number(x.summary?.theoryMissingCount || 0), 0),
      practiceMissingCount: items.reduce((acc, x) => acc + Number(x.summary?.practiceMissingCount || 0), 0),
      missingReports: items.reduce((acc, x) => acc + Number(x.summary?.missingReports || 0), 0),
      submittedCount: items.reduce(
        (acc, x) =>
          acc +
          (x.weeks || []).filter(
            (w) =>
              Number(w.weekNo) <= currentWeekNo &&
              (w.reportStatus === "SUBMITTED" || w.reportStatus === "RESUBMITTED")
          ).length,
        0
      ),
      revisionCount: items.reduce(
        (acc, x) =>
          acc +
          (x.weeks || []).filter(
            (w) => Number(w.weekNo) <= currentWeekNo && w.reportStatus === "REVISION_REQUESTED"
          ).length,
        0
      ),
      approvedCount: items.reduce(
        (acc, x) =>
          acc +
          (x.weeks || []).filter(
            (w) => Number(w.weekNo) <= currentWeekNo && w.reportStatus === "APPROVED"
          ).length,
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
        rot1StartWeek: period.rot1StartWeek,
        rot1EndWeek: period.rot1EndWeek,
        rot2StartWeek: period.rot2StartWeek,
        rot2EndWeek: period.rot2EndWeek,
      },
      stats,
      items,
    });
  } catch (err) {
    console.error("coordinator-control error:", err);
    return res.status(500).json({ error: "Panel verileri yüklenemedi" });
  }
});

export default router;
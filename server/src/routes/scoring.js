import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

/** period sınav haftası mı? */
function isExamWeek(period, weekNo) {
  const w = Number(weekNo);
  const m = Number(period?.midtermWeek ?? 0);
  const f1 = Number(period?.finalWeek1 ?? 0);
  const f2 = Number(period?.finalWeek2 ?? 0);
  return [m, f1, f2].some((x) => Number.isFinite(x) && x > 0 && x === w);
}

/** period rotasyon aralığında mı? (uygulama) */
function isWithinRotationPractice(period, rotationNo, weekNo) {
  const r = Number(rotationNo);
  const w = Number(weekNo);

  const s = r === 1 ? period?.rot1StartWeek : period?.rot2StartWeek;
  const e = r === 1 ? period?.rot1EndWeek : period?.rot2EndWeek;

  const start = Number(s);
  const end = Number(e);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return w >= start && w <= end;
}

/**
 * POST /api/scoring/attendance/upsert
 * body: { periodId, studentId, rotationNo, weekNo, theoryAbsent, practiceAbsent, note, markedBy }
 */
router.post("/attendance/upsert", async (req, res) => {
  const { periodId, studentId, rotationNo, weekNo } = req.body || {};
  if (!periodId || !studentId || rotationNo === undefined || !weekNo) {
    return res.status(400).json({ error: "periodId, studentId, rotationNo, weekNo zorunlu" });
  }

  // ✅ period çek (kural uygulayacağız)
  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

  const wk = Number(weekNo);
  const rot = Number(rotationNo);

  // incoming (client ne gönderirse)
  let theoryAbsent = req.body.theoryAbsent !== undefined ? !!req.body.theoryAbsent : undefined;
  let practiceAbsent = req.body.practiceAbsent !== undefined ? !!req.body.practiceAbsent : undefined;

  const exam = isExamWeek(period, wk);
  const practiceOpen = !exam && isWithinRotationPractice(period, rot, wk);

  // ✅ KURALLAR (SUNUCU ZORLAMASI)
  // Sınav haftası: iki yoklama da kapalı → her zaman false
  if (exam) {
    theoryAbsent = false;
    practiceAbsent = false;
  } else {
    // sınav değil:
    // Teori: açık (dokunma), ama practice rotasyon dışındaysa kapalı
    if (!practiceOpen) {
      practiceAbsent = false;
    }
  }

  const item = await prisma.attendance.upsert({
    where: {
      uniq_attendance_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: rot,
        weekNo: wk,
      },
    },
    create: {
      periodId: String(periodId),
      studentId: String(studentId),
      rotationNo: rot,
      weekNo: wk,
      theoryAbsent: !!theoryAbsent,     // sınavda false zorlanır
      practiceAbsent: !!practiceAbsent, // sınavda/rot dışı false zorlanır
      note: req.body.note ? String(req.body.note) : null,
      markedBy: req.body.markedBy ? String(req.body.markedBy) : null,
    },
    update: {
      theoryAbsent: theoryAbsent !== undefined ? !!theoryAbsent : undefined,
      practiceAbsent: practiceAbsent !== undefined ? !!practiceAbsent : undefined,
      note: req.body.note !== undefined ? (req.body.note ? String(req.body.note) : null) : undefined,
      markedBy: req.body.markedBy !== undefined ? (req.body.markedBy ? String(req.body.markedBy) : null) : undefined,
    },
  });

  res.json({
    ok: true,
    item,
    enforced: {
      exam,
      practiceOpen,
    },
  });
});

/**
 * POST /api/scoring/report/upsert
 * body: { periodId, studentId, rotationNo, weekNo, score, status, note, gradedBy }
 */
router.post("/report/upsert", async (req, res) => {
  const { periodId, studentId, rotationNo, weekNo, score } = req.body || {};
  if (!periodId || !studentId || rotationNo === undefined || !weekNo || score === undefined)
    return res.status(400).json({ error: "periodId, studentId, rotationNo, weekNo, score zorunlu" });

  const item = await prisma.weeklyReportScore.upsert({
    where: {
      uniq_reportscore_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
        weekNo: Number(weekNo),
      },
    },
    create: {
      periodId: String(periodId),
      studentId: String(studentId),
      rotationNo: Number(rotationNo),
      weekNo: Number(weekNo),
      score: Number(score),
      status: req.body.status ? String(req.body.status) : "SUBMITTED",
      note: req.body.note ? String(req.body.note) : null,
      gradedBy: req.body.gradedBy ? String(req.body.gradedBy) : null,
    },
    update: {
      score: Number(score),
      status: req.body.status !== undefined ? (req.body.status ? String(req.body.status) : "SUBMITTED") : undefined,
      note: req.body.note !== undefined ? (req.body.note ? String(req.body.note) : null) : undefined,
      gradedBy: req.body.gradedBy !== undefined ? (req.body.gradedBy ? String(req.body.gradedBy) : null) : undefined,
    },
  });

  res.json({ ok: true, item });
});

/**
 * POST /api/scoring/eval/upsert
 * body: { periodId, studentId, rotationNo, weekNo, score, note, gradedBy }
 */
router.post("/eval/upsert", async (req, res) => {
  const { periodId, studentId, rotationNo, weekNo, score } = req.body || {};
  if (!periodId || !studentId || rotationNo === undefined || !weekNo || score === undefined)
    return res.status(400).json({ error: "periodId, studentId, rotationNo, weekNo, score zorunlu" });

  const item = await prisma.weeklyEvaluationScore.upsert({
    where: {
      uniq_evalscore_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
        weekNo: Number(weekNo),
      },
    },
    create: {
      periodId: String(periodId),
      studentId: String(studentId),
      rotationNo: Number(rotationNo),
      weekNo: Number(weekNo),
      score: Number(score),
      note: req.body.note ? String(req.body.note) : null,
      gradedBy: req.body.gradedBy ? String(req.body.gradedBy) : null,
    },
    update: {
      score: Number(score),
      note: req.body.note !== undefined ? (req.body.note ? String(req.body.note) : null) : undefined,
      gradedBy: req.body.gradedBy !== undefined ? (req.body.gradedBy ? String(req.body.gradedBy) : null) : undefined,
    },
  });

  res.json({ ok: true, item });
});

export default router;
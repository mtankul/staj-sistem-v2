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

/**
 * Rapor erişim kuralı:
 * - Seçilen hafta aktif rotasyon aralığında olmalı
 * - Sınav haftası olmamalı
 * - weekSettings.practiceOpen === false ise kapalı olmalı
 * - Uygulamada "Geldi" işaretli değilse rapor kapalı olmalı
 */
function reportAvailability(period, weekNo, attendance) {
  const w = toInt(weekNo, null);
  const ex = examInfo(period, w);
  const weekSetting = Array.isArray(period?.weekSettings) ? period.weekSettings[0] || null : null;

  if (!w) {
    return {
      practiceOpen: false,
      reportOpen: false,
      lockReason: "Geçersiz hafta bilgisi.",
      exam: ex,
      weekSetting,
    };
  }

  const rotationCount = toInt(period?.rotationCount, 1) || 1;

  const rot1StartWeek = toInt(period?.rot1StartWeek, null);
  const rot1EndWeek = toInt(period?.rot1EndWeek, null);
  const rot2StartWeek = toInt(period?.rot2StartWeek, null);
  const rot2EndWeek = toInt(period?.rot2EndWeek, null);

  let inPracticeRange = false;

  if (rotationCount <= 1) {
    if (rot1StartWeek != null && rot1EndWeek != null) {
      inPracticeRange = w >= rot1StartWeek && w <= rot1EndWeek;
    } else {
      inPracticeRange = true;
    }
  } else {
    const inRot1 =
      rot1StartWeek != null &&
      rot1EndWeek != null &&
      w >= rot1StartWeek &&
      w <= rot1EndWeek;

    const inRot2 =
      rot2StartWeek != null &&
      rot2EndWeek != null &&
      w >= rot2StartWeek &&
      w <= rot2EndWeek;

    inPracticeRange = inRot1 || inRot2;
  }

  if (!inPracticeRange) {
    return {
      practiceOpen: false,
      reportOpen: false,
      lockReason: "Seçilen hafta mesleki uygulama/rotasyon haftaları içinde değildir.",
      exam: ex,
      weekSetting,
    };
  }

  if (ex) {
    return {
      practiceOpen: false,
      reportOpen: false,
      lockReason: `${ex.label} haftasında uygulama olmadığı için rapor yazılamaz.`,
      exam: ex,
      weekSetting,
    };
  }

  if (weekSetting?.practiceOpen === false) {
    return {
      practiceOpen: false,
      reportOpen: false,
      lockReason: "Bu hafta uygulama kapalı olduğu için rapor yazılamaz.",
      exam: ex,
      weekSetting,
    };
  }

  if (!attendance || attendance.practiceAbsent !== false) {
    return {
      practiceOpen: true,
      reportOpen: false,
      lockReason: "Uygulamada Geldi olarak işaretlenmediğiniz haftaya rapor yazamazsınız!",
      exam: ex,
      weekSetting,
    };
  }

  return {
    practiceOpen: true,
    reportOpen: true,
    lockReason: null,
    exam: ex,
    weekSetting,
  };
}

function computeVisibility(period, weekSetting, status) {
  const statusStr = String(status || "");

  // status default
  const defaultCanSeeScores = statusStr === "APPROVED";
  const defaultCanSeeComments =
    statusStr === "REVISION_REQUESTED" || statusStr === "APPROVED";
  const defaultCanSeeRevisionNote =
    statusStr === "REVISION_REQUESTED" || statusStr === "APPROVED";

  // mevcut şemada bildiğimiz alanlar:
  // period.studentCanSeeReportScores
  // weekSetting.studentCanSeeReportScore
  //
  // Öncelik:
  // 1) hafta ayarı (varsa)
  // 2) dönem ayarı (varsa)
  // 3) status default
  const weekScoreSetting =
    typeof weekSetting?.studentCanSeeReportScore === "boolean"
      ? weekSetting.studentCanSeeReportScore
      : undefined;

  const periodScoreSetting =
    typeof period?.studentCanSeeReportScores === "boolean"
      ? period.studentCanSeeReportScores
      : undefined;

  const canSeeScores =
    typeof weekScoreSetting === "boolean"
      ? weekScoreSetting
      : typeof periodScoreSetting === "boolean"
      ? periodScoreSetting
      : defaultCanSeeScores;

  // yorum ve revision note için şemada ayrı alan yoksa status default ile yönet
  const canSeeComments = defaultCanSeeComments;
  const canSeeRevisionNote = defaultCanSeeRevisionNote;

  return {
    canSeeScores,
    canSeeComments,
    canSeeRevisionNote,
  };
}

async function getStudentAndPeriodOrThrow(studentId, periodId, weekNo = null) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    const err = new Error("Öğrenci bulunamadı");
    err.status = 404;
    throw err;
  }

  if (student.periodId !== periodId) {
    const err = new Error("Bu döneme erişim yok");
    err.status = 403;
    throw err;
  }

  const periodQuery =
    weekNo == null
      ? { where: { id: periodId } }
      : {
          where: { id: periodId },
          include: {
            periodReportSnapshot: {
              include: { questions: { orderBy: { orderNo: "asc" } } },
            },
            weekSettings: { where: { weekNo } },
          },
        };

  const period = await prisma.period.findUnique(periodQuery);
  if (!period) {
    const err = new Error("Dönem bulunamadı");
    err.status = 404;
    throw err;
  }

  return { student, period };
}

async function getPracticeAttendance(periodId, studentId, rotationNo, weekNo) {
  if (!rotationNo) return null;

  return prisma.attendance.findUnique({
    where: {
      uniq_attendance_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
        weekNo: Number(weekNo),
      },
    },
  });
}

/* ===============================
   GET /api/student/questions?periodId=...
================================ */
router.get("/questions", requireStudent, async (req, res) => {
  try {
    const studentId = String(req.user.studentId);
    const periodId = String(req.query.periodId || "");
    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

    await getStudentAndPeriodOrThrow(studentId, periodId);

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
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Beklenmeyen hata" });
  }
});

/* ===============================
   GET /api/student/report-week?periodId=...&weekNo=...
================================ */
router.get("/report-week", requireStudent, async (req, res) => {
  try {
    const studentId = String(req.user.studentId);
    const periodId = String(req.query.periodId || "");
    const weekNo = toInt(req.query.weekNo, null);

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    if (!weekNo) return res.status(400).json({ error: "weekNo zorunlu" });

    const { period } = await getStudentAndPeriodOrThrow(studentId, periodId, weekNo);

    const rotationNo = rotationByWeek(period, weekNo);
    const attendance = rotationNo
      ? await getPracticeAttendance(periodId, studentId, rotationNo, weekNo)
      : null;

    const availability = reportAvailability(period, weekNo, attendance);

    const header = await prisma.weeklyReportScore.findUnique({
      where: {
        uniq_reportscore_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rotationNo),
          weekNo: Number(weekNo),
        },
      },
    });

    const answers = await prisma.weeklyReportAnswer.findMany({
      where: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
        weekNo: Number(weekNo),
      },
      orderBy: { questionId: "asc" },
    });

    const questionScores = await prisma.weeklyReportQuestionScore.findMany({
      where: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
        weekNo: Number(weekNo),
      },
    });
    const qsMap = new Map(questionScores.map((x) => [x.questionId, x]));

    const status = header?.status || "DRAFT";
    const canEdit = availability.reportOpen && canEditByStatus(status);

    const weekSetting = availability.weekSetting || null;
    const visibility = computeVisibility(period, weekSetting, status);

    const teacherNote = header?.revisionNote ?? header?.note ?? null;
    const revisionNote =
      status === "REVISION_REQUESTED" ? header?.revisionNote ?? header?.note ?? null : null;

    return res.json({
      ok: true,
      meta: {
        periodId,
        weekNo,
        rotationNo,
        exam: availability.exam ? availability.exam.label : null,
        status,
        canEdit,
        practiceOpen: availability.practiceOpen,
        reportOpen: availability.reportOpen,
        attendanceMarked: !!attendance,
        practicePresent: attendance ? attendance.practiceAbsent === false : false,
        practiceAbsent: attendance ? attendance.practiceAbsent === true : null,
        lockReason:
          availability.lockReason ||
          (!canEditByStatus(status) ? `Rapor kilitli. Durum: ${status}` : null),

        canSeeScores: visibility.canSeeScores,
        canSeeComments: visibility.canSeeComments,
        canSeeRevisionNote: visibility.canSeeRevisionNote,

        totalScore: header?.score ?? null,
        teacherNote,
        revisionNote,
      },
      questions: period.periodReportSnapshot?.questions || [],
      answers: (answers || []).map((a) => ({
        ...a,
        teacherScore: qsMap.get(a.questionId)?.score ?? null,
        teacherComment: qsMap.get(a.questionId)?.comment ?? null,
      })),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Beklenmeyen hata" });
  }
});

/* ===============================
   PUT /api/student/report-week
================================ */
router.put("/report-week", requireStudent, async (req, res) => {
  try {
    const studentId = String(req.user.studentId);
    const periodId = String(req.body?.periodId || "");
    const weekNo = toInt(req.body?.weekNo, null);
    const answersIn = Array.isArray(req.body?.answers) ? req.body.answers : [];

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    if (!weekNo) return res.status(400).json({ error: "weekNo zorunlu" });

    const { period } = await getStudentAndPeriodOrThrow(studentId, periodId, weekNo);

    const rotationNo = rotationByWeek(period, weekNo);
    const attendance = rotationNo
      ? await getPracticeAttendance(periodId, studentId, rotationNo, weekNo)
      : null;

    const availability = reportAvailability(period, weekNo, attendance);
    if (!availability.reportOpen) {
      return res.status(409).json({ error: availability.lockReason || "Bu hafta rapor yazılamaz" });
    }

    const existingHeader = await prisma.weeklyReportScore.findUnique({
      where: {
        uniq_reportscore_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          rotationNo: Number(rotationNo),
          weekNo: Number(weekNo),
        },
      },
    });

    if (existingHeader && !canEditByStatus(existingHeader.status)) {
      return res.status(409).json({ error: `Rapor kilitli. Durum: ${existingHeader.status}` });
    }

    const snapshot = await prisma.periodReportSnapshot.findUnique({
      where: { periodId: String(periodId) },
      include: { questions: true },
    });
    if (!snapshot) return res.status(400).json({ error: "Dönem rapor şablonu (snapshot) yok" });

    const validQuestionIds = new Set(snapshot.questions.map((q) => q.id));

    const header = existingHeader
      ? existingHeader
      : await prisma.weeklyReportScore.create({
          data: {
            periodId: String(periodId),
            studentId: String(studentId),
            rotationNo: Number(rotationNo),
            weekNo: Number(weekNo),
            score: 0,
            status: "DRAFT",
          },
        });

    const tx = [];
    for (const a of answersIn) {
      const qid = String(a?.questionId || "");
      if (!qid || !validQuestionIds.has(qid)) continue;

      const answerText = String(a?.answerText ?? "");

      tx.push(
        prisma.weeklyReportAnswer.upsert({
          where: {
            uniq_weekly_answer: {
              periodId: String(periodId),
              studentId: String(studentId),
              rotationNo: Number(rotationNo),
              weekNo: Number(weekNo),
              questionId: qid,
            },
          },
          create: {
            periodId: String(periodId),
            studentId: String(studentId),
            rotationNo: Number(rotationNo),
            weekNo: Number(weekNo),
            questionId: qid,
            answerText,
          },
          update: { answerText },
        })
      );
    }

    await prisma.$transaction(tx);

    return res.json({ ok: true, status: header.status, savedCount: tx.length });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Beklenmeyen hata" });
  }
});

/* ===============================
   POST /api/student/report-week/submit
================================ */
router.post("/report-week/submit", requireStudent, async (req, res) => {
  try {
    const studentId = String(req.user.studentId);
    const periodId = String(req.body?.periodId || "");
    const weekNo = toInt(req.body?.weekNo, null);

    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });
    if (!weekNo) return res.status(400).json({ error: "weekNo zorunlu" });

    const { period } = await getStudentAndPeriodOrThrow(studentId, periodId, weekNo);

    const rotationNo = rotationByWeek(period, weekNo);
    const attendance = rotationNo
      ? await getPracticeAttendance(periodId, studentId, rotationNo, weekNo)
      : null;

    const availability = reportAvailability(period, weekNo, attendance);
    if (!availability.reportOpen) {
      return res.status(409).json({ error: availability.lockReason || "Bu hafta rapor gönderilemez" });
    }

    const header = await prisma.weeklyReportScore.upsert({
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
        score: 0,
        status: "DRAFT",
      },
      update: {},
    });

    if (["SUBMITTED", "RESUBMITTED", "APPROVED"].includes(header.status)) {
      return res.status(409).json({ error: `Zaten gönderilmiş/kilitli. Durum: ${header.status}` });
    }

    if (header.status !== "DRAFT" && header.status !== "REVISION_REQUESTED") {
      return res.status(409).json({ error: `Gönderilemez durum: ${header.status}` });
    }

    const answerCount = await prisma.weeklyReportAnswer.count({
      where: {
        periodId: String(periodId),
        studentId: String(studentId),
        rotationNo: Number(rotationNo),
        weekNo: Number(weekNo),
      },
    });

    if (answerCount === 0) {
      return res.status(400).json({ error: "Göndermek için en az 1 cevap girilmeli" });
    }

    const nextStatus = header.status === "DRAFT" ? "SUBMITTED" : "RESUBMITTED";

    const updated = await prisma.weeklyReportScore.update({
      where: { id: header.id },
      data: { status: nextStatus },
    });

    return res.json({ ok: true, status: updated.status });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Beklenmeyen hata" });
  }
});

export default router;
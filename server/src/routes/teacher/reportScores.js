/**
 * CANONICAL: Teacher Report Scoring Routes (Coordinator Only)
 * Location: server/src/routes/teacher/reportScores.js
 *
 * Includes:
 *  - GET  /api/teacher/report-scores?periodId&weekNo
 *  - GET  /api/teacher/report-scores/detail?periodId&studentId&weekNo
 *  - PUT  /api/teacher/report-scores/save-items
 *  - PUT  /api/teacher/report-scores/request-revision
 *  - PUT  /api/teacher/report-scores/approve
 *  - PUT  /api/teacher/report-scores/upsert   (legacy compatibility)
 */

import { Router } from "express";
import { prisma } from "../../prisma.js";
import { examInfo, rotationByWeek, toInt } from "../../utils/periodWeek.js";

const router = Router();

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

    if (!t?.isCoordinator) {
      return res.status(403).json({ error: "Sadece koordinatör erişebilir" });
    }

    next();
  } catch (e) {
    console.error("requireCoordinator error:", e);
    return res.status(500).json({ error: "Yetki kontrolü başarısız" });
  }
}

/* ===============================
   HELPERS
================================ */
function round2(n) {
  return Number(Number(n || 0).toFixed(2));
}

function allowedStatusForScoring(status) {
  return ["SUBMITTED", "RESUBMITTED", "REVISION_REQUESTED", "APPROVED"].includes(
    String(status || "")
  );
}

async function getPeriodAndRotationOrThrow(periodId, weekNo) {
  const w = toInt(weekNo, null);
  if (!periodId || !w) {
    const err = new Error("periodId + weekNo zorunlu");
    err.status = 400;
    throw err;
  }

  const period = await prisma.period.findUnique({
    where: { id: String(periodId) },
  });

  if (!period) {
    const err = new Error("Dönem bulunamadı");
    err.status = 404;
    throw err;
  }

  const ex = examInfo(period, w);
  if (ex) return { period, weekNo: w, exam: ex, rotationNo: null };

  const rotationNo = rotationByWeek(period, w);
  if (!rotationNo) return { period, weekNo: w, exam: null, rotationNo: null };

  return { period, weekNo: w, exam: null, rotationNo: Number(rotationNo) };
}

async function getSnapshotOrThrow(periodId) {
  const snap = await prisma.periodReportSnapshot.findUnique({
    where: { periodId: String(periodId) },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });

  if (!snap) {
    const err = new Error("Bu dönem için rapor snapshot yok");
    err.status = 404;
    throw err;
  }

  return snap;
}

async function getWeeklyReportHeader(periodId, studentId, weekNo, rotationNo) {
  return prisma.weeklyReportScore.findUnique({
    where: {
      uniq_reportscore_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(weekNo),
        rotationNo: Number(rotationNo),
      },
    },
  });
}

async function recomputeReportTotal({ periodId, studentId, weekNo, rotationNo, teacherId = null }) {
  const scores = await prisma.weeklyReportQuestionScore.findMany({
    where: {
      periodId: String(periodId),
      studentId: String(studentId),
      weekNo: Number(weekNo),
      rotationNo: Number(rotationNo),
    },
    select: { score: true },
  });

  const total = round2(scores.reduce((acc, x) => acc + Number(x.score || 0), 0));

  const existing = await prisma.weeklyReportScore.findUnique({
    where: {
      uniq_reportscore_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(weekNo),
        rotationNo: Number(rotationNo),
      },
    },
  });

  if (!existing) {
    const created = await prisma.weeklyReportScore.create({
      data: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(weekNo),
        rotationNo: Number(rotationNo),
        score: total,
        status: "SUBMITTED",
        gradedBy: teacherId ? String(teacherId) : null,
        note: null,
      },
    });

    return { total, header: created };
  }

  const updated = await prisma.weeklyReportScore.update({
    where: {
      uniq_reportscore_week: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(weekNo),
        rotationNo: Number(rotationNo),
      },
    },
    data: {
      score: total,
      ...(teacherId ? { gradedBy: String(teacherId) } : {}),
    },
  });

  return { total, header: updated };
}

/* =========================================================
   GET /api/teacher/report-scores?periodId&weekNo
========================================================= */
router.get("/", requireCoordinator, async (req, res) => {
  try {
    const { periodId, weekNo } = req.query;

    const ctx = await getPeriodAndRotationOrThrow(periodId, weekNo);

    if (ctx.exam) return res.json({ mode: "EXAM", exam: ctx.exam, items: [] });
    if (!ctx.rotationNo) return res.json({ mode: "NO_ROTATION", items: [] });

    const snap = await prisma.periodReportSnapshot.findUnique({
      where: { periodId: String(periodId) },
      include: { questions: { orderBy: { orderNo: "asc" } } },
    });
    if (!snap) return res.json({ mode: "NO_SNAPSHOT", items: [] });

    const qs = (snap.questions || []).filter((q) => q.isActive);

    const students = await prisma.student.findMany({
      where: { periodId: String(periodId) },
      orderBy: { nameSurname: "asc" },
    });

    const studentIds = students.map((s) => s.id);

    const answers = await prisma.weeklyReportAnswer.findMany({
      where: {
        periodId: String(periodId),
        weekNo: Number(ctx.weekNo),
        rotationNo: Number(ctx.rotationNo),
        studentId: { in: studentIds },
      },
    });

    const scoreHeaders = await prisma.weeklyReportScore.findMany({
      where: {
        periodId: String(periodId),
        weekNo: Number(ctx.weekNo),
        rotationNo: Number(ctx.rotationNo),
        studentId: { in: studentIds },

        status: {
          in: [
            "SUBMITTED",
            "RESUBMITTED",
            "REVISION_REQUESTED",
            "APPROVED"
          ]
        }
      },
    });

    const byStudent = new Map();
    for (const a of answers) {
      if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, new Map());
      byStudent.get(a.studentId).set(a.questionId, a.answerText ?? "");
    }

    const scoreMap = new Map(scoreHeaders.map((s) => [s.studentId, s]));

    const items = students
      .map((s) => {
        const amap = byStudent.get(s.id) || new Map();
        const sc = scoreMap.get(s.id) || null;

        const answerCount = qs.filter((q) => (amap.get(q.id) || "").trim()).length;
        const hasReport = answerCount > 0 || !!sc;

        return {
          studentId: s.id,
          studentNo: s.studentNo,
          nameSurname: s.nameSurname,
          photoUrl: s.photoUrl,
          weekNo: Number(ctx.weekNo),
          rotationNo: Number(ctx.rotationNo),
          totalPoints: Number(snap.totalPoints || 0),
          answerCount,
          hasReport,
          totalScore: sc?.score ?? null,
          status: sc?.status ?? null,
          note: sc?.note ?? null,
          gradedBy: sc?.gradedBy ?? null,
          updatedAt: sc?.updatedAt ?? null,
        };
      })
      .filter((x) => x.hasReport);

    return res.json({ mode: "OK", items });
  } catch (e) {
    console.error("GET /teacher/report-scores error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Liste alınamadı" });
  }
});

/* =========================================================
   GET /api/teacher/report-scores/detail?periodId&studentId&weekNo
========================================================= */
router.get("/detail", requireCoordinator, async (req, res) => {
  try {
    const { periodId, studentId, weekNo } = req.query;

    const w = toInt(weekNo, null);
    if (!periodId || !studentId || !w) {
      return res.status(400).json({ error: "periodId + studentId + weekNo zorunlu" });
    }

    const ctx = await getPeriodAndRotationOrThrow(periodId, w);

    if (ctx.exam) return res.json({ mode: "EXAM", exam: ctx.exam });
    if (!ctx.rotationNo) return res.json({ mode: "NO_ROTATION" });

    const snap = await getSnapshotOrThrow(periodId);

    const answers = await prisma.weeklyReportAnswer.findMany({
      where: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(w),
        rotationNo: Number(ctx.rotationNo),
      },
    });
    const aMap = new Map(answers.map((a) => [a.questionId, a.answerText ?? ""]));

    const questionScores = await prisma.weeklyReportQuestionScore.findMany({
      where: {
        periodId: String(periodId),
        studentId: String(studentId),
        weekNo: Number(w),
        rotationNo: Number(ctx.rotationNo),
      },
    });
    const qsMap = new Map(questionScores.map((x) => [x.questionId, x]));

    const scoreHeader = await getWeeklyReportHeader(periodId, studentId, w, ctx.rotationNo);

    const questions = (snap.questions || [])
      .filter((q) => q.isActive)
      .map((q) => {
        const saved = qsMap.get(q.id) || null;
        return {
          id: q.id,
          orderNo: q.orderNo,
          text: q.text,
          points: Number(q.points || 0),
          answerText: aMap.get(q.id) || "",
          score: saved?.score ?? 0,
          comment: saved?.comment ?? "",
        };
      });

    const hasAnyAnswer = questions.some((q) => String(q.answerText || "").trim().length > 0);
    if (!hasAnyAnswer && !scoreHeader) {
      return res.status(404).json({ error: "Bu öğrenci için seçilen haftada rapor bulunamadı" });
    }

    const totalScore = round2(questions.reduce((acc, q) => acc + Number(q.score || 0), 0));

    return res.json({
      mode: "OK",
      rotationNo: Number(ctx.rotationNo),
      snapshotId: snap.id,
      totalPoints: Number(snap.totalPoints || 0),
      totalScore,
      status: scoreHeader?.status || "DRAFT",
      note: scoreHeader?.note || "",
      questions,
    });
  } catch (e) {
    console.error("GET /teacher/report-scores/detail error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Detay alınamadı" });
  }
});

/* =========================================================
   PUT /api/teacher/report-scores/save-items
   body: { periodId, studentId, weekNo, rotationNo, items:[{questionId, score, comment}] }
========================================================= */
router.put("/save-items", requireCoordinator, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, studentId, weekNo, rotationNo, items } = req.body || {};

    const w = toInt(weekNo, null);
    const rot = toInt(rotationNo, null);

    if (!periodId || !studentId || !w || !rot) {
      return res.status(400).json({ error: "periodId + studentId + weekNo + rotationNo zorunlu" });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items dizi olmalı" });
    }

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında rapor puanlanamaz" });

    const rotComputed = rotationByWeek(period, w);
    if (!rotComputed) return res.status(400).json({ error: "Bu hafta rotasyon haftası değil" });
    if (Number(rot) !== Number(rotComputed)) {
      return res.status(400).json({ error: "rotationNo bu haftanın rotasyonu ile uyuşmuyor" });
    }

    const snap = await getSnapshotOrThrow(periodId);
    const activeQuestions = (snap.questions || []).filter((q) => q.isActive);
    const qMap = new Map(activeQuestions.map((q) => [q.id, q]));

    const header = await getWeeklyReportHeader(periodId, studentId, w, rot);
    if (!header) {
      return res.status(409).json({ error: "Öğrenci raporu henüz gönderilmemiş." });
    }

    if (!allowedStatusForScoring(header.status)) {
      return res.status(409).json({ error: `Bu rapor puanlanamaz. Durum: ${header.status}` });
    }

    const tx = [];

    for (const it of items) {
      const questionId = String(it?.questionId || "");
      if (!questionId || !qMap.has(questionId)) continue;

      const maxPoints = Number(qMap.get(questionId)?.points || 0);
      const scoreVal = Number(it?.score ?? 0);
      const normalizedScore = Number.isFinite(scoreVal) ? scoreVal : 0;

      if (normalizedScore < 0 || normalizedScore > maxPoints) {
        return res.status(400).json({
          error: `Soru puanı 0 - ${maxPoints} aralığında olmalı`,
          questionId,
        });
      }

      tx.push(
        prisma.weeklyReportQuestionScore.upsert({
          where: {
            uniq_report_question_score: {
              periodId: String(periodId),
              studentId: String(studentId),
              weekNo: Number(w),
              rotationNo: Number(rot),
              questionId,
            },
          },
          create: {
            periodId: String(periodId),
            studentId: String(studentId),
            weekNo: Number(w),
            rotationNo: Number(rot),
            questionId,
            score: round2(normalizedScore),
            comment: it?.comment != null ? String(it.comment) : "",
            gradedBy: teacherId,
          },
          update: {
            score: round2(normalizedScore),
            comment: it?.comment != null ? String(it.comment) : "",
            gradedBy: teacherId,
          },
        })
      );
    }

    await prisma.$transaction(tx);

    const { total, header: updatedHeader } = await recomputeReportTotal({
      periodId,
      studentId,
      weekNo: w,
      rotationNo: rot,
      teacherId,
    });

    return res.json({
      ok: true,
      totalScore: total,
      status: updatedHeader?.status,
    });
  } catch (e) {
    console.error("PUT /teacher/report-scores/save-items error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Soru bazlı puanlar kaydedilemedi" });
  }
});

/* =========================================================
   PUT /api/teacher/report-scores/request-revision
   body: { periodId, studentId, weekNo, rotationNo, note }
========================================================= */
router.put("/request-revision", requireCoordinator, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, studentId, weekNo, rotationNo, note } = req.body || {};

    const w = toInt(weekNo, null);
    const rot = toInt(rotationNo, null);

    if (!periodId || !studentId || !w || !rot) {
      return res.status(400).json({ error: "periodId + studentId + weekNo + rotationNo zorunlu" });
    }

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında rapor puanlanamaz" });

    const rotComputed = rotationByWeek(period, w);
    if (!rotComputed) return res.status(400).json({ error: "Bu hafta rotasyon haftası değil" });
    if (Number(rot) !== Number(rotComputed)) {
      return res.status(400).json({ error: "rotationNo bu haftanın rotasyonu ile uyuşmuyor" });
    }

    const header = await getWeeklyReportHeader(periodId, studentId, w, rot);
    if (!header) {
      return res.status(409).json({ error: "Öğrenci raporu henüz gönderilmemiş." });
    }

    const { total } = await recomputeReportTotal({
      periodId,
      studentId,
      weekNo: w,
      rotationNo: rot,
      teacherId,
    });

    const updated = await prisma.weeklyReportScore.update({
      where: {
        uniq_reportscore_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          weekNo: Number(w),
          rotationNo: Number(rot),
        },
      },
      data: {
        score: total,
        status: "REVISION_REQUESTED",
        note: note != null ? String(note) : "",
        gradedBy: teacherId,
      },
    });

    return res.json({
      ok: true,
      totalScore: total,
      status: updated.status,
    });
  } catch (e) {
    console.error("PUT /teacher/report-scores/request-revision error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Düzeltmeye gönderilemedi" });
  }
});

/* =========================================================
   PUT /api/teacher/report-scores/approve
   body: { periodId, studentId, weekNo, rotationNo, note }
========================================================= */
router.put("/approve", requireCoordinator, async (req, res) => {
  try {
    const teacherId = String(req.user.teacherId);
    const { periodId, studentId, weekNo, rotationNo, note } = req.body || {};

    const w = toInt(weekNo, null);
    const rot = toInt(rotationNo, null);

    if (!periodId || !studentId || !w || !rot) {
      return res.status(400).json({ error: "periodId + studentId + weekNo + rotationNo zorunlu" });
    }

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında rapor puanlanamaz" });

    const rotComputed = rotationByWeek(period, w);
    if (!rotComputed) return res.status(400).json({ error: "Bu hafta rotasyon haftası değil" });
    if (Number(rot) !== Number(rotComputed)) {
      return res.status(400).json({ error: "rotationNo bu haftanın rotasyonu ile uyuşmuyor" });
    }

    const header = await getWeeklyReportHeader(periodId, studentId, w, rot);
    if (!header) {
      return res.status(409).json({ error: "Öğrenci raporu henüz gönderilmemiş." });
    }

    const { total } = await recomputeReportTotal({
      periodId,
      studentId,
      weekNo: w,
      rotationNo: rot,
      teacherId,
    });

    const updated = await prisma.weeklyReportScore.update({
      where: {
        uniq_reportscore_week: {
          periodId: String(periodId),
          studentId: String(studentId),
          weekNo: Number(w),
          rotationNo: Number(rot),
        },
      },
      data: {
        score: total,
        status: "APPROVED",
        note: note != null ? String(note) : "",
        gradedBy: teacherId,
      },
    });

    return res.json({
      ok: true,
      totalScore: total,
      status: updated.status,
    });
  } catch (e) {
    console.error("PUT /teacher/report-scores/approve error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Onaylanamadı" });
  }
});

/* =========================================================
   PUT /api/teacher/report-scores/upsert
   Legacy compatibility: total score direct write
========================================================= */
router.put("/upsert", requireCoordinator, async (req, res) => {
  try {
    const { periodId, studentId, weekNo, rotationNo, score, note } = req.body || {};

    const w = toInt(weekNo, null);
    const rotBody = toInt(rotationNo, null);

    if (!periodId || !studentId || !w || !rotBody) {
      return res.status(400).json({ error: "Eksik parametre" });
    }

    const scoreVal = Number(score);
    if (!Number.isFinite(scoreVal)) return res.status(400).json({ error: "score sayısal olmalı" });

    const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
    if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });

    const ex = examInfo(period, w);
    if (ex) return res.status(400).json({ error: "Sınav haftasında puan girilemez" });

    const rotComputed = rotationByWeek(period, w);
    if (!rotComputed) return res.status(400).json({ error: "Bu hafta rotasyon haftası değil" });

    if (Number(rotBody) !== Number(rotComputed)) {
      return res.status(400).json({ error: "rotationNo bu haftanın rotasyonu ile uyuşmuyor" });
    }

    const snap = await prisma.periodReportSnapshot.findUnique({
      where: { periodId: String(periodId) },
    });
    if (!snap) return res.status(400).json({ error: "Snapshot yok" });

    if (scoreVal > Number(snap.totalPoints)) {
      return res.status(400).json({ error: `Toplam puan ${snap.totalPoints} üstüne çıkamaz` });
    }

    const item = await prisma.weeklyReportScore.upsert({
      where: {
        uniq_reportscore_week: {
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
        score: round2(scoreVal),
        status: "SUBMITTED",
        note: note !== undefined ? String(note || "") : null,
        gradedBy: String(req.user.teacherId),
      },
      update: {
        score: round2(scoreVal),
        note: note !== undefined ? String(note || "") : null,
        gradedBy: String(req.user.teacherId),
      },
    });

    return res.json({ ok: true, item });
  } catch (e) {
    console.error("PUT /teacher/report-scores/upsert error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Kaydedilemedi" });
  }
});

export default router;
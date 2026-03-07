import { Router } from "express";
import { prisma } from "../../prisma.js";

const router = Router();

/* ===============================
   GET visibility settings
================================ */
router.get("/report-visibility", async (req, res) => {
  const { periodId } = req.query;

  if (!periodId) {
    return res.status(400).json({ error: "periodId zorunlu" });
  }

  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: {
      weekSettings: {
        orderBy: { weekNo: "asc" },
      },
    },
  });

  res.json({
    ok: true,
    global: {
      showScores: period.studentCanSeeReportScores ?? false,
      showComments: period.studentCanSeeReportComments ?? true,
      showRevisionNotes: period.studentCanSeeRevisionNotes ?? true,
    },
    weeks: period.weekSettings || [],
  });
});

/* ===============================
   UPDATE global settings
================================ */

router.put("/report-visibility/global", async (req, res) => {
  const { periodId, showScores, showComments, showRevisionNotes } = req.body;

  await prisma.period.update({
    where: { id: periodId },
    data: {
      studentCanSeeReportScores: showScores,
      studentCanSeeReportComments: showComments,
      studentCanSeeRevisionNotes: showRevisionNotes,
    },
  });

  res.json({ ok: true });
});

/* ===============================
   UPDATE week override
================================ */

router.put("/report-visibility/week", async (req, res) => {
  const { periodId, weekNo, showScore, showComment, showRevision } = req.body;

  await prisma.weekSetting.upsert({
    where: {
      uniq_week_setting: {
        periodId,
        weekNo,
      },
    },
    create: {
      periodId,
      weekNo,
      studentCanSeeReportScore: showScore,
      studentCanSeeReportComment: showComment,
      studentCanSeeRevisionNote: showRevision,
    },
    update: {
      studentCanSeeReportScore: showScore,
      studentCanSeeReportComment: showComment,
      studentCanSeeRevisionNote: showRevision,
    },
  });

  res.json({ ok: true });
});

export default router;
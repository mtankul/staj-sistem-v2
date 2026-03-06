//periods.js

import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// GET /api/periods
router.get("/", async (req, res) => {
  const items = await prisma.period.findMany({
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

// POST /api/periods
router.post("/", async (req, res) => {
  const {
    academicYear,
    term, // GUZ | BAHAR | YAZ
    courseId,
    isActive = false,

    // ✅ exam weeks + total weeks
    totalWeeks,
    midtermWeek,
    finalWeek1,
    finalWeek2,

    // period settings
    reportWeight,
    evalWeight,
    practicePenaltyCoef,
    theoryPenaltyCoef,
    rot1Weight,
    rot2Weight,
    absTheoryMax,
    absPracticeMax,
    studentCanSeeReportScores,
    studentCanSeeReportWeekly,

    // ✅ practice/rotation + rules
    practiceDays,
    rotationCount,
    rot1StartWeek,
    rot1EndWeek,
    rot2StartWeek,
    rot2EndWeek,
    lotteryRules,
  } = req.body || {};

  if (!academicYear || !term || !courseId) {
    return res.status(400).json({ error: "academicYear, term, courseId zorunlu" });
  }

  if (isActive) {
    await prisma.period.updateMany({ where: { isActive: true }, data: { isActive: false } });
  }

  const created = await prisma.period.create({
    data: {
      academicYear: String(academicYear),
      term,
      courseId,
      isActive: !!isActive,

      ...(totalWeeks !== undefined ? { totalWeeks: Number(totalWeeks) } : {}),
      ...(midtermWeek !== undefined ? { midtermWeek: Number(midtermWeek) } : {}),
      ...(finalWeek1 !== undefined ? { finalWeek1: Number(finalWeek1) } : {}),
      ...(finalWeek2 !== undefined ? { finalWeek2: Number(finalWeek2) } : {}),

      ...(practiceDays !== undefined ? { practiceDays } : {}),
      ...(rotationCount !== undefined ? { rotationCount: Number(rotationCount) } : {}),
      ...(rot1StartWeek !== undefined ? { rot1StartWeek: Number(rot1StartWeek) } : {}),
      ...(rot1EndWeek !== undefined ? { rot1EndWeek: Number(rot1EndWeek) } : {}),
      ...(rot2StartWeek !== undefined ? { rot2StartWeek: Number(rot2StartWeek) } : {}),
      ...(rot2EndWeek !== undefined ? { rot2EndWeek: Number(rot2EndWeek) } : {}),
      ...(lotteryRules !== undefined ? { lotteryRules } : {}),

      ...(reportWeight !== undefined ? { reportWeight: Number(reportWeight) } : {}),
      ...(evalWeight !== undefined ? { evalWeight: Number(evalWeight) } : {}),
      ...(practicePenaltyCoef !== undefined ? { practicePenaltyCoef: Number(practicePenaltyCoef) } : {}),
      ...(theoryPenaltyCoef !== undefined ? { theoryPenaltyCoef: Number(theoryPenaltyCoef) } : {}),
      ...(rot1Weight !== undefined ? { rot1Weight: Number(rot1Weight) } : {}),
      ...(rot2Weight !== undefined ? { rot2Weight: Number(rot2Weight) } : {}),
      ...(absTheoryMax !== undefined ? { absTheoryMax: Number(absTheoryMax) } : {}),
      ...(absPracticeMax !== undefined ? { absPracticeMax: Number(absPracticeMax) } : {}),
      ...(studentCanSeeReportScores !== undefined ? { studentCanSeeReportScores: !!studentCanSeeReportScores } : {}),
      ...(studentCanSeeReportWeekly !== undefined ? { studentCanSeeReportWeekly: !!studentCanSeeReportWeekly } : {}),
    },
  });

  res.json(created);
});

// PUT /api/periods/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};

  if (patch.isActive === true) {
    await prisma.period.updateMany({ where: { isActive: true }, data: { isActive: false } });
  }

  const { courseId, ...rest } = patch;

  const data = {
    ...rest,
    ...(courseId ? { course: { connect: { id: String(courseId) } } } : {}),
  };

  const updated = await prisma.period.update({
    where: { id },
    data,
    include: { course: true },
  });

  res.json(updated);
});

// DELETE /api/periods/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.period.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
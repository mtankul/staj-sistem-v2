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

  if (!u.teacherId)
    return res.status(401).json({ error: "teacherId missing in token" });

  next();
}

/* ===============================
   GET REPORT DETAIL
================================ */

router.get("/report-detail", requireTeacher, async (req, res) => {
  try {
    const periodId = String(req.query.periodId || "");
    const studentId = String(req.query.studentId || "");
    const weekNo = Number(req.query.weekNo || 0);

    if (!periodId || !studentId || !weekNo) {
      return res.status(400).json({ error: "periodId, studentId, weekNo zorunlu" });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    const header = await prisma.weeklyReportScore.findFirst({
      where: {
        periodId,
        studentId,
        weekNo,
      },
    });

    const answers = await prisma.weeklyReportAnswer.findMany({
      where: {
        periodId,
        studentId,
        weekNo,
      },
      include: {
        question: true,
      },
      orderBy: {
        question: {
          orderNo: "asc",
        },
      },
    });

    return res.json({
      ok: true,
      student,
      header,
      answers,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "report-detail error" });
  }
});

export default router;
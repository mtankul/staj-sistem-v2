// server/src/routes/teacher/index.js
import { Router } from "express";

import panel from "./panel.js";              // /me, /students, /attendance...
import reports from "./reports.js";          // /reports, /eval, /eval-form...
import reportScores from "./reportScores.js"; // /report-scores/* (coordinator)

/**
 * CANONICAL: Teacher Router Aggregator
 * Location: server/src/routes/teacher/index.js
 *
 * Mounts:
 *  - panel.js        -> /api/teacher/*
 *  - reports.js      -> /api/teacher/*
 *  - reportScores.js -> /api/teacher/report-scores/*
 *
 * Notes:
 *  - This file does not define endpoints directly.
 *  - Swagger paths are generated from JSDoc blocks in mounted route files.
 */

/**
 * @openapi
 * tags:
 *   - name: Teacher
 *     description: Teacher panel endpoints (/api/teacher/*)
 *   - name: TeacherReports
 *     description: Teacher reports & evaluation endpoints (/api/teacher/*)
 *   - name: TeacherReportScores
 *     description: Coordinator report scoring endpoints (/api/teacher/report-scores/*)
 */

const router = Router();

router.use(panel);
router.use(reports);
router.use("/report-scores", reportScores);

export default router;